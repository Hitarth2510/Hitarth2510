// Generates dist/stats.svg from the GitHub GraphQL API. No dependencies (Node 20+).
import fs from 'node:fs';
import path from 'node:path';

const LOGIN = process.env.GH_LOGIN || 'Hitarth2510';
const OUT = process.env.OUT_DIR || 'dist';
const ROOT = process.env.REPO_ROOT || '.';

const QUERY = `query($login:String!){user(login:$login){
  followers{totalCount}
  pullRequests{totalCount}
  repositories(ownerAffiliations:OWNER,isFork:false,first:100,orderBy:{field:STARGAZERS,direction:DESC}){
    totalCount nodes{stargazerCount languages(first:10,orderBy:{field:SIZE,direction:DESC}){edges{size node{name color}}}}}
  contributionsCollection{totalCommitContributions restrictedContributionsCount totalPullRequestContributions
    contributionCalendar{totalContributions weeks{contributionDays{contributionCount date weekday}}}}
}}`;

async function getData() {
  if (process.env.MOCK) return JSON.parse(fs.readFileSync(process.env.MOCK, 'utf8'));
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-stats' },
    body: JSON.stringify({ query: QUERY, variables: { login: LOGIN } }),
  });
  const j = await res.json();
  if (!res.ok || j.errors) throw new Error('GitHub API error: ' + JSON.stringify(j.errors || j));
  return j.data.user;
}

const u = await getData();
const cc = u.contributionsCollection;
const days = cc.contributionCalendar.weeks.flatMap(w => w.contributionDays);
const weeks = cc.contributionCalendar.weeks;

// streaks
let longest = 0, run = 0;
for (const d of days) { run = d.contributionCount > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
let current = 0, i = days.length - 1;
if (i >= 0 && days[i].contributionCount === 0) i--; // today may not have contributions yet
for (; i >= 0 && days[i].contributionCount > 0; i--) current++;

// languages
const langs = {};
for (const r of u.repositories.nodes) for (const e of r.languages.edges) {
  const k = e.node.name;
  langs[k] = langs[k] || { size: 0, color: e.node.color || '#8B5CF6' };
  langs[k].size += e.size;
}
const total = Object.values(langs).reduce((a, b) => a + b.size, 0) || 1;
const top = Object.entries(langs).sort((a, b) => b[1].size - a[1].size).slice(0, 6)
  .map(([name, v]) => ({ name, color: v.color, pct: (v.size / total) * 100 }));

const stars = u.repositories.nodes.reduce((a, r) => a + r.stargazerCount, 0);
const fmt = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// fonts
const font = (fam, w, f) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(path.join(ROOT, 'assets/fonts', f)).toString('base64')}) format('woff2');}`;
const CSS = font('SG', 700, 'sg-700.woff2') + font('SG', 500, 'sg-500.woff2') + font('JB', 400, 'jb-400.woff2') +
  `.sg{font-family:'SG','Segoe UI',Helvetica,Arial,sans-serif}.jb{font-family:'JB',Consolas,Menlo,monospace}
@keyframes up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}.up{animation:up .7s ease both}
@keyframes fi{from{opacity:0}to{opacity:1}}.fi{animation:fi .5s ease both}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}.grow{transform-box:fill-box;transform-origin:left;animation:grow 1.2s cubic-bezier(.2,.8,.2,1) both}
@keyframes fl{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}.fl{transform-box:fill-box;transform-origin:center bottom;animation:fl 1.6s ease-in-out infinite}`;

const W = 1200, P = 20, G = 16;
const C = { panel: '#0B0B14', text: '#F4F4F5', mute: '#A1A1AA', cyan: '#22D3EE', violet: '#8B5CF6', lilac: '#C4B5FD' };
const tile = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="24" fill="${C.panel}"/><rect x="${x + .5}" y="${y + .5}" width="${w - 1}" height="${h - 1}" rx="23.5" stroke="url(#edge)"/>`;
const label = (x, y, t, col = C.cyan) => `<text class="jb" x="${x}" y="${y}" font-size="14" letter-spacing="3.5" fill="${col}">${esc(t)}</text>`;
let body = '';

