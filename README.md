# Agency Nula Lead Finder — Netlify верзија

Оваа верзија:

- го чува Google Places API клучот во Netlify Environment Variables
- прикажува само бизниси кај кои Google Places не вратил веб-страница
- не користи Google Custom Search API
- отвора обично Google пребарување за Instagram, без API трошок
- генерира понуда дури откако корисникот ќе го провери профилот
- ги зачувува статусите и пораките локално во browser

## Што треба да направиш

### 1. Google Cloud

Овозможи **Places API (New)** за твојот Google Cloud проект и задржи го постојниот API клуч.

Не го внесувај API клучот во HTML и не го објавувај на GitHub.

### 2. Поставување на Netlify

Најсигурен начин е преку GitHub:

1. Отвори нов приватен GitHub repository.
2. Постави ги сите фајлови од оваа папка во repository-то.
3. Во Netlify избери **Add new site → Import an existing project**.
4. Поврзи го GitHub repository-то.
5. Build command остави празно.
6. Publish directory постави `.` ако Netlify не го прочита автоматски од `netlify.toml`.
7. Deploy.

### 3. Додавање на API клучот

Во Netlify отвори:

**Site configuration → Environment variables → Add a variable**

Име:

```text
GOOGLE_PLACES_API_KEY
```

Вредност: твојот Google Places API клуч.

Потоа направи нов deploy.

### 4. Заштита од трошоци

Во Google Cloud постави дневна квота или буџетско известување за Places API. Локалниот бројач во алатката е само информативен и важи за еден browser.

## Важно

Оваа алатка не испраќа Instagram пораки автоматски. Таа:

1. пронаоѓа бизнис без веб-страница
2. отвора Google пребарување за Instagram профилот
3. ти овозможува лично да го провериш профилот
4. генерира порака само кога ќе избереш „Подготви понуда“
