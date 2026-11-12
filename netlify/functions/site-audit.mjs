import {safeFetch, normaliseTargetUrl, GuardError} from '../lib/ssrf.mjs';
import {analyzeHtml, buildFindings, computeScore, summarise} from '../lib/audit.mjs';
import {runPsi} from '../lib/psi.mjs';
import {json, readJsonBody} from '../lib/http.mjs';

const MAX_BODY_BYTES = 4096;
const SIDE_FETCH = {timeoutMs:5000, maxBytes:64 * 1024};

const GUARD_STATUS = {
  invalid_url:400, url_too_long:400, invalid_scheme:400, credentials:400, port:400,
  private_address:400, invalid_redirect:422, too_many_redirects:422, dns:422, timeout:504, network:502
};

async function checkHttpRedirect(page, fetchPage){
  const first = new URL(page.redirects[0]);
  const final = new URL(page.finalUrl);
  if (final.protocol !== 'https:') return null;
  if (first.protocol === 'http:') {
    return {checked:true, redirectsToHttps:true, evidence:`${first.href} → ${final.href}`};
  }
  const httpUrl = `http://${final.host}/`;
  try {
    const result = await fetchPage(httpUrl, {accept:'none', ...SIDE_FETCH});
    const redirectsToHttps = new URL(result.finalUrl).protocol === 'https:';
    return {
      checked:true,
      redirectsToHttps,
      evidence:redirectsToHttps ? `${httpUrl} → ${result.finalUrl}` : `${httpUrl} → статус ${result.status}, без пренасочување кон https`
    };
  } catch (_) {
    // Port 80 closed or unreachable: nothing insecure is served, so no finding.
    return {checked:false, redirectsToHttps:null, evidence:null};
  }
}

export function parseRobotsSitemaps(text){
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*sitemap\s*:\s*(\S+)/i))
    .filter(Boolean)
    .map((match) => match[1])
    .filter((url) => /^https?:\/\//i.test(url))
    .slice(0, 3);
}

async function checkRobotsAndSitemap(origin, fetchPage){
  let robots = null;
  let declared = [];
  try {
    const result = await fetchPage(`${origin}/robots.txt`, {accept:'text', ...SIDE_FETCH});
    const isHtml = /text\/html/i.test(result.contentType || '');
    const reachable = result.status === 200 && result.body !== null && !isHtml;
    robots = {reachable, status:result.status === 200 && isHtml ? '200 (HTML наместо текст)' : result.status};
    if (reachable) declared = parseRobotsSitemaps(result.body);
  } catch (_) {
    robots = null;
  }

  const sitemapUrl = declared[0] || `${origin}/sitemap.xml`;
  let sitemap = null;
  try {
    const result = await fetchPage(sitemapUrl, {accept:'text', ...SIDE_FETCH});
    const body = (result.body || '').trimStart().slice(0, 300);
    const looksXml = /xml/i.test(result.contentType || '') || /^(<\?xml|<urlset|<sitemapindex)/i.test(body);
    const reachable = result.status === 200 && looksXml && !/text\/html/i.test(result.contentType || '');
    sitemap = {reachable, status:result.status, path:declared[0] ? sitemapUrl : '/sitemap.xml'};
  } catch (_) {
    sitemap = null;
  }
  return {robots, sitemap};
}

export function createHandler({
  fetchPage = safeFetch,
  psiRunner = runPsi,
  env = () => process.env,
  now = () => new Date()
} = {}){
  return async (request) => {
    if (request.method === 'GET') {
      return json({ok:true, function:'site-audit', pagespeedKey:Boolean(env().PAGESPEED_API_KEY)});
    }
    if (request.method !== 'POST') return json({error:'Дозволени се GET и POST повици.'}, 405);

    const parsed = await readJsonBody(request, MAX_BODY_BYTES);
    if (!parsed.ok) return parsed.response;

    let target;
    try {
      target = normaliseTargetUrl(parsed.body.url);
    } catch (error){
      if (error instanceof GuardError) return json({error:error.message, code:error.code}, 400);
      return json({error:'Невалиден URL.'}, 400);
    }

    const runPagespeed = parsed.body.pagespeed !== false;
    const psiPromise = runPagespeed
      ? psiRunner(target.href, {apiKey:env().PAGESPEED_API_KEY || ''}).catch(() => ({psi:null, reason:'Неуспешно поврзување со PageSpeed.'}))
      : Promise.resolve({psi:null, reason:'PageSpeed проверката е исклучена за ова барање.'});

    let page;
    try {
      page = await fetchPage(target.href, {accept:'html'});
    } catch (error){
      if (error instanceof GuardError) return json({error:error.message, code:error.code}, GUARD_STATUS[error.code] || 502);
      return json({error:'Сајтот не може да се вчита.', code:'network'}, 502);
    }

    if (page.skipped === 'content-type' || page.body === null){
      return json({error:'Адресата не враќа HTML страница.', code:'not_html', finalUrl:page.finalUrl}, 422);
    }
    if (page.status >= 400){
      const hint = page.status === 403 || page.status === 429 ? ' Сајтот можеби блокира автоматски проверки.' : '';
      return json({error:`Сајтот врати статус ${page.status}.${hint}`, code:'http_status', status:page.status, finalUrl:page.finalUrl}, 422);
    }

    const origin = new URL(page.finalUrl).origin;
    const [httpRedirect, sideChecks, psiResult] = await Promise.all([
      checkHttpRedirect(page, fetchPage),
      checkRobotsAndSitemap(origin, fetchPage),
      psiPromise
    ]);

    const checkedAt = now();
    const facts = analyzeHtml(page.body, {finalUrl:page.finalUrl, byteLength:page.bytes, truncated:page.truncated, now:checkedAt});
    const findings = buildFindings(facts, {httpRedirect, robots:sideChecks.robots, sitemap:sideChecks.sitemap, psi:psiResult.psi});
    const scoring = computeScore(findings, psiResult.psi);

    return json({
      url:target.href,
      finalUrl:page.finalUrl,
      redirects:page.redirects,
      checkedAt:checkedAt.toISOString(),
      ...scoring,
      counts:summarise(findings),
      findings,
      facts:{
        isHttps:facts.isHttps,
        title:facts.title,
        metaDescription:facts.metaDescription,
        h1Count:facts.h1Count,
        lang:facts.lang,
        images:facts.images,
        htmlBytes:facts.htmlBytes,
        truncated:facts.truncated,
        copyright:facts.copyright,
        cms:facts.cms,
        structuredDataTypes:facts.structuredData.types,
        httpRedirect,
        robots:sideChecks.robots,
        sitemap:sideChecks.sitemap
      },
      psi:psiResult.psi,
      psiReason:psiResult.reason
    });
  };
}

export default createHandler();

export const config = {
  path: '/.netlify/functions/site-audit',
  rateLimit: {
    windowLimit: 10,
    windowSize: 60,
    aggregateBy: ['ip', 'domain']
  }
};
