import * as THREE from "./vendor/three.module.min.js";
import { PRIZES } from "./prizes.js";
import { Store } from "./store.js";

const $ = selector => document.querySelector(selector);
const statusEl = $("#status");
const soundButton = $("#sound");
const progressEl = $("#progress");
const revealEl = $("#reveal");
const collectionEl = $("#collection");
const collectionTitleEl = $("#collectionTitle");
const collectionListEl = $("#collectionList");
const collectionCloseButton = $("#collectionClose");
const exitButton = $("#exit");
const embedded = window.self !== window.top;
const THEME_URL = location.hostname === "localhost" || location.hostname === "127.0.0.1"
  ? "./assets/audio/glitch-park-theme.mp3"
  : "https://yazelin.github.io/glitch-park-claw/assets/audio/glitch-park-theme.mp3";
let themeAudio = null;

// 同一首遊樂園主題曲由同一個播放層負責。獨立開啟時，本頁在瀏覽器允許的
// 第一個使用者手勢後播放；嵌入 Larch 時不建立 Audio，而是請外層播放，
// 切換扭蛋機、娃娃機或未來的小遊戲時，音樂才不會被 iframe 重置。
function requestTheme(action, muted = false) {
  if (embedded) {
    parent.postMessage({ type: "glitch-park:music", action, track: "theme", url: new URL(THEME_URL, location.href).href, muted }, "*");
    return;
  }
  themeAudio ||= Object.assign(new Audio(THEME_URL), { loop: true, preload: "metadata", volume: .27 });
  if (action === "mute") themeAudio.muted = muted;
  if (action === "play" && !muted) themeAudio.play().catch(() => {});
}

if (embedded) {
  exitButton.hidden = false;
  exitButton.addEventListener("click", () => parent.postMessage({ type: "claw:exit" }, "*"));
  requestTheme("play");
}

const PAL = {
  ink: 0x453a5e, violet: 0x9375cf, lavender: 0xd9d1ed, pale: 0xf7f5fb,
  mint: 0x65d6cd, coral: 0xe98176, amber: 0xf0c66f, floor: 0xcfc7e3,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe8e4f2);
scene.fog = new THREE.Fog(0xe8e4f2, 11, 23);

const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 50);
const cameraBase = new THREE.Vector3();
const cameraTarget = new THREE.Vector3(0, 2.82, 0);
const look = { x: 0, y: 0, targetX: 0, targetY: 0 };
const reducedRendering = matchMedia("(pointer: coarse)").matches || innerWidth < 720;
const renderer = new THREE.WebGLRenderer({ antialias: !reducedRendering, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = !reducedRendering;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

function resize() {
  const narrow = innerWidth / innerHeight < 0.76;
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, narrow ? 1.15 : 1.55));
  camera.aspect = innerWidth / innerHeight;
  camera.fov = narrow ? 47 : 39;
  cameraBase.set(narrow ? 0 : 0.12, narrow ? 3.68 : 3.4, narrow ? 11.8 : 10.35);
  camera.position.copy(cameraBase);
  camera.lookAt(cameraTarget);
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

scene.add(new THREE.HemisphereLight(0xffffff, 0x82779c, 2.15));
const key = new THREE.DirectionalLight(0xfff7e8, 3.2);
key.position.set(4, 7, 6);
key.castShadow = !reducedRendering;
key.shadow.mapSize.set(512, 512);
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

// 所有牆面與背景機台共用同一張 4×2 atlas。clone 只建立不同的 UV 視窗，
// image/source 仍指向同一份 WebP，因此瀏覽器只需要下載一次圖片。
const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin(null);
const atlasViews = [];
const atlasMaterialCache = new Map();
const glitchAtlas = textureLoader.load("./assets/glitch-atlas.webp", () => {
  for (const view of atlasViews) view.needsUpdate = true;
});
glitchAtlas.colorSpace = THREE.SRGBColorSpace;
function atlasView(index, aspect = 1, focusY = .5) {
  const view = glitchAtlas.clone();
  const column = index % 4;
  const rowFromTop = Math.floor(index / 4);
  const tileX = column * .25;
  const tileY = rowFromTop === 0 ? .5 : 0;
  let repeatX = .25;
  let repeatY = .5;
  // 每個 atlas 圖格都是正方形。長方形面板只裁掉上下或左右，不把人物
  // 拉寬、壓扁；offset 則讓裁切維持在圖格中央。
  if (aspect > 1) repeatY /= aspect;
  else if (aspect < 1) repeatX *= aspect;
  view.colorSpace = THREE.SRGBColorSpace;
  view.wrapS = view.wrapT = THREE.ClampToEdgeWrapping;
  view.repeat.set(repeatX, repeatY);
  view.offset.set(tileX + (.25 - repeatX) / 2, tileY + (.5 - repeatY) * focusY);
  view.needsUpdate = true;
  atlasViews.push(view);
  return view;
}

function atlasMaterial(index, opacity = 1, aspect = 1, focusY = .5) {
  const key = `${index}:${opacity}:${aspect.toFixed(3)}:${focusY.toFixed(2)}`;
  if (atlasMaterialCache.has(key)) return atlasMaterialCache.get(key);
  const material = new THREE.MeshBasicMaterial({
    map: atlasView(index, aspect, focusY), transparent: opacity < 1, opacity, toneMapped: false,
  });
  atlasMaterialCache.set(key, material);
  return material;
}

const avatarAtlasViews = [];
const avatarAtlas = textureLoader.load("./assets/avatar-atlas.webp", () => {
  for (const view of avatarAtlasViews) view.needsUpdate = true;
});
avatarAtlas.colorSpace = THREE.SRGBColorSpace;
function avatarAtlasView(index) {
  const view = avatarAtlas.clone();
  view.colorSpace = THREE.SRGBColorSpace;
  view.wrapS = view.wrapT = THREE.ClampToEdgeWrapping;
  view.repeat.set(.25, .5);
  view.offset.set((index % 4) * .25, Math.floor(index / 4) === 0 ? .5 : 0);
  view.needsUpdate = true;
  avatarAtlasViews.push(view);
  return view;
}

function mesh(geometry, material, parent = scene) {
  const object = new THREE.Mesh(geometry, material);
  object.castShadow = object.receiveShadow = true;
  parent.add(object);
  return object;
}

const sharedBoxGeometry = new THREE.BoxGeometry(1, 1, 1);
const sharedSphereGeometry = new THREE.SphereGeometry(1, 16, 12);
function box(w, h, d, material, x, y, z, parent = scene) {
  const object = mesh(sharedBoxGeometry, material, parent);
  object.position.set(x, y, z);
  object.scale.set(w, h, d);
  return object;
}

const chuteX = -.82, chuteZ = 1.1;
function surfaceWithChute(w, h, d, material, y, parent) {
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
  const holeX0 = chuteX - .44, holeX1 = chuteX + .44;
  const holeZ0 = chuteZ - .31, holeZ1 = chuteZ + .31;
  box(holeX0 - x0, h, d, material, (x0 + holeX0) / 2, y, 0, parent);
  box(x1 - holeX1, h, d, material, (holeX1 + x1) / 2, y, 0, parent);
  box(holeX1 - holeX0, h, holeZ0 - z0, material, chuteX, y, (z0 + holeZ0) / 2, parent);
  box(holeX1 - holeX0, h, z1 - holeZ1, material, chuteX, y, (holeZ1 + z1) / 2, parent);
}

// 地板與機台。玻璃櫃體只做薄面，四角實體框架負責建立輪廓。
const floorCanvas = document.createElement("canvas");
floorCanvas.width = floorCanvas.height = 256;
const floorContext = floorCanvas.getContext("2d");
for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
  floorContext.fillStyle = (x + y) % 2 ? "#ddd6ed" : "#efe9dc";
  floorContext.fillRect(x * 64, y * 64, 64, 64);
}
floorContext.strokeStyle = "rgba(105,87,145,.12)"; floorContext.lineWidth = 3;
for (let n = 0; n <= 256; n += 64) { floorContext.beginPath(); floorContext.moveTo(n, 0); floorContext.lineTo(n, 256); floorContext.stroke(); floorContext.beginPath(); floorContext.moveTo(0, n); floorContext.lineTo(256, n); floorContext.stroke(); }
const floorTexture = new THREE.CanvasTexture(floorCanvas);
floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping; floorTexture.repeat.set(9, 9); floorTexture.colorSpace = THREE.SRGBColorSpace;
const floor = mesh(new THREE.PlaneGeometry(28, 28), new THREE.MeshStandardMaterial({ map: floorTexture, roughness: .88 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;

// 遊樂園後牆：大面積漸層、拱門、故障訊號線與像素燈，作為角色廣告牆的底圖。
const wallCanvas = document.createElement("canvas");
wallCanvas.width = 1024; wallCanvas.height = 512;
const wallContext = wallCanvas.getContext("2d");
const wallGradient = wallContext.createLinearGradient(0, 0, 0, 512);
wallGradient.addColorStop(0, "#d9d4ec"); wallGradient.addColorStop(.55, "#c9c1e1"); wallGradient.addColorStop(1, "#a99bc9");
wallContext.fillStyle = wallGradient; wallContext.fillRect(0, 0, 1024, 512);
wallContext.fillStyle = "rgba(255,255,255,.18)";
for (let i = 0; i < 28; i++) wallContext.fillRect(24 + (i * 137) % 970, 24 + (i * 83) % 280, 12 + i % 3 * 7, 12 + i % 3 * 7);
wallContext.strokeStyle = "rgba(91,72,132,.18)"; wallContext.lineWidth = 3;
for (let y = 74; y < 460; y += 82) {
  wallContext.beginPath();
  wallContext.moveTo(0, y); wallContext.lineTo(155, y); wallContext.lineTo(190, y + 22);
  wallContext.lineTo(470, y + 22); wallContext.lineTo(505, y); wallContext.lineTo(1024, y);
  wallContext.stroke();
}
wallContext.strokeStyle = "rgba(101,214,205,.35)"; wallContext.lineWidth = 9;
wallContext.beginPath(); wallContext.arc(512, 515, 360, Math.PI, Math.PI * 2); wallContext.stroke();
const wallTexture = new THREE.CanvasTexture(wallCanvas); wallTexture.colorSpace = THREE.SRGBColorSpace;
const backWall = mesh(new THREE.PlaneGeometry(20, 8), new THREE.MeshBasicMaterial({ map: wallTexture }), scene);
backWall.position.set(0, 3.7, -6.25); backWall.castShadow = false;

// 七張角色廣告和七台背景機器一一對齊。影像都來自同一張 atlas，
// 外框與角落像素則保留格莉奇遊樂園的紫、青、珊瑚色發光語彙。
const wallAdOrder = [2, 4, 0, 1, 6, 5, 3];
for (let i = 0; i < 7; i++) {
  const x = -7.2 + i * 2.4;
  const y = i % 2 ? 4.08 : 3.95;
  const accent = [PAL.mint, PAL.coral, PAL.amber][i % 3];
  const frame = box(1.78, 1.78, .1, darkMat, x, y, -6.13); frame.castShadow = false;
  const innerFrame = box(1.62, 1.62, .035, new THREE.MeshBasicMaterial({ color: accent }), x, y, -6.07);
  innerFrame.castShadow = false;
  const poster = mesh(new THREE.PlaneGeometry(1.49, 1.49), atlasMaterial(wallAdOrder[i]));
  poster.position.set(x, y, -6.045); poster.castShadow = false;
  for (const cornerX of [-.77, .77]) for (const cornerY of [-.77, .77]) {
    const pixel = box(.12, .12, .035, new THREE.MeshBasicMaterial({ color: i % 2 ? PAL.mint : 0xe6a6d6 }), x + cornerX, y + cornerY, -6.015);
    pixel.castShadow = false;
  }
}

// 懸掛燈串建立遊樂園的縱深；燈泡只發光，不投動態陰影。
const festoon = new THREE.Group(); scene.add(festoon);
const cordCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-8, 5.4, -3.7), new THREE.Vector3(0, 4.85, -4.2), new THREE.Vector3(8, 5.4, -3.7)]);
const cord = mesh(new THREE.TubeGeometry(cordCurve, 40, .018, 6, false), darkMat, festoon); cord.castShadow = false;
for (let i = 0; i <= 16; i++) {
  const point = cordCurve.getPoint(i / 16);
  const bulbColor = i % 3 === 0 ? PAL.mint : i % 3 === 1 ? PAL.amber : 0xe6a6d6;
  const bulb = sphere(festoon, .07, bulbColor, point.x, point.y - .09, point.z, [1, 1.18, 1]);
  bulb.material.emissive = new THREE.Color(bulbColor); bulb.material.emissiveIntensity = 1.1; bulb.castShadow = false;
}

