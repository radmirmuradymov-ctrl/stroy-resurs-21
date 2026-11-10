// Генерирует честные заглушки-иллюстрации в public/images/: фактуры материалов и схемы техники.
// Запуск: node scripts/gen-images.mjs. Когда появятся реальные фото из ВК — заменить пути в siteConfig.ts.
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../public/images/', import.meta.url);
mkdirSync(OUT, { recursive: true });

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const W = 800, H = 500;
const svg = (body, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"><rect width="${W}" height="${H}" fill="${bg}"/>${body}</svg>`;
// Фактуры рисуем плиткой TW×TH и повторяем через <pattern>, чтобы файлы были лёгкими
let TW = W, TH = H;
const tiled = (body, bg) =>
  svg(`<defs><pattern id="t" width="${TW}" height="${TH}" patternUnits="userSpaceOnUse"><rect width="${TW}" height="${TH}" fill="${bg}"/>${body}</pattern></defs><rect width="${W}" height="${H}" fill="url(#t)"/>`, bg);
// Дублируем элемент у края плитки, чтобы не было швов
const wrap = (cx, cy, rad, draw) => {
  let out = '';
  for (const dx of [0, -TW, TW]) for (const dy of [0, -TH, TH]) {
    const x = cx + dx, y = cy + dy;
    if (x + rad > 0 && x - rad < TW && y + rad > 0 && y - rad < TH) out += draw(x, y);
  }
  return out;
};
const pick = (r, a) => a[Math.floor(r() * a.length)];
const f = (n) => n.toFixed(1);

function blob(r, cx, cy, rad, sides, jitter) {
  const pts = [];
  const rot = r() * Math.PI * 2;
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    const rr = rad * (1 - jitter + r() * jitter * 2);
    pts.push(`${f(cx + Math.cos(a) * rr)},${f(cy + Math.sin(a) * rr * 0.85)}`);
  }
  return pts.join(' ');
}

// Песок: мелкое зерно
function sandBody(seed, shades, n) {
  const r = rng(seed);
  let b = '';
  for (let i = 0; i < n; i++) b += `<circle cx="${f(r() * TW)}" cy="${f(r() * TH)}" r="${f(0.8 + r() * 2.2)}" fill="${pick(r, shades)}"/>`;
  return b;
}
const sand = (seed, bg, shades, n) => tiled(sandBody(seed, shades, n), bg);

// Щебень / гравий: плотная укладка многоугольников
function stones(seed, bg, shades, size, sides, jitter, n, under = '') {
  const r = rng(seed);
  let b = under;
  for (let i = 0; i < n; i++) {
    const rad = size * (0.6 + r() * 0.8);
    const cx = r() * TW, cy = r() * TH;
    const c = pick(r, shades), a = blob(r, 0, 0, rad, sides, jitter), hi = blob(r, -rad * 0.2, -rad * 0.25, rad * 0.45, sides, jitter);
    b += wrap(cx, cy, rad, (x, y) => `<g transform="translate(${f(x)} ${f(y)})"><polygon points="${a}" fill="${c}" stroke="#00000033" stroke-width="1.5"/><polygon points="${hi}" fill="#ffffff1f"/></g>`);
  }
  return tiled(b, bg);
}

// Торф / перегной: волокна и комки
function fibers(seed, bg, shades, n) {
  const r = rng(seed);
  let b = '';
  for (let i = 0; i < n; i++) {
    const x = r() * TW, y = r() * TH, a = r() * Math.PI, l = 6 + r() * 22;
    b += `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x + Math.cos(a) * l)}" y2="${f(y + Math.sin(a) * l)}" stroke="${pick(r, shades)}" stroke-width="${f(1 + r() * 2.5)}" stroke-linecap="round"/>`;
  }
  return tiled(b, bg);
}

// Кирпичная кладка
function bricks(seed) {
  const r = rng(seed);
  let b = '';
  const bw = 120, bh = 44, m = 8;
  for (let row = 0; row * (bh + m) < H; row++) {
    const off = row % 2 ? -bw / 2 : 0;
    for (let x = off; x < W; x += bw + m) {
      const c = pick(r, ['#A8442A', '#B4502F', '#9A3D25', '#B9583A', '#8F3820']);
      b += `<rect x="${x}" y="${row * (bh + m) + m / 2}" width="${bw}" height="${bh}" fill="${c}"/>`;
      b += `<rect x="${x}" y="${row * (bh + m) + m / 2}" width="${bw}" height="6" fill="#ffffff14"/>`;
    }
  }
  return svg(b, '#C9C3B8');
}

