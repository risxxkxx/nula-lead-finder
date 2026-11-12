// Small helpers shared by the Netlify Functions.

export function json(body, status = 200){
  return new Response(JSON.stringify(body), {
    status,
    headers:{
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff'
    }
  });
}

export function cleanText(value, maxLength){
  return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, maxLength);
}

/** Read a JSON body with a hard size limit. Returns {ok, body} or {ok:false, response}. */
export async function readJsonBody(request, maxBytes){
  let text;
  try {
    text = await request.text();
  } catch (_) {
    return {ok:false, response:json({error:'Невалидно барање.'}, 400)};
  }
  if (new TextEncoder().encode(text).length > maxBytes){
    return {ok:false, response:json({error:'Барањето е преголемо.'}, 413)};
  }
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
    return {ok:true, body};
  } catch (_) {
    return {ok:false, response:json({error:'Невалидно барање.'}, 400)};
  }
}
