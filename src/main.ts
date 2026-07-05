/// <reference types="vite/client" />

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ─── CONFIG ───
const C = {
  coinCount: 10,
  buildingMaxHeight: 6,
  buildingMinHeight: 0.8,
  buildingMaxWidth: 2.0,
  buildingMinWidth: 0.8,
  buildingDepth: 1.2,
  arcRadius: 9,
  pollInterval: 60000,
  damping: 0.05,
  heightLerp: 0.04,
  colorLerp: 0.04,
};

const ROOF_HEIGHT = 0.3;
const ROOF_GREEN = '#26a69a';
const ROOF_RED = '#e57373';

// ─── PALETTE (Light — Daylight) ───
const PALETTE = {
  bg: '#f5f0e8',
  ground: '#d4c9b3',
  accent1: '#8d6e63',
  accent2: '#a1887f',
  accent3: '#ef9a9a',
  highlight: '#26a69a',
  text: 'rgba(0,0,0,0.7)',
  textMuted: 'rgba(0,0,0,0.4)',
};

// ─── FALLBACK DATA ───
const FALLBACK_COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', current_price: 58420, price_change_percentage_24h: 2.4, market_cap: 1150000000000, market_cap_rank: 1 },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', current_price: 3120, price_change_percentage_24h: -1.2, market_cap: 375000000000, market_cap_rank: 2 },
  { id: 'solana', symbol: 'SOL', name: 'Solana', current_price: 142, price_change_percentage_24h: 5.8, market_cap: 64000000000, market_cap_rank: 3 },
  { id: 'ripple', symbol: 'XRP', name: 'XRP', current_price: 0.52, price_change_percentage_24h: -0.8, market_cap: 28500000000, market_cap_rank: 4 },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', current_price: 0.124, price_change_percentage_24h: 3.2, market_cap: 17800000000, market_cap_rank: 5 },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano', current_price: 0.45, price_change_percentage_24h: -2.1, market_cap: 15800000000, market_cap_rank: 6 },
  { id: 'avalanche', symbol: 'AVAX', name: 'Avalanche', current_price: 35.8, price_change_percentage_24h: 1.5, market_cap: 13100000000, market_cap_rank: 7 },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot', current_price: 7.2, price_change_percentage_24h: -3.5, market_cap: 9800000000, market_cap_rank: 8 },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink', current_price: 14.8, price_change_percentage_24h: 4.1, market_cap: 8700000000, market_cap_rank: 9 },
  { id: 'polygon', symbol: 'MATIC', name: 'Polygon', current_price: 0.68, price_change_percentage_24h: -0.5, market_cap: 6400000000, market_cap_rank: 10 },
];

// ─── STATE ───
type CoinData = {
  id: string; symbol: string; name: string; current_price: number;
  price_change_percentage_24h: number; market_cap: number; market_cap_rank: number;
};

type BuildingState = {
  group: THREE.Group;
  body: THREE.Mesh;
  roof: THREE.Mesh;
  label: HTMLDivElement;
  currentHeight: number;
  targetHeight: number;
  currentRoofColor: THREE.Color;
  targetRoofColor: THREE.Color;
  width: number;
};

let coins: CoinData[] = [...FALLBACK_COINS];
let isLive = false;
let lastFetchTime = 0;
let selectedIndex = -1;
let selectedBuilding: THREE.Mesh | null = null;
let idleTimer = 0;

const buildingStates: BuildingState[] = [];

// ─── DOM REFS ───
const heroValue = document.getElementById('hero-value')!;
const heroLabel = document.getElementById('hero-label')!;
const stamp = document.getElementById('stamp')!;
const desc = document.getElementById('desc')!;
const quietzone = document.getElementById('quietzone')!;
const qzName = document.getElementById('qz-name')!;
const qzSymbol = document.getElementById('qz-symbol')!;
const qzPrice = document.getElementById('qz-price')!;
const qzChange = document.getElementById('qz-change')!;
const qzSub = document.getElementById('qz-sub')!;