const machine = new THREE.Group();
scene.add(machine);
// 主機台使用真正落地的高櫃身。下櫃從地板一路延伸到操作台，讓整體輪廓
// 是直立長方形機台，而不是寬大的玻璃展示箱擺在矮方塊上。
machine.position.y = 1.3;
box(2.95, 1.3, 3.65, violetMat, 0, -.65, 0, machine);
box(2.55, 1.08, .04, mat(0x70559e, .5), 0, -.65, 1.855, machine).castShadow = false;
const lowerLightColors = [PAL.mint, 0xe6a6d6, PAL.amber];
const lowerLightHeights = [.36, .58, .44, .68, .42, .56, .34];
const lowerLightOffsets = [.05, -.03, .08, 0, -.07, .04, -.02];
const lowerLightMaterials = lowerLightColors.map(color => new THREE.MeshStandardMaterial({
  color, emissive: color, emissiveIntensity: 1.75, roughness: .24, metalness: .12,
}));
for (let i = 0; i < 7; i++) {
  const x = -.99 + i * .33;
  const height = lowerLightHeights[i];
  const y = -.65 + lowerLightOffsets[i];
  // 深色外框形成內凹燈槽；交錯的發光核心向前凸出，並用菱形燈帽
  // 打破七根等長直條的單調輪廓。
  const pocket = box(.23, height + .14, .075, darkMat, x, y, 1.89, machine);
  pocket.castShadow = false;
  const core = box(i % 2 ? .105 : .13, height, i % 2 ? .045 : .075, lowerLightMaterials[i % 3], x, y, i % 2 ? 1.925 : 1.955, machine);
  core.castShadow = false;
  const cap = box(.105, .105, .055, lowerLightMaterials[(i + 1) % 3], x, y + height / 2 - .015, 1.96, machine);
  cap.rotation.z = Math.PI / 4;
  cap.castShadow = false;
}
box(2.55, .055, .04, new THREE.MeshBasicMaterial({ color: PAL.mint }), 0, -.08, 1.865, machine).castShadow = false;
box(2.55, .055, .04, new THREE.MeshBasicMaterial({ color: 0xe6a6d6 }), 0, -1.22, 1.865, machine).castShadow = false;
const lowerGlowLeft = new THREE.PointLight(PAL.mint, 1.4, 1.7, 2); lowerGlowLeft.position.set(-.62, -.6, 2.06); machine.add(lowerGlowLeft);
const lowerGlowRight = new THREE.PointLight(0xe6a6d6, 1.25, 1.7, 2); lowerGlowRight.position.set(.62, -.6, 2.06); machine.add(lowerGlowRight);
surfaceWithChute(2.95, .72, 3.65, violetMat, .36, machine);
surfaceWithChute(2.71, .22, 3.35, paleMat, .78, machine);
box(2.97, 0.36, 3.66, violetMat, 0, 4.46, 0, machine);
surfaceWithChute(2.45, .07, 3.05, mat(0xb6acd2, .9), .92, machine);

