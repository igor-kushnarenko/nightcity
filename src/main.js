// nightcity: небо → облака → дальний → средний дальний → средний ближний → ближний → дождь → комната.
import * as THREE from 'three';
import { W, H, LAYERS, ROOM_PARALLAX, layerOffset } from './config.js';
import { loadSettings, saveSettings, skyAssets, rainParams, SKY_PRESETS } from './settings.js';
import { Ambience } from './audio.js';

const params = new URLSearchParams(location.search);
const NOFX = new Set((params.get('nofx') || '').split(',').filter(Boolean));
const LOW = params.get('q') === 'low';
const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const PARALLAX_ON = !(LOW || TOUCH || NOFX.has('parallax'));
let settings = loadSettings();
if (SKY_PRESETS.includes(params.get('sky'))) settings.sky = params.get('sky');
if (params.has('rain')) settings.rain = Math.min(1, Math.max(0, +params.get('rain')));

const BASE = import.meta.env.BASE_URL + 'layers/';
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
document.getElementById('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene(); const camera = new THREE.OrthographicCamera(0, W, H, 0, -10, 10);
const loader = new THREE.TextureLoader();
const tex = (name, dir = '') => { const t = loader.load(BASE + dir + name + '.png'); t.colorSpace = THREE.NoColorSpace; t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; return t; };
const vert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
let order = 0;
const quad = (mat, scale = 1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(W * scale, H * scale), mat); m.position.set(W / 2, H / 2, 0); m.renderOrder = order++; scene.add(m); return m; };
const T = { value: 0 };

// небо
const skyTex = {}; for (const s of SKY_PRESETS) skyTex[s] = null;
const getSky = (s) => (skyTex[s] ??= tex(skyAssets(s).sky));
const skyMat = new THREE.ShaderMaterial({ vertexShader: vert, depthTest: false, depthWrite: false,
  uniforms: { uTex: { value: getSky(settings.sky) }, uFlash: { value: 0 } },
  fragmentShader: `uniform sampler2D uTex; uniform float uFlash; varying vec2 vUv; void main(){ vec3 c = texture2D(uTex, vUv).rgb; gl_FragColor = vec4(c + uFlash*vec3(.55,.6,.75)*(.4+.6*c), 1.); }` });
const meshes = { sky: quad(skyMat, LAYERS[0].scale) };

// облака: дрейф по x с заворотом, у каждого слоя своя скорость
const cloudFrag = `uniform sampler2D uTex; uniform float uX, uA, uFlash; varying vec2 vUv; void main(){ vec4 c = texture2D(uTex, vec2(abs(fract((vUv.x + uX)*.5)*2.-1.), vUv.y)); if (c.a < .01) discard; gl_FragColor = vec4(c.rgb + uFlash*.5, c.a*uA); }`;
const cloudOrder = order; const cloudGroup = { position: { set: (x, y) => { for (const c of clouds) c.mesh.position.set(W / 2 + x, H / 2 + y, 0); } } };
let clouds = [];
function buildClouds() {
  for (const c of clouds) { scene.remove(c.mesh); c.mesh.material.dispose(); }
  clouds = skyAssets(settings.sky).clouds.map((n, i) => {
    const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: cloudFrag, transparent: true, depthTest: false, depthWrite: false,
      uniforms: { uTex: { value: tex(n) }, uX: { value: Math.random() }, uA: { value: settings.sky === 'storm' ? 0.75 : 0.9 }, uFlash: { value: 0 } } });
    mat.uniforms.uTex.value.wrapS = THREE.RepeatWrapping;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W * LAYERS[1].scale, H * LAYERS[1].scale), mat); mesh.position.set(W / 2, H / 2, 0); mesh.renderOrder = cloudOrder; scene.add(mesh);
    return { mesh, mat, speed: 0.002 * (0.6 + i * 0.35) };
  });
}
order++; buildClouds();

