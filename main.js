import * as THREE from "./vendor/three.module.min.js";
import { PRIZES } from "./prizes.js";
import { Store } from "./store.js";

const $ = selector => document.querySelector(selector);
const statusEl = $("#status");
const dropButton = $("#drop");
const progressEl = $("#progress");
const revealEl = $("#reveal");
const exitButton = $("#exit");
const moveButtons = [...document.querySelectorAll(".move")];
const embedded = window.self !== window.top;

if (embedded) {
  exitButton.hidden = false;
  exitButton.addEventListener("click", () => parent.postMessage({ type: "claw:exit" }, "*"));
}

const PAL = {
  ink: 0x453a5e, violet: 0x9375cf, lavender: 0xd9d1ed, pale: 0xf7f5fb,
  mint: 0x65d6cd, coral: 0xe98176, amber: 0xf0c66f, floor: 0xcfc7e3,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe8e4f2);
scene.fog = new THREE.Fog(0xe8e4f2, 11, 23);

const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 50);
const cameraTarget = new THREE.Vector3(0, 2.25, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

function resize() {
  const narrow = innerWidth / innerHeight < 0.76;
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, narrow ? 1.45 : 2));
  camera.aspect = innerWidth / innerHeight;
  camera.fov = narrow ? 47 : 39;
  camera.position.set(narrow ? 0 : 0.15, narrow ? 3.05 : 2.8, narrow ? 9.8 : 8.1);
  camera.lookAt(cameraTarget);
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

scene.add(new THREE.HemisphereLight(0xffffff, 0x82779c, 2.15));
const key = new THREE.DirectionalLight(0xfff7e8, 3.2);
key.position.set(4, 7, 6);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = key.shadow.camera.bottom = -5;
key.shadow.camera.right = key.shadow.camera.top = 5;
scene.add(key);
const insideLight = new THREE.PointLight(PAL.mint, 7, 7, 1.8);
insideLight.position.set(-1.25, 3.9, 0.2);
scene.add(insideLight);
const warmLight = new THREE.PointLight(PAL.amber, 5, 5, 1.8);
warmLight.position.set(1.35, 3.5, 0.8);
scene.add(warmLight);

const mat = (color, roughness = 0.55, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const violetMat = mat(PAL.violet, 0.34, 0.08);
const darkMat = mat(PAL.ink, 0.3, 0.55);
const paleMat = mat(PAL.pale, 0.48);
const metalMat = mat(0xbfc1d4, 0.22, 0.82);
const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xdffbff, transparent: true, opacity: 0.12, roughness: 0.06, metalness: 0, depthWrite: false, side: THREE.DoubleSide });

function mesh(geometry, material, parent = scene) {
  const object = new THREE.Mesh(geometry, material);
  object.castShadow = object.receiveShadow = true;
  parent.add(object);
  return object;
}

function box(w, h, d, material, x, y, z, parent = scene) {
  const object = mesh(new THREE.BoxGeometry(w, h, d), material, parent);
  object.position.set(x, y, z);
  return object;
}

// 地板與機台。玻璃櫃體只做薄面，四角實體框架負責建立輪廓。
const floor = mesh(new THREE.PlaneGeometry(28, 28), mat(PAL.floor, 0.88));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;

const machine = new THREE.Group();
scene.add(machine);
box(4.7, 0.72, 3.65, violetMat, 0, 0.36, 0, machine);
box(4.46, 0.22, 3.35, paleMat, 0, 0.78, 0, machine);
box(4.72, 0.36, 3.66, violetMat, 0, 4.46, 0, machine);
box(4.2, 0.07, 3.05, mat(0xb6acd2, 0.9), 0, 0.92, 0, machine);

