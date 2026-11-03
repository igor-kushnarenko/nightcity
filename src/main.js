// nightcity: небо → облака → дальний → средний дальний → средний ближний → ближний → дождь → комната.
import * as THREE from 'three';
import { W, H, LAYERS, ROOM_PARALLAX, layerOffset, LAMPS, LAMP_IDS, hitLamp, clientToScene, RADIO, hitRadio } from './config.js';
import { loadSettings, saveSettings, skyAssets, rainParams, SKY_PRESETS, toggleLamp } from './settings.js';
import { Ambience } from './audio.js';
import { Tuner } from './radio.js';
import { createTransition, startTransition, stepTransition, blendParams, progress, PRESETS } from './transition.js';

const params = new URLSearchParams(location.search);
const NOFX = new Set((params.get('nofx') || '').split(',').filter(Boolean));
const LOW = params.get('q') === 'low';
const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const PARALLAX_ON = !(LOW || TOUCH || NOFX.has('parallax'));
let settings = loadSettings();
if (SKY_PRESETS.includes(params.get('sky'))) settings.sky = params.get('sky');
if (params.has('lamps')) { const on = params.get('lamps').split(','); settings.lamps = { left: on.includes('left') || on.includes('all'), right: on.includes('right') || on.includes('all') }; }
if (params.has('radio')) settings.radio = params.get('radio') === '1';
if (params.has('rain')) settings.rain = Math.min(1, Math.max(0, +params.get('rain')));

const TT = params.has('tt') ? Math.max(0, +params.get('tt') || 0) : 10; // ?tt=сек — длительность перехода
let tr = createTransition(settings.sky, TT), BP = blendParams(tr.weights);
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
  uniforms: { uS0: { value: getSky('dusk') }, uS1: { value: getSky('night') }, uS2: { value: getSky('day') }, uS3: { value: getSky('storm') }, uW: { value: new THREE.Vector4(...tr.weights) }, uFlash: { value: 0 }, uStars: { value: tex('stars_night', 'masks/') }, uStarOn: { value: 0 }, uT: T },
  // звёзды: каждая (id в g маски) мерцает целиком, свой период 2–6 с, яркость 60–130 %, лёгкий оттенок, редкая вспышка
  fragmentShader: `uniform sampler2D uS0, uS1, uS2, uS3, uStars; uniform vec4 uW; uniform float uFlash, uStarOn, uT; varying vec2 vUv;
    float h(float n){ return fract(sin(n*12.9898)*43758.5453); }
    void main(){ vec3 c = vec3(0.);
      if (uW.x > .001) c += texture2D(uS0, vUv).rgb*uW.x; if (uW.y > .001) c += texture2D(uS1, vUv).rgb*uW.y;
      if (uW.z > .001) c += texture2D(uS2, vUv).rgb*uW.z; if (uW.w > .001) c += texture2D(uS3, vUv).rgb*uW.w;
      if (uStarOn > .001) { vec4 m = texture2D(uStars, vUv); if (m.r > .5) {
        float id = floor(m.g*255. + .5); float per = 2. + 4.*h(id); float w = sin(6.2832*(uT/per + h(id*1.3)));
        float k = .95 + .35*w; float sp = step(.985, h(id*3.7 + floor(uT/per)))*max(0., w)*.6;
        vec3 tint = mix(vec3(.85,.92,1.15), vec3(1.15,1.,.85), h(id*5.1));
        c = mix(c, c*k*mix(vec3(1.), tint, .5) + sp*vec3(.6,.65,.7), uStarOn); } }
      gl_FragColor = vec4(c + uFlash*vec3(.55,.6,.75)*(.4+.6*c), 1.); }` });
const meshes = { sky: quad(skyMat, LAYERS[0].scale) };

