'use strict';

const $ = (id) => document.getElementById(id);
const STATUS_OPTIONS = ['Нов', 'Проверен Instagram', 'Подготвена порака', 'Контактиран', 'Одговорил', 'Заинтересиран', 'Не е заинтересиран', 'Не контактирај'];
const STORAGE = {
  usage: 'nula_places_usage_v4',
  leads: 'nula_leads_v4',
  settings: 'nula_offer_settings_v4'
};
const USAGE_SEED_BY_DAY = {
  '2026-7-21': 8
};

let currentResults = [];
let activeLeadIndex = null;

const CATEGORIES = [
  ['Забна ординација / Стоматологија','забна ординација','dentist'],
  ['Ординација — општа медицина','ординација','doctor'],
  ['Болница / Клиника','клиника','hospital'],
  ['Аптека','аптека','pharmacy'],
  ['Ветеринар','ветеринарна амбуланта','veterinary_care'],
  ['Физиотерапија','физиотерапија','physiotherapist'],
  ['Оптика','оптика','optician'],
  ['Фризерски салон','фризерски салон','hair_care'],
  ['Салон за убавина / Козметика','салон за убавина','beauty_salon'],
  ['Спа центар','спа центар','spa'],
  ['Фитнес центар / Теретана','фитнес центар','gym'],
  ['Автосервис','автосервис','car_repair'],
  ['Автоперална','автоперална','car_wash'],
  ['Автокуќа','автокуќа','car_dealer'],
  ['Rent a car','изнајмување автомобили','car_rental'],
  ['Електричар','електричар','electrician'],
  ['Водоинсталатер','водоинсталатер','plumber'],
  ['Бравар','бравар','locksmith'],
  ['Молерофарбар','молерофарбар','painter'],
  ['Градежна фирма','градежна фирма','general_contractor'],
  ['Покривни работи','кровопокривач','roofing_contractor'],
  ['Селидби','селидби','moving_company'],
  ['Ресторан','ресторан','restaurant'],
  ['Кафуле','кафуле','cafe'],
  ['Пекара','пекара','bakery'],
  ['Бар','бар','bar'],
  ['Хотел / Сместување','хотел','lodging'],
  ['Туристичка агенција','туристичка агенција','travel_agency'],
  ['Адвокатска канцеларија','адвокатска канцеларија','lawyer'],
  ['Сметководствена агенција','сметководствена агенција','accounting'],
  ['Агенција за недвижности','агенција за недвижности','real_estate_agency'],
  ['Осигурителна агенција','осигурителна агенција','insurance_agency'],
  ['Цвеќарница','цвеќарница','florist'],
  ['Продавница за мебел','продавница за мебел','furniture_store'],
  ['Железарија / Хардвер','железарија','hardware_store'],
  ['Продавница за облека','продавница за облека','clothing_store'],
  ['Продавница за обувки','продавница за обувки','shoe_store'],
  ['Златарница / Накит','златарница','jewelry_store'],
  ['Продавница за електроника','продавница за електроника','electronics_store'],
  ['Маркет','маркет','supermarket'],
  ['Бензинска пумпа','бензинска пумпа','gas_station'],
  ['Хемиско чистење','хемиско чистење','laundry'],
  ['Пет шоп','пет шоп','pet_store'],
  ['Училиште / Курсеви','училиште за странски јазици','school']
];