for (const x of [-2.21, 2.21]) for (const z of [-1.66, 1.66]) {
  box(0.16, 3.55, 0.16, darkMat, x, 2.65, z, machine);
}
box(4.38, 0.13, 0.13, darkMat, 0, 4.2, 1.66, machine);
box(4.38, 0.13, 0.13, darkMat, 0, 4.2, -1.66, machine);
box(0.13, 0.13, 3.25, darkMat, -2.21, 4.2, 0, machine);
box(0.13, 0.13, 3.25, darkMat, 2.21, 4.2, 0, machine);
box(4.35, 3.25, 0.025, glassMat, 0, 2.55, 1.67, machine).castShadow = false;
box(0.025, 3.25, 3.2, glassMat, -2.22, 2.55, 0, machine).castShadow = false;
box(0.025, 3.25, 3.2, glassMat, 2.22, 2.55, 0, machine).castShadow = false;

// 落物口與控制台。
box(1.15, 0.16, 0.85, darkMat, -1.46, 0.94, 1.1, machine);
box(1.03, 0.03, 0.73, mat(0x211b2f, 0.9), -1.46, 1.035, 1.1, machine);
const consoleTop = box(1.3, 0.22, 0.86, paleMat, 1.38, 0.93, 1.52, machine);
consoleTop.rotation.x = -0.08;
const redButton = mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.12, 24), mat(PAL.coral, 0.28), machine);
redButton.position.set(1.38, 1.11, 1.5);

// 機頂招牌用 CanvasTexture，避免額外字型與圖片依賴。
const signCanvas = document.createElement("canvas");
signCanvas.width = 768; signCanvas.height = 160;
const signContext = signCanvas.getContext("2d");
const gradient = signContext.createLinearGradient(0, 0, 768, 0);
gradient.addColorStop(0, "#7658b5"); gradient.addColorStop(.52, "#a88cdd"); gradient.addColorStop(1, "#65d6cd");
signContext.fillStyle = gradient; signContext.fillRect(0, 0, 768, 160);
signContext.fillStyle = "rgba(255,255,255,.18)";
for (let x = 20; x < 768; x += 52) signContext.fillRect(x, 20 + (x % 104), 18, 18);
signContext.fillStyle = "#fff"; signContext.textAlign = "center"; signContext.textBaseline = "middle";
signContext.font = "700 66px sans-serif"; signContext.fillText("GLITCH CLAW", 384, 79);
const signTexture = new THREE.CanvasTexture(signCanvas); signTexture.colorSpace = THREE.SRGBColorSpace;
const sign = mesh(new THREE.PlaneGeometry(4.1, .86), new THREE.MeshBasicMaterial({ map: signTexture }), machine);
sign.position.set(0, 4.52, 1.84);

// 背景只留下幾台失焦感的機器，讓娃娃機仍是畫面中心。
for (let i = 0; i < 7; i++) {
  const x = -7.2 + i * 2.4;
  const bg = box(1.45, 3.25, 1.25, mat(i % 2 ? 0x86bdb8 : 0xae9bd3, .62), x, 1.62, -4.6);
  box(1.05, 1.25, .04, new THREE.MeshBasicMaterial({ color: i % 2 ? 0xf0c66f : 0x7f69b0 }), x, 2.05, -3.95);
  bg.castShadow = false;
}

const textureLoader = new THREE.TextureLoader();
const dolls = [];
const startingPositions = [
  [0.02, 0.22, 0.08], [-.83, 0.13, -.28], [.88, 0.14, -.22],
  [-1.45, 0.16, .35], [1.45, 0.17, .34], [-.62, 0.18, .76], [.66, 0.17, .72],
];

function sphere(parent, radius, color, x, y, z, scale = [1, 1, 1]) {
  const object = mesh(new THREE.SphereGeometry(radius, 24, 16), mat(color, .82), parent);
  object.position.set(x, y, z); object.scale.set(...scale);
  return object;
}