for (const x of [-1.33, 1.33]) for (const z of [-1.66, 1.66]) {
  box(0.16, 3.55, 0.16, darkMat, x, 2.65, z, machine);
}
box(2.62, 0.13, 0.13, darkMat, 0, 4.2, 1.66, machine);
box(2.62, 0.13, 0.13, darkMat, 0, 4.2, -1.66, machine);
box(0.13, 0.13, 3.25, darkMat, -1.33, 4.2, 0, machine);
box(0.13, 0.13, 3.25, darkMat, 1.33, 4.2, 0, machine);
box(2.59, 3.25, 0.025, glassMat, 0, 2.55, 1.67, machine).castShadow = false;
box(0.025, 3.25, 3.2, glassMat, -1.34, 2.55, 0, machine).castShadow = false;
box(0.025, 3.25, 3.2, glassMat, 1.34, 2.55, 0, machine).castShadow = false;
// 後側只留透明玻璃，玩家可以越過娃娃與吊爪直接看見樂園後牆。
box(2.59, 3.25, 0.025, glassMat, 0, 2.55, -1.67, machine).castShadow = false;

// 落物口不是貼在桌上的黑平台：四條框圍出真正的開口，內壁一路往下，
// 再連到機台正面的取物箱。娃娃落下時會實際沉入這個深度。
const chuteInner = mat(0x171321, .92);
box(.14, .14, .9, darkMat, chuteX - .54, .99, chuteZ, machine);
box(.14, .14, .9, darkMat, chuteX + .54, .99, chuteZ, machine);
box(1.22, .14, .14, darkMat, chuteX, .99, chuteZ - .38, machine);
box(1.22, .14, .14, darkMat, chuteX, .99, chuteZ + .38, machine);
box(.08, .62, .72, chuteInner, chuteX - .43, .69, chuteZ, machine);
box(.08, .62, .72, chuteInner, chuteX + .43, .69, chuteZ, machine);
box(.86, .62, .08, chuteInner, chuteX, .69, chuteZ - .27, machine);
box(.86, .1, .62, mat(0x09070d, 1), chuteX, .39, chuteZ, machine);
// 正面取物門：洞內的娃娃會落到這裡，之後才顯示獲得結果。
box(1.02, .48, .025, mat(0x211a31, .78), chuteX, .42, 1.833, machine).castShadow = false;
box(1.16, .08, .07, darkMat, chuteX, .69, 1.84, machine);
box(.08, .58, .07, darkMat, chuteX - .56, .4, 1.84, machine);
box(.08, .58, .07, darkMat, chuteX + .56, .4, 1.84, machine);
const consoleTop = box(1.32, 0.22, 0.9, paleMat, .72, 0.93, 1.49, machine);
consoleTop.rotation.x = -0.08;
const joystickBase = mesh(new THREE.CylinderGeometry(.19, .22, .08, 24), darkMat, machine);
joystickBase.position.set(.25, 1.11, 1.53); joystickBase.userData.control = "joystick";
const joystickPivot = new THREE.Group(); joystickPivot.position.set(.25, 1.14, 1.53); machine.add(joystickPivot);
const joystickStick = mesh(new THREE.CylinderGeometry(.035, .045, .34, 12), metalMat, joystickPivot); joystickStick.position.y = .17;
const joystickKnob = mesh(new THREE.SphereGeometry(.105, 18, 12), mat(PAL.violet, .28), joystickPivot); joystickKnob.position.y = .37; joystickKnob.userData.control = "joystick";
const grabMaterial = new THREE.MeshStandardMaterial({ color: PAL.coral, emissive: PAL.coral, emissiveIntensity: .08, roughness: .28 });
const coinSlotMaterial = new THREE.MeshStandardMaterial({ color: 0x271f35, emissive: PAL.amber, emissiveIntensity: .08, roughness: .32 });
const coinPlate = box(.28, .035, .36, darkMat, .67, 1.1, 1.54, machine);
coinPlate.userData.control = "coin";
const coinSlot = box(.055, .022, .22, coinSlotMaterial, .67, 1.124, 1.54, machine);
coinSlot.userData.control = "coin";
const coinToken = mesh(new THREE.CylinderGeometry(.115, .115, .025, 24), mat(PAL.amber, .28, .42), machine);
coinToken.rotation.z = Math.PI / 2; coinToken.position.set(.67, 1.43, 1.54); coinToken.visible = false;
const grabButton = mesh(new THREE.CylinderGeometry(.17, .19, .11, 24), grabMaterial, machine);
grabButton.position.set(1.08, 1.13, 1.54); grabButton.userData.control = "grab";
const coinGlow = new THREE.PointLight(PAL.amber, 0, 1.2, 2); coinGlow.position.set(.67, 1.35, 1.72); machine.add(coinGlow);
const grabGlow = new THREE.PointLight(PAL.coral, 0, 1.25, 2); grabGlow.position.set(1.08, 1.34, 1.72); machine.add(grabGlow);
const controlHitMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
const joystickHit = mesh(new THREE.CylinderGeometry(.34, .34, .25, 20), controlHitMaterial, machine);
joystickHit.position.set(.25, 1.18, 1.53); joystickHit.userData.control = "joystick"; joystickHit.castShadow = false;
const coinHit = mesh(new THREE.CylinderGeometry(.26, .26, .25, 20), controlHitMaterial, machine);
coinHit.position.set(.67, 1.18, 1.54); coinHit.userData.control = "coin"; coinHit.castShadow = false;
const grabHit = mesh(new THREE.CylinderGeometry(.29, .29, .25, 20), controlHitMaterial, machine);
grabHit.position.set(1.08, 1.19, 1.54); grabHit.userData.control = "grab"; grabHit.castShadow = false;

function panelLabel(text, x) {
  const canvas = document.createElement("canvas"); canvas.width = 256; canvas.height = 96;
  const context = canvas.getContext("2d"); context.fillStyle = "rgba(69,58,94,.82)"; context.fillRect(0, 0, 256, 96);
  context.fillStyle = "#fff"; context.font = "700 43px sans-serif"; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(text, 128, 50);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const label = mesh(new THREE.PlaneGeometry(.34, .13), new THREE.MeshBasicMaterial({ map: texture }), machine);
  label.position.set(x, .94, 1.955); label.castShadow = false;
}
panelLabel("移動", .25); panelLabel("投幣孔", .67); panelLabel("夾取", 1.08);

