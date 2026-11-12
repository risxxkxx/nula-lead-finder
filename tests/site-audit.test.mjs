import {describe, it, expect, vi, afterEach} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHandler, parseRobotsSitemaps} from '../netlify/functions/site-audit.mjs';
import placesSearch, {filterByMode, mapPlace} from '../netlify/functions/places-search.mjs';
import {GuardError} from '../netlify/lib/ssrf.mjs';
import {parsePsiResponse} from '../netlify/lib/psi.mjs';

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const psiFixture = parsePsiResponse(JSON.parse(fixture('psi-response.fixture.json'))).psi;
const NOW = () => new Date('2026-11-12T12:00:00Z');

const post = (body, raw) => new Request('https://app.example/.netlify/functions/site-audit', {
  method:'POST', headers:{'Content-Type':'application/json'}, body:raw ?? JSON.stringify(body)
});

/** Fake fetchPage keyed by URL. */
function pages(map){
  const calls = [];
  const fn = vi.fn(async (url, opts) => {
    calls.push({url, accept:opts?.accept});
    const entry = map[url];
    if (!entry) throw new GuardError('network', 'Сајтот не може да се вчита.');
    if (entry instanceof Error) throw entry;
    return {status:200, finalUrl:url, redirects:[url], contentType:'text/html', body:null, bytes:0, truncated:false, ...entry};
  });
  fn.calls = calls;
  return fn;
}

describe('site-audit handler', () => {
  it('GET reports health and whether a PageSpeed key is configured', async () => {
    const handler = createHandler({env:() => ({PAGESPEED_API_KEY:'x'})});
    const res = await handler(new Request('https://app.example/x'));
    expect(await res.json()).toEqual({ok:true, function:'site-audit', pagespeedKey:true});
  });

  it('rejects other methods, bad JSON, oversized bodies and unsafe URLs', async () => {
    const handler = createHandler({fetchPage:pages({}), psiRunner:vi.fn()});
    expect((await handler(new Request('https://app.example/x', {method:'PUT'}))).status).toBe(405);
    expect((await handler(post(null, '{nope'))).status).toBe(400);
    expect((await handler(post({url:'https://a.example/' + 'x'.repeat(5000)}))).status).toBe(413);
    for (const url of ['http://127.0.0.1/', 'http://[::1]/', 'ftp://a.example/', 'https://u:p@a.example/', 'https://a.example:8080/', 42]){
      const res = await handler(post({url}));
      expect(res.status).toBe(400);
    }
  });

  it('audits a weak site, combines HTML findings, side checks and PSI', async () => {
    const fetchPage = pages({
      'https://oldsite.example/':{body:fixture('bad-site.html'), bytes:900},
      'http://oldsite.example/':{status:200},
      'https://oldsite.example/robots.txt':{status:404, contentType:'text/html', body:null},
      'https://oldsite.example/sitemap.xml':{status:404, contentType:'text/html', body:null}
    });
    const psiRunner = vi.fn(async () => ({psi:psiFixture, reason:null}));
    const handler = createHandler({fetchPage, psiRunner, env:() => ({PAGESPEED_API_KEY:'K'}), now:NOW});
    const res = await handler(post({url:'oldsite.example'}));
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(psiRunner).toHaveBeenCalledWith('https://oldsite.example/', {apiKey:'K'});
    expect(data.finalUrl).toBe('https://oldsite.example/');
    expect(data.psi.categories.performance).toBe(34);
    expect(data.psiReason).toBeNull();
    const ids = data.findings.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(['no_viewport', 'no_http_redirect', 'no_robots', 'no_sitemap', 'psi_performance', 'psi_lcp']));
    expect(data.score).toBeLessThan(50);
    expect(data.opportunity).toBe('Висока');
    expect(data.counts.critical).toBeGreaterThan(0);
    expect(data.facts.cms.name).toBe('WordPress');
  });

  it('returns HTML findings with psi: null and a reason when PSI fails', async () => {
    const fetchPage = pages({
      'https://good.example/':{body:fixture('good-site.html')},
      'http://good.example/':{finalUrl:'https://good.example/', redirects:['http://good.example/', 'https://good.example/']},
      'https://good.example/robots.txt':{contentType:'text/plain', body:'User-agent: *\nSitemap: https://good.example/sitemap_index.xml'},
      'https://good.example/sitemap_index.xml':{contentType:'application/xml', body:'<?xml version="1.0"?><sitemapindex/>'}
    });
    const handler = createHandler({fetchPage, psiRunner:async () => ({psi:null, reason:'PageSpeed не одговори навреме.'}), env:() => ({}), now:NOW});
    const data = await (await handler(post({url:'https://good.example/'}))).json();
    expect(data.psi).toBeNull();
    expect(data.psiReason).toBe('PageSpeed не одговори навреме.');
    expect(data.findings).toEqual([]);
    expect(data.score).toBe(100);
    expect(data.psiScore).toBeNull();
    expect(data.facts.sitemap).toMatchObject({reachable:true, path:'https://good.example/sitemap_index.xml'});
    expect(fetchPage.calls.map((c) => c.url)).toContain('https://good.example/sitemap_index.xml');
  });

  it('survives a throwing PSI runner', async () => {
    const fetchPage = pages({'https://good.example/':{body:fixture('good-site.html')}});
    const handler = createHandler({fetchPage, psiRunner:async () => { throw new Error('x'); }, env:() => ({}), now:NOW});
    const data = await (await handler(post({url:'https://good.example/'}))).json();
    expect(data.psi).toBeNull();
    expect(data.psiReason).toMatch(/PageSpeed/);
  });

  it('treats unreachable side checks as unknown (no robots/sitemap finding)', async () => {
    const fetchPage = pages({'https://good.example/':{body:fixture('good-site.html')}});
    const handler = createHandler({fetchPage, psiRunner:async () => ({psi:null, reason:'x'}), env:() => ({}), now:NOW});
    const data = await (await handler(post({url:'https://good.example/'}))).json();
    expect(data.findings.map((f) => f.id)).not.toContain('no_robots');
    expect(data.facts.robots).toBeNull();
  });

  it('maps guard errors from the page fetch to safe HTTP errors', async () => {
    const cases = [
      [new GuardError('private_address', 'Доменот покажува кон приватна или локална адреса.'), 400],
      [new GuardError('timeout', 'Сајтот не одговори навреме.'), 504],
      [new GuardError('too_many_redirects', 'Повеќе од 5 пренасочувања.'), 422],
      [new Error('internal detail 10.0.0.1'), 502]
    ];
    for (const [error, status] of cases){
      const handler = createHandler({fetchPage:pages({'https://x.example/':error}), psiRunner:async () => ({psi:null, reason:'x'})});
      const res = await handler(post({url:'https://x.example/'}));
      expect(res.status).toBe(status);
      expect(JSON.stringify(await res.json())).not.toContain('10.0.0.1');
    }
  });

  it('rejects non-HTML and error-status pages', async () => {
    let handler = createHandler({fetchPage:pages({'https://x.example/':{skipped:'content-type', contentType:'application/pdf'}}), psiRunner:async () => ({psi:null})});
    expect((await handler(post({url:'https://x.example/'}))).status).toBe(422);
    handler = createHandler({fetchPage:pages({'https://x.example/':{status:403, body:'<html></html>'}}), psiRunner:async () => ({psi:null})});
    const data = await (await handler(post({url:'https://x.example/'}))).json();
    expect(data.error).toMatch(/403/);
  });

  it('can skip PageSpeed on request', async () => {
    const psiRunner = vi.fn();
    const handler = createHandler({fetchPage:pages({'https://good.example/':{body:'<title>x</title>'}}), psiRunner, now:NOW});
    const data = await (await handler(post({url:'https://good.example/', pagespeed:false}))).json();
    expect(psiRunner).not.toHaveBeenCalled();
    expect(data.psi).toBeNull();
  });

  it('parses Sitemap lines from robots.txt', () => {
    expect(parseRobotsSitemaps('User-agent: *\nsitemap: https://a.example/s.xml\nSitemap: /relative.xml\n')).toEqual(['https://a.example/s.xml']);
  });
});