function createDoll(prize, index) {
  const doll = new THREE.Group();
  const [x, rot, z] = startingPositions[index];
  doll.position.set(x, .96, z); doll.rotation.y = rot;
  machine.add(doll);
  sphere(doll, .34, prize.color, 0, .42, 0, [1, .93, .9]);
  sphere(doll, .33, prize.color, 0, -.05, 0, [.83, 1.05, .67]);
  sphere(doll, .14, prize.color, -.31, .0, 0, [.65, 1.15, .7]);
  sphere(doll, .14, prize.color, .31, .0, 0, [.65, 1.15, .7]);
  sphere(doll, .15, prize.color, -.17, -.36, 0, [.72, 1.15, .8]);
  sphere(doll, .15, prize.color, .17, -.36, 0, [.72, 1.15, .8]);

  // 耳朵／角／髮飾用不同剪影區分角色。
  if (["catgrass", "bambi", "blackhole"].includes(prize.id)) {
    for (const side of [-1, 1]) {
      const ear = mesh(new THREE.ConeGeometry(.15, .32, 4), mat(prize.color, .82), doll);
      ear.position.set(side * .22, .73, 0); ear.rotation.z = side * -.22;
    }
  } else {
    const tuft = mesh(new THREE.ConeGeometry(.11, .27, 5), mat(prize.accent, .76), doll);
    tuft.position.set(-.13, .76, .01); tuft.rotation.z = -.34;
  }
  for (const side of [-1, 1]) sphere(doll, .04, 0x302940, side * .12, .46, .29, [1, 1.3, .6]);
  const badgeTexture = textureLoader.load(prize.avatar);
  badgeTexture.colorSpace = THREE.SRGBColorSpace;
  const badge = mesh(new THREE.CircleGeometry(.16, 28), new THREE.MeshBasicMaterial({ map: badgeTexture, transparent: true }), doll);
  badge.position.set(0, -.04, .235);
  doll.userData = { prize, home: new THREE.Vector3(x, .96, z), index };
  dolls.push(doll);
  return doll;
}
PRIZES.forEach(createDoll);

// 吊車、纜線與三爪。
const railX = box(4.05, .11, .11, metalMat, 0, 4.02, 0, machine);
const railZ = box(.11, .09, 2.75, metalMat, 0, 3.93, 0, machine);
const crane = new THREE.Group();
crane.position.set(0, 0, .2); machine.add(crane);
const trolley = box(.44, .24, .44, darkMat, 0, 3.91, 0, crane);
const cable = mesh(new THREE.CylinderGeometry(.018, .018, 1, 10), darkMat, crane);
const claw = new THREE.Group(); crane.add(claw);
const clawHead = mesh(new THREE.CylinderGeometry(.18, .22, .28, 20), metalMat, claw);
const prongs = [];
for (let i = 0; i < 3; i++) {
  const pivot = new THREE.Group();
  pivot.rotation.y = i * Math.PI * 2 / 3;
  claw.add(pivot);
  const arm = mesh(new THREE.CylinderGeometry(.025, .035, .66, 10), metalMat, pivot);
  arm.position.set(.14, -.3, 0); arm.rotation.z = -.45;
  const tip = mesh(new THREE.SphereGeometry(.06, 12, 8), metalMat, pivot);
  tip.position.set(.28, -.59, 0);
  prongs.push({ pivot, arm, tip });
}

let clawY = 3.34;
function setClawHeight(y) {
  clawY = y; claw.position.y = y;
  const length = Math.max(.08, 3.78 - y);
  cable.scale.y = length; cable.position.y = y + length / 2;
}
setClawHeight(clawY);

function setProng(open) {
  const angle = THREE.MathUtils.lerp(-.15, -.48, open);
  for (const part of prongs) {
    part.arm.rotation.z = angle;
    part.tip.position.x = THREE.MathUtils.lerp(.14, .28, open);
    part.tip.position.y = THREE.MathUtils.lerp(-.62, -.59, open);
  }
}
setProng(1);

