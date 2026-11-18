// Baut ../index.html aus template.html, ach.js und data.json (data.json erzeugt precompute.js)
const fs = require('fs');
const d = __dirname;
let html = fs.readFileSync(d + '/template.html', 'utf8');
html = html.replace('/*ACH*/', () => fs.readFileSync(d + '/ach.js', 'utf8'))
  .replace('/*DATA*/', () => fs.readFileSync(d + '/data.json', 'utf8'));
fs.writeFileSync(d + '/../index.html', html);
console.log('index.html', (html.length / 1024).toFixed(1), 'KB');
