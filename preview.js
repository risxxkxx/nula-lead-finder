import {decodePreview, mapsSearchUrl, telHref, readableTextOn} from './js/preview-codec.js';

// Placeholder copy per category group. Everything here is generic sample text;
// the page says so explicitly. Only the business name, category, city, address,
// phone and the real Google rating/count come from the link.
const COPY = {
  food:{
    eyebrow:'Ресторан · Кафе',
    headline:(d) => d.name,
    lead:(d) => `Добра храна, пријатно друштво и место кое сакате повторно да го посетите${d.city ? ` — во ${d.city}` : ''}.`,
    primary:'Резервирај маса',
    servicesTitle:'Што ќе најдете на сајтот',
    services:[
      ['menu', 'Дигитално мени', 'Целото мени со фотографии и цени, прегледно на секој телефон.'],
      ['calendar', 'Резервација на маса', 'Гостите резервираат за неколку секунди, без чекање на телефон.'],
      ['spark', 'Настани и прослави', 'Простор за роденденски, деловни вечери и посебни понуди.']
    ],
    whyTitle:'Зошто гостите се враќаат',
    why:[
      ['Свежи состојки', 'Јадења подготвени со внимание, секој ден.'],
      ['Пријатна атмосфера', 'Простор за кафе, ручек или вечера со друштво.'],
      ['Љубезна услуга', 'Тим што се грижи секоја посета да биде пријатна.']
    ]
  },
  auto:{
    eyebrow:'Авто услуги',
    headline:(d) => d.name,
    lead:(d) => `Сигурни раце за вашето возило${d.city ? ` во ${d.city}` : ''}. Закажете термин брзо и без компликации.`,
    primary:'Закажи термин',
    servicesTitle:'Услуги',
    services:[
      ['wrench', 'Сервис и одржување', 'Редовен сервис, масло, филтри и проверка пред пат.'],
      ['gauge', 'Дијагностика', 'Брзо откривање на проблемот пред да стане скап.'],
      ['calendar', 'Онлајн термин', 'Изберете ден и час, ние ве чекаме подготвени.']
    ],
    whyTitle:'Зошто возачите ни веруваат',
    why:[
      ['Јасни цени', 'Знаете што плаќате пред да започне работата.'],
      ['Искусни мајстори', 'Работа направена правилно од прв пат.'],
      ['Без долго чекање', 'Термини што се почитуваат.']
    ]
  },
  beauty:{
    eyebrow:'Убавина · Здравје',
    headline:(d) => d.name,
    lead:(d) => `Време посветено на вас. Професионална грижа во мирен и пријатен простор${d.city ? ` во ${d.city}` : ''}.`,
    primary:'Закажи третман',
    servicesTitle:'Третмани и услуги',
    services:[
      ['leaf', 'Третмани', 'Преглед на сите услуги со опис и времетраење.'],
      ['calendar', 'Онлајн закажување', 'Слободните термини секогаш видливи, закажување со еден клик.'],
      ['tag', 'Ценовник', 'Транспарентни цени за секоја услуга.']
    ],
    whyTitle:'Зошто клиентите нè избираат',
    why:[
      ['Професионален тим', 'Искуство и постојана едукација.'],
      ['Хигиена и грижа', 'Највисоки стандарди при секој третман.'],
      ['Пријатен амбиент', 'Простор во кој навистина се опуштате.']
    ]
  },
  generic:{
    eyebrow:'Локален бизнис',
    headline:(d) => d.name,
    lead:(d) => `Професионална услуга и лесен контакт${d.city ? ` — ${d.city}` : ''}. Сè што треба да знаете, на едно место.`,
    primary:'Побарај понуда',
    servicesTitle:'Што нудиме',
    services:[
      ['grid', 'Услуги', 'Јасен преглед на услугите со кратки описи.'],
      ['mail', 'Барање за понуда', 'Едноставна форма — одговор во најкраток рок.'],
      ['phone', 'Брз контакт', 'Повик, порака или упатство до локацијата со еден допир.']
    ],
    whyTitle:'Зошто да нè изберете',
    why:[
      ['Искуство', 'Работа на која можете да се потпрете.'],
      ['Сигурност', 'Јасни договори и почитување на роковите.'],
      ['Достапност', 'Секогаш лесно до нас, на телефон или на лице место.']
    ]
  }
};

const ICONS = {
  menu:'M4 6h16M4 12h16M4 18h10',
  calendar:'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  spark:'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6',
  wrench:'M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z',
  gauge:'M12 14l4-4M4 18a9 9 0 1 1 16 0',
  leaf:'M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19l7-7',
  tag:'M3 12V4h8l9 9-8 8z M7.5 7.5h.01',
  grid:'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  mail:'M4 6h16v12H4zM4 7l8 6 8-6',
  phone:'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  pin:'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  star:'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z'
};