// ─── THREE.JS SETUP ───
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
});
const dpr = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(dpr);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.bg);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(15, 7, 15);
camera.lookAt(0, 1.5, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.dampingFactor = C.damping;
controls.minPolarAngle = 0.3;
controls.maxPolarAngle = 1.3;
controls.minDistance = 5;
controls.maxDistance = 30;
controls.target.set(0, 1.5, 0);
controls.update();

// ─── LIGHTING ───
const hemiLight = new THREE.HemisphereLight(0xffeedd, 0x8d6e63, 0.8);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffeedd, 1.0);
dirLight.position.set(10, 15, 5);
scene.add(dirLight);

const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
scene.add(ambientLight);

// ─── GROUND ───
const groundGeo = new THREE.PlaneGeometry(30, 30);
const groundMat = new THREE.MeshStandardMaterial({
  color: PALETTE.ground,
  roughness: 0.9,
  metalness: 0,
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.05;
scene.add(ground);

// ─── LEGEND ───
function createLegend() {
  const legend = document.createElement('div');
  legend.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    pointer-events: none;
    display: flex;
    align-items: center;
    gap: 14px;
    font: 10px/1 system-ui, sans-serif;
    color: rgba(0,0,0,0.4);
    letter-spacing: 0.5px;
  `;
  const greenSq = document.createElement('span');
  greenSq.style.cssText = 'display:inline-block;width:10px;height:10px;background:#26a69a;border-radius:2px;';
  const redSq = document.createElement('span');
  redSq.style.cssText = 'display:inline-block;width:10px;height:10px;background:#e57373;border-radius:2px;';

  const upItem = document.createElement('span');
  upItem.style.cssText = 'display:flex;align-items:center;gap:5px;';
  upItem.append(greenSq, document.createTextNode('up in 24h'));

  const downItem = document.createElement('span');
  downItem.style.cssText = 'display:flex;align-items:center;gap:5px;';
  downItem.append(redSq, document.createTextNode('down in 24h'));

  legend.append(upItem, downItem);
  document.body.appendChild(legend);
}
createLegend();

// ─── BUILDINGS ───
function createBuildingLabel(): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `
    position: fixed;
    pointer-events: none;
    font-family: system-ui, sans-serif;
    font-size: 10px;
    font-weight: 500;
    color: rgba(0,0,0,0.7);
    text-align: center;
    transform: translate(-50%, -100%);
    z-index: 5;
    line-height: 1.3;
    transition: opacity 0.01ms;
  `;
  document.body.appendChild(el);
  return el;
}

function worldToScreen(pos: THREE.Vector3): { x: number; y: number } {
  const vec = pos.clone().project(camera);
  return {
    x: (vec.x * 0.5 + 0.5) * window.innerWidth,
    y: (-vec.y * 0.5 + 0.5) * window.innerHeight,
  };
}

function getTargetHeight(coin: CoinData, data: CoinData[]): number {
  const maxPrice = Math.max(...data.map(c => c.current_price));
  const minPrice = Math.min(...data.map(c => c.current_price));
  const priceRange = maxPrice - minPrice || 1;
  const normPrice = (coin.current_price - minPrice) / priceRange;
  return C.buildingMinHeight + normPrice * (C.buildingMaxHeight - C.buildingMinHeight);
}

function getBuildingWidth(coin: CoinData, dataLength: number): number {
  const rankFactor = 1 - (coin.market_cap_rank - 1) / (dataLength - 1);
  return C.buildingMinWidth + rankFactor * (C.buildingMaxWidth - C.buildingMinWidth);
}

function getRoofColor(change: number): THREE.Color {
  return new THREE.Color(change >= 0 ? ROOF_GREEN : ROOF_RED);
}

function applyBuildingDimensions(state: BuildingState) {
  const w = state.width;
  state.body.scale.set(w, state.currentHeight, C.buildingDepth);
  state.body.position.y = state.currentHeight / 2;
  state.roof.scale.set(w * 0.85, 1, C.buildingDepth * 0.85);
  state.roof.position.y = state.currentHeight + ROOF_HEIGHT / 2;
}

function initCity(data: CoinData[]) {
  data.forEach((coin, i) => {
    const height = getTargetHeight(coin, data);
    const width = getBuildingWidth(coin, data.length);
    const change = coin.price_change_percentage_24h || 0;
    const roofColor = getRoofColor(change);

    const angle = (i / (data.length - 1)) * Math.PI - Math.PI / 2;
    const x = Math.cos(angle) * C.arcRadius;
    const z = Math.sin(angle) * C.arcRadius;

    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: PALETTE.accent1,
      roughness: 0.6,
      metalness: 0.1,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.userData = { index: i };

    const roofGeo = new THREE.BoxGeometry(1, ROOF_HEIGHT, 1);
    const roofMat = new THREE.MeshStandardMaterial({
      color: roofColor,
      emissive: roofColor.clone(),
      emissiveIntensity: 0.2,
      roughness: 0.5,
      metalness: 0.1,
    });
    const roof = new THREE.Mesh(roofGeo, roofMat);

    group.add(body);
    group.add(roof);
    scene.add(group);

    const state: BuildingState = {
      group,
      body,
      roof,
      label: createBuildingLabel(),
      currentHeight: height,
      targetHeight: height,
      currentRoofColor: roofColor.clone(),
      targetRoofColor: roofColor.clone(),
      width,
    };
    applyBuildingDimensions(state);
    state.label.textContent = `${coin.symbol.toUpperCase()}\n$${formatPrice(coin.current_price)}`;
    buildingStates.push(state);
  });

  updateHero(data);
  updateStamp();
}

function applyCoinData(data: CoinData[]) {
  data.forEach((coin, i) => {
    const state = buildingStates[i];
    if (!state) return;

    state.targetHeight = getTargetHeight(coin, data);
    state.targetRoofColor = getRoofColor(coin.price_change_percentage_24h || 0);
    state.width = getBuildingWidth(coin, data.length);
    state.body.scale.x = state.width;
    state.roof.scale.x = state.width * 0.85;

    state.label.textContent = `${coin.symbol.toUpperCase()}\n$${formatPrice(coin.current_price)}`;
  });

  if (selectedIndex >= 0 && selectedIndex < data.length) {
    showDetail(selectedIndex);
  }

  updateHero(data);
  updateStamp();
}

function updateLabels() {
  buildingStates.forEach((state) => {
    const worldPos = new THREE.Vector3(
      state.group.position.x,
      state.currentHeight + ROOF_HEIGHT + 0.8,
      state.group.position.z,
    );
    const screen = worldToScreen(worldPos);
    state.label.style.left = `${screen.x}px`;
    state.label.style.top = `${screen.y}px`;

    const dir = worldPos.clone().sub(camera.position);
    const behind = camera.getWorldDirection(new THREE.Vector3()).dot(dir) < 0;
    state.label.style.display = behind ? 'none' : 'block';
  });
}

function formatPrice(p: number): string {
  if (p >= 1) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (p >= 0.01) return p.toFixed(4);
  return p.toFixed(6);
}

function formatMarketCap(mc: number): string {
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`;
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(2)}B`;
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(0)}M`;
  return `$${mc.toLocaleString()}`;
}

function updateHero(data: CoinData[]) {
  const totalMC = data.reduce((s, c) => s + c.market_cap, 0);
  heroValue.textContent = formatMarketCap(totalMC);
  heroLabel.textContent = 'Total Market Cap';
}

function updateStamp() {
  const ago = lastFetchTime ? Math.round((performance.now() - lastFetchTime) / 1000) : 0;
  const status = isLive ? 'live' : 'fallback';
  stamp.textContent = `CoinGecko · Top 10 · ${status} · ${ago}s ago`;
}

// ─── QUIET ZONE ───
function showDetail(index: number) {
  const coin = coins[index];
  if (!coin) return;

  selectedIndex = index;
  idleTimer = 0;
  quietzone.classList.add('visible');

  qzName.textContent = coin.name;
  qzSymbol.textContent = coin.symbol.toUpperCase();
  qzPrice.textContent = `$${formatPrice(coin.current_price)}`;

  const change = coin.price_change_percentage_24h || 0;
  qzChange.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
  qzChange.style.color = change >= 0 ? ROOF_GREEN : ROOF_RED;

  qzSub.textContent = `Rank #${coin.market_cap_rank} · Cap ${formatMarketCap(coin.market_cap)}`;
}

function hideDetail() {
  quietzone.classList.remove('visible');
  selectedIndex = -1;
  selectedBuilding = null;
  buildingStates.forEach((state) => {
    const mat = state.roof.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.2;
  });
}

// ─── RAYCASTER ───
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDown = false;

const bodyMeshes = () => buildingStates.map(s => s.body);

renderer.domElement.addEventListener('pointerdown', () => {
  pointerDown = true;
});
renderer.domElement.addEventListener('pointerup', (e: PointerEvent) => {
  if (!pointerDown) return;
  pointerDown = false;

  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(bodyMeshes());

  if (intersects.length > 0) {
    const mesh = intersects[0].object as THREE.Mesh;
    const idx = mesh.userData.index;
    if (idx !== undefined) {
      buildingStates.forEach((state) => {
        const mat = state.roof.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0.2;
      });
      const state = buildingStates[idx];
      const mat = state.roof.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.5;
      selectedBuilding = state.body;
      showDetail(idx);
    }
  } else {
    hideDetail();
  }
});

renderer.domElement.addEventListener('touchstart', (e) => {
  if (e.touches.length > 1) return;
  pointerDown = true;
});
renderer.domElement.addEventListener('touchend', () => {
  pointerDown = false;
});

// ─── API FETCH ───
async function fetchCoins() {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&sparkline=false');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: CoinData[] = await res.json();
    if (data && data.length > 0) {
      coins = data;
      isLive = true;
      lastFetchTime = performance.now();
      applyCoinData(coins);
    }
  } catch (err) {
    console.warn('CoinGecko fetch failed, using fallback:', err);
    isLive = false;
    lastFetchTime = performance.now();
    applyCoinData(coins);
  }
}