// город: слой + маска (r окна, g фаза кластера, b неон)
const cityFrag = `uniform sampler2D uTex, uMask; uniform float uT, uLights, uSeed, uFlash; varying vec2 vUv;
  float h(float n){ return fract(sin(n*12.9898+uSeed)*43758.5453); }
  void main(){
    vec4 c = texture2D(uTex, vUv); if (c.a < .01) discard;
    vec3 m = texture2D(uMask, vUv).rgb; vec3 col = c.rgb;
    float ph = m.g*255.;
    if (m.r > .5) {
      float slot = floor(uT*.25 + ph*.37); float off = step(.985, h(ph + slot*7.1));
      float fl = 1. - .25*step(.93, h(ph*3.1 + floor(uT*14.)))*step(.97, h(ph + floor(uT*.7)));
      float k = mix(.35, 1.25, uLights) * fl * (1. - .75*off);
      col = col*k + vec3(.08,.05,0.)*uLights;
    }
    if (m.b > .5) {
      float pulse = .82 + .18*sin(uT*2.3 + ph*.05);
      float gl = step(.992, h(floor(uT*9.) + floor(ph/32.)));
      float k = mix(.4, 1.35, uLights) * pulse * (1. - .7*gl);
      col = col*k + col*col*.25*uLights;
    }
    col += uFlash*.25*c.rgb;
    gl_FragColor = vec4(col, c.a);
  }`;
for (const L of LAYERS.slice(2)) {
  const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: cityFrag, transparent: true, depthTest: false, depthWrite: false,
    uniforms: { uTex: { value: tex(L.id) }, uMask: { value: tex(L.id + '_fx', 'masks/') }, uT: T, uLights: { value: settings.lights }, uSeed: { value: order * 3.7 }, uFlash: { value: 0 } } });
  if (NOFX.has('city')) mat.uniforms.uLights.value = 0.6;
  meshes[L.id] = quad(mat, L.scale);
}

// дождь — подход rainroom: тонкие штрихи по независимым колонкам, 3 слоя глубины
const rainU = { uRainDen: { value: 0.2 }, uRainLen: { value: 1 }, uRainSlant: { value: 0.04 }, uRainA: { value: 1 }, uRainT: { value: 0 } };
const rainFrag = `uniform float uLayer,uRainDen,uRainLen,uRainSlant,uRainA,uRainT; varying vec2 vUv;
  float h2(vec2 p){ vec3 p3=fract(vec3(p.xyx+uLayer*17.17)*.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
  float h1(float n){ return h2(vec2(n, 7.7)); }
  void main(){
    vec2 p = vec2(vUv.x*${W}., (1.-vUv.y)*${H}.); float L = uLayer;
    float cw = mix(3., 7., L*.5); float slant = uRainSlant*(.6+.4*L);
    float x = p.x + p.y*slant; float c = floor(x/cw); float fx = fract(x/cw);
    float speed = mix(520., 1100., L*.5) * (.75 + .5*h1(c)); float per = mix(260., 520., h1(c+31.7));
    float yy = p.y - uRainT*speed + h1(c+7.3)*per*13.; float cyc = floor(yy/per); float m = mod(yy, per);
    if (h2(vec2(c, cyc)) > uRainDen*mix(.9, .55, L*.5)) discard;
    float len = mix(10., 34., L*.5) * uRainLen * (.6 + .8*h2(vec2(c, cyc+.5)));
    float start = h2(vec2(c+.3, cyc)) * (per - len); float k = (m - start)/len; if (k < 0. || k > 1.) discard;
    float cx = .2 + .6*h2(vec2(c, cyc+1.7)); float d = abs(fx - cx)*cw; float wpx = mix(.5, .9, L*.5);
    float a = (1. - smoothstep(wpx*.4, wpx, d)) * k * mix(.14, .3, L*.5) * (.5 + .7*h2(vec2(c+.9, cyc))) * uRainA;
    if (a < .004) discard; gl_FragColor = vec4(.74,.8,.92, a);
  }`;
const rainMeshes = [];
for (const L of NOFX.has('rain') ? [] : LOW ? [1, 2] : [0, 1, 2]) rainMeshes.push(quad(new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: rainFrag, transparent: true, depthTest: false, depthWrite: false, uniforms: { ...rainU, uLayer: { value: L } } })));

// комната (окно прозрачное) — сверху
const roomMat = new THREE.ShaderMaterial({ vertexShader: vert, transparent: true, depthTest: false, depthWrite: false, uniforms: { uTex: { value: tex('room') }, uFlash: { value: 0 } },
  fragmentShader: `uniform sampler2D uTex; uniform float uFlash; varying vec2 vUv; void main(){ vec4 c = texture2D(uTex, vUv); if (c.a < .01) discard; gl_FragColor = vec4(c.rgb*(1.+uFlash*.35), c.a); }` });