const SVG_NS = 'http://www.w3.org/2000/svg';

function icon(name, className = 'icon'){
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICONS[name] || ICONS.grid);
  svg.appendChild(path);
  return svg;
}

/** Element helper: text is always set through textContent. */
function el(tag, className, text){
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function link(href, className, text, external = false){
  const a = el('a', className, text);
  a.href = href;
  if (external){
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
  return a;
}

function ratingBadge(data){
  if (data.rating === null) return null;
  const badge = el('div', 'rating-badge');
  badge.appendChild(icon('star', 'icon star'));
  badge.appendChild(el('strong', '', data.rating.toFixed(1)));
  const label = data.reviewCount ? `${data.reviewCount.toLocaleString('mk-MK')} оцени на Google` : 'оцена на Google';
  badge.appendChild(el('span', '', label));
  return badge;
}

function renderInvalid(root){
  const box = el('main', 'invalid');
  box.appendChild(el('h1', '', 'Линкот не е валиден'));
  box.appendChild(el('p', '', 'Овој линк за концепт е оштетен или нецелосен. Побарајте нов линк од NULA Studio.'));
  box.appendChild(link('https://agencynula.com/', 'btn primary', 'agencynula.com', true));
  root.replaceChildren(box);
}

function render(root, data){
  const copy = COPY[data.template] || COPY.generic;
  document.body.classList.add(`tpl-${data.template}`);
  document.documentElement.style.setProperty('--accent', data.accent);
  document.documentElement.style.setProperty('--on-accent', readableTextOn(data.accent));
  document.title = `${data.name} — концепт предлог од NULA Studio`;

  const tel = telHref(data.phone);
  const maps = mapsSearchUrl(data);
  const frag = document.createDocumentFragment();

  // Concept banner
  const banner = el('div', 'concept-banner');
  banner.setAttribute('role', 'note');
  banner.appendChild(el('span', 'concept-dot'));
  banner.appendChild(el('span', '', `Концепт предлог од NULA Studio — не е официјален сајт на ${data.name}`));
  frag.appendChild(banner);

  // Nav
  const nav = el('header', 'nav');
  const navInner = el('div', 'container nav-inner');
  navInner.appendChild(el('div', 'brand', data.name));
  const navLinks = el('nav', 'nav-links');
  navLinks.setAttribute('aria-label', 'Навигација');
  navLinks.appendChild(link('#uslugi', '', copy.servicesTitle));
  navLinks.appendChild(link('#kontakt', '', 'Контакт'));
  if (tel){
    const call = link(tel, 'btn small primary', 'Јави се');
    call.prepend(icon('phone'));
    navLinks.appendChild(call);
  }
  navInner.appendChild(navLinks);
  nav.appendChild(navInner);
  frag.appendChild(nav);

  // Hero
  const hero = el('section', 'hero');
  const heroInner = el('div', 'container hero-inner');
  const heroText = el('div', 'hero-text');
  heroText.appendChild(el('div', 'eyebrow', data.category || copy.eyebrow));
  heroText.appendChild(el('h1', '', copy.headline(data)));
  heroText.appendChild(el('p', 'lead', copy.lead(data)));
  const actions = el('div', 'hero-actions');
  const primary = link(tel || '#kontakt', 'btn primary', tel ? 'Јави се' : copy.primary);
  if (tel) primary.prepend(icon('phone'));
  actions.appendChild(primary);
  const mapBtn = link(maps, 'btn ghost', 'Види на мапа', true);
  mapBtn.prepend(icon('pin'));
  actions.appendChild(mapBtn);
  heroText.appendChild(actions);
  const badge = ratingBadge(data);
  if (badge) heroText.appendChild(badge);
  heroInner.appendChild(heroText);

  const visual = el('div', 'hero-visual');
  visual.setAttribute('aria-hidden', 'true');
  visual.appendChild(el('div', 'shape shape-a'));
  visual.appendChild(el('div', 'shape shape-b'));
  const card = el('div', 'hero-card');
  card.appendChild(el('div', 'hero-card-label', copy.primary));
  card.appendChild(el('div', 'hero-card-title', data.name));
  const cardLines = el('div', 'hero-card-lines');
  cardLines.append(el('span'), el('span'), el('span'));
  card.appendChild(cardLines);
  card.appendChild(el('div', 'hero-card-btn', copy.primary));
  visual.appendChild(card);
  heroInner.appendChild(visual);
  hero.appendChild(heroInner);
  frag.appendChild(hero);

  // Services
  const services = el('section', 'section services');
  services.id = 'uslugi';
  const servicesInner = el('div', 'container');
  servicesInner.appendChild(el('h2', 'section-title', copy.servicesTitle));
  const grid = el('div', 'cards');
  copy.services.forEach(([iconName, title, text]) => {
    const item = el('article', 'card');
    const iconWrap = el('div', 'card-icon');
    iconWrap.appendChild(icon(iconName));
    item.appendChild(iconWrap);
    item.appendChild(el('h3', '', title));
    item.appendChild(el('p', '', text));
    grid.appendChild(item);
  });
  servicesInner.appendChild(grid);
  services.appendChild(servicesInner);
  frag.appendChild(services);

  // Why us
  const why = el('section', 'section why');
  const whyInner = el('div', 'container why-inner');
  whyInner.appendChild(el('h2', 'section-title', copy.whyTitle));
  const list = el('ol', 'why-list');
  copy.why.forEach(([title, text], index) => {
    const li = el('li');
    li.appendChild(el('span', 'why-num', String(index + 1).padStart(2, '0')));
    const body = el('div');
    body.appendChild(el('h3', '', title));
    body.appendChild(el('p', '', text));
    li.appendChild(body);
    list.appendChild(li);
  });
  whyInner.appendChild(list);
  why.appendChild(whyInner);
  frag.appendChild(why);

  // Google rating strip (only the real Places rating/count)
  if (data.rating !== null){
    const strip = el('section', 'section rating-strip');
    const inner = el('div', 'container rating-inner');
    const big = el('div', 'rating-big');
    big.appendChild(el('strong', '', data.rating.toFixed(1)));
    const stars = el('div', 'stars');
    stars.setAttribute('aria-label', `${data.rating.toFixed(1)} од 5`);
    for (let i = 1; i <= 5; i += 1) stars.appendChild(icon('star', `icon star${i <= Math.floor(data.rating + 0.25) ? ' on' : ''}`));
    big.appendChild(stars);
    inner.appendChild(big);
    const text = el('div');
    text.appendChild(el('h2', 'section-title', 'Оцена на Google'));
    text.appendChild(el('p', '', data.reviewCount
      ? `Просечна оцена од ${data.reviewCount.toLocaleString('mk-MK')} јавни оцени на Google Maps.`
      : 'Просечна јавна оцена на Google Maps.'));
    text.appendChild(link(maps, 'text-link', 'Види ги оцените на Google', true));
    inner.appendChild(text);
    strip.appendChild(inner);
    frag.appendChild(strip);
  }

  // Contact
  const contact = el('section', 'section contact');
  contact.id = 'kontakt';
  const contactInner = el('div', 'container contact-inner');
  const contactText = el('div');
  contactText.appendChild(el('h2', 'section-title', 'Контакт'));
  contactText.appendChild(el('p', 'contact-lead', 'Јавете се или побарајте нè на мапа — тука сме.'));
  contactInner.appendChild(contactText);
  const rows = el('div', 'contact-rows');
  if (data.address || data.city){
    const row = link(maps, 'contact-row', '', true);
    row.appendChild(icon('pin'));
    const span = el('span');
    span.appendChild(el('strong', '', 'Адреса'));
    span.appendChild(el('span', '', data.address || data.city));
    row.appendChild(span);
    rows.appendChild(row);
  }
  if (tel){
    const row = link(tel, 'contact-row');
    row.appendChild(icon('phone'));
    const span = el('span');
    span.appendChild(el('strong', '', 'Телефон'));
    span.appendChild(el('span', '', data.phone));
    row.appendChild(span);
    rows.appendChild(row);
  }
  const mapRow = link(maps, 'contact-row', '', true);
  mapRow.appendChild(icon('spark'));
  const mapSpan = el('span');
  mapSpan.appendChild(el('strong', '', 'Google Maps'));
  mapSpan.appendChild(el('span', '', 'Отвори упатство до локацијата'));
  mapRow.appendChild(mapSpan);
  rows.appendChild(mapRow);
  contactInner.appendChild(rows);
  contact.appendChild(contactInner);
  frag.appendChild(contact);

  // Footer
  const footer = el('footer', 'footer');
  const footerInner = el('div', 'container footer-inner');
  footerInner.appendChild(el('p', '', `Ова е концепт предлог изработен од NULA Studio за ${data.name}. Текстовите се примерни и ќе се заменат со вистинските информации. Оцената е јавен податок од Google Maps.`));
  footerInner.appendChild(link('https://agencynula.com/', 'footer-link', 'NULA Studio · agencynula.com', true));
  footer.appendChild(footerInner);
  frag.appendChild(footer);

  // Sticky mobile call bar
  if (tel){
    const bar = link(tel, 'call-bar', 'Јави се');
    bar.prepend(icon('phone'));
    frag.appendChild(bar);
  }

  root.replaceChildren(frag);
}

const root = document.getElementById('app');
const data = decodePreview(new URLSearchParams(window.location.search).get('c') || '');
if (data) render(root, data); else renderInvalid(root);
