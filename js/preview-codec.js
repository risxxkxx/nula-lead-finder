// Encode/decode + sanitise the data behind preview.html links.
// Shared by the main app (encode) and preview.js (decode); pure and testable.
// The link carries everything (base64url JSON in ?c=), nothing is stored server-side.

export const TEMPLATES = ['food', 'auto', 'beauty', 'generic'];
export const PREVIEW_LIMITS = {name:80, category:60, city:60, address:160, phone:30, encoded:2000};
export const DEFAULT_ACCENTS = {food:'#c2410c', auto:'#f59e0b', beauty:'#be185d', generic:'#2563eb'};

const TYPE_GROUPS = {
  food:['restaurant', 'cafe', 'bakery', 'bar', 'meal_takeaway', 'meal_delivery', 'coffee_shop', 'pizza_restaurant', 'fast_food_restaurant', 'ice_cream_shop', 'night_club'],
  auto:['car_repair', 'car_wash', 'car_dealer', 'car_rental', 'gas_station', 'auto_parts_store', 'tire_shop'],
  beauty:['beauty_salon', 'hair_care', 'hair_salon', 'spa', 'nail_salon', 'barber_shop', 'dentist', 'doctor', 'physiotherapist', 'pharmacy', 'gym', 'optician', 'hospital', 'veterinary_care', 'skin_care_clinic']
};
const KEYWORD_GROUPS = {
  food:/ресторан|кафе|кафуле|пекар|бар\b|пица|скара|слатк|бистро|restaurant|cafe|coffee|bakery|pizza/i,
  auto:/авто|возил|вулканиз|гуми|перална|rent a car|механ|car\b|auto/i,
  beauty:/салон|фризер|козмет|убавин|спа|нокти|забн|стомат|ординац|физиотер|аптека|фитнес|теретана|оптика|клиника|beauty|salon|spa|dental|gym/i
};

// Control characters, bidi overrides and isolates are removed from every field.
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g;

export function cleanField(value, max){
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const text = String(value).replace(UNSAFE_CHARS, ' ').replace(/\s+/g, ' ').trim();
  return Array.from(text).slice(0, max).join('').trim();
}

export function cleanPhone(value){
  const text = cleanField(value, PREVIEW_LIMITS.phone).replace(/[^\d+()/\s-]/g, '').trim();
  const digits = text.replace(/\D/g, '');
  return digits.length >= 6 && digits.length <= 15 ? text : '';
}

export function templateFor(type, category){
  const t = String(type || '').toLowerCase();
  for (const [group, types] of Object.entries(TYPE_GROUPS)) if (types.includes(t)) return group;
  const text = `${category || ''} ${t}`;
  for (const [group, re] of Object.entries(KEYWORD_GROUPS)) if (re.test(text)) return group;
  return 'generic';
}

export function sanitizePreviewData(raw){
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const name = cleanField(raw.name, PREVIEW_LIMITS.name);
  if (!name) return null;
  const category = cleanField(raw.category, PREVIEW_LIMITS.category);
  const template = TEMPLATES.includes(raw.template) ? raw.template : templateFor('', category);
  const ratingNum = Number(raw.rating);
  const rating = Number.isFinite(ratingNum) && ratingNum >= 1 && ratingNum <= 5 ? Math.round(ratingNum * 10) / 10 : null;
  const countNum = Number(raw.reviewCount);
  const reviewCount = rating !== null && Number.isInteger(countNum) && countNum > 0 && countNum <= 1000000 ? countNum : null;
  const accent = typeof raw.accent === 'string' && /^#[0-9a-f]{6}$/i.test(raw.accent) ? raw.accent.toLowerCase() : DEFAULT_ACCENTS[template];
  return {
    name,
    category,
    city:cleanField(raw.city, PREVIEW_LIMITS.city),
    address:cleanField(raw.address, PREVIEW_LIMITS.address),
    phone:cleanPhone(raw.phone),
    rating,
    reviewCount,
    accent,
    template
  };
}

// --- base64url (UTF-8 safe, works in browsers and Node) ---------------------

export function base64UrlEncode(text){
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(value){
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]*$/.test(value)) throw new Error('invalid base64url');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder('utf-8', {fatal:true}).decode(bytes);
}

// Compact keys keep links short.
const KEY_MAP = {name:'n', category:'c', city:'ci', address:'a', phone:'p', rating:'r', reviewCount:'rc', accent:'ac', template:'t'};

export function encodePreview(data){
  const clean = sanitizePreviewData(data);
  if (!clean) throw new Error('Preview needs at least a business name.');
  const compact = {v:1};
  for (const [key, short] of Object.entries(KEY_MAP)){
    if (clean[key] !== '' && clean[key] !== null) compact[short] = clean[key];
  }
  return base64UrlEncode(JSON.stringify(compact));
}

export function decodePreview(param){
  if (typeof param !== 'string' || !param || param.length > PREVIEW_LIMITS.encoded) return null;
  try {
    const compact = JSON.parse(base64UrlDecode(param));
    if (!compact || typeof compact !== 'object' || compact.v !== 1) return null;
    const expanded = {};
    for (const [key, short] of Object.entries(KEY_MAP)) expanded[key] = compact[short];
    return sanitizePreviewData(expanded);
  } catch (_) {
    return null;
  }
}

export function buildPreviewUrl(baseHref, data){
  const url = new URL('preview.html', baseHref);
  url.search = '';
  url.hash = '';
  url.searchParams.set('c', encodePreview(data));
  return url.href;
}

export function mapsSearchUrl({name, address, city}){
  const query = [name, address || city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Pick black or white text for a given accent colour (WCAG relative luminance). */
export function readableTextOn(hex){
  const match = /^#([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!match) return '#ffffff';
  const channels = [0, 2, 4].map((i) => parseInt(match[1].slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.4 ? '#111111' : '#ffffff';
}

export function telHref(phone){
  const value = String(phone || '').trim();
  const digits = value.replace(/\D/g, '');
  return digits ? `tel:${value.startsWith('+') ? '+' : ''}${digits}` : '';
}
