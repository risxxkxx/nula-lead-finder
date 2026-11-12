// Deterministic outreach composer for leads that HAVE a website (audit-based).
// Pure module: used as the fallback when no ANTHROPIC_API_KEY is configured or
// when the AI call fails/returns something that does not pass validation.
// The original no-website message generator in app.js is unchanged.

export const TONES = ['warm', 'professional', 'short'];
export const CHANNELS = ['email', 'instagram', 'viber'];
export const SEVERITY_RANK = {critical:0, important:1, minor:2};
export const MAX_PROBLEMS = 3;
export const SIGNATURE = 'NULA Studio';

export function topFindings(findings, limit = MAX_PROBLEMS){
  return [...(Array.isArray(findings) ? findings : [])]
    .filter((f) => f && typeof f.title === 'string' && f.title.trim())
    .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3))
    .slice(0, limit);
}

/** Evidence is quoted only when it is a short, non-technical measured value. */
function evidenceSuffix(finding){
  const evidence = String(finding.evidence || '').trim();
  if (!evidence || evidence.length > 60 || /[<>]/.test(evidence)) return '';
  if (finding.source === 'psi' || /^(LCP|CLS|TBT|INP|HTML:|„©|„\(c\)|„Copyright)/i.test(evidence) || /\d+ од \d+ слики/.test(evidence)){
    return ` — ${evidence}`;
  }
  return '';
}

function lowerFirst(text){
  return text ? text.charAt(0).toLocaleLowerCase('mk') + text.slice(1) : text;
}

function domainOf(website){
  try { return new URL(website).hostname.replace(/^www\./, ''); } catch (_) { return ''; }
}

/**
 * @param {{business:{name?:string, website?:string}, findings:object[], offerText?:string,
 *          tone?:string, channel?:string, referenceLink?:string}} input
 * @returns {{subject:string|null, body:string}}
 */
export function composeAuditMessage(input){
  const business = input.business || {};
  const name = String(business.name || '').trim() || 'вашиот бизнис';
  const domain = domainOf(business.website);
  const tone = TONES.includes(input.tone) ? input.tone : 'warm';
  const channel = CHANNELS.includes(input.channel) ? input.channel : 'email';
  const offer = String(input.offerText || '').trim() || 'изработка и редизајн на веб-страници';
  const ref = String(input.referenceLink || '').trim() || 'https://agencynula.com/';
  const problems = topFindings(input.findings);
  const site = domain ? `сајтот на ${name} (${domain})` : `сајтот на ${name}`;

  if (channel === 'viber' || (tone === 'short' && channel !== 'email')){
    const list = problems.map((f) => lowerFirst(f.title)).join('; ');
    const body = problems.length
      ? `Здраво! Од ${SIGNATURE} сме. Го погледнавме ${site} и забележавме: ${list}. Можеме да помогнеме со ${offer}. Ако сакате, ќе ви пратиме краток предлог. Референци: ${ref}`
      : `Здраво! Од ${SIGNATURE} сме. Го погледнавме ${site}. Можеме да помогнеме со ${offer}. Ако сакате, ќе ви пратиме краток предлог. Референци: ${ref}`;
    return {subject:null, body};
  }

  const greeting = tone === 'professional' ? 'Почитувани,' : 'Здраво,';
  const bullets = problems.map((f) => `• ${f.title}${evidenceSuffix(f)}`).join('\n');
  const intro = problems.length
    ? (tone === 'professional'
      ? `Го разгледавме ${site} и забележавме неколку работи што може да се подобрат:`
      : `Го погледнавме ${site} и забележавме неколку работи што лесно може да се подобрат:`)
    : `Го разгледавме ${site}.`;
  const offerLine = `Ние во ${SIGNATURE} изработуваме ${offer} и можеме да помогнеме со овие подобрувања.`;
  const cta = tone === 'professional'
    ? 'Доколку сте заинтересирани, одговорете на оваа порака и ќе Ви испратиме краток предлог со конкретни чекори.'
    : 'Ако ви е интересно, одговорете на оваа порака и ќе ви испратиме краток предлог со конкретни чекори.';
  const closing = tone === 'professional' ? `Со почит,\n${SIGNATURE}` : `Поздрав,\n${SIGNATURE}`;

  const parts = [greeting, problems.length ? `${intro}\n\n${bullets}` : intro, offerLine];
  if (channel === 'email' && tone !== 'short') parts.push(cta, `Дел од нашите референци: ${ref}`, closing);
  else parts.push(cta, `Референци: ${ref}`, `— ${SIGNATURE}`);

  const body = parts.join('\n\n');
  const subject = channel === 'email'
    ? (problems.length ? `Неколку конкретни подобрувања за сајтот на ${name}` : `Предлог за сајтот на ${name}`)
    : null;
  return {subject, body};
}