// 招牌用 CanvasTexture，避免額外字型與圖片依賴。
const signCanvas = document.createElement("canvas");
signCanvas.width = 896; signCanvas.height = 208;
const signContext = signCanvas.getContext("2d");
const gradient = signContext.createLinearGradient(0, 0, 896, 208);
gradient.addColorStop(0, "#35294f"); gradient.addColorStop(.48, "#614a8c"); gradient.addColorStop(1, "#315f67");
signContext.fillStyle = gradient; signContext.fillRect(0, 0, 896, 208);
signContext.strokeStyle = "#8de8e0"; signContext.lineWidth = 12; signContext.strokeRect(15, 15, 866, 178);
signContext.strokeStyle = "rgba(230,166,214,.9)"; signContext.lineWidth = 4; signContext.strokeRect(32, 32, 832, 144);
for (let x = 62; x < 860; x += 76) {
  signContext.beginPath(); signContext.fillStyle = x % 152 ? "#f0c66f" : "#8de8e0"; signContext.arc(x, 28, 7, 0, Math.PI * 2); signContext.fill();
}
signContext.fillStyle = "#fff"; signContext.textAlign = "center"; signContext.textBaseline = "middle";
signContext.shadowColor = "#8de8e0"; signContext.shadowBlur = 18;
signContext.font = "800 70px sans-serif"; signContext.fillText("GLITCH CLAW", 448, 88);
signContext.shadowBlur = 7; signContext.fillStyle = "#e5fffc";
signContext.font = "600 25px sans-serif"; signContext.fillText("格莉奇遊樂園・幸運夾取站", 448, 145);
const signTexture = new THREE.CanvasTexture(signCanvas); signTexture.colorSpace = THREE.SRGBColorSpace;
// 原本架在機頂時，桌機的寬畫面會把字切掉；放到底座中央又會被方向鍵蓋住。
// 改嵌在玻璃櫃上緣的實體橫框，位置較低，而且不占用遊戲畫面與操作區。
const signBack = box(1.55, .46, .13, mat(PAL.ink, .3, .28), .58, .39, 1.76, machine);
const sign = mesh(new THREE.PlaneGeometry(1.42, .33), new THREE.MeshBasicMaterial({ map: signTexture }), machine);
// 底板正面在 z≈1.825；留出明確間距，避免兩個面爭用同一深度而閃爍。
sign.position.set(.58, .39, 1.885);
const signLight = new THREE.PointLight(PAL.mint, 2.6, 3.2, 1.8); signLight.position.set(.58, .48, 2.02); machine.add(signLight);

// 機台正面的像素燈框呼應格莉奇的青色髮飾。
const trimMaterial = new THREE.MeshStandardMaterial({ color: PAL.mint, emissive: PAL.mint, emissiveIntensity: 1.25, roughness: .3 });
box(.045, 3.1, .045, trimMaterial, -1.23, 2.56, 1.71, machine).castShadow = false;
box(.045, 3.1, .045, trimMaterial, 1.23, 2.56, 1.71, machine).castShadow = false;
box(2.45, .045, .045, trimMaterial, 0, 4.08, 1.71, machine).castShadow = false;

// 七台背景機器也使用真正的夾娃娃機結構。角色圖只留在頂牌和下櫃側面；
// 正面是透明玻璃，能看見內凹空間、獎品、吊軌與小夾爪。
for (let i = 0; i < 7; i++) {
  const x = -7.2 + i * 2.4;
  const cabinet = new THREE.Group();
  cabinet.position.set(x, 0, -4.6);
  cabinet.rotation.y = (i - 3) * -.018;
  scene.add(cabinet);
  const bodyColor = i % 2 ? 0x78aaa8 : 0x9682bd;
  const glowColor = [0xf0c66f, 0x78d8cf, 0xe98176][i % 3];
  const cabinetMat = mat(bodyColor, .64);
  const body = box(1.48, .82, 1.28, cabinetMat, 0, .47, 0, cabinet);
  body.castShadow = false;
  box(1.34, .42, 1.34, mat(PAL.ink, .4, .18), 0, 2.83, .01, cabinet);
  box(1.16, .46, .045, new THREE.MeshBasicMaterial({ color: glowColor }), 0, 2.84, .68, cabinet).castShadow = false;
  const marqueeIndex = (i + 1) % 8;
  const marqueeFocus = marqueeIndex === 6 ? .5 : .82;
  const marquee = mesh(new THREE.PlaneGeometry(1.05, .35), atlasMaterial(marqueeIndex, 1, 1.05 / .35, marqueeFocus), cabinet);
  marquee.position.set(0, 2.84, .707); marquee.castShadow = false;
  const innerShadowMaterial = new THREE.MeshBasicMaterial({ color: 0x241d32, transparent: true, opacity: .34, depthWrite: false });
  box(1.12, 1.58, .025, innerShadowMaterial, 0, 1.77, -.56, cabinet).castShadow = false;
  box(1.2, .08, 1.05, mat(0xd7d1e4, .72), 0, .94, 0, cabinet).castShadow = false;
  for (const sideX of [-.63, .63]) for (const sideZ of [-.55, .55]) {
    box(.1, 1.72, .1, darkMat, sideX, 1.77, sideZ, cabinet).castShadow = false;
  }
  box(1.2, .09, .09, darkMat, 0, 2.59, .55, cabinet).castShadow = false;
  box(1.2, .09, .09, darkMat, 0, 2.59, -.55, cabinet).castShadow = false;
  box(1.18, 1.58, .018, glassMat, 0, 1.77, .61, cabinet).castShadow = false;
  box(.018, 1.58, 1.08, glassMat, -.69, 1.77, 0, cabinet).castShadow = false;
  box(.018, 1.58, 1.08, glassMat, .69, 1.77, 0, cabinet).castShadow = false;

  // 小獎品與吊爪建立玻璃後方的深度，材質和幾何沿用共用資源。
  const prizeColors = [PAL.mint, 0xe6a6d6, PAL.amber];
  for (let p = 0; p < 3; p++) {
    const miniPrize = sphere(cabinet, .14, prizeColors[(i + p) % 3], (p - 1) * .34, 1.11 + (p % 2) * .06, p === 1 ? -.2 : .16, [1, .9, .84]);
    miniPrize.castShadow = false;
  }
  box(.92, .045, .045, metalMat, 0, 2.48, -.04, cabinet).castShadow = false;
  box(.035, .58, .035, darkMat, (i % 3 - 1) * .22, 2.17, -.04, cabinet).castShadow = false;
  const miniClaw = new THREE.Group(); miniClaw.position.set((i % 3 - 1) * .22, 1.83, -.04); cabinet.add(miniClaw);
  sphere(miniClaw, .095, 0xbfc1d4, 0, 0, 0, [1.15, .82, 1]);
  for (const side of [-1, 1]) {
    const arm = box(.035, .36, .035, metalMat, side * .09, -.19, 0, miniClaw);
    arm.rotation.z = side * -.3;
    const tip = sphere(miniClaw, .035, 0xbfc1d4, side * .145, -.37, 0);
    tip.castShadow = false;
  }

  const deck = box(1.28, .16, .55, mat(0xd7d1e4, .55), 0, .92, .77, cabinet);
  deck.rotation.x = -.12;
  const stick = mesh(new THREE.CylinderGeometry(.025, .025, .22, 10), darkMat, cabinet);
  stick.position.set(-.28, 1.08, .84); stick.rotation.x = -.12;
  sphere(cabinet, .07, glowColor, -.28, 1.2, .82);
  sphere(cabinet, .055, PAL.coral, .25, 1.07, .84, [1, .55, 1]);
  sphere(cabinet, .055, PAL.mint, .43, 1.06, .84, [1, .55, 1]);
  box(.42, .16, .045, darkMat, 0, .49, .665, cabinet).castShadow = false;
  box(.045, .1, .025, new THREE.MeshBasicMaterial({ color: glowColor }), 0, .49, .695, cabinet).castShadow = false;
  for (const side of [-1, 1]) {
    const sideAd = mesh(new THREE.PlaneGeometry(.5, .5), atlasMaterial((i + (side < 0 ? 2 : 3)) % 8), cabinet);
    sideAd.position.set(side * .751, .48, 0);
    sideAd.rotation.y = side * Math.PI / 2;
    sideAd.castShadow = false;
  }
  box(.055, 1.68, .045, new THREE.MeshBasicMaterial({ color: glowColor }), -.625, 1.77, .625, cabinet).castShadow = false;
  box(.055, 1.68, .045, new THREE.MeshBasicMaterial({ color: glowColor }), .625, 1.77, .625, cabinet).castShadow = false;
  box(1.12, .14, 1.1, darkMat, 0, .08, 0, cabinet);
}