// Дрова: торцы поленьев в поленнице
function logs(seed) {
  const r = rng(seed);
  let b = '';
  const rad = 46;
  for (let row = 0; row * rad * 1.7 < H + rad; row++) {
    for (let col = 0; col * rad * 2 < W + rad; col++) {
      const cx = col * rad * 2 + (row % 2 ? rad : 0) + (r() - 0.5) * 8;
      const cy = row * rad * 1.7 + (r() - 0.5) * 8;
      const rr = rad * (0.85 + r() * 0.2);
      const birch = r() > 0.35;
      b += `<polygon points="${blob(r, cx, cy, rr, 9, 0.08)}" fill="${birch ? '#E8E2D4' : '#4A3426'}"/>`;
      b += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rr * 0.82)}" fill="${pick(r, ['#D4A76A', '#C99A5C', '#DDB27A'])}"/>`;
      for (let k = 1; k < 5; k++) b += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(rr * 0.82 * k / 5)}" fill="none" stroke="#9C6B3A55" stroke-width="1.5"/>`;
      if (r() > 0.5) b += `<line x1="${f(cx)}" y1="${f(cy)}" x2="${f(cx + rr * 0.7)}" y2="${f(cy - rr * 0.3)}" stroke="#6B4A2A88" stroke-width="2"/>`;
    }
  }
  return svg(b, '#2B1E16');
}

TW = 200; TH = 125; // плитка 1/16 кадра
const textures = {
  'pesok.svg': sand(1, '#D6B88A', ['#C9A673', '#E2C9A0', '#B8925E', '#EDDAB8', '#A9824F'], 560),
  'chernozem.svg': stones(4, '#2E221B', ['#3B2C23', '#46352A', '#251B15', '#4F3D30', '#33261E'], 9, 7, 0.35, 150),
  'torf.svg': fibers(5, '#4E3221', ['#6B4630', '#3A2417', '#7D5638', '#5A3A27', '#8A6444'], 260),
};
TW = 400; TH = 250; // крупная фракция — плитка 1/4 кадра
Object.assign(textures, {
  'shcheben.svg': stones(2, '#5E6066', ['#8A8D93', '#9EA1A6', '#7A7D83', '#B0B2B6', '#6D7076'], 26, 6, 0.3, 225),
  'opgs.svg': stones(3, '#CDB38A', ['#9C8F7E', '#B7AB98', '#8A7F70', '#C4B8A4', '#7F7466'], 16, 10, 0.12, 105, sandBody(33, ['#BFA272', '#DCC59C', '#A88D60'], 1200)),
  'kirpich.svg': bricks(6),
  'drova.svg': logs(7),
  'musor.svg': stones(8, '#6E6A64', ['#9A968F', '#B5B0A7', '#A8442A', '#8C887F', '#C6C1B7', '#7B3A26', '#D9D4CA'], 22, 5, 0.45, 175),
});
TW = W; TH = H;

// Схемы техники: силуэт сбоку, размерная линия, подпись
const BLUE = '#1E3F8C', DARK = '#14213D', ORANGE = '#E8642A', GRID = '#D2D6DC';
function grid() {
  let g = '';
  for (let x = 0; x <= W; x += 40) g += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${GRID}" stroke-width="1"/>`;
  for (let y = 0; y <= H; y += 40) g += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${GRID}" stroke-width="1"/>`;
  return g;
}
const wheel = (x, r = 34) => `<circle cx="${x}" cy="390" r="${r}" fill="${DARK}"/><circle cx="${x}" cy="390" r="${r * 0.42}" fill="#EEEEEC"/>`;
const ground = `<rect x="0" y="424" width="${W}" height="6" fill="${DARK}"/>`;
function dim(x1, x2, label) {
  return `<g stroke="${DARK}" stroke-width="2"><line x1="${x1}" y1="462" x2="${x2}" y2="462"/><line x1="${x1}" y1="452" x2="${x1}" y2="472"/><line x1="${x2}" y1="452" x2="${x2}" y2="472"/></g>` +
    `<rect x="${(x1 + x2) / 2 - 170}" y="444" width="340" height="30" fill="#EEEEEC"/>` +
    `<text x="${(x1 + x2) / 2}" y="472" text-anchor="middle" font-family="Arial Narrow, Arial, sans-serif" font-weight="700" font-size="30" fill="${DARK}">${label}</text>`;
}
function cab(x, w = 120, h = 150) {
  return `<path d="M${x} 390 V${390 - h + 30} L${x + 20} ${390 - h} H${x + w} V390 Z" fill="${BLUE}"/>` +
    `<rect x="${x + 22}" y="${390 - h + 14}" width="${w - 38}" height="52" fill="#B3C5FF"/>`;
}
function truck({ cabX, cabW, cabH, body, wheels, label }) {
  return svg(grid() + ground + body + cab(cabX, cabW, cabH) + wheels.map((w) => wheel(w)).join('') + dim(60, 740, label), '#EEEEEC');
}

