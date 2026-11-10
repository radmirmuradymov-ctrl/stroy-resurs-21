// shortcut: в коде ссылки от корня ("/images/…", "/uslugi/…"). Для GitHub Pages (сайт в подпапке)
// после сборки дописываем подпапку в HTML. Если сайт переедет на свой домен — скрипт не нужен.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const base = (process.env.BASE_PATH || '').replace(/\/$/, '');
if (!base) process.exit(0);

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
let n = 0;
for (const f of walk('dist').filter((f) => f.endsWith('.html'))) {
  const s = readFileSync(f, 'utf8');
  // href="/x", src="/x" и то же внутри JSON-пропсов островов (&quot;/images/…)
  const out = s
    .replace(new RegExp(`((?:href|src)=")/(?!/|${base.slice(1)}/)`, 'g'), `$1${base}/`)
    .replace(new RegExp(`(&quot;)/(images|materialy|uslugi|logo)`, 'g'), `$1${base}/$2`);
  if (out !== s) { writeFileSync(f, out); n++; }
}
console.log(`fix-base: ${base} → ${n} html`);