const INDUSTRY_ADVANCED = {
  dentist:'веб-страница со услуги, тим и онлајн закажување термини за пациенти',
  doctor:'веб-страница со услуги, тим и онлајн закажување термини',
  hospital:'веб-страница со преглед на оддели, услуги и онлајн закажување',
  pharmacy:'веб-страница со каталог, работно време и повеќе локации',
  veterinary_care:'веб-страница со услуги и онлајн закажување термини за миленичиња',
  physiotherapist:'веб-страница со услуги, ценовник и онлајн закажување',
  optician:'веб-страница со каталог на производи, брендови и услуги',
  hair_care:'веб-страница со галерија, ценовник и онлајн закажување термини',
  beauty_salon:'веб-страница со галерија, ценовник и онлајн закажување',
  spa:'веб-страница со третмани, пакети, ценовник и онлајн закажување',
  gym:'веб-страница со пакети, распоред на тренинзи и онлајн запишување',
  car_repair:'веб-страница со услуги и онлајн барање термин или понуда',
  car_wash:'веб-страница со услуги, ценовник и онлајн закажување',
  car_dealer:'веб-страница со каталог на возила и испраќање барање',
  car_rental:'веб-страница со флота, достапност и онлајн резервација на возила',
  electrician:'веб-страница со услуги и брзо барање за интервенција',
  plumber:'веб-страница со услуги и брзо барање за интервенција',
  locksmith:'веб-страница со услуги и брз контакт за итни интервенции',
  painter:'веб-страница со галерија од завршени проекти и барање за понуда',
  general_contractor:'веб-страница со проекти, услуги, референци и барање за понуда',
  roofing_contractor:'веб-страница со галерија, услуги и барање за понуда',
  moving_company:'веб-страница со онлајн барање за понуда',
  restaurant:'веб-страница со мени и онлајн резервација на маса или нарачка',
  cafe:'веб-страница со мени, галерија, настани и резервации',
  bakery:'веб-страница со каталог и онлајн нарачки',
  bar:'веб-страница со мени, настани и резервации',
  lodging:'веб-страница со галерија, достапност и онлајн резервации',
  travel_agency:'веб-страница со аранжмани и онлајн барање за понуда или резервација',
  lawyer:'професионална веб-страница со области на работа и барање консултација',
  accounting:'професионална веб-страница со услуги и барање консултација',
  real_estate_agency:'веб-страница со каталог, филтри и пребарување недвижности',
  insurance_agency:'веб-страница со полиси и онлајн барање за понуда',
  florist:'веб-страница со каталог и онлајн нарачки',
  furniture_store:'веб-страница со каталог и барање за понуда',
  hardware_store:'веб-страница со каталог на производи',
  clothing_store:'веб-продавница со каталог и онлајн нарачки',
  shoe_store:'веб-продавница со каталог и онлајн нарачки',
  jewelry_store:'веб-страница со каталог, галерија и онлајн нарачки',
  electronics_store:'веб-продавница со каталог и онлајн нарачки',
  supermarket:'веб-страница со локации, понуди и каталог',
  gas_station:'веб-страница со локации, услуги и актуелни информации',
  laundry:'веб-страница со ценовник и онлајн закажување или подигнување',
  pet_store:'веб-продавница со каталог и онлајн нарачки',
  school:'веб-страница со курсеви, распоред и онлајн пријавување'
};

function todayKey(){
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

function loadUsage(){
  const day = todayKey();
  const seed = USAGE_SEED_BY_DAY[day] || 0;
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(STORAGE.usage) || '{}'); } catch (_) {}
  if (stored.day !== day) stored = {day, places: seed};
  stored.places = Math.max(Number(stored.places) || 0, seed);
  return stored;
}

function saveUsage(usage){
  localStorage.setItem(STORAGE.usage, JSON.stringify(usage));
  $('placesUsage').textContent = String(usage.places);
}

function bumpPlacesUsage(){
  const usage = loadUsage();
  usage.places += 1;
  saveUsage(usage);
}

function setStatus(text, type=''){
  const el = $('status');
  el.textContent = text;
  el.className = type;
}

function setMessageState(text, type=''){
  const el = $('messageState');
  el.textContent = text;
  el.className = `message-state ${type}`.trim();
}

