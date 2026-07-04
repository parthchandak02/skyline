# skyline — Creative Brief

## Concept
Top 10 cryptocurrencies by market cap visualized as a 3D city skyline. Each building is a cryptocurrency: height = current price, color (emissive) = 24h change (green = up, red = down, white = flat), width = market cap rank (higher rank = wider base). The user orbits around the city using mouse/touch to explore.

**Metaphor family:** city (building heights encode price)
**Narrative pattern:** Annotation (ticker symbol + price always visible above each building)
**Tier 2 Patterns (pick 2):** Hero Number (total combined market cap at top-left) + Quiet Zone (tap/click building → detail panel with name, price, 24h change %, market cap, rank)

## Data Source
- URL: `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&sparkline=false`
- Response: JSON array of 10 coin objects. Each has: `id`, `symbol`, `current_price`, `price_change_percentage_24h`, `market_cap`, `market_cap_rank`, `name`, `image`
- Poll interval: 60 seconds
- Fallback: embedded array of 10 realistic crypto entries (BTC, ETH, SOL, XRP, DOGE, ADA, AVAX, DOT, LINK, MATIC) with typical prices and 24h changes

## Three Dials
- DESIGN_VARIANCE: 4 (orderly skyline grid, heights vary by data, symmetric spacing)
- MOTION_INTENSITY: 2 (static scene with gentle ambient building pulse, poll refresh every 60s)
- VISUAL_DENSITY: 4 (10 buildings + ground + sky gradient + labels + chrome)

## Visual Style
- Preset: Light — Daylight (warm earth)
- Palette:
```js
const PALETTE = {
  bg: '#f5f0e8',          // warm cream sky
  ground: '#d4c9b3',      // warm beige ground
  accent1: '#8d6e63',     // warm brown — building primary
  accent2: '#a1887f',     // lighter brown — building secondary
  accent3: '#ef9a9a',     // soft coral — highlight accent
  highlight: '#26a69a',   // teal — contrast pop for hero
  text: 'rgba(0,0,0,0.7)',
  textMuted: 'rgba(0,0,0,0.4)',
};
```
- Background: warm cream sky gradient, soft horizon haze
- Building material: MeshStandardMaterial with warm earth tones
- No sharp shadows — soft ambient + hemisphere lighting
- No cool tones anywhere — all warm earth + coral + teal (teal only for hero accent)

## Encoding Contract
| Data Field | Visual Channel | Range | Inverse Function | "Bigger means..." | Legend? |
|------------|----------------|-------|------------------|-------------------|---------|
| current_price | building height Y | 0.5-5 scene units | invertScale(height, 0.5, 5, minPrice, maxPrice) | higher priced coin | yes (height bar) |
| price_change_percentage_24h | building emissive color | green (-5% or less) -> white (0%) -> red (+5% or more) | invertColor(rgb) -> approximate % | stronger gain/loss | yes (color bar on hero) |
| market_cap_rank | building width XZ | 0.8-2.0 units | invertScale(width, 0.8, 2.0, 1, 10) | lower rank number = wider building (rank 1 = widest) | no (rank is intuitive) |
| name/symbol | Html label above building | always visible text | - | building identity | always-visible |

Legend approach: a small color bar (green-to-white-to-red gradient with labels) in the hero area showing the color mapping. Plus a note: "height = price" in the desc.

## Creative Scene (Three.js)
- Primary metaphor: City skyline. 10 rectangular buildings on a flat ground plane in a semi-circle arc formation (not a straight line — adds depth)
- THREE APIs: BoxGeometry, MeshStandardMaterial, HemisphereLight, DirectionalLight, OrbitControls, Raycaster
- Default camera: elevated 15-degree angle, looking slightly down at the city from the front-right. All 10 buildings visible.
- Ground: large PlaneGeometry with warm beige MeshStandardMaterial
- Sky: gradient from warm cream to light orange at horizon using scene.background Color or a simple gradient

## Interaction
- OrbitControls: damped (dampingFactor: 0.05), min/max polar angle (15 to 80 degrees), min/max distance
- Click/tap a building: Raycaster detects hit -> highlight building (emissive pulse) -> show Quiet Zone detail panel
- Click/tap empty ground or quiet zone close: deselect, hide panel
- Hover over building: subtle emissive glow increase (mouseover/mouseout)
- On first load, brief camera animation (truck from above down to view angle) over 2 seconds

## UX Chrome (DOM overlay, not Three.js)
- #hero: top-left, shows total combined market cap formatted (e.g. "$2.45T Total Market Cap"), 24px bold, Muted text color
- Also in hero or below: a small legend bar showing green-white-red gradient with labels "-5% 0% +5%"
- #stamp: bottom-left, 10px system-ui, opacity 0.4, shows "CoinGecko · 10 coins · live|fallback · Xs ago"
- #desc: bottom-center, 11px system-ui, opacity 0.45, max-width 65ch. Text: "A crypto city skyline — building height = price, color = 24h change"
- #quietzone: center-screen DOM overlay (position: fixed, centered, pointer-events: none on container, auto on content). Shows when a building is tapped: coin name, symbol, price, 24h change %, market cap, rank. Styled with Daylight palette (cream bg, brown accents, subtle shadow). Fades out after 3s idle.

Chrome positions (no overlap):
- #hero: top: 20px; left: 16px
- #stamp: bottom: 20px; left: 16px
- #desc: bottom: 20px; left: 50%; transform: translateX(-50%); bottom: 60px (above stamp)
- #quietzone: centered, z-index above canvas

## Rendering Requirements
1. Vite + TypeScript + Three.js (no React, no R3F)
2. Entry: `src/main.ts` — WebGLRenderer, PerspectiveCamera, Scene, requestAnimationFrame
3. DPR: `Math.min(window.devicePixelRatio, 2)`
4. Canvas CSS: `position:fixed;top:0;left:0;width:100%;height:100%;display:block`
5. Touch guard on touchend; `touch-action: manipulation`
6. Fallback data embedded; first frame never blank
7. `prefers-reduced-motion`: static camera (no auto-rotate), interaction still works, no entrance animation
8. Motion tokens in CSS: `--motion-fast:160ms`, `--motion-base:240ms`, `--motion-slow:360ms`, `--ease-out-expo`
9. HTML overlay elements all styled in daylight.css / inline styles matching Daylight palette
10. No em-dashes anywhere — use hyphens for any separators

## Coherence
- alphaHierarchy: {bg: 1, ground: 1, building: 1, active: 0.9, label: 0.7}
- shapeLanguage: geometric (boxes, planes — rigid architecture)
- glowBudget: exactly 1 glow/emissive effect: active/hovered building gets emissiveIntensity boost
- accent color: teal (#26a69a) for hero accent only — one accent + semantic green/red for change
- stroke weight: N/A (Three.js, no canvas strokes)
- Font: system-ui, sans-serif for all chrome. No Inter, Roboto, Open Sans.

## Build & Deploy
- Scaffold: `npm create vite@latest . -- --template vanilla-ts`
- Dependencies: `npm install three @types/three`
- Build: `npm run build` → outputs to `dist/`
- Deploy: `source ~/.hermes/.env && ~/.hermes/bin/ship-creative-daily.sh ~/projects/skyline dist`
- URL: `https://skyline.parthchandak.info`