describe('places-search handler', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const places = [
    {id:'1', displayName:{text:'Без сајт'}, formattedAddress:'Скопје', nationalPhoneNumber:'070 000 000', googleMapsUri:'https://maps.google.com/?cid=1', rating:4.6, userRatingCount:87},
    {id:'2', displayName:{text:'Со сајт'}, websiteUri:'https://so-sajt.example/', rating:3.9, userRatingCount:12},
    {id:'3', displayName:{text:'Лош линк'}, websiteUri:'javascript:alert(1)'}
  ];

  const request = (body) => new Request('https://app.example/.netlify/functions/places-search', {method:'POST', body:JSON.stringify(body)});

  it('filters by mode server-side and maps rating/website fields', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'PLACES_KEY');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({places})));
    vi.stubGlobal('fetch', fetchMock);

    const noSite = await (await placesSearch(request({category:'кафуле', city:'Скопје'}))).json();
    expect(noSite.mode).toBe('no_website');
    expect(noSite.results.map((r) => r.placeId)).toEqual(['1']);
    expect(noSite.results[0]).toMatchObject({rating:4.6, userRatingCount:87, websiteUri:''});

    const withSite = await (await placesSearch(request({category:'кафуле', city:'Скопје', mode:'with_website'}))).json();
    expect(withSite.results.map((r) => r.placeId)).toEqual(['2', '3']);
    expect(withSite.results[1].websiteUri).toBe('');
    expect(withSite).toMatchObject({totalFound:3, withoutWebsite:1, withWebsite:2});

    const all = await (await placesSearch(request({category:'кафуле', city:'Скопје', mode:'all'}))).json();
    expect(all.results).toHaveLength(3);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['X-Goog-FieldMask']).toContain('places.rating');
    expect(init.headers['X-Goog-FieldMask']).toContain('places.userRatingCount');
    expect(init.headers['X-Goog-FieldMask']).toContain('places.websiteUri');
  });

  it('falls back to the default mode for unknown values and validates input', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'PLACES_KEY');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({places}))));
    const data = await (await placesSearch(request({category:'x', city:'y', mode:'drop table'}))).json();
    expect(data.mode).toBe('no_website');
    expect((await placesSearch(request({category:'', city:'y'}))).status).toBe(400);
    expect((await placesSearch(request({category:'x', city:'y', includedType:'bad type!'}))).status).toBe(400);
  });

  it('reports a missing key clearly', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', '');
    const res = await placesSearch(request({category:'x', city:'y'}));
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe('missing_key');
  });

  it('pure helpers', () => {
    expect(filterByMode(places, 'with_website')).toHaveLength(2);
    expect(mapPlace({id:'z'})).toMatchObject({name:'Без име', rating:null, userRatingCount:null});
  });
});
