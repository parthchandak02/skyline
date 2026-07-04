# skyline

Top 10 crypto prices as a 3D city skyline. Building height = price, color = 24h change.

**Visual Style:** Light — Daylight (warm earth, cream background, brown accents, teal highlight)

**Data Source:** CoinGecko /coins/markets endpoint (top 10 coins by market cap)

**How it works:**
- Each building represents a cryptocurrency: height = current price, emissive color = 24h change (teal = up, red = down, white = flat), width = market cap rank
- OrbitControls to explore the city from any angle (mouse drag, touch rotate)
- Tap/click a building to reveal a detail panel with name, symbol, price, 24h change, market cap, and rank
- The hero number at top-left shows total combined market cap across all 10 coins
- CoinGecko polled every 60 seconds; fallback data shown immediately on page load

**GitHub:** https://github.com/parthchandak02/skyline

**Live:** https://skyline.parthchandak.info

**Tech:** Vanilla Three.js + Vite + TypeScript. Hosted on Cloudflare Pages.
