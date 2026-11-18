// Zählt alle 2 598 960 möglichen Hände durch: Seltenheit je Erfolg und Verteilung der Punkte
const TH = require('./ach.js');
const fs = require('fs');
const N = TH.LIST.length;
const DAY = TH.cardId(9, 1); // Herz-9 als Stellvertreter für die Karte des Tages
const counts = new Array(N).fill(0);
const masks = [];
let total = 0;
const ids = [0, 0, 0, 0, 0];
for (let a = 0; a < 48; a++) for (let b = a + 1; b < 49; b++) for (let c = b + 1; c < 50; c++)
  for (let d = c + 1; d < 51; d++) for (let e = d + 1; e < 52; e++) {
    ids[0] = a; ids[1] = b; ids[2] = c; ids[3] = d; ids[4] = e;
    const hs = TH.hits(ids, DAY);
    let m = 0n;
    for (const i of hs) { counts[i]++; m |= 1n << BigInt(i); }
    masks.push(m);
    total++;
  }
const prob = counts.map(c => c / total);
const pts = prob.map(p => TH.ptsOf(p));
const hist = new Map();
for (const m of masks) {
  let s = 0;
  for (let i = 0; i < N; i++) if (m & (1n << BigInt(i))) s += pts[i];
  hist.set(s, (hist.get(s) || 0) + 1);
}
const scores = [...hist.keys()].sort((x, y) => x - y);
let below = 0;
const cdf = scores.map(s => { const row = [s, below / total]; below += hist.get(s); return row; });
const out = { total, prob: Object.fromEntries(TH.LIST.map((a, i) => [a.id, prob[i]])), cdf };
fs.writeFileSync(__dirname + '/data.json', JSON.stringify(out));
TH.LIST.forEach((a, i) => console.log(a.id.padEnd(14), (prob[i] * 100).toFixed(4).padStart(9) + ' %', TH.tierOf(prob[i]).name, '1 von ' + Math.round(1 / prob[i]).toLocaleString('de')));
console.log('Punktstufen:', scores.length, 'max', scores[scores.length - 1]);