const dolls = [];
// 收窄機身後改成四前、三後。後排坐在實體階梯上，不讓娃娃懸空，
// 也讓三個胸牌從前排頭頂之間露出來。
const rearDollRiser = box(2.05, .74, .86, mat(0xd8d2e6, .78), 0, 1.34, -.48, machine);
rearDollRiser.castShadow = false;
const startingPositions = [
  [-.96, 1.41, .12, .42], [-.64, 2.18, .08, -.48], [-.32, 1.41, .04, .42],
  [0, 2.18, 0, -.48], [.32, 1.41, -.04, .42], [.64, 2.18, -.08, -.48], [.96, 1.41, -.12, .42],
];

function sphere(parent, radius, color, x, y, z, scale = [1, 1, 1]) {
  const object = mesh(sharedSphereGeometry, mat(color, .82), parent);
  object.position.set(x, y, z);
  object.scale.set(radius * scale[0], radius * scale[1], radius * scale[2]);
  return object;
}

function createDoll(prize, index) {
  const doll = new THREE.Group();
  const [x, y, rot, z] = startingPositions[index];
  doll.position.set(x, y, z); doll.rotation.y = rot;
  doll.scale.setScalar(.84);
  machine.add(doll);
  sphere(doll, .34, prize.color, 0, .42, 0, [1, .93, .9]);
  sphere(doll, .33, prize.color, 0, -.05, 0, [.83, 1.05, .67]);
  sphere(doll, .14, prize.color, -.31, .0, 0, [.65, 1.15, .7]);
  sphere(doll, .14, prize.color, .31, .0, 0, [.65, 1.15, .7]);
  const leftLeg = sphere(doll, .15, prize.color, -.17, -.36, 0, [.72, 1.15, .8]);
  const rightLeg = sphere(doll, .15, prize.color, .17, -.36, 0, [.72, 1.15, .8]);

  // 頭部只用官方頭像看得懂的特徵。第一版拿三角錐代替「髮束／耳朵」，
  // 結果四個人像長角，後排的角又會插到前排頭上。這裡改成圓潤的布偶語彙：
  // 髮帽、髮球、髮夾、眼鏡與真正的帽子；只有貓草保留一對柔軟貓耳。
  const addHairCap = (color, scale = [1.02, .62, .94]) => {
    const cap = sphere(doll, .35, color, 0, .61, -.035, scale);
    cap.castShadow = false;
    return cap;
  };
  const addLock = (color, x, y, sx = .48, sy = 1.05, rotation = 0) => {
    const lock = sphere(doll, .15, color, x, y, .02, [sx, sy, .56]);
    lock.rotation.z = rotation;
    return lock;
  };
  if (prize.id === "glitch") {
    addHairCap(0xc6d0f0);
    addLock(0xc6d0f0, -.25, .51, .45, 1.08, -.18);
    addLock(0xc6d0f0, .25, .51, .45, 1.08, .18);
    box(.055, .055, .035, new THREE.MeshBasicMaterial({ color: PAL.mint }), .22, .65, .305, doll);
    box(.04, .04, .035, new THREE.MeshBasicMaterial({ color: PAL.mint }), .29, .71, .305, doll);
    const cowlickCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-.04, .78, .01), new THREE.Vector3(-.15, .98, .015), new THREE.Vector3(.035, 1.02, .02)
    );
    mesh(new THREE.TubeGeometry(cowlickCurve, 12, .026, 8, false), mat(0xc6d0f0, .75), doll);
    for (const side of [-1, 1]) {
      const antennaCurve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(side * .11, .79, -.015),
        new THREE.Vector3(side * .18, .93, 0),
        new THREE.Vector3(side * .25, .99, .015)
      );
      mesh(new THREE.TubeGeometry(antennaCurve, 9, .016, 7, false), mat(0x665887, .42, .35), doll);
      const antennaTip = box(.065, .065, .055, new THREE.MeshStandardMaterial({ color: PAL.mint, emissive: PAL.mint, emissiveIntensity: 1.1 }), side * .255, .995, .018, doll);
      antennaTip.rotation.z = side * .16;
    }
  } else if (prize.id === "catgrass") {
    addHairCap(0x40355f, [1.05, .7, .95]);
    for (const side of [-1, 1]) {
      const ear = sphere(doll, .15, 0x40355f, side * .23, .77, -.02, [.52, 1.05, .52]);
      ear.rotation.z = side * -.28;
    }
    addLock(0x594a78, -.27, .52, .46, 1.12, -.2);
    const headphoneBand = mesh(new THREE.TorusGeometry(.24, .035, 8, 28, Math.PI), mat(0x302744, .38, .18), doll);
    headphoneBand.position.set(0, .24, .08); headphoneBand.rotation.z = Math.PI;
    for (const side of [-1, 1]) {
      sphere(doll, .09, 0x302744, side * .29, .18, .17, [.65, 1, .52]);
      sphere(doll, .055, side < 0 ? 0x8de8e0 : 0x9b7fd4, side * .29, .18, .225, [.62, 1, .42]);
    }
  } else if (prize.id === "bambi") {
    addHairCap(0xe6a6d6, [1.05, .67, .95]);
    sphere(doll, .17, 0xe6a6d6, -.32, .56, -.04, [.72, 1, .72]);
    sphere(doll, .17, 0xe6a6d6, .32, .56, -.04, [.72, 1, .72]);
    for (const side of [-1, 1]) {
      const glasses = mesh(new THREE.TorusGeometry(.09, .014, 8, 20), mat(0x59405f, .38), doll);
      glasses.position.set(side * .105, .45, .305);
    }
    box(.05, .018, .018, darkMat, 0, .45, .31, doll);
  } else if (prize.id === "noah") {
    addHairCap(0x888897, [1.04, .66, .95]);
    addLock(0x777786, -.27, .52, .42, 1.14, -.18);
    for (const side of [-1, 1]) {
      const goggle = mesh(new THREE.TorusGeometry(.072, .017, 8, 18), mat(0x9a7440, .3, .4), doll);
      goggle.position.set(side * .085, .7, .24);
    }
  } else if (prize.id === "tower") {
    addHairCap(0x20223a, [1.03, .67, .94]);
    addLock(0x20223a, -.27, .51, .38, 1.13, -.19);
    addLock(0x20223a, .27, .53, .34, .96, .16);
    sphere(doll, .09, 0x20223a, .31, .68, -.12, [.65, 1.25, .65]);
  } else if (prize.id === "zerox") {
    addHairCap(0xd8d8e5, [1.03, .65, .94]);
    addLock(0xd8d8e5, -.29, .39, .52, 1.55, -.06);
    addLock(0xd8d8e5, .29, .39, .52, 1.55, .06);
    box(.17, .045, .028, new THREE.MeshBasicMaterial({ color: 0x8fded9 }), -.19, .64, .306, doll).rotation.z = -.08;
  } else if (prize.id === "blackhole") {
    addHairCap(0x171424, [1.02, .58, .94]);
    const brim = mesh(new THREE.CylinderGeometry(.42, .42, .055, 28), mat(0xa56f34, .55), doll);
    brim.position.set(0, .77, -.015); brim.rotation.z = -.08;
    const crown = mesh(new THREE.CylinderGeometry(.23, .28, .25, 24), mat(0xb7803e, .52), doll);
    crown.position.set(0, .9, -.02); crown.rotation.z = -.08;
    box(.5, .045, .28, darkMat, 0, .82, -.02, doll).rotation.z = -.08;
    leftLeg.visible = rightLeg.visible = false;
    // 黑洞先生不是一般兩足布偶。六條短觸足從圓身下方向外攤開，
    // 保留不倒翁的可愛比例，又能一眼看出他的非人輪廓。
    const feet = [
      [-.25, -.31, .08, -.36, -.5, .08], [-.1, -.34, .08, -.16, -.56, .14],
      [.1, -.34, .08, .16, -.56, .14], [.25, -.31, .08, .36, -.5, .08],
      [-.18, -.3, -.08, -.31, -.5, -.16], [.18, -.3, -.08, .31, -.5, -.16],
    ];
    for (const [sx, sy, sz, ex, ey, ez] of feet) {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(sx, sy, sz),
        new THREE.Vector3((sx + ex) / 2, ey + .08, (sz + ez) / 2),
        new THREE.Vector3(ex, ey, ez)
      );
      mesh(new THREE.TubeGeometry(curve, 10, .07, 8, false), mat(prize.color, .84), doll);
      sphere(doll, .075, prize.color, ex, ey, ez, [1.2, .72, 1]);
    }
  }

  // 七人各自的眼色與神情。眼白、虹膜與高光仍用柔軟圓形，符合雪人／不倒翁
  // 布偶的語彙；差異放在顏色、開合程度和眉形，不再共用同一對黑豆眼。
  const eyeStyle = {
    glitch:    { iris: 0x5c8fd4, sclera: 0xf4f2ff, sy: 1.05 },
    catgrass:  { iris: 0x765b9d, sclera: 0xeee8fa, sy: .72, brow: "soft" },
    bambi:     { iris: 0xbe71aa, sclera: 0xffeffa, sy: 1.0 },
    noah:      { iris: 0xa77038, sclera: 0xeee4d8, sy: .58, brow: "wise" },
    tower:     { iris: 0x477fa8, sclera: 0xeaf7ff, sy: .7, brow: "sharp" },
    zerox:     { iris: 0x887db5, sclera: 0xf2f0fa, sy: .82 },
    blackhole: { iris: 0x252033, sclera: 0xf1eff8, sy: .5, brow: "sleepy" },
  }[prize.id];
  for (const side of [-1, 1]) {
    sphere(doll, .063, eyeStyle.sclera, side * .12, .46, .292, [1.12, eyeStyle.sy, .52]);
    sphere(doll, .035, eyeStyle.iris, side * .12, .455, .337, [.86, eyeStyle.sy, .42]);
    sphere(doll, .011, 0xffffff, side * .12 - .01, .475, .365, [1, 1, .4]);
    if (eyeStyle.brow) {
      const brow = box(.105, .018, .025, darkMat, side * .12, .535, .326, doll);
      const slant = eyeStyle.brow === "sharp" ? -.18 : eyeStyle.brow === "wise" ? .13 : .05;
      brow.rotation.z = side * slant;
    }
  }
  const badgeTexture = avatarAtlasView(prize.atlasIndex);
  const badgeBack = mesh(new THREE.CircleGeometry(.225, 28), paleMat, doll);
  badgeBack.position.set(0, .015, .247);
  const badge = mesh(new THREE.CircleGeometry(.195, 28), new THREE.MeshBasicMaterial({ map: badgeTexture, transparent: true }), doll);
  badge.position.set(0, .015, .253);
  const contactShadow = mesh(new THREE.CircleGeometry(.28, 28), new THREE.MeshBasicMaterial({ color: PAL.ink, transparent: true, opacity: .16, depthWrite: false }), machine);
  contactShadow.rotation.x = -Math.PI / 2; contactShadow.scale.y = .58; contactShadow.position.set(x, .962, z);
  contactShadow.castShadow = false;
  doll.userData = { prize, home: new THREE.Vector3(x, y, z), homeRotation: rot, index, contactShadow };
  dolls.push(doll);
  return doll;
}
PRIZES.forEach(createDoll);

