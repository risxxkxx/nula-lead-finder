import {describe, it, expect} from 'vitest';
import {
  encodePreview, decodePreview, sanitizePreviewData, base64UrlEncode, base64UrlDecode,
  templateFor, cleanPhone, cleanField, buildPreviewUrl, mapsSearchUrl, telHref, readableTextOn,
  PREVIEW_LIMITS, DEFAULT_ACCENTS
} from '../js/preview-codec.js';

const sample = {
  name:'Кафе „Тест“ & Ко', category:'Кафуле', city:'Скопје', address:'ул. Македонија 1, Скопје',
  phone:'070 123 456', rating:4.56, reviewCount:87, accent:'#C2410C', template:'food'
};

describe('base64url', () => {
  it('round-trips UTF-8 (Cyrillic, quotes, emoji) without +, / or =', () => {
    const text = JSON.stringify({x:'Ѓорѓи Ќ ѕ „“ 😀 ?&='});
    const encoded = base64UrlEncode(text);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(base64UrlDecode(encoded)).toBe(text);
  });

  it('rejects non-base64url input and invalid UTF-8', () => {
    expect(() => base64UrlDecode('ab+/')).toThrow();
    expect(() => base64UrlDecode(base64UrlEncode('x').slice(0, 1) + '_w')).toThrow();
  });
});

describe('encode / decode', () => {
  it('round-trips sanitised data', () => {
    const decoded = decodePreview(encodePreview(sample));
    expect(decoded).toEqual({
      name:'Кафе „Тест“ & Ко', category:'Кафуле', city:'Скопје', address:'ул. Македонија 1, Скопје',
      phone:'070 123 456', rating:4.6, reviewCount:87, accent:'#c2410c', template:'food'
    });
  });

  it('omits empty fields to keep links short', () => {
    const encoded = encodePreview({name:'Само име'});
    const json = JSON.parse(base64UrlDecode(encoded));
    expect(json).toEqual({v:1, n:'Само име', ac:DEFAULT_ACCENTS.generic, t:'generic'});
  });

  it('refuses to encode without a name', () => {
    expect(() => encodePreview({name:'   '})).toThrow();
  });

  it.each([
    ['empty', ''],
    ['garbage', '!!!'],
    ['not json', base64UrlEncode('hello')],
    ['array', base64UrlEncode('[1,2]')],
    ['wrong version', base64UrlEncode(JSON.stringify({v:2, n:'x'}))],
    ['no name', base64UrlEncode(JSON.stringify({v:1, c:'x'}))],
    ['too long', 'a'.repeat(PREVIEW_LIMITS.encoded + 1)],
    ['not a string', 42]
  ])('returns null for %s', (_, value) => {
    expect(decodePreview(value)).toBeNull();
  });

  it('builds preview URLs relative to the app and replaces existing params', () => {
    const url = new URL(buildPreviewUrl('https://lead.example/index.html?x=1#y', {name:'A'}));
    expect(url.pathname).toBe('/preview.html');
    expect([...url.searchParams.keys()]).toEqual(['c']);
    expect(decodePreview(url.searchParams.get('c')).name).toBe('A');
  });
});

describe('sanitising', () => {
  const decodeRaw = (obj) => decodePreview(base64UrlEncode(JSON.stringify({v:1, ...obj})));

  it('keeps HTML payloads as inert text (rendered via textContent) and caps lengths', () => {
    const data = decodeRaw({n:'<img src=x onerror=alert(1)>'.repeat(10), a:'<script>alert(1)</script>'});
    expect(data.name.length).toBeLessThanOrEqual(PREVIEW_LIMITS.name);
    expect(data.address).toBe('<script>alert(1)</script>');
  });

  it('strips control characters and bidi overrides', () => {
    expect(cleanField('A\u0000B\u202eC\u2066D\nE', 50)).toBe('A B C D E');
  });

  it('caps by code points, not UTF-16 units', () => {
    expect(Array.from(cleanField('😀'.repeat(100), 5))).toHaveLength(5);
  });

  it('rejects non-string fields', () => {
    const data = decodeRaw({n:'Име', c:{evil:true}, ci:['Скопје'], a:null});
    expect(data).toMatchObject({category:'', city:'', address:''});
  });

  it('validates the accent colour', () => {
    expect(decodeRaw({n:'x', ac:'red;background:url(javascript:1)', t:'auto'}).accent).toBe(DEFAULT_ACCENTS.auto);
    expect(decodeRaw({n:'x', ac:'#12345'}).accent).toBe(DEFAULT_ACCENTS.generic);
    expect(decodeRaw({n:'x', ac:'#ABCDEF'}).accent).toBe('#abcdef');
  });

  it('validates the template id, falling back to category detection', () => {
    expect(decodeRaw({n:'x', t:'../../etc'}).template).toBe('generic');
    expect(decodeRaw({n:'x', t:'nope', c:'Фризерски салон'}).template).toBe('beauty');
  });

  it('keeps the rating only within 1–5 and the review count only with a rating', () => {
    expect(decodeRaw({n:'x', r:7, rc:10})).toMatchObject({rating:null, reviewCount:null});
    expect(decodeRaw({n:'x', r:'4.2', rc:10.5})).toMatchObject({rating:4.2, reviewCount:null});
    expect(decodeRaw({n:'x', rc:500})).toMatchObject({rating:null, reviewCount:null});
    expect(decodeRaw({n:'x', r:4, rc:-3}).reviewCount).toBeNull();
  });

  it('cleans phone numbers', () => {
    expect(cleanPhone('+389 (0)70 123-456')).toBe('+389 (0)70 123-456');
    expect(cleanPhone('070 123 456 <b>')).toBe('070 123 456');
    expect(cleanPhone('javascript:alert(1)')).toBe('');
    expect(cleanPhone('123')).toBe('');
  });

  it('rejects null/arrays', () => {
    expect(sanitizePreviewData(null)).toBeNull();
    expect(sanitizePreviewData([])).toBeNull();
  });
});

describe('helpers', () => {
  it('maps Places types and Macedonian keywords to templates', () => {
    expect(templateFor('restaurant')).toBe('food');
    expect(templateFor('car_wash')).toBe('auto');
    expect(templateFor('dentist')).toBe('beauty');
    expect(templateFor('lawyer')).toBe('generic');
    expect(templateFor('', 'Пекара')).toBe('food');
    expect(templateFor('', 'автосервис')).toBe('auto');
    expect(templateFor('', 'Забна ординација')).toBe('beauty');
    expect(templateFor('', 'сметководство')).toBe('generic');
  });

  it('builds safe tel: and maps links', () => {
    expect(telHref('+389 70 123 456')).toBe('tel:+38970123456');
    expect(telHref('')).toBe('');
    const maps = mapsSearchUrl({name:'Кафе & Ко', address:'ул. 1', city:'Скопје'});
    expect(maps.startsWith('https://www.google.com/maps/search/?api=1&query=')).toBe(true);
    expect(maps).not.toContain('&Ко');
  });

  it('chooses readable text colour on the accent', () => {
    expect(readableTextOn('#f59e0b')).toBe('#111111');
    expect(readableTextOn('#1e3a8a')).toBe('#ffffff');
    expect(readableTextOn('bad')).toBe('#ffffff');
  });
});