// облака: дрейф по x с заворотом, у каждого слоя своя скорость
const cloudFrag = `uniform sampler2D uTex; uniform float uX, uA, uFlash; varying vec2 vUv; void main(){ vec4 c = texture2D(uTex, vec2(abs(fract((vUv.x + uX)*.5)*2.-1.), vUv.y)); if (c.a < .01) discard; gl_FragColor = vec4(c.rgb + uFlash*.5, c.a*uA); }`;
const cloudOrder = order; const cloudGroup = { position: { set: (x, y) => { for (const c of clouds) c.mesh.position.set(W / 2 + x, H / 2 + y, 0); } } };
let clouds = [];
function buildClouds() {
  for (const c of clouds) { scene.remove(c.mesh); c.mesh.material.dispose(); }
  clouds = [...skyAssets('dusk').clouds, ...skyAssets('storm').clouds].map((n, i) => {
    const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: cloudFrag, transparent: true, depthTest: false, depthWrite: false,
      uniforms: { uTex: { value: tex(n) }, uX: { value: Math.random() }, uA: { value: 0 }, uFlash: { value: 0 } } });
    mat.uniforms.uTex.value.wrapS = THREE.RepeatWrapping;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W * LAYERS[1].scale, H * LAYERS[1].scale), mat); mesh.position.set(W / 2, H / 2, 0); mesh.renderOrder = cloudOrder; scene.add(mesh);
    return { mesh, mat, storm: n === 'clouds_storm', speed: 0.002 * (0.6 + (i % 3) * 0.35) };
  });
}
order++; buildClouds();

// город: слой + маска (r окна, g фаза кластера, b неон)
const cityFrag = `uniform sampler2D uTex, uMask; uniform float uT, uLights, uSeed, uFlash; uniform vec3 uGrade; varying vec2 vUv;
  float h(float n){ return fract(sin(n*12.9898+uSeed)*43758.5453); }
  void main(){
    vec4 c = texture2D(uTex, vUv); if (c.a < .01) discard;
    vec3 m = texture2D(uMask, vUv).rgb; vec3 col = c.rgb*uGrade;
    float ph = floor(m.g*255. + .5);                    // id компоненты: всё окно/вся полоса — одна фаза
    if (m.r > .5) {
      float per = 25. + 20.*h(ph*1.7);                  // своё окно времени у каждого окна, 25–45 с
      float tt = uT/per + h(ph*2.3); float slot = floor(tt); float f = fract(tt);
      float off = step(.96, h(ph + slot*7.1)) * smoothstep(.0, .08, f) * (1. - smoothstep(.55, .63, f));
      float k = mix(.35, 1.25, uLights) * (1. - .7*off);
      col = col*k + vec3(.08,.05,0.)*uLights*(1. - off);
    }
    if (m.b > .5) {
      float pulse = .9 + .1*sin(uT*1.1 + ph*.37);
      float gs = floor(uT*4.); float gl = step(.997, h(gs + ph*.13)) * .25;
      float k = mix(.4, 1.3, uLights) * pulse * (1. - gl);
      col = col*k + col*col*.2*uLights;
    }
    col += uFlash*.25*c.rgb;
    gl_FragColor = vec4(col, c.a);
  }`;