// 吊車、纜線與三爪。
const railX = box(2.28, .11, .11, metalMat, 0, 4.02, 0, machine);
const railZ = box(.11, .09, 2.75, metalMat, 0, 3.93, 0, machine);
const crane = new THREE.Group();
crane.position.set(0, 0, .2); machine.add(crane);
const trolley = box(.44, .24, .44, darkMat, 0, 3.91, 0, crane);
// 軌道車維持水平，纜線以下則以懸吊點為軸保留慣性擺動。
const suspension = new THREE.Group(); suspension.position.y = 3.78; crane.add(suspension);
const cable = mesh(new THREE.CylinderGeometry(.018, .018, 1, 10), darkMat, suspension);
const claw = new THREE.Group(); suspension.add(claw);
const clawHead = mesh(new THREE.CylinderGeometry(.18, .22, .28, 20), metalMat, claw);
const prongs = [];
function placeBetween(object, ax, ay, bx, by) {
  object.position.set((ax + bx) / 2, (ay + by) / 2, 0);
  object.scale.y = Math.hypot(bx - ax, by - ay);
  object.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(bx - ax, by - ay, 0).normalize()
  );
}
for (let i = 0; i < 3; i++) {
  const pivot = new THREE.Group();
  pivot.rotation.y = i * Math.PI * 2 / 3;
  claw.add(pivot);
  const upper = mesh(new THREE.CylinderGeometry(.032, .04, 1, 10), metalMat, pivot);
  const hook = mesh(new THREE.CylinderGeometry(.027, .034, 1, 10), metalMat, pivot);
  const joint = mesh(new THREE.SphereGeometry(.055, 12, 8), metalMat, pivot);
  const tip = mesh(new THREE.SphereGeometry(.052, 12, 8), metalMat, pivot);
  prongs.push({ pivot, upper, hook, joint, tip });
}

let clawY = 3.34;
function setClawHeight(y) {
  clawY = y; claw.position.y = y - 3.78;
  const length = Math.max(.08, 3.78 - y);
  cable.scale.y = length; cable.position.y = -length / 2;
}
setClawHeight(clawY);

function setProng(open) {
  for (const part of prongs) {
    const elbowX = THREE.MathUtils.lerp(.22, .39, open);
    const tipX = THREE.MathUtils.lerp(.065, .2, open);
    const elbowY = -.43, tipY = -.72;
    placeBetween(part.upper, .09, -.08, elbowX, elbowY);
    placeBetween(part.hook, elbowX, elbowY, tipX, tipY);
    part.joint.position.set(elbowX, elbowY, 0);
    part.tip.position.set(tipX, tipY, 0);
  }
}
setProng(1);

const swing = { velocityX: 0, velocityZ: 0 };
const previousCranePosition = new THREE.Vector2(crane.position.x, crane.position.z);
function updateClawSwing(dt) {
  const safeDt = Math.max(dt, .001);
  const moveX = (crane.position.x - previousCranePosition.x) / safeDt;
  const moveZ = (crane.position.z - previousCranePosition.y) / safeDt;
  previousCranePosition.set(crane.position.x, crane.position.z);
  // 吊爪與纜線很輕，橫車一動就要立刻被甩開。提高移動量對傾角的影響，
  // 並縮短彈簧週期，避免像沉重吊燈一樣慢半拍才開始晃。
  let targetX = THREE.MathUtils.clamp(moveZ * .11, -.2, .2);
  let targetZ = THREE.MathUtils.clamp(-moveX * .11, -.2, .2);
  if (phase === "dropping" || phase === "closing") {
    targetX += Math.sin(phaseTime * 7.2) * .024;
    targetZ += Math.cos(phaseTime * 6.6) * .02;
  }
  // 保留低於臨界值的阻尼，停止後快速越過中心數次，再自然收斂。
  swing.velocityX += ((targetX - suspension.rotation.x) * 58 - swing.velocityX * 6.8) * dt;
  swing.velocityZ += ((targetZ - suspension.rotation.z) * 58 - swing.velocityZ * 6.8) * dt;
  suspension.rotation.x = THREE.MathUtils.clamp(suspension.rotation.x + swing.velocityX * dt, -.24, .24);
  suspension.rotation.z = THREE.MathUtils.clamp(suspension.rotation.z + swing.velocityZ * dt, -.24, .24);
}