function escapeHtml(value=''){
  return String(value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function loadLeadStore(){
  try { return JSON.parse(localStorage.getItem(STORAGE.leads) || '{}'); } catch (_) { return {}; }
}

function leadKey(row){
  return `${row.placeId || ''}|${row.name || ''}|${row.address || ''}`.toLowerCase();
}

function hydrateLead(row){
  const saved = loadLeadStore()[leadKey(row)] || {};
  return {...row, status:saved.status || 'Нов', message:saved.message || ''};
}

function persistLead(row){
  const store = loadLeadStore();
  store[leadKey(row)] = {status:row.status || 'Нов', message:row.message || '', updatedAt:new Date().toISOString()};
  localStorage.setItem(STORAGE.leads, JSON.stringify(store));
}

function getSettings(){
  const settings = {
    offerType:$('offerType').value,
    tone:$('messageTone').value,
    customOffer:$('customOffer').value.trim(),
    referenceLink:$('referenceLink').value.trim() || 'https://agencynula.com/'
  };
  localStorage.setItem(STORAGE.settings, JSON.stringify(settings));
  return settings;
}

function loadSettings(){
  let settings = {};
  try { settings = JSON.parse(localStorage.getItem(STORAGE.settings) || '{}'); } catch (_) {}
  $('offerType').value = settings.offerType || 'range';
  $('messageTone').value = settings.tone || 'warm';
  $('customOffer').value = settings.customOffer || '';
  $('referenceLink').value = settings.referenceLink || 'https://agencynula.com/';
  toggleCustomOffer();
}

function toggleCustomOffer(){
  $('customOfferWrap').classList.toggle('hidden', $('offerType').value !== 'custom');
}

function advancedOffer(row){
  return INDUSTRY_ADVANCED[row.categoryType] || 'професионална веб-страница со функционалности прилагодени на вашиот бизнис';
}

function selectedOffer(row, settings){
  const basic = 'основна веб-страница со општи информации, услуги, локација и контакт';
  const professional = advancedOffer(row);
  const offers = {
    range:`решенија од ${basic} до ${professional}`,
    basic,
    professional,
    booking:'веб-страница со преглед на услуги и онлајн закажување или резервации',
    catalog:'веб-страница со каталог на производи или услуги и можност за онлајн нарачки',
    website_gbp:`${professional}, заедно со поставување или уредување на Google Business Profile`,
    custom:settings.customOffer || professional
  };
  return offers[settings.offerType] || offers.range;
}

function buildMessage(row){
  const settings = getSettings();
  const name = (row.name || 'вашиот бизнис').trim();
  const offer = selectedOffer(row, settings);
  const ref = settings.referenceLink;

  if (settings.tone === 'short'){
    return `Здраво! Забележавме дека ${name} моментално нема веб-страница. Ние изработуваме ${offer}.\n\nРеференци: ${ref}\n\nДоколку сте заинтересирани, слободно пишете ни за понуда.`;
  }

  const greeting = settings.tone === 'professional' ? 'Почитувани,' : 'Здраво!';
  return `${greeting}\n\nВи пишуваме бидејќи забележавме дека ${name} моментално нема веб-страница. Ние изработуваме ${offer}.\n\nЛинк до нашиот веб-сајт каде може да видите дел од нашите референци: ${ref}\n\nДоколку сте заинтересирани, слободно пишете ни за понуда.`;
}

function instagramSearchUrl(row){
  const terms = `site:instagram.com \"${row.name}\" ${row.city || ''} -inurl:/p/ -inurl:/reel/ -inurl:/stories/`;
  return `https://www.google.com/search?q=${encodeURIComponent(terms)}`;
}

function renderResults(rows){
  $('resultCount').textContent = String(rows.length);
  const wrap = $('resultsWrap');
  if (!rows.length){
    wrap.innerHTML = '<div class="empty">Нема пронајдени бизниси без веб-страница за избраните критериуми.</div>';
    $('exportBtn').disabled = true;
    return;
  }

  let html = '<table><thead><tr><th>Бизнис</th><th>Телефон</th><th>Статус</th><th>Провери</th><th>Понуда</th></tr></thead><tbody>';
  rows.forEach((row,index) => {
    const options = STATUS_OPTIONS.map((status) => `<option value="${escapeHtml(status)}" ${row.status === status ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('');
    html += `<tr>
      <td>
        <div class="business-name">${escapeHtml(row.name)}</div>
        <div class="meta">${escapeHtml(row.address || 'Без локација')}</div>
        ${row.message ? '<span class="tag">има подготвена порака</span>' : ''}
      </td>
      <td class="meta">${escapeHtml(row.phone || '—')}</td>
      <td><select class="status-select" data-status-index="${index}">${options}</select></td>
      <td><div class="actions">
        ${row.mapsUri ? `<a class="button-link secondary" href="${escapeHtml(row.mapsUri)}" target="_blank" rel="noopener noreferrer">Google Maps</a>` : ''}
        <a class="button-link instagram" href="${escapeHtml(instagramSearchUrl(row))}" target="_blank" rel="noopener noreferrer" data-instagram-index="${index}">Побарај Instagram</a>
      </div></td>
      <td><div class="actions"><button type="button" data-offer-index="${index}">Подготви понуда</button></div></td>
    </tr>`;
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
  $('exportBtn').disabled = false;

  wrap.querySelectorAll('[data-status-index]').forEach((select) => {
    select.addEventListener('change', () => {
      const row = currentResults[Number(select.dataset.statusIndex)];
      row.status = select.value;
      persistLead(row);
    });
  });

  wrap.querySelectorAll('[data-instagram-index]').forEach((link) => {
    link.addEventListener('click', () => {
      const row = currentResults[Number(link.dataset.instagramIndex)];
      if (row.status === 'Нов') row.status = 'Проверен Instagram';
      persistLead(row);
      renderResults(currentResults);
    });
  });

  wrap.querySelectorAll('[data-offer-index]').forEach((button) => {
    button.addEventListener('click', () => openOfferModal(Number(button.dataset.offerIndex)));
  });
}

function openOfferModal(index){
  const row = currentResults[index];
  if (!row) return;
  activeLeadIndex = index;
  $('modalBusinessName').textContent = row.name;
  $('modalBusinessMeta').textContent = `${row.phone || 'Без телефон'}${row.address ? ` · ${row.address}` : ''}`;
  $('generatedMessage').value = row.message || '';
  setMessageState(row.message ? 'Оваа порака е зачувана локално и може да се измени.' : 'Избери понуда и кликни „Генерирај порака“.');
  $('offerModal').classList.add('open');
  $('offerModal').setAttribute('aria-hidden','false');
}

function closeOfferModal(){
  $('offerModal').classList.remove('open');
  $('offerModal').setAttribute('aria-hidden','true');
  activeLeadIndex = null;
}

function toCSV(rows){
  const headers = ['Име','Телефон','Локација','Статус','Порака','Google Maps'];
  const lines = [headers.join(',')];
  for (const row of rows){
    const values = [row.name,row.phone || '',row.address || '',row.status || 'Нов',row.message || '',row.mapsUri || ''];
    lines.push(values.map((value) => `"${String(value).replace(/"/g,'""')}"`).join(','));
  }
  return lines.join('\n');
}

function downloadCSV(){
  const csv = toCSV(currentResults);
  const blob = new Blob(['\ufeff' + csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `nula-leads-${$('city').value.trim() || 'search'}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function searchBusinesses(){
  const category = $('category').value.trim();
  const city = $('city').value.trim();
  const maxResults = Number($('maxResults').value);
  const selected = $('categorySelect').selectedOptions[0];
  const includedType = selected?.dataset.type || '';

  if (!category || !city){
    setStatus('Избери или внеси категорија и град.', 'error');
    return;
  }

  $('searchBtn').disabled = true;
  setStatus('Пребарувам преку Google Places...');
  currentResults = [];
  renderResults([]);

  try {
    const response = await fetch('/.netlify/functions/places-search', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({category,city,includedType,maxResults})
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Backend грешка (${response.status})`);

    bumpPlacesUsage();
    currentResults = (data.results || []).map((row) => hydrateLead({...row,category,categoryType:includedType,city}));
    renderResults(currentResults);
    setStatus(`Најдени ${data.totalFound || 0} бизниси, од кои ${currentResults.length} немаат веб-страница.`, 'success');
  } catch (error){
    const localHint = window.location.protocol === 'file:' ? ' Оваа верзија мора да биде поставена на Netlify за backend-от да работи.' : '';
    setStatus(`${error.message}.${localHint}`.replace('..','.'), 'error');
  } finally {
    $('searchBtn').disabled = false;
  }
}

function populateCategories(){
  const select = $('categorySelect');
  CATEGORIES.forEach(([label,query,type]) => {
    const option = document.createElement('option');
    option.value = query;
    option.dataset.type = type;
    option.textContent = label;
    select.appendChild(option);
  });
}

$('categorySelect').addEventListener('change', (event) => {
  const option = event.target.selectedOptions[0];
  if (option?.value) $('category').value = option.value;
});
$('searchBtn').addEventListener('click', searchBusinesses);
$('exportBtn').addEventListener('click', downloadCSV);
$('closeModalBtn').addEventListener('click', closeOfferModal);
$('offerModal').addEventListener('click', (event) => { if (event.target === $('offerModal')) closeOfferModal(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeOfferModal(); });
$('offerType').addEventListener('change', () => { toggleCustomOffer(); getSettings(); });
['messageTone','customOffer','referenceLink'].forEach((id) => $(id).addEventListener('input', getSettings));

$('generateMessageBtn').addEventListener('click', () => {
  if (activeLeadIndex === null) return;
  const row = currentResults[activeLeadIndex];
  row.message = buildMessage(row);
  if (row.status === 'Нов' || row.status === 'Проверен Instagram') row.status = 'Подготвена порака';
  $('generatedMessage').value = row.message;
  persistLead(row);
  renderResults(currentResults);
  setMessageState('Пораката е генерирана и зачувана локално.', 'success');
});

$('generatedMessage').addEventListener('input', () => {
  if (activeLeadIndex === null) return;
  const row = currentResults[activeLeadIndex];
  row.message = $('generatedMessage').value;
  persistLead(row);
  setMessageState('Измените се зачувани локално.', 'success');
});

$('copyMessageBtn').addEventListener('click', async () => {
  const text = $('generatedMessage').value.trim();
  if (!text){
    setMessageState('Прво генерирај порака.', 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    $('generatedMessage').select();
    document.execCommand('copy');
  }
  setMessageState('Пораката е копирана.', 'success');
});

$('searchInstagramModalBtn').addEventListener('click', () => {
  if (activeLeadIndex === null) return;
  const row = currentResults[activeLeadIndex];
  window.open(instagramSearchUrl(row), '_blank', 'noopener,noreferrer');
  if (row.status === 'Нов') row.status = 'Проверен Instagram';
  persistLead(row);
  renderResults(currentResults);
});

$('markContactedBtn').addEventListener('click', () => {
  if (activeLeadIndex === null) return;
  const row = currentResults[activeLeadIndex];
  row.message = $('generatedMessage').value.trim();
  row.status = 'Контактиран';
  persistLead(row);
  renderResults(currentResults);
  setMessageState('Бизнисот е означен како контактиран.', 'success');
});

populateCategories();
loadSettings();
saveUsage(loadUsage());