const held = new Set();
const keyMap = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", ArrowUp: "forward", w: "forward", W: "forward", ArrowDown: "back", s: "back", S: "back" };
function releaseAll() { held.clear(); moveButtons.forEach(button => button.classList.remove("active")); }
moveButtons.forEach(button => {
  const down = event => { event.preventDefault(); if (phase === "idle") { held.add(button.dataset.dir); button.classList.add("active"); beep(340, .035, .025); } };
  const up = event => { event.preventDefault(); held.delete(button.dataset.dir); button.classList.remove("active"); };
  button.addEventListener("pointerdown", down); button.addEventListener("pointerup", up); button.addEventListener("pointercancel", up); button.addEventListener("pointerleave", up);
});
addEventListener("keydown", event => {
  if (keyMap[event.key]) { event.preventDefault(); held.add(keyMap[event.key]); }
  if (event.code === "Space" && !event.repeat) { event.preventDefault(); startGrab(); }
});
addEventListener("keyup", event => { if (keyMap[event.key]) held.delete(keyMap[event.key]); });
addEventListener("blur", releaseAll);

let audioContext;
function beep(frequency, duration = .09, volume = .04, type = "sine") {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
  } catch (_) { /* 沒有音效仍可玩。 */ }
}

let phase = "idle";
let phaseTime = 0;
let phaseStart = {};
let caught = null;
let forcedPrizeId = null;
const chute = new THREE.Vector2(-1.46, 1.1);

function setControls(enabled) {
  dropButton.disabled = !enabled;
  moveButtons.forEach(button => { button.disabled = !enabled; });
  if (!enabled) releaseAll();
}

function setStatus(text) { statusEl.textContent = text; }

function startGrab() {
  if (phase !== "idle") return;
  phase = "dropping"; phaseTime = 0; phaseStart.y = clawY;
  setControls(false); setStatus("吊爪下降中……");
  beep(190, .2, .055, "square");
}
dropButton.addEventListener("click", startGrab);

function nearestDoll() {
  if (forcedPrizeId) {
    const forced = dolls.find(doll => doll.userData.prize.id === forcedPrizeId);
    forcedPrizeId = null;
    return forced;
  }
  let best = null, distance = Infinity;
  for (const doll of dolls) {
    if (!doll.visible) continue;
    const d = Math.hypot(doll.position.x - crane.position.x, doll.position.z - crane.position.z);
    if (d < distance) { best = doll; distance = d; }
  }
  return distance < .6 ? best : null;
}

function attachCaught() {
  caught = nearestDoll();
  if (!caught) return;
  claw.attach(caught);
  caught.position.set(0, -.69, 0);
  caught.rotation.set(0, 0, .08);
}

function enter(next, start = {}) { phase = next; phaseTime = 0; phaseStart = start; }
const ease = value => value < .5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;

function finishRound() {
  const prize = caught?.userData.prize || null;
  Store.finish(prize?.id);
  renderProgress();
  if (prize) {
    beep(523, .16, .05); setTimeout(() => beep(659, .18, .05), 100); setTimeout(() => beep(784, .3, .05), 210);
    revealEl.innerHTML = `<div class="revealCard"><div class="eyebrow">成功抓取</div><img src="${prize.avatar}" alt="${prize.name}"><h2>${prize.name}</h2><p>角色布偶已加入你的收藏。</p><button type="button">再玩一次</button></div>`;
  } else {
    beep(135, .35, .035, "sawtooth");
    revealEl.innerHTML = `<div class="revealCard"><div class="missIcon">🫧</div><h2>差一點點</h2><p>重新對準娃娃的中心，再試一次。</p><button type="button">再玩一次</button></div>`;
  }
  revealEl.classList.add("on");
  revealEl.querySelector("button").focus();
}

function resetRound() {
  revealEl.classList.remove("on");
  if (caught) {
    machine.attach(caught);
    caught.visible = true;
    const angle = caught.userData.index * 1.73 + Store.data.plays * .81;
    caught.position.set(Math.sin(angle) * 1.42, .96, Math.cos(angle) * .62 - .03);
    caught.rotation.set(0, Math.sin(angle) * .25, 0);
  }
  caught = null;
  crane.position.set(0, 0, .2); setClawHeight(3.34); setProng(1);
  phase = "idle"; setControls(true); setStatus("移動吊爪，對準娃娃後按下「抓取」。");
}
revealEl.addEventListener("click", event => { if (event.target.closest("button")) resetRound(); });

