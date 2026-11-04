// Wraps the Platane/snk snake (drawn on your real contribution grid) in the README's card style.
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.env.OUT_DIR || 'dist';
const ROOT = process.env.REPO_ROOT || '.';
const meta = JSON.parse(fs.readFileSync(path.join(OUT, 'meta.json'), 'utf8'));
let snake = fs.readFileSync(path.join(OUT, 'snake-raw.svg'), 'utf8').replace(/<\?xml[^>]*>/, '').trim();

// read the snake's own viewBox so it scales correctly inside the card
const vb = (snake.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 880 192';
const [vx, vy, vw, vh0] = vb.split(/[\s,]+/).map(Number);
const vh = vh0 - 34; // crop the progress bar under the grid
const W = 1200, P = 20, pad = 46, top = 84;
const sw = W - 2 * P - 2 * pad, sh = sw * (vh / vw);
const H = P + top + sh + 40 + P;
snake = snake.replace(/<svg\b[^>]*>/, m => m
  .replace(/\s(width|height|x|y)="[^"]*"/g, '')
  .replace(/\sviewBox="[^"]*"/, '')
  .replace('<svg', `<svg x="${P + pad}" y="${P + top - 10}" width="${sw}" height="${sh}" viewBox="${vx} ${vy} ${vw} ${vh}" overflow="hidden"`));

const font = (fam, w, f) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(path.join(ROOT, 'assets/fonts', f)).toString('base64')}) format('woff2');}`;
const fmt = n => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
const LV = ['#16161F', '#3B0764', '#6D28D9', '#8B5CF6', '#DDD6FE'];
const lx = W - P - 26 - 5 * 20 - 40, ly = H - P - 40;

const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" fill="none">
<style>${font('SG', 700, 'sg-700.woff2')}${font('JB', 400, 'jb-400.woff2')}.hx-jb{font-family:'JB',Consolas,Menlo,monospace}</style>
<defs><linearGradient id="hx-edge" x1="0" y1="0" x2="${W}" y2="${H}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#22D3EE" stop-opacity=".45"/><stop offset=".5" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#8B5CF6" stop-opacity=".55"/></linearGradient></defs>
<rect x="${P}" y="${P}" width="${W - 2 * P}" height="${H - 2 * P}" rx="24" fill="#0B0B14"/>
<rect x="${P + .5}" y="${P + .5}" width="${W - 2 * P - 1}" height="${H - 2 * P - 1}" rx="23.5" stroke="url(#hx-edge)"/>
<text class="hx-jb" x="${P + 26}" y="${P + 40}" font-size="14" letter-spacing="3.5" fill="#22D3EE">// CONTRIBUTION GRAPH</text>
<text class="hx-jb" x="${W - P - 26}" y="${P + 40}" text-anchor="end" font-size="14" fill="#A1A1AA"><tspan fill="#F4F4F5">${fmt(meta.total)}</tspan> contributions in the last year</text>
${snake}
<text class="hx-jb" x="${P + 26}" y="${ly + 12}" font-size="13" fill="#52525B">auto-updated ${new Date().toISOString().slice(0, 10)}</text>
<text class="hx-jb" x="${lx - 10}" y="${ly + 12}" text-anchor="end" font-size="13" fill="#A1A1AA">less</text>
${LV.map((c, j) => `<rect x="${lx + j * 20}" y="${ly}" width="16" height="16" rx="4" fill="${c}"/>`).join('')}
<text class="hx-jb" x="${lx + 5 * 20 + 6}" y="${ly + 12}" font-size="13" fill="#A1A1AA">more</text>
</svg>`;
fs.writeFileSync(path.join(OUT, 'graph.svg'), out);
console.log('graph.svg written');
