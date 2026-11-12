import {describe, it, expect, vi} from 'vitest';
import {composeAuditMessage, topFindings} from '../netlify/lib/message-composer.mjs';
import {
  createHandler, validateInput, findUnsupportedNumbers, parseModelOutput, buildPromptData,
  SYSTEM_PROMPT, DEFAULT_MODEL, ANTHROPIC_URL
} from '../netlify/functions/generate-message.mjs';

const findings = [
  {id:'no_lang', severity:'minor', title:'Не е означен јазикот на страницата', explanation:'...', evidence:'Нема lang атрибут на <html>', source:'html'},
  {id:'psi_performance', severity:'critical', title:'Сајтот е бавен на мобилен телефон', explanation:'...', evidence:'Performance 34/100 (PageSpeed, мобилен)', source:'psi'},
  {id:'no_tel_link', severity:'important', title:'Нема копче за директен повик', explanation:'...', evidence:'Не е пронајден tel: линк', source:'html'},
  {id:'outdated_copyright', severity:'important', title:'Сајтот изгледа неажуриран', explanation:'...', evidence:'„© 2016“', source:'html'},
  {id:'no_viewport', severity:'critical', title:'Сајтот не е поставен за мобилни екрани', explanation:'...', evidence:'Нема <meta name="viewport"> ознака', source:'html'}
];
const business = {name:'Кафе Тест', website:'https://www.kafe-test.example/', category:'кафуле', city:'Скопје', rating:4.4, userRatingCount:120};
const base = {business, findings, offerText:'професионална веб-страница со мени и резервации', tone:'warm', channel:'email', referenceLink:'https://agencynula.com/'};

describe('template composer', () => {
  it('picks the top 3 findings by severity', () => {
    expect(topFindings(findings).map((f) => f.id)).toEqual(['psi_performance', 'no_viewport', 'no_tel_link']);
  });

  it('builds an email with subject, max 3 problems, one CTA and the NULA signature', () => {
    const {subject, body} = composeAuditMessage(base);
    expect(subject).toBe('Неколку конкретни подобрувања за сајтот на Кафе Тест');
    expect(body.startsWith('Здраво,')).toBe(true);
    expect(body.match(/^• /gm)).toHaveLength(3);
    expect(body).toContain('Сајтот е бавен на мобилен телефон — Performance 34/100 (PageSpeed, мобилен)');
    expect(body).not.toContain('<meta');
    expect(body).not.toContain('Не е означен јазикот');
    expect(body).toContain('kafe-test.example');
    expect(body).toContain('професионална веб-страница со мени и резервации');
    expect(body.trim().endsWith('NULA Studio')).toBe(true);
    expect((body.match(/одговорете на оваа порака/g) || [])).toHaveLength(1);
  });

  it('uses the formal greeting and closing for the professional tone', () => {
    const {body} = composeAuditMessage({...base, tone:'professional'});
    expect(body.startsWith('Почитувани,')).toBe(true);
    expect(body).toContain('Со почит,\nNULA Studio');
  });

  it('Instagram DM has no subject', () => {
    const {subject, body} = composeAuditMessage({...base, channel:'instagram'});
    expect(subject).toBeNull();
    expect(body).toContain('— NULA Studio');
  });

  it('Viber message is a single short paragraph', () => {
    const {subject, body} = composeAuditMessage({...base, channel:'viber'});
    expect(subject).toBeNull();
    expect(body).not.toContain('\n');
    expect(body).toContain('сајтот е бавен на мобилен телефон; сајтот не е поставен за мобилни екрани; нема копче за директен повик');
  });

  it('handles no findings and missing data gracefully', () => {
    const {subject, body} = composeAuditMessage({business:{}, findings:[], channel:'email'});
    expect(subject).toBe('Предлог за сајтот на вашиот бизнис');
    expect(body).not.toContain('•');
    expect(body).toContain('NULA Studio');
  });

  it('is deterministic', () => {
    expect(composeAuditMessage(base)).toEqual(composeAuditMessage(base));
  });
});

describe('input validation and output guards', () => {
  it('requires a name and findings array, caps lengths, normalises enums', () => {
    expect(validateInput({business:{}, findings:[]}).ok).toBe(false);
    expect(validateInput({business:{name:'x'}}).ok).toBe(false);
    const {input} = validateInput({
      business:{name:'x'.repeat(500), website:'javascript:alert(1)', rating:9},
      findings:[{id:'a b<c', severity:'evil', title:'t'.repeat(500), source:'?'}, {title:''}],
      tone:'rude', channel:'fax', referenceLink:'ftp://x', offer:{text:'o'.repeat(900)}
    });
    expect(input.business.name).toHaveLength(120);
    expect(input.business.website).toBe('');
    expect(input.business.rating).toBeNull();
    expect(input.findings).toHaveLength(1);
    expect(input.findings[0]).toMatchObject({id:'abc', severity:'minor', source:'html'});
    expect(input.findings[0].title).toHaveLength(160);
    expect(input.tone).toBe('warm');
    expect(input.channel).toBe('email');
    expect(input.referenceLink).toBe('https://agencynula.com/');
    expect(input.offerText).toHaveLength(300);
  });

  it('flags numbers that are not in the sent data', () => {
    const data = buildPromptData(validateInput(base).input);
    expect(findUnsupportedNumbers('Performance 34/100, оцена 4.4', data)).toEqual([]);
    expect(findUnsupportedNumbers('Губите 40% од клиентите', data)).toEqual(['40']);
    expect(findUnsupportedNumbers('3 работи', data)).toEqual([]);
  });

  it('parses JSON output, also inside code fences', () => {
    expect(parseModelOutput('```json\n{"subject":"S","body":"B"}\n```')).toEqual({subject:'S', body:'B'});
    expect(parseModelOutput('{"subject":null,"body":"  "}')).toBeNull();
    expect(parseModelOutput('not json')).toBeNull();
  });

  it('the system prompt carries the required rules', () => {
    for (const rule of ['ONLY the findings', 'at most 3 problems', 'No promises', 'exactly one clear call to action', 'NULA Studio', 'untrusted']){
      expect(SYSTEM_PROMPT).toContain(rule);
    }
  });
});