for (const L of LAYERS.slice(2)) {
  const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: cityFrag, transparent: true, depthTest: false, depthWrite: false,
    uniforms: { uTex: { value: tex(L.id) }, uMask: { value: tex(L.id + '_fx', 'masks/') }, uT: T, uLights: { value: settings.lights }, uSeed: { value: order * 3.7 }, uFlash: { value: 0 }, uGrade: { value: new THREE.Vector3(...BP.grade) } } });
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
// Свет ламп: диффуз по псевдонормалям (masks/room_nrm rg), блики по блеску (b), свечение излучателей (masks/room_emit),
// ореол и слабое отражение в стекле на прозрачных пикселях. Свет квантуется по ступеням — пиксельный вид.
const LP = LAMP_IDS.map((id) => LAMPS[id]);
const roomMat = new THREE.ShaderMaterial({ vertexShader: vert, transparent: true, depthTest: false, depthWrite: false,
  uniforms: { uTex: { value: tex('room') }, uNrm: { value: tex('room_nrm', 'masks/') }, uEmit: { value: tex('room_emit', 'masks/') }, uLitL: { value: tex('lit_left', 'masks/') }, uLitR: { value: tex('lit_right', 'masks/') }, uFlash: { value: 0 }, uT: T,
    uI: { value: new THREE.Vector2(0, 0) }, uTint: { value: new THREE.Vector3(...BP.room) }, uLow: { value: LOW ? 1 : 0 }, uRadio: { value: new THREE.Vector2(0, 0) } },
  fragmentShader: `uniform sampler2D uTex, uNrm, uEmit, uLitL, uLitR; uniform float uFlash, uT, uLow; uniform vec2 uI, uRadio; uniform vec3 uTint; varying vec2 vUv;
    const vec3 C0 = vec3(${LP[0].color.join(',')}); const vec3 C1 = vec3(${LP[1].color.join(',')});
    vec3 lampPos(int i, vec2 p){ if (i == 0) return vec3(${LP[0].pos[0]}., ${LP[0].pos[1]}., 40.); return vec3(${LP[1].pos[0]}., clamp(p.y, ${LP[1].seg[0]}., ${LP[1].seg[1]}.), 30.); }
    void main(){
      vec4 c = texture2D(uTex, vUv); vec2 p = floor(vec2(vUv.x*${W}., (1.-vUv.y)*${H}.)) + .5;
      vec4 nt = texture2D(uNrm, vUv); vec3 n = vec3(nt.rg*2.-1., 0.); n.z = sqrt(max(.05, 1. - dot(n.xy, n.xy))); float gloss = nt.b;
      vec3 em = texture2D(uEmit, vUv).rgb; vec3 add = vec3(0.); vec3 lit = vec3(0.); float halo = 0.; vec3 haloC = vec3(0.); float refl = 0.;
      for (int i = 0; i < 2; i++) {
        float I = i == 0 ? uI.x : uI.y; if (I < .001) continue; vec3 C = i == 0 ? C0 : C1; float R = i == 0 ? ${LP[0].radius}. : ${LP[1].radius}.;
        I *= 1. + .02*sin(uT*13.1 + float(i)*2.) * sin(uT*7.3 + float(i));
        vec3 L = lampPos(i, p) - vec3(p, 0.); float d = length(L.xy); vec3 l = normalize(vec3(L.x, L.y, L.z));
        float att = 1. / (1. + (d/R)*(d/R)*4.) * (1. - smoothstep(R*1.4, R*2.4, d));
        float diff = uLow > .5 ? .7 : max(dot(n, l), 0.)*.75 + .25;
        float q = floor(att*diff*I*14. + .5)/14.;
        if (false) { vec3 hv = normalize(l + vec3(0.,0.,1.)); float sp = pow(max(dot(n, hv), 0.), 36.) * gloss * att * I; add += C * floor(sp*10. + .5)/10. * .55; }
        halo += I * exp(-d*d/(i == 0 ? 1100. : 1800.)) * .6; haloC += C * I * exp(-d*d/(i == 0 ? 900. : 1400.));
        float mx = i == 0 ? ${2 * 243 - LP[0].pos[0]}. : ${2 * 1577 - LP[1].pos[0]}.; vec2 mp = vec2(mx, lampPos(i, p).y);
        refl += I * exp(-dot(p - mp, p - mp)/(i == 0 ? 600. : 900.)) * .2;
        if (i == 0) add += C*em.r*I*.35; else add += C*em.g*I*.3;
      }
      vec3 hc = haloC / max(halo/.55, 1e-3);
      if (c.a < .01) { float a = min(.5, halo*.35 + refl); if (a < .004) discard; gl_FragColor = vec4(hc, a); return; }
      float fl0 = 1. + .02*sin(uT*13.1)*sin(uT*7.3), fl1 = 1. + .02*sin(uT*13.1 + 2.)*sin(uT*7.3 + 1.);
      vec3 col = c.rgb*uTint + texture2D(uLitL, vUv).rgb*uI.x*fl0 + texture2D(uLitR, vUv).rgb*uI.y*fl1 + add + hc*halo*.22;
      // радио: шкала светится тёплым, зелёный индикатор, мягкое пятно на корпусе; hover — лёгкая подсветка
      if (uRadio.x + uRadio.y > .001) {
        vec2 d0 = vec2(${RADIO.dial[0]}., ${RADIO.dial[1]}.), d1 = vec2(${RADIO.dial[2]}., ${RADIO.dial[3]}.);
        float inD = step(d0.x, p.x)*step(p.x, d1.x)*step(d0.y, p.y)*step(p.y, d1.y);
        float lum = dot(c.rgb, vec3(.3,.59,.11));
        col += inD*vec3(1.,.62,.25)*(.10 + lum*1.6)*uRadio.x*(1. + .03*sin(uT*5.3));
        vec2 dc = clamp(p, d0, d1); float dd = length(p - dc);
        col += vec3(1.,.6,.25)*exp(-dd*dd/260.)*.10*uRadio.x*(1. - inD);
        vec2 lp = p - vec2(${RADIO.led[0]}., ${RADIO.led[1]}.); float led = exp(-dot(lp, lp)/3.); col += vec3(.25,1.,.35)*led*uRadio.x*.9 + vec3(.2,.9,.3)*exp(-dot(lp, lp)/40.)*.12*uRadio.x;
        vec2 h0 = vec2(${RADIO.hit[0]}., ${RADIO.hit[1]}.), h1 = vec2(${RADIO.hit[2]}., ${RADIO.hit[3]}.);
        col += c.rgb*.18*uRadio.y*step(h0.x, p.x)*step(p.x, h1.x)*step(h0.y, p.y)*step(p.y, h1.y);
      }
      gl_FragColor = vec4(col*(1.+uFlash*.35), c.a);
    }` });
