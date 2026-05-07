# Pedrova jízda

Procedurální underground runner v prohlížeči s vlastním WebGL/Three.js enginem, neonovým vizuálem a PWA podporou.

> Poznámka: hra používá černý humor a drsnější underground styl. Ber ji jako satirickou arkádu, ne jako návod na reálné chování.

## Co hra umí

- 3D běhací hra přímo v prohlížeči
- WebGL renderer přes Three.js
- mobilní ovládání a fullscreen feeling na iPhonu
- PWA manifest pro instalaci na plochu
- offline cache přes service worker
- ukládání nejlepšího skóre lokálně v prohlížeči

## Spuštění

Nejjednodušší lokálně:

```bash
python3 -m http.server 8080
```

Pak otevři:

```text
http://localhost:8080
```

Na iPhonu/iPadu je nejlepší nasadit projekt na GitHub Pages, Vercel nebo Netlify a otevřít přes HTTPS. Service worker a PWA režim se naplno chovají správně hlavně přes HTTPS.

## Struktura

```text
.
├── index.html          # hlavní hra, styl a JavaScript
├── manifest.json       # PWA manifest
├── service-worker.js   # offline cache
├── icon.svg            # SVG ikona
└── icons/              # PNG ikony pro PWA
```

## Doporučené další upgrady

- rozdělit `index.html` na `style.css` a `app.js`
- přidat jednoduché nastavení obtížnosti
- přidat mute tlačítko pro zvuky
- přidat achievementy a seznam rekordů
- přidat bezpečnější fallback, když se nenačte CDN s Three.js

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