const held = new Set();
const stickInput = { x: 0, z: 0 };
const keyMap = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", ArrowUp: "forward", w: "forward", W: "forward", ArrowDown: "back", s: "back", S: "back" };
function releaseAll() { held.clear(); stickInput.x = stickInput.z = 0; }

let soundEnabled = true;
let audioContext;
function beep(frequency, duration = .09, volume = .04, type = "sine") {
  if (!soundEnabled) return;
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
soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundButton.textContent = soundEnabled ? "聲音：開" : "聲音：關";
  soundButton.setAttribute("aria-pressed", String(!soundEnabled));
  requestTheme("mute", !soundEnabled);
  if (soundEnabled) requestTheme("play");
  if (soundEnabled) beep(620, .08, .035);
});

if (!embedded) {
  requestTheme("play");
  const unlockTheme = () => requestTheme("play", !soundEnabled);
  addEventListener("pointerdown", unlockTheme, { once: true });
  addEventListener("keydown", unlockTheme, { once: true });
  addEventListener("visibilitychange", () => {
    if (!themeAudio) return;
    if (document.hidden) themeAudio.pause();
    else requestTheme("play", !soundEnabled);
  });
}

addEventListener("keydown", event => {
  if (keyMap[event.key]) {
    event.preventDefault();
    if (phase === "idle" && !held.has(keyMap[event.key])) beep(330, .045, .022, "triangle");
    held.add(keyMap[event.key]);
  }
  if ((event.key === "c" || event.key === "C") && !event.repeat) insertCoin();
  if (event.code === "Space" && !event.repeat) { event.preventDefault(); startGrab(); }
});
addEventListener("keyup", event => { if (keyMap[event.key]) held.delete(keyMap[event.key]); });
addEventListener("blur", releaseAll);

let phase = "waiting";
let phaseTime = 0;
let phaseStart = {};
let caught = null;
let forcedPrizeId = null;
let coinAnimation = -1;
const chute = new THREE.Vector2(chuteX, chuteZ);

function updateControlLights() {
  coinSlotMaterial.emissiveIntensity = phase === "waiting" ? .7 : .06;
  grabMaterial.emissiveIntensity = phase === "idle" ? .65 : .06;
}

function setStatus(text) { statusEl.textContent = text; }

function insertCoin() {
  if (phase !== "waiting") return;
  phase = "idle"; phaseTime = 0;
  look.targetX = look.targetY = 0;
  coinAnimation = 0; coinToken.visible = true;
  coinToken.position.set(.67, 1.43, 1.54);
  beep(880, .07, .045, "square"); setTimeout(() => beep(1320, .12, .04), 75);
  setStatus("拖動機台搖桿對準娃娃，再按「夾取」。");
  updateControlLights();
}

function startGrab() {
  if (phase !== "idle") return;
  phase = "dropping"; phaseTime = 0; phaseStart.y = clawY;
  releaseAll();
  grabButton.scale.y = .66; setTimeout(() => { grabButton.scale.y = 1; }, 140);
  updateControlLights(); setStatus("吊爪下降中……");
  beep(190, .2, .055, "square");
}

const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const controlMeshes = [joystickHit, coinHit, grabHit, joystickBase, joystickKnob, coinPlate, coinSlot, grabButton];
let joystickPointer = null;
let joystickOrigin = { x: 0, y: 0 };
function controlHit(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNdc.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  raycaster.setFromCamera(pointerNdc, camera);
  return raycaster.intersectObjects(controlMeshes, false)[0]?.object?.userData.control || null;
}
renderer.domElement.addEventListener("pointerdown", event => {
  const control = controlHit(event);
  if (control === "coin") insertCoin();
  if (control === "grab") startGrab();
  if (control === "joystick" && phase === "idle") {
    event.preventDefault(); joystickPointer = event.pointerId;
    joystickOrigin = { x: event.clientX, y: event.clientY };
    renderer.domElement.setPointerCapture(event.pointerId);
    beep(310, .045, .022, "triangle");
  }
});
renderer.domElement.addEventListener("pointermove", event => {
  // 沿用扭蛋機的待機視差：指標只改鏡頭目標，主迴圈負責柔和追上。
  // 投幣後 phase 會離開 waiting，鏡頭便回正，不干擾搖桿的方向感。
  if (phase === "waiting") {
    const rect = renderer.domElement.getBoundingClientRect();
    look.targetX = THREE.MathUtils.clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1);
    look.targetY = THREE.MathUtils.clamp((event.clientY - rect.top) / rect.height * 2 - 1, -1, 1);
  }
  if (event.pointerId === joystickPointer) {
    stickInput.x = THREE.MathUtils.clamp((event.clientX - joystickOrigin.x) / 48, -1, 1);
    stickInput.z = THREE.MathUtils.clamp((event.clientY - joystickOrigin.y) / 48, -1, 1);
  } else {
    renderer.domElement.style.cursor = controlHit(event) ? "pointer" : "default";
  }
});
renderer.domElement.addEventListener("pointerleave", () => {
  if (phase === "waiting") look.targetX = look.targetY = 0;
});
function releaseJoystick(event) {
  if (event.pointerId !== joystickPointer) return;
  joystickPointer = null; stickInput.x = stickInput.z = 0;
  if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
}
renderer.domElement.addEventListener("pointerup", releaseJoystick);
renderer.domElement.addEventListener("pointercancel", releaseJoystick);

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
  caught.userData.contactShadow.visible = false;
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
    revealEl.innerHTML = `<div class="revealCard"><div class="eyebrow">成功抓取</div><span class="avatarSprite revealAvatar" style="${avatarStyle(prize)}" role="img" aria-label="${prize.name}"></span><h2>${prize.name}</h2><p>角色布偶已加入你的收藏。</p><button type="button">再玩一次</button></div>`;
  } else {
    beep(135, .35, .035, "sawtooth");
    revealEl.innerHTML = `<div class="revealCard"><div class="missIcon" aria-hidden="true"></div><h2>差一點點</h2><p>重新對準娃娃的中心，再試一次。</p><button type="button">再玩一次</button></div>`;
  }
  revealEl.classList.add("on");
  revealEl.querySelector("button").focus();
}

function resetRound() {
  revealEl.classList.remove("on");
  if (caught) {
    machine.attach(caught);
    caught.visible = true;
    // 每隻娃娃只回自己的展示位。舊版依遊玩次數輪換位置，會把剛夾到的娃娃
    // 塞進另一隻仍站著的位置，造成身體與胸牌重疊。
    caught.position.copy(caught.userData.home);
    caught.rotation.set(0, caught.userData.homeRotation, 0);
    caught.scale.setScalar(.84);
    caught.userData.contactShadow.position.set(caught.userData.home.x, .962, caught.userData.home.z);
    caught.userData.contactShadow.visible = true;
  }
  caught = null;
  crane.position.set(0, 0, .2); setClawHeight(3.34); setProng(1);
  previousCranePosition.set(crane.position.x, crane.position.z);
  suspension.rotation.set(0, 0, 0); swing.velocityX = swing.velocityZ = 0;
  phase = "waiting"; updateControlLights(); setStatus("請先點擊機台上的「投幣孔」。");
}
revealEl.addEventListener("click", event => { if (event.target.closest("button")) resetRound(); });