meshes.room = quad(roomMat, 1 + (ROOM_PARALLAX * 2) / W);

// ---------- ввод ----------
let mouse = [0, 0], cur = [0, 0];
if (PARALLAX_ON) window.addEventListener('pointermove', (e) => { mouse = [(e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1]; });

// ---------- звук и меню (как в rainroom) ----------
const audio = new Ambience(); audio.set(settings.volume, settings.rain);
// радио — как в rainroom: Tuner (CORS-плеер через WebAudio + запасной), помехи в Ambience
let muted = false, audioUnlocked = false;
const tuner = new Tuner({ audio, onName: (name) => { $('station').textContent = name || (settings.radio ? 'нет сигнала' : '—'); const s = tuner.cur(); if (name && s) { settings.radioStation = s.id; saveSettings(settings); hint('📻 ' + name); } } });
tuner.load(import.meta.env.BASE_URL + 'stations.json'); tuner.setVolume(settings.radioVol);
function syncTuner() {
  if (!audioUnlocked) return; const on = settings.radio, v = muted ? 0 : settings.radioVol;
  audio.setRadio(on, settings.radioVol); tuner.setVolume(v);
  if (on !== tuner.on) { tuner.setOn(on, settings.radioStation); if (!on) $('station').textContent = '—'; }
}
function setRadio(on) { if (settings.radio === !!on) return; settings = { ...settings, radio: !!on }; saveSettings(settings); audio.click(); syncTuner(); hint(on ? '📻 Радио' : 'Радио выкл'); renderUI(); }
function nextStation(d = 1) { if (settings.radio) tuner.turn(d); else setRadio(true); }
document.getElementById('bg').style.backgroundImage = `url(${BASE}room.png)`;
const $ = (id) => document.getElementById(id);
const toast = $('toast'); let toastT;
function hint(text) { toast.textContent = text; toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('show'), 2600); }
const SKY_NAMES = { dusk: 'Сумерки', night: 'Ночь', day: 'День', storm: 'Гроза' };
const SLIDERS = ['cloudSpeed', 'lights', 'rain', 'parallax', 'volume'];
function renderUI() {
  for (const b of document.querySelectorAll('#skyseg .seg')) b.classList.toggle('sel', b.dataset.sky === settings.sky);
  $('cloudsbtn').classList.toggle('on', settings.clouds); $('cloudsbtn').setAttribute('aria-pressed', String(settings.clouds));
  $('cloudrow').classList.toggle('collapsed', !settings.clouds);
  for (const k of SLIDERS) if (document.activeElement !== $(k)) $(k).value = Math.round(settings[k] * 100);
  $('parallax').disabled = !PARALLAX_ON;
  $('radiobtn').classList.toggle('on', settings.radio); $('radiobtn').setAttribute('aria-pressed', String(settings.radio));
  $('radiorow').classList.toggle('collapsed', !settings.radio); if (document.activeElement !== $('radiovol')) $('radiovol').value = Math.round(settings.radioVol * 100);
  for (const id of LAMP_IDS) { const b = $('lamp_' + id); b.classList.toggle('on', settings.lamps[id]); b.setAttribute('aria-pressed', String(settings.lamps[id])); }
}
function update(patch) {
  const prevSky = settings.sky; settings = { ...settings, ...patch }; saveSettings(settings);
  if (settings.sky !== prevSky) { tr = startTransition(tr, settings.sky, TT); hint(SKY_NAMES[settings.sky]); }
  renderUI();
}
for (const b of document.querySelectorAll('#skyseg .seg')) b.addEventListener('click', () => update({ sky: b.dataset.sky }));
$('cloudsbtn').addEventListener('click', () => update({ clouds: !settings.clouds }));
for (const k of SLIDERS) $(k).addEventListener('input', (e) => update({ [k]: e.target.value / 100 }));
function setLamp(id) { settings = toggleLamp(settings, id); saveSettings(settings); audio.click(); renderUI(); }
for (const id of LAMP_IDS) $('lamp_' + id).addEventListener('click', () => setLamp(id));
$('radiobtn').addEventListener('click', () => setRadio(!settings.radio));
$('radiovol').addEventListener('input', (e) => { settings = { ...settings, radioVol: e.target.value / 100 }; saveSettings(settings); syncTuner(); });
$('stprev').addEventListener('click', () => tuner.turn(-1)); $('stnext').addEventListener('click', () => tuner.turn(1));
const canvas = renderer.domElement;
const scenePt = (e) => clientToScene(e.clientX, e.clientY, canvas.getBoundingClientRect());
const lampAt = (e) => hitLamp(...scenePt(e)), radioAt = (e) => hitRadio(...scenePt(e));
let radioHover = false;
window.addEventListener('pointermove', (e) => { const over = e.target === canvas; radioHover = over && radioAt(e); canvas.style.cursor = over && (lampAt(e) || radioHover) ? 'pointer' : ''; });
canvas.addEventListener('click', (e) => { const id = lampAt(e); if (id) setLamp(id); else if (radioAt(e)) setRadio(!settings.radio); });
const muteBtn = $('mute');
function toggleMute() { muted = !muted; syncTuner(); muteBtn.querySelector('span').textContent = muted ? 'Звук выкл' : 'Звук'; muteBtn.classList.toggle('off', muted); }
muteBtn.addEventListener('click', toggleMute);
function toggleFs() { const d = document, el = d.documentElement; if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d); else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el); }
$('fs').addEventListener('click', toggleFs);
let idleTimer = 0;
function wake() { document.body.classList.remove('idle'); clearTimeout(idleTimer); idleTimer = setTimeout(() => document.body.classList.add('idle'), 6000); }
const overlay = $('overlay'); let started = false;
function firstInteraction() { audio.start(); if (!audioUnlocked) { audioUnlocked = true; syncTuner(); } if (!started) { started = true; overlay.classList.add('gone'); } }
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
  else if ('lLдД'.includes(k)) setLamp('left'); else if ('kKлЛ'.includes(k)) setLamp('right');
  else if ('rRкК'.includes(k)) setRadio(!settings.radio); else if ('nNтТ'.includes(k)) nextStation(1);
  else if ('mMьЬ'.includes(k)) toggleMute(); else if ('fFаА'.includes(k)) toggleFs();
}, { capture: true });
window.addEventListener('wheel', (e) => { if (hud.contains(e.target)) return; if (e.target === canvas && radioAt(e) && settings.radio) { tuner.turn(Math.sign(e.deltaY)); return; } update({ rain: Math.min(1, Math.max(0, Math.round((settings.rain - Math.sign(e.deltaY) * 0.05) * 20) / 20)) }); }, { passive: true });
renderUI(); wake();

