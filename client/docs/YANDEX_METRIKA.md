# Реализация Яндекс.Метрики в проекте Top-Pet

Краткое описание для обращения к эксперту: как подключена Метрика, что уже сделано и что может требовать проверки.

---

## Стек и окружение

- **Клиент:** React (Create React App), SPA с React Router.
- **Раздача:** статика отдаётся через nginx в Docker (порт 3000), перед ним может стоять прокси/платформа (Coolify и т.п.).
- **Домен:** top-pet.ru (фронт), api.top-pet.ru (бэкенд).
- **Счётчик Метрики:** 106546874.

---

## Где и как подключена Метрика

### 1. Компонент

**Файл:** `client/src/components/analytics/YandexMetrika.tsx`

- React-компонент без разметки (return null).
- Рендерится **внутри** `BrowserRouter` в `App.tsx`, чтобы иметь доступ к `useLocation()`.
- ID счётчика берётся из переменной окружения `REACT_APP_YANDEX_METRIKA_ID` при сборке. Если переменная пустая или не число — компонент ничего не делает (логирует «отключена»).

### 2. Загрузка скрипта

- Скрипт подключается динамически: `document.createElement('script')`, `src = https://mc.yandex.ru/metrika/tag.js?id=${counterId}`, `async = true`, вставка в `document.head`.
- Если при монтировании уже есть `window.ym` (например, скрипт подгружен с другой страницы), init вызывается сразу, без повторной загрузки скрипта.

### 3. Инициализация и хиты

- После загрузки скрипта (событие `onload`) вызывается:
  - `window.ym(counterId, 'init', { defer: true, clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true, trackHash: true, triggerEvent: true })` — для SPA используется `defer: true` (все просмотры отправляются только через hit).
  - Сразу после init (без задержки) — первый хит: `window.ym(counterId, 'hit', url, { title: document.title, referer: document.referrer })`.
- При смене маршрута вызывается `window.ym(counterId, 'hit', url, { title, referer })` в отдельном `useEffect`.
- Защита от двойной инициализации: `useRef(initialized)` — скрипт не подгружается и init не вызывается повторно при повторном монтировании.

Типизация: в том же файле объявлено `declare global { interface Window { ym?: (...) => void } }`.

### 4. Переменная окружения

- **Имя:** `REACT_APP_YANDEX_METRIKA_ID`.
- **Продакшен:** задаётся в `client/.env.production` (значение `106546874`), подхватывается при `npm run build`.
- В разработке можно оставить пустым — тогда Метрика не инициализируется.

### 5. Content Security Policy (CSP)

**Файл:** `client/nginx.conf` (попадает в образ клиента и отдаёт статику)

В блок `server` добавлен заголовок без `unsafe-eval` (по рекомендации эксперта):

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://mc.yandex.ru https://yastatic.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://api.top-pet.ru https://mc.yandex.ru wss://api.top-pet.ru; img-src 'self' data: https: https://mc.yandex.ru; frame-src 'self' https://mc.yandex.ru; object-src 'none'; base-uri 'self';";
```

- `script-src`: `'self'`, `https://mc.yandex.ru`, `https://yastatic.net` (без `unsafe-eval`).
- `connect-src`, `img-src`, `frame-src`: явно разрешён `https://mc.yandex.ru` для запросов и пикселя Метрики.

**Важно:** если после деплоя в DevTools снова появится ошибка «CSP blocks the use of eval», в nginx нужно вернуть `'unsafe-eval'` в `script-src` и зафиксировать в документации, что tag.js в данной среде требует eval.

---

## Что видно в браузере

- В консоли при загрузке страницы по очереди появляются логи:
  - `[YandexMetrika] инициализация: { counterId: 106546874 }`
  - `[YandexMetrika] загрузка скрипта: { scriptUrl: 'https://mc.yandex.ru/metrika/tag.js?id=106546874' }`
  - `[YandexMetrika] скрипт загружен, вызываем init`
  - `[YandexMetrika] init: { counterId: 106546874 }`
  - `[YandexMetrika] первый хит: { url: 'https://top-pet.ru/' }`