function updateGame(dt) {
  phaseTime += dt;
  if (phase === "idle") {
    const speed = 1.55 * dt;
    if (held.has("left")) crane.position.x -= speed;
    if (held.has("right")) crane.position.x += speed;
    if (held.has("forward")) crane.position.z -= speed;
    if (held.has("back")) crane.position.z += speed;
    crane.position.x = THREE.MathUtils.clamp(crane.position.x, -1.72, 1.72);
    crane.position.z = THREE.MathUtils.clamp(crane.position.z, -1.05, 1.12);
    railZ.position.x = crane.position.x;
    return;
  }
  if (phase === "dropping") {
    const p = Math.min(phaseTime / 1.18, 1);
    setClawHeight(THREE.MathUtils.lerp(phaseStart.y, 1.72, ease(p)));
    if (p === 1) { enter("closing"); beep(280, .13, .05, "square"); }
  } else if (phase === "closing") {
    const p = Math.min(phaseTime / .62, 1); setProng(1 - ease(p));
    if (p === 1) { attachCaught(); enter("rising", { y: clawY }); setStatus(caught ? "抓住了！正在送往落物口……" : "好像沒有夾到……"); }
  } else if (phase === "rising") {
    const p = Math.min(phaseTime / 1.08, 1); setClawHeight(THREE.MathUtils.lerp(phaseStart.y, 3.34, ease(p)));
    if (caught) caught.rotation.z = Math.sin(phaseTime * 8) * .08;
    if (p === 1) enter("returning", { x: crane.position.x, z: crane.position.z });
  } else if (phase === "returning") {
    const p = Math.min(phaseTime / 1.15, 1), e = ease(p);
    crane.position.x = THREE.MathUtils.lerp(phaseStart.x, chute.x, e);
    crane.position.z = THREE.MathUtils.lerp(phaseStart.z, chute.y, e);
    railZ.position.x = crane.position.x;
    if (p === 1) { enter("releasing"); beep(410, .1, .045); }
  } else if (phase === "releasing") {
    const p = Math.min(phaseTime / .66, 1); setProng(ease(p));
    if (caught && phaseTime > .24) caught.position.y -= dt * 3.1;
    if (p === 1) {
      if (caught) caught.visible = false;
      enter("showing"); setTimeout(finishRound, 260);
    }
  }
}

function renderProgress() {
  progressEl.innerHTML = PRIZES.map(prize => `<div class="prizeSlot ${Store.data.owned.includes(prize.id) ? "has" : ""}" title="${prize.name}"><img src="${prize.avatar}" alt="${prize.name}"></div>`).join("");
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .04);
  updateGame(dt);
  const time = performance.now() * .001;
  dolls.forEach((doll, index) => { if (doll.visible && doll.parent === machine) doll.rotation.z = Math.sin(time * 1.2 + index) * .015; });
  insideLight.intensity = 6.6 + Math.sin(time * 2.1) * .35;
  renderer.render(scene, camera);
}

await Store.load();
renderProgress();
setControls(true);
animate();

if (new URLSearchParams(location.search).has("test")) {
  window.__clawTest = {
    getState: () => ({ phase, claw: { x: crane.position.x, z: crane.position.z }, store: structuredClone(Store.data), caught: caught?.userData.prize.id || null }),
    setClaw: (x, z) => { if (phase !== "idle") return false; crane.position.x = THREE.MathUtils.clamp(Number(x), -1.72, 1.72); crane.position.z = THREE.MathUtils.clamp(Number(z), -1.05, 1.12); return true; },
    forceWin: id => { if (!PRIZES.some(prize => prize.id === id) || phase !== "idle") return false; forcedPrizeId = id; startGrab(); return true; },
    reset: resetRound,
  };
}