meshes.room = quad(roomMat, 1 + (ROOM_PARALLAX * 2) / W);

// ---------- ввод ----------
let mouse = [0, 0], cur = [0, 0];
if (PARALLAX_ON) window.addEventListener('pointermove', (e) => { mouse = [(e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1]; });

// ---------- звук и меню (как в rainroom) ----------
const audio = new Ambience(); audio.set(settings.volume, settings.rain);
document.getElementById('bg').style.backgroundImage = `url(${BASE}room.png)`;
const $ = (id) => document.getElementById(id);
const toast = $('toast'); let toastT;
function hint(text) { toast.textContent = text; toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('show'), 2600); }
let muted = false;
const SKY_NAMES = { dusk: 'Сумерки', night: 'Ночь', day: 'День', storm: 'Гроза' };
const SLIDERS = ['cloudSpeed', 'lights', 'rain', 'parallax', 'volume'];
function renderUI() {
  for (const b of document.querySelectorAll('#skyseg .seg')) b.classList.toggle('sel', b.dataset.sky === settings.sky);
  $('cloudsbtn').classList.toggle('on', settings.clouds); $('cloudsbtn').setAttribute('aria-pressed', String(settings.clouds));
  $('cloudrow').classList.toggle('collapsed', !settings.clouds);
  for (const k of SLIDERS) if (document.activeElement !== $(k)) $(k).value = Math.round(settings[k] * 100);
  $('parallax').disabled = !PARALLAX_ON;
}
function update(patch) {
  const prevSky = settings.sky; settings = { ...settings, ...patch }; saveSettings(settings);
  if (settings.sky !== prevSky) { skyMat.uniforms.uTex.value = getSky(settings.sky); buildClouds(); hint(SKY_NAMES[settings.sky]); }
  audio.set(muted ? 0 : settings.volume, settings.rain); renderUI();
}
for (const b of document.querySelectorAll('#skyseg .seg')) b.addEventListener('click', () => update({ sky: b.dataset.sky }));
$('cloudsbtn').addEventListener('click', () => update({ clouds: !settings.clouds }));
for (const k of SLIDERS) $(k).addEventListener('input', (e) => update({ [k]: e.target.value / 100 }));
const muteBtn = $('mute');
function toggleMute() { muted = !muted; audio.set(muted ? 0 : settings.volume, settings.rain); muteBtn.querySelector('span').textContent = muted ? 'Звук выкл' : 'Звук'; muteBtn.classList.toggle('off', muted); }
muteBtn.addEventListener('click', toggleMute);
function toggleFs() { const d = document, el = d.documentElement; if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d); else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el); }
$('fs').addEventListener('click', toggleFs);
let idleTimer = 0;
function wake() { document.body.classList.remove('idle'); clearTimeout(idleTimer); idleTimer = setTimeout(() => document.body.classList.add('idle'), 6000); }
const overlay = $('overlay'); let started = false;
function firstInteraction() { audio.start(); if (!started) { started = true; overlay.classList.add('gone'); } }
for (const ev of ['pointerdown', 'touchend', 'click']) window.addEventListener(ev, () => { firstInteraction(); wake(); }, { capture: true });
window.addEventListener('pointermove', wake);
// меню в круглой кнопке: раскрывается при наведении/нажатии, сворачивается через 5 с
const hud = $('hud'), menuBtn = $('menubtn');
let menuTimer = 0, overMenu = false;
function openMenu() { clearTimeout(menuTimer); hud.classList.remove('closed'); menuBtn.setAttribute('aria-expanded', 'true'); }
function scheduleClose(ms = 5000) { clearTimeout(menuTimer); menuTimer = setTimeout(() => { if (overMenu) return; hud.classList.add('closed'); menuBtn.setAttribute('aria-expanded', 'false'); if (hud.contains(document.activeElement)) document.activeElement.blur(); }, ms); }
for (const el of [hud, menuBtn]) {
  el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { overMenu = true; openMenu(); } });
  el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { overMenu = false; scheduleClose(); } });
}
menuBtn.addEventListener('click', () => { openMenu(); if (!overMenu) scheduleClose(); });
hud.addEventListener('pointerdown', () => { if (!overMenu) scheduleClose(); });
const focusables = () => [...document.querySelectorAll('#hud button, #hud input')].filter((el) => el.offsetParent !== null && !el.disabled && !el.closest('.collapsed') && !el.closest('.closed'));
window.addEventListener('keydown', (e) => {
  firstInteraction(); wake(); const k = e.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(k)) {
    const wasClosed = hud.classList.contains('closed'); openMenu(); if (!overMenu) scheduleClose();
    if (wasClosed) { document.querySelector('#skyseg .seg.sel')?.focus(); e.preventDefault(); return; }
  }
  const list = focusables(), i = list.indexOf(document.activeElement), onRange = document.activeElement?.type === 'range';
  if (onRange && (k === 'ArrowLeft' || k === 'ArrowRight')) { /* стрелки двигают ползунок */ }
  else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) {
    const dir = k === 'ArrowDown' || k === 'ArrowRight' ? 1 : -1; const n = i < 0 ? 0 : (i + dir + list.length) % list.length; list[n].focus(); e.preventDefault();
  } else if (k >= '1' && k <= '4') update({ sky: SKY_PRESETS[+k - 1] });
  else if ('mMьЬ'.includes(k)) toggleMute(); else if ('fFаА'.includes(k)) toggleFs();
}, { capture: true });
window.addEventListener('wheel', (e) => { if (hud.contains(e.target)) return; update({ rain: Math.min(1, Math.max(0, Math.round((settings.rain - Math.sign(e.deltaY) * 0.05) * 20) / 20)) }); }, { passive: true });
renderUI(); wake();

