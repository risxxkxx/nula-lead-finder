const ALLOWED_MAX_RESULTS = new Set([10, 20]);
const SEARCH_MODES = new Set(['no_website', 'with_website', 'all']);
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.googleMapsUri',
  'places.primaryType',
  'places.rating',
  'places.userRatingCount'
].join(',');

function json(body, status = 200){
  return new Response(JSON.stringify(body), {
    status,
    headers:{
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'no-store'
    }
  });
}

function cleanText(value, maxLength){
  return String(value || '').trim().slice(0, maxLength);
}

export function normaliseMode(value){
  return SEARCH_MODES.has(value) ? value : 'no_website';
}

export function filterByMode(places, mode){
  if (mode === 'with_website') return places.filter((place) => Boolean(place.websiteUri));
  if (mode === 'all') return places;
  return places.filter((place) => !place.websiteUri);
}

function safeWebsite(value){
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href.slice(0, 2048) : '';
  } catch (_) {
    return '';
  }
}

export function mapPlace(place){
  const rating = Number(place.rating);
  const count = Number(place.userRatingCount);
  return {
    placeId:place.id || '',
    name:place.displayName?.text || 'Без име',
    phone:place.nationalPhoneNumber || place.internationalPhoneNumber || '',
    address:place.formattedAddress || '',
    mapsUri:place.googleMapsUri || '',
    primaryType:place.primaryType || '',
    websiteUri:safeWebsite(place.websiteUri),
    rating:Number.isFinite(rating) && rating > 0 ? rating : null,
    userRatingCount:Number.isFinite(count) && count > 0 ? Math.round(count) : null
  };
}

export default async (request) => {
  if (request.method === 'GET') {
    return json({ok:true, function:'places-search'});
  }
  if (request.method !== 'POST') return json({error:'Дозволени се GET и POST повици.'}, 405);

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey){
    return json({error:'Недостасува GOOGLE_PLACES_API_KEY во Netlify Environment Variables.', code:'missing_key'}, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({error:'Невалидно барање.'}, 400);
  }
  if (!body || typeof body !== 'object') return json({error:'Невалидно барање.'}, 400);

  const category = cleanText(body.category, 80);
  const city = cleanText(body.city, 80);
  const includedType = cleanText(body.includedType, 60);
  const requestedMax = Number(body.maxResults);
  const maxResults = ALLOWED_MAX_RESULTS.has(requestedMax) ? requestedMax : 20;
  const mode = normaliseMode(body.mode);

  if (!category || !city){
    return json({error:'Категоријата и градот се задолжителни.'}, 400);
  }
  if (includedType && !/^[a-z_]+$/.test(includedType)){
    return json({error:'Невалиден тип на бизнис.'}, 400);
  }

  const requestBody = {
    textQuery:`${category} во ${city}, Северна Македонија`,
    languageCode:'mk',
    regionCode:'MK',
    pageSize:maxResults
  };
  if (includedType) requestBody.includedType = includedType;

  try {
    const googleResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'X-Goog-Api-Key':apiKey,
        'X-Goog-FieldMask':FIELD_MASK
      },
      body:JSON.stringify(requestBody)
    });

    const payload = await googleResponse.json().catch(() => ({}));
    if (!googleResponse.ok){
      const googleMessage = payload?.error?.message || `Google Places грешка (${googleResponse.status})`;
      return json({error:googleMessage}, googleResponse.status);
    }

    const places = Array.isArray(payload.places) ? payload.places : [];
    const withoutWebsite = places.filter((place) => !place.websiteUri).length;
    const results = filterByMode(places, mode).map(mapPlace);

    return json({
      mode,
      totalFound:places.length,
      withoutWebsite,
      withWebsite:places.length - withoutWebsite,
      results
    });
  } catch (error){
    return json({error:`Неуспешно поврзување со Google Places: ${error.message}`}, 502);
  }
};


export const config = {
  path: '/.netlify/functions/places-search',
  rateLimit: {
    windowLimit: 20,
    windowSize: 60,
    aggregateBy: ['ip', 'domain']
  }
};
