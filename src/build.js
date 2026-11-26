// Baut public/index.html aus template.html, ach.js und data.json (data.json erzeugt precompute.js)
// und kopiert Schriften und Kopfzeilen nach public/. Der Worker liefert public/ aus.
const fs = require('fs');
const path = require('path');
const d = __dirname, out = path.join(d, '..', 'public');
fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });
let html = fs.readFileSync(d + '/template.html', 'utf8');
html = html.replace('/*ACH*/', () => fs.readFileSync(d + '/ach.js', 'utf8'))
  .replace('/*BADGES*/', () => fs.readFileSync(d + '/badges.js', 'utf8'))
  .replace('/*DATA*/', () => fs.readFileSync(d + '/data.json', 'utf8'));
fs.writeFileSync(path.join(out, 'index.html'), html);
for (const f of fs.readdirSync(path.join(d, '..', 'fonts'))) fs.copyFileSync(path.join(d, '..', 'fonts', f), path.join(out, 'fonts', f));
fs.copyFileSync(path.join(d, '_headers'), path.join(out, '_headers'));
console.log('public/index.html', (html.length / 1024).toFixed(1), 'KB');