function updateGame(dt) {
  phaseTime += dt;
  if (coinAnimation >= 0) {
    coinAnimation += dt;
    const progress = Math.min(coinAnimation / .42, 1);
    coinToken.position.y = THREE.MathUtils.lerp(1.43, 1.13, progress * progress);
    coinToken.rotation.x = progress * .25;
    if (progress === 1) { coinToken.visible = false; coinAnimation = -1; }
  }
  const keyboardX = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
  const keyboardZ = (held.has("back") ? 1 : 0) - (held.has("forward") ? 1 : 0);
  const inputX = THREE.MathUtils.clamp(keyboardX + stickInput.x, -1, 1);
  const inputZ = THREE.MathUtils.clamp(keyboardZ + stickInput.z, -1, 1);
  const targetTiltX = phase === "idle" ? inputZ * .38 : 0;
  const targetTiltZ = phase === "idle" ? -inputX * .38 : 0;
  joystickPivot.rotation.x += (targetTiltX - joystickPivot.rotation.x) * Math.min(dt * 14, 1);
  joystickPivot.rotation.z += (targetTiltZ - joystickPivot.rotation.z) * Math.min(dt * 14, 1);
  if (phase === "idle") {
    const speed = 1.55 * dt;
    crane.position.x += inputX * speed;
    crane.position.z += inputZ * speed;
    crane.position.x = THREE.MathUtils.clamp(crane.position.x, -.94, .94);
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
    if (p === 1) { enter("releasing", { thud: false }); beep(410, .1, .045); }
  } else if (phase === "releasing") {
    const p = Math.min(phaseTime / .92, 1); setProng(ease(Math.min(p * 1.35, 1)));
    if (caught && phaseTime > .14) caught.position.y -= dt * 3.15;
    if (caught && phaseTime > .67 && !phaseStart.thud) {
      phaseStart.thud = true; beep(118, .22, .065, "triangle");
    }
    if (p === 1) {
      if (caught) caught.visible = false;
      enter("showing"); setTimeout(finishRound, 180);
    }
  }
}

function renderProgress() {
  progressEl.innerHTML = PRIZES.map(prize => {
    const owned = Store.data.owned.includes(prize.id);
    return owned
      ? `<div class="prizeSlot has" title="${prize.name}"><span class="avatarSprite" style="${avatarStyle(prize)}" role="img" aria-label="${prize.name}"></span></div>`
      : `<div class="prizeSlot" title="還沒夾到">？</div>`;
  }).join("");
}

function avatarStyle(prize) {
  const column = prize.atlasIndex % 4;
  const row = Math.floor(prize.atlasIndex / 4);
  return `--avatar-x:${column / 3 * 100}%;--avatar-y:${row * 100}%`;
}

function openCollection() {
  const owned = PRIZES.filter(prize => Store.data.owned.includes(prize.id));
  collectionTitleEl.textContent = `收集進度　${owned.length} / ${PRIZES.length}`;
  collectionListEl.innerHTML = owned.length
    ? owned.map(prize => `<div class="collectionRow">
        <span class="avatarSprite collectionAvatar" style="${avatarStyle(prize)}" role="img" aria-label="${prize.name}"></span>
        <div><div class="collectionName">${prize.name}</div><div class="collectionType">角色布偶</div></div>
      </div>`).join("")
    : `<div class="collectionEmpty">還沒夾到任何人，先對準一隻娃娃試試看。</div>`;
  collectionEl.hidden = false;
  collectionCloseButton.focus();
}

function closeCollection() {
  collectionEl.hidden = true;
  progressEl.focus();
}

progressEl.addEventListener("click", openCollection);
progressEl.addEventListener("keydown", event => {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openCollection(); }
});
collectionCloseButton.addEventListener("click", closeCollection);
collectionEl.addEventListener("click", event => { if (event.target === collectionEl) closeCollection(); });
addEventListener("keydown", event => { if (event.key === "Escape" && !collectionEl.hidden) closeCollection(); });

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .04);
  updateGame(dt);
  updateClawSwing(dt);
  const time = performance.now() * .001;
  const idleLook = phase === "waiting";
  const targetLookX = idleLook ? look.targetX : 0;
  const targetLookY = idleLook ? look.targetY : 0;
  look.x += (targetLookX - look.x) * Math.min(dt * 2.6, 1);
  look.y += (targetLookY - look.y) * Math.min(dt * 2.6, 1);
  const breathe = idleLook ? Math.sin(time / 5.2) * .045 : 0;
  camera.position.set(cameraBase.x + look.x * .42, cameraBase.y - look.y * .22 + breathe, cameraBase.z);
  camera.lookAt(cameraTarget.x + look.x * .12, cameraTarget.y - look.y * .06, cameraTarget.z);
  const pulse = .5 + .5 * Math.sin(time * 5.5);
  coinSlotMaterial.emissiveIntensity = phase === "waiting" ? .55 + pulse * 1.35 : .05;
  grabMaterial.emissiveIntensity = phase === "idle" ? .28 + pulse * 1.15 : .05;
  coinGlow.intensity = phase === "waiting" ? .35 + pulse * 1.1 : 0;
  grabGlow.intensity = phase === "idle" ? .25 + pulse * .9 : 0;
  dolls.forEach((doll, index) => { if (doll.visible && doll.parent === machine) doll.rotation.z = Math.sin(time * 1.2 + index) * .015; });
  insideLight.intensity = 6.6 + Math.sin(time * 2.1) * .35;
  renderer.render(scene, camera);
}

await Store.load();
renderProgress();
updateControlLights();
animate();

if (new URLSearchParams(location.search).has("test")) {
  const controlPoint = object => {
    const point = object.getWorldPosition(new THREE.Vector3()).project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
  };
  window.__clawTest = {
    getState: () => ({ phase, claw: { x: crane.position.x, z: crane.position.z, swingX: suspension.rotation.x, swingZ: suspension.rotation.z }, joystick: { x: joystickPivot.rotation.x, z: joystickPivot.rotation.z }, look: { x: look.x, y: look.y, targetX: look.targetX, targetY: look.targetY }, cues: { coin: coinSlotMaterial.emissiveIntensity, grab: grabMaterial.emissiveIntensity, coinVisible: coinToken.visible }, music: { embedded, created: Boolean(themeAudio), playing: Boolean(themeAudio && !themeAudio.paused), muted: Boolean(themeAudio?.muted) }, soundEnabled, store: structuredClone(Store.data), caught: caught?.userData.prize.id || null }),
    getDolls: () => dolls.map(doll => ({ id: doll.userData.prize.id, parent: doll.parent === machine ? "machine" : "claw", visible: doll.visible, x: doll.position.x, y: doll.position.y, z: doll.position.z })),
    getControlPoint: name => controlPoint({ coin: coinSlot, grab: grabButton, joystick: joystickKnob }[name]),
    setClaw: (x, z) => { if (phase !== "idle") return false; crane.position.x = THREE.MathUtils.clamp(Number(x), -.94, .94); crane.position.z = THREE.MathUtils.clamp(Number(z), -1.05, 1.12); return true; },
    insertCoin,
    forceWin: id => { if (!PRIZES.some(prize => prize.id === id) || !["waiting", "idle"].includes(phase)) return false; if (phase === "waiting") insertCoin(); forcedPrizeId = id; startGrab(); return true; },
    advance: seconds => { for (let elapsed = 0; elapsed < Number(seconds); elapsed += .02) { updateGame(.02); updateClawSwing(.02); } return phase; },
    reset: resetRound,
  };
}
