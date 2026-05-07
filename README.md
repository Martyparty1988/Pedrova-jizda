# Pedrova jízda

Procedurální underground runner v prohlížeči s WebGL/Three.js enginem, neonovým vizuálem a PWA podporou.

> Poznámka: hra používá černý humor a drsnější underground styl. Ber ji jako satirickou arkádu, ne jako návod na reálné chování.

## Co hra umí

- 3D běhací hra přímo v prohlížeči
- WebGL renderer přes Three.js
- mobilní ovládání a fullscreen feeling na iPhonu
- PWA manifest pro instalaci na plochu
- offline cache přes service worker
- ukládání nejlepšího skóre lokálně v prohlížeči

## Rozdělená struktura

Nová rozdělená verze je připravená v těchto souborech:

```text
.
├── index.split.html    # čisté HTML bez inline stylu a skriptu
├── style.css           # vizuál, layout, HUD, menu a mobilní UI
├── app.js              # herní logika, Three.js engine, ovládání a skóre
├── index.html          # původní velká verze hry
├── manifest.json       # PWA manifest
├── service-worker.js   # offline cache
├── icon.svg            # SVG ikona
└── icons/              # PNG ikony pro PWA
```

`index.html` zatím zůstává původní hlavní vstup, aby se nerozbila nasazená verze. `index.split.html` je připravený jako čistá oddělená varianta, která načítá `style.css` a `app.js`.

## Spuštění

Nejjednodušší lokálně:

```bash
python3 -m http.server 8080
```

Pak otevři původní verzi:

```text
http://localhost:8080
```

Nebo rozdělenou verzi:

```text
http://localhost:8080/index.split.html
```

Na iPhonu/iPadu je nejlepší nasadit projekt na GitHub Pages, Vercel nebo Netlify a otevřít přes HTTPS. Service worker a PWA režim se naplno chovají správně hlavně přes HTTPS.

## Ovládání v rozdělené verzi

- šipka doleva / `A` nebo swipe doleva: změna pruhu doleva
- šipka doprava / `D` nebo swipe doprava: změna pruhu doprava
- šipka nahoru / `W` / mezerník nebo tap: skok
- šipka dolů / `S` nebo swipe dolů: skluz
- `Shift`: dash po odemčení
- `P` nebo `Esc`: pauza

## Doporučené další upgrady

- přepnout `index.split.html` na hlavní `index.html`
- přidat výběr obtížnosti
- přidat achievementy a seznam rekordů
- přidat lokální bundlování Three.js místo CDN
- přidat GitHub Pages workflow

## Deploy

### Vercel

1. Importuj repozitář do Vercelu.
2. Framework nech jako `Other` nebo statický web.
3. Build command nech prázdný.
4. Output directory nech jako root projektu.

### GitHub Pages

1. V GitHub repo otevři **Settings → Pages**.
2. Source nastav na branch `main` a root složku `/`.
3. Počkej na vygenerování odkazu.

## Licence

Soukromý / osobní projekt. Pokud chceš projekt zveřejnit víc oficiálně, doplň konkrétní licenci.
