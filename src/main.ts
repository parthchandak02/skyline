/// <reference types="vite/client" />

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ─── CONFIG ───
const C = {
  coinCount: 10,
  buildingMaxHeight: 5,
  buildingMinHeight: 0.5,
  buildingMaxWidth: 2.0,
  buildingMinWidth: 0.8,
  buildingDepth: 1.2,
  arcRadius: 8,
  pollInterval: 60000,
  damping: 0.05,
};

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

let coins: CoinData[] = [...FALLBACK_COINS];
let isLive = false;
let lastFetchTime = 0;
let selectedIndex = -1;
let selectedBuilding: THREE.Mesh | null = null;
let idleTimer = 0;

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
camera.position.set(14, 8, 14);
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

// ─── BUILDINGS ───
const buildings: THREE.Mesh[] = [];
const buildingLabels: HTMLDivElement[] = [];

function createBuildingLabel(index: number): HTMLDivElement {
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

function buildCity(data: CoinData[]) {
  // Clear old buildings
  buildings.forEach(b => { scene.remove(b); b.geometry.dispose(); (b.material as THREE.Material).dispose(); });
  buildings.length = 0;
  selectedBuilding = null;
  selectedIndex = -1;
  quietzone.classList.remove('visible');

  data.forEach((coin, i) => {
    const maxPrice = Math.max(...data.map(c => c.current_price));
    const minPrice = Math.min(...data.map(c => c.current_price));
    const priceRange = maxPrice - minPrice || 1;

    // Height: normalized price
    const normPrice = (coin.current_price - minPrice) / priceRange;
    const height = C.buildingMinHeight + normPrice * (C.buildingMaxHeight - C.buildingMinHeight);

    // Width: inverse rank (rank 1 = widest)
    const rankFactor = 1 - (coin.market_cap_rank - 1) / (data.length - 1);
    const width = C.buildingMinWidth + rankFactor * (C.buildingMaxWidth - C.buildingMinWidth);

    // Position in arc
    const angle = (i / (data.length - 1)) * Math.PI - Math.PI / 2;
    const x = Math.cos(angle) * C.arcRadius;
    const z = Math.sin(angle) * C.arcRadius;

    // Color based on 24h change
    const change = coin.price_change_percentage_24h || 0;
    const t = Math.max(-1, Math.min(1, change / 5)); // normalize to -1..1
    let color: THREE.Color;
    if (t < 0) {
      // teal (green) to white
      color = new THREE.Color(PALETTE.highlight).lerp(new THREE.Color('#e0e0e0'), -t);
    } else {
      // white to red
      color = new THREE.Color('#e0e0e0').lerp(new THREE.Color('#e57373'), t);
    }

    const geo = new THREE.BoxGeometry(width, height, C.buildingDepth);
    const mat = new THREE.MeshStandardMaterial({
      color: PALETTE.accent1,
      roughness: 0.6,
      metalness: 0.1,
      emissive: color,
      emissiveIntensity: 0.15,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, height / 2, z);
    mesh.userData = { index: i, coin, baseColor: PALETTE.accent1, emissiveColor: color };
    scene.add(mesh);
    buildings.push(mesh);

    // Label
    const label = createBuildingLabel(i);
    label.textContent = `${coin.symbol.toUpperCase()}\n$${formatPrice(coin.current_price)}`;
    buildingLabels.push(label);
  });

  updateLabels();
  updateHero(data);
  updateStamp(data);
}

function updateLabels() {
  buildings.forEach((b, i) => {
    const pos = b.position.clone();
    pos.y += (b.geometry as THREE.BoxGeometry).parameters.height / 2 + 0.8;
    const screen = worldToScreen(pos);
    const label = buildingLabels[i];
    if (label) {
      label.style.left = `${screen.x}px`;
      label.style.top = `${screen.y}px`;
      // Hide if behind camera
      const dir = pos.clone().sub(camera.position);
      const behind = camera.getWorldDirection(new THREE.Vector3()).dot(dir) < 0;
      label.style.display = behind ? 'none' : 'block';
    }
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

function updateStamp(data: CoinData[]) {
  const ago = lastFetchTime ? Math.round((performance.now() - lastFetchTime) / 1000) : 0;
  const status = isLive ? 'live' : 'fallback';
  stamp.textContent = `CoinGecko · ${data.length} coins · ${status} · ${ago}s ago`;
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
  qzChange.style.color = change >= 0 ? '#26a69a' : '#e57373';

  qzSub.textContent = `Rank #${coin.market_cap_rank} · Cap ${formatMarketCap(coin.market_cap)}`;
}

function hideDetail() {
  quietzone.classList.remove('visible');
  selectedIndex = -1;
  // Reset building emissive
  buildings.forEach(b => {
    const mat = b.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = 0.15;
  });
}

// ─── RAYCASTER ───
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDown = false;

renderer.domElement.addEventListener('pointerdown', () => {
  pointerDown = true;
});
renderer.domElement.addEventListener('pointerup', (e: PointerEvent) => {
  if (!pointerDown) return;
  pointerDown = false;

  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(buildings);

  if (intersects.length > 0) {
    const mesh = intersects[0].object as THREE.Mesh;
    const idx = mesh.userData.index;
    if (idx !== undefined) {
      // Highlight selected
      buildings.forEach(b => {
        const mat = b.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0.15;
      });
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.5;
      selectedBuilding = mesh;
      showDetail(idx);
    }
  } else {
    hideDetail();
  }
});

// Touch guard
renderer.domElement.addEventListener('touchstart', (e) => {
  if (e.touches.length > 1) return; // allow pinch zoom
  pointerDown = true;
});
renderer.domElement.addEventListener('touchend', (e) => {
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
      buildCity(coins);
    }
  } catch (err) {
    console.warn('CoinGecko fetch failed, using fallback:', err);
    isLive = false;
    lastFetchTime = performance.now();
    buildCity(coins);
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

  // Animate building labels follow 3D positions
  updateLabels();

  // Idle timer for quiet zone fade
  if (quietzone.classList.contains('visible')) {
    idleTimer += 16;
    if (idleTimer > 3000) {
      hideDetail();
    }
  }

  // Gentle ambient building pulse
  const time = Date.now() * 0.001;
  buildings.forEach((b, i) => {
    const mat = b.material as THREE.MeshStandardMaterial;
    if (i !== selectedIndex) {
      mat.emissiveIntensity = 0.1 + 0.05 * Math.sin(time * 0.5 + i * 0.7);
    }
  });

  renderer.render(scene, camera);
}

// ─── START ───
lastFetchTime = performance.now();
buildCity(FALLBACK_COINS); // render immediately with fallback
fetchCoins(); // then fetch live
setInterval(fetchCoins, C.pollInterval);
animate();