// ---------- кадр ----------
let last = performance.now(), rainShown = settings.rain, flash = 0, nextBolt = 8 + Math.random() * 20, fps = 60;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now; T.value += dt; fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
  const k = 1 - Math.exp(-dt * 4); cur = [cur[0] + (mouse[0] - cur[0]) * k, cur[1] + (mouse[1] - cur[1]) * k];
  const st = PARALLAX_ON ? settings.parallax : 0;
  for (const L of LAYERS) { const m = L.id === 'clouds' ? cloudGroup : meshes[L.id]; const [ox, oy] = layerOffset(L, cur[0], cur[1], st).map(Math.round); /* целые пиксели — без мерцания краёв при NEAREST */ if (m === cloudGroup) m.position.set(ox, oy, 0); else m.position.set(W / 2 + ox, H / 2 + oy, 0); }
  meshes.room.position.set(W / 2 - Math.round(cur[0] * ROOM_PARALLAX * st), H / 2 + Math.round(cur[1] * ROOM_PARALLAX * st), 0);
  tr = stepTransition(tr, dt); BP = blendParams(tr.weights); const ws = tr.weights[3];
  skyMat.uniforms.uW.value.set(...tr.weights);
  for (const c of clouds) { const a = c.storm ? 0.75 * ws : 0.9 * (1 - ws); c.mat.uniforms.uA.value = a; c.mesh.visible = a > 0.003 && settings.clouds && !NOFX.has('clouds'); }
  const rainEff = Math.min(1, settings.rain + BP.rainAdd * (1 - settings.rain));
  audio.set(muted ? 0 : settings.volume, rainEff);
  for (const c of clouds) c.mat.uniforms.uX.value = (c.mat.uniforms.uX.value + dt * c.speed * settings.cloudSpeed) % 1;
  // молния — только в грозу
  if (BP.storm > 0.85 && !NOFX.has('lightning')) { nextBolt -= dt; if (nextBolt < 0) { flash = 1; nextBolt = 12 + Math.random() * 30; } }
  flash = Math.max(0, flash - dt * 3.5); const fl = flash * (0.6 + 0.4 * Math.sin(T.value * 60));
  skyMat.uniforms.uFlash.value = fl; skyMat.uniforms.uStarOn.value = NOFX.has('stars') || LOW ? 0 : BP.stars; roomMat.uniforms.uFlash.value = fl * 0.3; for (const c of clouds) c.mat.uniforms.uFlash.value = fl;
  for (const L of LAYERS.slice(2)) { const u = meshes[L.id].material.uniforms; u.uFlash.value = fl; u.uGrade.value.set(...BP.grade); if (!NOFX.has('city')) u.uLights.value = settings.lights * BP.lights; }
  roomMat.uniforms.uTint.value.set(...BP.room);
  { const f = 1 - Math.exp(-dt / 0.1); const u = roomMat.uniforms.uI.value; u.x += ((settings.lamps.left ? 1 : 0) - u.x) * f; u.y += ((settings.lamps.right ? 1 : 0) - u.y) * f; }
  { const u = roomMat.uniforms.uRadio.value, f = Math.min(1, dt / RADIO.fade); u.x += Math.sign((settings.radio ? 1 : 0) - u.x) * Math.min(Math.abs((settings.radio ? 1 : 0) - u.x), f); u.y += ((radioHover ? 1 : 0) * (1 - u.x) * 0.6 - u.y) * Math.min(1, dt * 8); }
  tuner.update(dt);
  rainShown += (rainEff - rainShown) * (1 - Math.exp(-dt * 1.2)); const RP = rainParams(rainShown);
  rainU.uRainDen.value = RP.density; rainU.uRainLen.value = RP.length; rainU.uRainSlant.value = 0.03 + RP.slant * 0.15; rainU.uRainA.value = RP.alpha; rainU.uRainT.value = (rainU.uRainT.value + dt * RP.speed) % 1800;
  renderer.render(scene, camera); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__nightcity = { state: () => ({ ...settings, parallaxOn: PARALLAX_ON, offsets: LAYERS.map((L) => layerOffset(L, cur[0], cur[1], PARALLAX_ON ? settings.parallax : 0).map((v) => +v.toFixed(1))) }), fps: () => fps, bolt: () => { flash = 1; }, lamps: () => roomMat.uniforms.uI.value.toArray(), radio: () => ({ on: settings.radio, shown: +roomMat.uniforms.uRadio.value.x.toFixed(2), state: tuner.state, name: tuner.cur()?.name, n: tuner.list.length }), tuner, sky: (p) => update({ sky: p }), transition: () => ({ weights: tr.weights.map((v) => +v.toFixed(3)), progress: +progress(tr).toFixed(3), target: tr.target }) };