describe('generate-message handler', () => {
  const post = (body) => new Request('https://app.example/.netlify/functions/generate-message', {method:'POST', body:JSON.stringify(body)});
  const anthropicReply = (text, status = 200) => new Response(JSON.stringify({
    id:'msg_test', type:'message', role:'assistant', content:[{type:'text', text}], stop_reason:'end_turn'
  }), {status, headers:{'content-type':'application/json'}});

  it('GET reports whether AI is configured', async () => {
    const res = await createHandler({env:() => ({})})(new Request('https://app.example/x'));
    expect(await res.json()).toEqual({ok:true, function:'generate-message', ai:false});
  });

  it('falls back to the template when no key is set', async () => {
    const fetchImpl = vi.fn();
    const data = await (await createHandler({env:() => ({}), fetchImpl})(post(base))).json();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(data.source).toBe('template');
    expect(data.notice).toMatch(/ANTHROPIC_API_KEY/);
    expect(data.body).toContain('NULA Studio');
  });

  it('calls the Messages API with the documented request format', async () => {
    const fetchImpl = vi.fn(async () => anthropicReply(JSON.stringify({subject:'Сајтот на Кафе Тест', body:'Здраво,\nPerformance 34/100.\nNULA Studio'})));
    const handler = createHandler({env:() => ({ANTHROPIC_API_KEY:'sk-test-SECRET'}), fetchImpl});
    const data = await (await handler(post(base))).json();

    expect(data).toMatchObject({source:'ai', model:DEFAULT_MODEL, subject:'Сајтот на Кафе Тест', notice:null});
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(ANTHROPIC_URL);
    expect(init.method).toBe('POST');
    expect(init.headers['x-api-key']).toBe('sk-test-SECRET');
    expect(init.headers['anthropic-version']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const sent = JSON.parse(init.body);
    expect(sent).toMatchObject({model:DEFAULT_MODEL, max_tokens:1024, system:SYSTEM_PROMPT});
    expect(sent.messages).toHaveLength(1);
    expect(sent.messages[0].role).toBe('user');
    const promptData = JSON.parse(sent.messages[0].content.replace(/^Data \(JSON\):\n/, ''));
    expect(promptData.findings).toHaveLength(3);
    expect(sent).not.toHaveProperty('temperature');
  });

  it('uses ANTHROPIC_MODEL when set and drops the subject for non-email channels', async () => {
    const fetchImpl = vi.fn(async () => anthropicReply('{"subject":"x","body":"Здраво! NULA Studio"}'));
    const handler = createHandler({env:() => ({ANTHROPIC_API_KEY:'k', ANTHROPIC_MODEL:'claude-haiku-5-5'}), fetchImpl});
    const data = await (await handler(post({...base, channel:'viber'}))).json();
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).model).toBe('claude-haiku-5-5');
    expect(data.subject).toBeNull();
  });

  it('rejects AI output with invented numbers and uses the template', async () => {
    const fetchImpl = vi.fn(async () => anthropicReply('{"subject":"x","body":"Губите 70% од посетителите. NULA Studio"}'));
    const data = await (await createHandler({env:() => ({ANTHROPIC_API_KEY:'k'}), fetchImpl})(post(base))).json();
    expect(data.source).toBe('template');
    expect(data.notice).toMatch(/бројки/);
  });

  it('falls back on API errors without leaking the key or upstream message', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({type:'error', error:{type:'authentication_error', message:'invalid x-api-key sk-test-SECRET'}}), {status:401}));
    const res = await createHandler({env:() => ({ANTHROPIC_API_KEY:'sk-test-SECRET'}), fetchImpl})(post(base));
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).not.toContain('sk-test-SECRET');
    expect(text).not.toContain('authentication_error');
    expect(JSON.parse(text)).toMatchObject({source:'template', notice:expect.stringContaining('401')});
  });

  it('falls back on network errors and malformed output', async () => {
    let handler = createHandler({env:() => ({ANTHROPIC_API_KEY:'k'}), fetchImpl:async () => { throw new Error('ECONNRESET'); }});
    expect((await (await handler(post(base))).json()).source).toBe('template');
    handler = createHandler({env:() => ({ANTHROPIC_API_KEY:'k'}), fetchImpl:async () => anthropicReply('Здраво без JSON')});
    expect((await (await handler(post(base))).json()).notice).toMatch(/формат/);
  });

  it('validates requests', async () => {
    const handler = createHandler({env:() => ({})});
    expect((await handler(post({findings:[]}))).status).toBe(400);
    expect((await handler(new Request('https://app.example/x', {method:'POST', body:'x'.repeat(20000)}))).status).toBe(413);
    expect((await handler(new Request('https://app.example/x', {method:'DELETE'}))).status).toBe(405);
  });
});