// 1) metric tiles
const metrics = [
  ['CONTRIBUTIONS', cc.contributionCalendar.totalContributions, 'past year'],
  ['COMMITS', cc.totalCommitContributions + cc.restrictedContributionsCount, 'past year'],
  ['PULL REQUESTS', u.pullRequests.totalCount, 'all time'],
  ['STARS EARNED', stars, 'all repos'],
  ['REPOSITORIES', u.repositories.totalCount, 'public'],
  ['FOLLOWERS', u.followers.totalCount, 'on GitHub'],
];
const mw = (W - 2 * P - 5 * G) / 6, mh = 140, my = P;
metrics.forEach(([k, v, sub], j) => {
  const x = P + j * (mw + G);
  body += `<g class="up" style="animation-delay:${j * 0.08}s">${tile(x, my, mw, mh)}
<text class="jb" x="${x + 20}" y="${my + 34}" font-size="12.5" letter-spacing="1.6" fill="${j % 2 ? C.lilac : C.cyan}">${esc(k)}</text>
<text class="sg" x="${x + 18}" y="${my + 94}" font-size="50" font-weight="700" letter-spacing="-1.5" fill="url(#num)">${fmt(v)}</text>
<text class="jb" x="${x + 20}" y="${my + 122}" font-size="13" fill="${C.mute}">${sub}</text></g>`;
});

// 2) streak + languages
const ry = my + mh + G, rh = 230, sw = 380, lw = W - 2 * P - sw - G;
body += tile(P, ry, sw, rh) + label(P + 26, ry + 40, '// STREAK');
body += `<g transform="translate(${P + 300} ${ry + 104})"><path class="fl" d="M0 -46C18 -24 30 -10 30 10C30 30 16 44 0 44C-16 44 -30 30 -30 10C-30 -6 -18 -16 -12 -30C-8 -18 -2 -14 4 -14C4 -26 2 -36 0 -46Z" fill="url(#flame)"/></g>
<text class="sg" x="${P + 24}" y="${ry + 138}" font-size="88" font-weight="700" letter-spacing="-3" fill="url(#num)">${current}</text>
<text class="jb" x="${P + 28}" y="${ry + 172}" font-size="14" letter-spacing="3" fill="${C.text}">${current === 1 ? 'DAY' : 'DAYS'} CURRENT STREAK</text>
<rect x="${P + 26}" y="${ry + 188}" width="${sw - 52}" height="1" fill="#27272A"/>
<text class="jb" x="${P + 28}" y="${ry + 214}" font-size="14" fill="${C.mute}">longest: <tspan fill="${C.lilac}">${longest} days</tspan></text>`;
const lx = P + sw + G;
body += tile(lx, ry, lw, rh) + label(lx + 26, ry + 40, '// TOP LANGUAGES');
const barX = lx + 26, barW = lw - 52, barY = ry + 64;
let bx = barX, bar = '';
top.forEach((l, j) => {
  const w = Math.max(3, (l.pct / top.reduce((a, b) => a + b.pct, 0)) * barW);
  bar += `<rect x="${bx}" y="${barY}" width="${w}" height="16" fill="${l.color}"/>`;
  bx += w;
});
body += `<clipPath id="bar"><rect x="${barX}" y="${barY}" width="${barW}" height="16" rx="8"/></clipPath><g clip-path="url(#bar)" class="grow">${bar}</g>`;
top.forEach((l, j) => {
  const col = j % 3, row = Math.floor(j / 3);
  const x = barX + col * (barW / 3), y = ry + 130 + row * 56;
  body += `<g class="fi" style="animation-delay:${0.4 + j * 0.1}s"><circle cx="${x + 8}" cy="${y - 6}" r="8" fill="${l.color}"/>
<text class="sg" x="${x + 26}" y="${y}" font-size="21" font-weight="500" fill="${C.text}">${esc(l.name)}</text>
<text class="jb" x="${x + 26}" y="${y + 24}" font-size="14" fill="${C.mute}">${l.pct.toFixed(1)}%</text></g>`;
});
if (!top.length) body += `<text class="jb" x="${barX}" y="${ry + 140}" font-size="15" fill="${C.mute}">No public code yet</text>`;