- В Network видна успешная загрузка `tag.js?id=106546874` (200 OK).
- При переходе по маршрутам в SPA логируется, например: `[YandexMetrika] хит при смене маршрута: { pathname: '...', url: '...' }`.

То есть: скрипт загружается, init и hit вызываются с нужным counterId.

---

## В чём нужна помощь эксперта

1. **Запросы отправки данных в Network**  
   Кроме загрузки `tag.js` в списке запросов не видны явные вызовы к mc.yandex.ru (watch, collect и т.п.). Нужно понять: это ожидаемо (запросы идут в другом виде/с задержкой), или что-то мешает их отправке (CSP, расширения, режим браузера)?

2. **Данные в кабинете Метрики**  
   Подтвердить, приходят ли визиты/просмотры в отчёты при такой реализации (динамическая подгрузка tag.js с `?id=...`, init + hit из React, SPA-переходы через hit при смене location).

3. **Рекомендации по реализации**  
   Есть ли более предпочтительный способ подключения Метрики в SPA (официальный сниппет в index.html, другой порядок init/hit, отказ от unsafe-eval за счёт иного способа загрузки и т.д.) при сохранении работы карты кликов, вебвизора и отслеживания переходов по маршрутам.

---

## Внесённые изменения (по рекомендациям эксперта)

- **init:** добавлены `defer: true` (SPA — все просмотры только через hit), `trackHash: true`, `triggerEvent: true`.
- **Первый хит:** вызывается сразу после init (без задержки 150 ms), с options `{ title: document.title, referer: document.referrer }`.
- **Хит при смене маршрута:** передаётся тот же options для вебвизора и источников трафика.
- **Защита от двойной инициализации:** `useRef(initialized)` — скрипт и init выполняются один раз.
- **CSP:** убран `unsafe-eval`; добавлены `https://yastatic.net` в script-src, явно `https://mc.yandex.ru` в img-src и frame-src, `object-src 'none'`, `base-uri 'self'`. При появлении ошибки eval в браузере — вернуть `'unsafe-eval'` в script-src.

---

## Проверочный чеклист

- **«В реальном времени»** в кабинете Метрики — визиты должны отображаться сразу.
- **Инкогнито:** открыть сайт без расширений, сделать 2–3 перехода по страницам, проверить «В реальном времени».
- **Консоль браузера:** выполнить `ym(106546874, 'getClientID')` (должен вернуть ID); `ym(106546874, 'reachGoal', 'test')` — в Network должны появиться запросы к mc.yandex.ru.
- **Вебвизор:** в настройках счётчика включён «Вебвизор»; в разделе «Вебвизор» → «Записи» появляются сессии.
- **Фильтры:** в настройках счётчика проверить вкладку «Фильтры» и опцию «Не учитывать мои визиты» (при необходимости отключить для проверки).

---

## Альтернатива

Можно рассмотреть пакет **react-yandex-metrika** (`YMInitializer` в App) для инициализации счётчика — без обязательной замены текущей реализации.

---

## Файлы для справки

| Назначение              | Путь |
|-------------------------|------|
| Компонент Метрики       | `client/src/components/analytics/YandexMetrika.tsx` |
| Подключение в приложении| `client/src/App.tsx` (импорт и `<YandexMetrika />` внутри `BrowserRouter`) |
| Переменная окружения    | `client/.env.production` — `REACT_APP_YANDEX_METRIKA_ID=106546874` |
| CSP (nginx)             | `client/nginx.conf` — `add_header Content-Security-Policy ...` |
| Документация по env     | `client/README.md` — раздел «Переменные окружения» |

Если эксперту нужны фрагменты кода или точные строки конфигов — их можно взять из указанных файлов.
