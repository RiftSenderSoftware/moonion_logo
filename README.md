<p align="center">
  <img src="assets/fox.png" width="200" alt="Moony Dreams fox">
</p>

<h1 align="center">Moony Dreams — загрузочный экран</h1>

<p align="center">
  Загрузочный экран для веба: один JS-файл без зависимостей, ≈55 KB, подключается к любой странице.<br>
  Ночное небо, созвездие лисы и луна, которые растут вместе с загрузкой.
</p>

<p align="center">
  <img src="docs/screenshots/progress.webp" width="860" alt="Загрузка: 20%, 62%, 99%">
</p>

## Что внутри

- **Прогресс, вплетённый в иллюстрацию.** Вместе с полосой загрузки оранжевое созвездие лисы соединяется звезда за звездой,
  а полумесяц в углу растёт до полной луны. На 100% у созвездия загораются глаза и искра на лбу, как у маскота,
  оно вспыхивает, и экран плавно исчезает.
- **Адаптивная вёрстка.** Компоновка пересчитывается под реальный viewport: в портрете элементы стоят столбиком, в альбоме — в ряд.
  Учитываются safe-area (чёлки). В совсем маленьких окнах (например, 300×250) лишние детали скрываются.
- **Живое, но спокойное небо.** Звёзды и Млечный Путь рисуются на canvas, несколько звёзд мерцают, изредка пролетает метеор.
  Есть поддержка `prefers-reduced-motion`.
- **Подключается одной строкой.** Всё встроено в один файл (CSS, картинки в base64), без зависимостей и лишних сетевых запросов.
  Код на ES5, поэтому работает в старых браузерах и вебвью без сборщика.

## Форматы

| Телефон, альбом | Планшет |
|:---:|:---:|
| <img src="docs/screenshots/landscape.webp" width="520" alt="844×390"> | <img src="docs/screenshots/tablet.webp" width="240" alt="768×1024"> |

<p align="center">
  <img src="docs/screenshots/desktop.webp" width="860" alt="1920×1080">
</p>

Все разрешения сразу можно посмотреть в [`loader/preview.html`](loader/preview.html):

```bash
python -m http.server 8765 --directory loader
```

Затем откройте http://localhost:8765/preview.html.

## Подключение

Вставьте скрипт первым элементом `<body>`, чтобы экран появился сразу, ещё до загрузки остальной страницы:

```html
<body>
  <script src="moony-loader.js" data-autoshow></script>
  ...
```

Файл лежит в [`loader/dist/moony-loader.js`](loader/dist/moony-loader.js). Его можно подключить по ссылке или вставить inline.

Когда страница готова, скройте лоадер:

```js
MoonyLoader.setProgress(0.4);           // реальный прогресс 0..1, необязательно
MoonyLoader.finish(function () {        // бар до 100%, вспышка, плавное исчезновение
  startApp();
});
```

Если прогресса нет, бар сам плавно ползёт к 90% и добегает до 100% по `finish()`.
Для Unity WebGL передавайте прогресс из `createUnityInstance(canvas, config, MoonyLoader.setProgress)`.

## Встраивание в готовую страницу

Нужен Python 3. Pillow батник поставит сам.

- **Перетащите `index.html` сайта или веб-приложения на [`pack-html5.bat`](pack-html5.bat).** Лоадер встроится первым элементом `<body>`,
  файлы рядом с HTML (js, css, ассеты) скопируются, и в `build/html5/` появятся `<имя>/index.html` и `<имя>.zip`.
- **Двойной клик по батнику** соберёт чистую HTML-страницу с лоадером, в которую можно вставить свой контент.

Из консоли:

```bash
pack-html5.bat path\to\site\index.html --name my_site
```

Встроенный так лоадер скрывается сам на событии `window.load`. Чтобы управлять им из кода, как показано выше,
поставьте `window.MOONY_LOADER_MANUAL = true` до этого события.
Остальные опции (`minDuration`, `fakeProgress`, `starDensity`, `meteors`, `parent` и др.) описаны в [`loader/README.md`](loader/README.md).

## Структура

```
assets/              маскот и логотип с прозрачным фоном
loader/
  src/               исходники: moony-loader.js, moony-loader.css, demo.html
  dist/              собранный moony-loader.js (всё встроено) и demo.html
  build.py           сборка src + assets -> dist
  pack.py            упаковка в HTML5 (index.html + zip)
  preview.html       превью на 10 разрешениях
pack-html5.bat       батник для упаковки
docs/screenshots/    картинки для этого README
```

После правок в `loader/src` или `assets` пересоберите файл командой `python loader/build.py`
(батник делает это автоматически).
