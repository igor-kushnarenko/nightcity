# Плейбук: nightcity (по образцу rainroom)
- Vite + Three.js, base `/nightcity/`, деплой `.github/workflows/deploy.yml` (push в main → test → build → Pages). `npm test` — настройки/параллакс.
- Арт: `art_src/layers nightcity/` (не менять). `python3 tools/make_layers.py` → `public/layers/*.png` (storm 1671→1672) и маски `public/layers/masks/<слой>_fx.png` (r тёплые окна, g фаза кластера 6x6, b неон — по порогам цвета). PSD не коммитим.
- Порядок: небо → облака (дрейф, зеркальный повтор без шва) → far → midfar → midnear → near → дождь (3 слоя, как rainroom) → room. Холст 1672x941 1:1, CSS contain + pixelated.
- Параллакс `src/config.js` LAYERS (sky 4 … near 34 px × сила), слои увеличены на 3–5 % под запас; комната 2 px. Выкл: сенсор, `?q=low`, `?nofx=parallax`.
- Небо: dusk/night/day/storm (storm = storm_sky + storm_clouds + редкие молнии). Настройки `nightcity.settings.v1`.
- Отладка: `?sky=`, `?rain=0..1`, `?nofx=rain,clouds,city,lightning,parallax`, `window.__nightcity`.
- Скриншоты: `npx vite preview --port 4190 &` и `node tools/shots.mjs http://localhost:4190/nightcity/ shots/v1`.
- Меню — порт из rainroom (☰ справа внизу, hud.glass, автозакрытие 5 с, стрелки/Enter — пульт, 1–4 небо, M звук, F экран, колесо — дождь). Скриншот: `node tools/menushot.mjs <url> shots/v2/menu.png`.
- Важно (three r170): не класть меши в Group с renderOrder — группа сортируется после всех слоёв (облака оказались поверх комнаты).