// ---------- кадр ----------
let last = performance.now(), rainShown = settings.rain, flash = 0, nextBolt = 8 + Math.random() * 20, fps = 60;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now; T.value += dt; fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
  const k = 1 - Math.exp(-dt * 4); cur = [cur[0] + (mouse[0] - cur[0]) * k, cur[1] + (mouse[1] - cur[1]) * k];
  const st = PARALLAX_ON ? settings.parallax : 0;
  for (const L of LAYERS) { const m = L.id === 'clouds' ? cloudGroup : meshes[L.id]; const [ox, oy] = layerOffset(L, cur[0], cur[1], st); if (m === cloudGroup) m.position.set(ox, oy, 0); else m.position.set(W / 2 + ox, H / 2 + oy, 0); }
  meshes.room.position.set(W / 2 - cur[0] * ROOM_PARALLAX * st, H / 2 + cur[1] * ROOM_PARALLAX * st, 0);
  for (const c of clouds) c.mesh.visible = settings.clouds && !NOFX.has('clouds');
  for (const c of clouds) c.mat.uniforms.uX.value = (c.mat.uniforms.uX.value + dt * c.speed * settings.cloudSpeed) % 1;
  // молния — только в грозу
  if (settings.sky === 'storm' && !NOFX.has('lightning')) { nextBolt -= dt; if (nextBolt < 0) { flash = 1; nextBolt = 12 + Math.random() * 30; } }
  flash = Math.max(0, flash - dt * 3.5); const fl = flash * (0.6 + 0.4 * Math.sin(T.value * 60));
  skyMat.uniforms.uFlash.value = fl; roomMat.uniforms.uFlash.value = fl * 0.3; for (const c of clouds) c.mat.uniforms.uFlash.value = fl;
  for (const L of LAYERS.slice(2)) { const u = meshes[L.id].material.uniforms; u.uFlash.value = fl; if (!NOFX.has('city')) u.uLights.value = settings.lights; }
  rainShown += (settings.rain - rainShown) * (1 - Math.exp(-dt * 1.2)); const RP = rainParams(rainShown);
  rainU.uRainDen.value = RP.density; rainU.uRainLen.value = RP.length; rainU.uRainSlant.value = 0.03 + RP.slant * 0.15; rainU.uRainA.value = RP.alpha; rainU.uRainT.value = (rainU.uRainT.value + dt * RP.speed) % 1800;
  renderer.render(scene, camera); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__nightcity = { state: () => ({ ...settings, parallaxOn: PARALLAX_ON, offsets: LAYERS.map((L) => layerOffset(L, cur[0], cur[1], PARALLAX_ON ? settings.parallax : 0).map((v) => +v.toFixed(1))) }), fps: () => fps, bolt: () => { flash = 1; } };