const vehicles = {
  'gazel.svg': truck({
    cabX: 560, cabW: 150, cabH: 150, label: 'ГАЗель · до 1.5 т',
    body: `<rect x="90" y="190" width="460" height="180" fill="#FFFFFF" stroke="${BLUE}" stroke-width="6"/><rect x="90" y="340" width="460" height="14" fill="${ORANGE}"/><rect x="80" y="370" width="640" height="16" fill="${DARK}"/>`,
    wheels: [200, 620],
  }),
  'zil.svg': truck({
    cabX: 560, cabW: 140, cabH: 170, label: 'ЗИЛ / ГАЗ · до 5 т',
    body: `<path d="M110 360 L130 230 H540 V360 Z" fill="${ORANGE}"/><path d="M130 230 H540 V250 H127 Z" fill="#C44E1A"/><rect x="100" y="360" width="620" height="18" fill="${DARK}"/>`,
    wheels: [210, 330, 630],
  }),
  'kamaz.svg': truck({
    cabX: 560, cabW: 160, cabH: 200, label: 'КамАЗ / МАЗ · 10–20 т',
    body: `<path d="M60 360 L80 180 H545 V360 Z" fill="${ORANGE}"/><path d="M80 180 H545 V204 H77 Z" fill="#C44E1A"/><g stroke="#C44E1A" stroke-width="5">${[170, 260, 350, 440].map((x) => `<line x1="${x}" y1="210" x2="${x}" y2="355"/>`).join('')}</g><rect x="50" y="360" width="680" height="18" fill="${DARK}"/>`,
    wheels: [150, 260, 640],
  }),
  'manipulator.svg': truck({
    cabX: 590, cabW: 140, cabH: 180, label: 'Манипулятор · кран-борт',
    body: `<rect x="60" y="300" width="420" height="60" fill="none" stroke="${BLUE}" stroke-width="8"/><rect x="490" y="250" width="70" height="110" fill="${DARK}"/>` +
      `<path d="M525 255 L330 90 L200 120" fill="none" stroke="${ORANGE}" stroke-width="22" stroke-linejoin="round"/><line x1="200" y1="120" x2="200" y2="230" stroke="${DARK}" stroke-width="4"/>` +
      `<rect x="150" y="230" width="100" height="62" fill="#A8442A"/><rect x="50" y="360" width="680" height="18" fill="${DARK}"/>`,
    wheels: [150, 260, 660],
  }),
};

// Грузчики: мешки у борта (без людей — по ТЗ никаких стоковых касок)
const bags = (() => {
  const r = rng(9);
  let b = grid() + ground;
  for (let i = 0; i < 9; i++) {
    const x = 70 + (i % 5) * 120 + (i > 4 ? 60 : 0), y = i > 4 ? 250 : 330;
    b += `<path d="M${x} ${y + 92} Q${x - 8} ${y + 20} ${x + 20} ${y + 6} H${x + 84} Q${x + 112} ${y + 20} ${x + 104} ${y + 92} Z" fill="${pick(r, ['#FFFFFF', '#F4F2EC', '#E9E6DE'])}" stroke="${DARK}" stroke-width="3"/>`;
    b += `<path d="M${x + 36} ${y + 6} L${x + 52} ${y - 10} L${x + 68} ${y + 6}" fill="none" stroke="${DARK}" stroke-width="3"/>`;
  }
  return svg(b + dim(60, 740, 'Мешки по 40–50 кг'), '#EEEEEC');
})();

for (const [name, content] of Object.entries({ ...textures, ...vehicles, 'meshki.svg': bags })) {
  writeFileSync(new URL(name, OUT), content);
  console.log(name, (content.length / 1024).toFixed(0) + ' KB');
}
