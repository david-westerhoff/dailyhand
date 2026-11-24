// Kartenziehen und Tageskarte ohne Server prüfen
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

// worker/index.js importiert ach.js und data.json wie ein Bundler; hier die reinen Funktionen nachbauen
const src = readFileSync(new URL('../worker/index.js', import.meta.url), 'utf8');
const drawSrc = src.match(/export function drawHand\(\) \{[\s\S]*?\n\}/)[0].replace('export ', '');
const dayCardSrc = src.match(/export function dayCardOf\(day\) \{[\s\S]*?\n\}/)[0].replace('export ', '');
const drawHand = new Function(drawSrc + '; return drawHand;')();
const dayCardOf = new Function(dayCardSrc + '; return dayCardOf;')();

test('fünf verschiedene Karten, ungefähr gleich verteilt', () => {
  const n = 52000, cnt = new Array(52).fill(0);
  for (let i = 0; i < n / 5; i++) {
    const h = drawHand();
    assert.equal(new Set(h).size, 5);
    for (const c of h) cnt[c]++;
  }
  const exp = n / 52; // 1000 je Karte
  for (const c of cnt) assert.ok(Math.abs(c - exp) < 160, `Karte ${c} weicht zu stark ab`);
});

test('Tageskarte gleich wie in der Testversion (Formel aus dem Datum)', () => {
  const seed = 2026 * 10000 + 11 * 100 + 24;
  assert.equal(dayCardOf('2026-11-24'), (Math.imul(seed, 2654435761) >>> 0) % 52);
});

test('ach.js lädt', () => {
  const TH = createRequire(import.meta.url)('../src/ach.js');
  assert.equal(TH.LIST.length, 100);
});