// 3) contribution heatmap
const hy = ry + rh + G, cell = 16, gap = 4.5, hw = W - 2 * P;
const counts = days.map(d => d.contributionCount).filter(c => c > 0).sort((a, b) => a - b);
const q = p => counts.length ? counts[Math.min(counts.length - 1, Math.floor(p * counts.length))] : 1;
const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)];
const LV = ['#16161F', '#3B0764', '#6D28D9', '#8B5CF6', '#DDD6FE'];
const lvl = c => c === 0 ? 0 : c <= q1 ? 1 : c <= q2 ? 2 : c <= q3 ? 3 : 4;
const gridW = weeks.length * (cell + gap) - gap, gx = P + (hw - gridW) / 2, gy = hy + 78;
const hh = 78 + 7 * (cell + gap) + 50;
body += tile(P, hy, hw, hh) + label(P + 26, hy + 40, '// CONTRIBUTION GRAPH');
body += `<text class="jb" x="${W - P - 26}" y="${hy + 40}" text-anchor="end" font-size="14" fill="${C.mute}"><tspan fill="${C.text}">${fmt(cc.contributionCalendar.totalContributions)}</tspan> contributions in the last year</text>`;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
let lastM = -1;
weeks.forEach((w, wi) => {
  const x = gx + wi * (cell + gap);
  const m = new Date(w.contributionDays[0].date).getUTCMonth();
  if (m !== lastM && wi < weeks.length - 2) { body += `<text class="jb" x="${x}" y="${gy - 12}" font-size="13" fill="${C.mute}">${MON[m]}</text>`; lastM = m; }
  let col = '';
  for (const d of w.contributionDays) col += `<rect x="${x}" y="${gy + d.weekday * (cell + gap)}" width="${cell}" height="${cell}" rx="4" fill="${LV[lvl(d.contributionCount)]}"/>`;
  body += `<g class="fi" style="animation-delay:${(wi * 0.018).toFixed(3)}s">${col}</g>`;
});
const ly = gy + 7 * (cell + gap) + 22;
body += `<text class="jb" x="${W - P - 26 - 5 * 20 - 50}" y="${ly + 12}" text-anchor="end" font-size="13" fill="${C.mute}">less</text>` +
  LV.map((c, j) => `<rect x="${W - P - 26 - 5 * 20 - 40 + j * 20}" y="${ly}" width="16" height="16" rx="4" fill="${c}"/>`).join('') +
  `<text class="jb" x="${W - P - 26 - 30}" y="${ly + 12}" font-size="13" fill="${C.mute}">more</text>`;
const updated = new Date().toISOString().slice(0, 10);
body += `<text class="jb" x="${P + 26}" y="${ly + 12}" font-size="13" fill="#52525B">auto-updated ${updated}</text>`;

const H = hy + hh + P;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" fill="none"><style>${CSS}</style>
<defs><linearGradient id="edge" x1="0" y1="0" x2="${W}" y2="${H}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.cyan}" stop-opacity=".45"/><stop offset=".5" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="${C.violet}" stop-opacity=".55"/></linearGradient>
<linearGradient id="num" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${C.lilac}"/></linearGradient>
<linearGradient id="flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#F472B6"/><stop offset=".5" stop-color="${C.violet}"/><stop offset="1" stop-color="${C.cyan}"/></linearGradient></defs>
${body}</svg>`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'stats.svg'), svg);
console.log(`stats.svg written: ${days.length} days, ${top.length} languages, streak ${current}/${longest}`);