// ─── RESIZE ───
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

// ─── ANIMATION LOOP ───
function animate() {
  requestAnimationFrame(animate);
  controls.update();

  const time = Date.now() * 0.001;

  buildingStates.forEach((state, i) => {
    state.currentHeight += (state.targetHeight - state.currentHeight) * C.heightLerp;
    state.body.scale.y = state.currentHeight;
    state.body.position.y = state.currentHeight / 2;
    state.roof.position.y = state.currentHeight + ROOF_HEIGHT / 2;

    state.currentRoofColor.lerp(state.targetRoofColor, C.colorLerp);
    const roofMat = state.roof.material as THREE.MeshStandardMaterial;
    roofMat.color.copy(state.currentRoofColor);
    roofMat.emissive.copy(state.currentRoofColor);

    if (i !== selectedIndex) {
      roofMat.emissiveIntensity = 0.15 + 0.05 * Math.sin(time * 0.5 + i * 0.7);
    }
  });

  updateLabels();

  if (quietzone.classList.contains('visible')) {
    idleTimer += 16;
    if (idleTimer > 3000) {
      hideDetail();
    }
  }

  renderer.render(scene, camera);
}

// ─── START ───
lastFetchTime = performance.now();
initCity(FALLBACK_COINS);
fetchCoins();
setInterval(fetchCoins, C.pollInterval);
animate();
