// Badge-Zahlen (statsOf) ohne Server prüfen: Worker mit esbuild bündeln und die Funktion importieren
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const out = join(tmpdir(), 'dailyhand-worker-test.mjs');
buildSync({ entryPoints: [fileURLToPath(new URL('../worker/index.js', import.meta.url))], bundle: true, format: 'esm', outfile: out, logLevel: 'silent' });
const { statsOf, percentile } = await import(pathToFileURL(out).href);
const BADGES = createRequire(import.meta.url)('../src/badges.js');

const row = (day, hits, score) => ({ day, hits, score });

test('Serie, Tage, Punkte, Wiederholung', () => {
  const rows = [
    row('2026-11-01', 'luft,rot', 1000),
    row('2026-11-02', 'paar,rot', 2000),
    row('2026-11-03', 'paar,rot', 3000),
    row('2026-11-05', 'paar', 500),
    row('2026-11-06', 'luft', 700)
  ];
  const s = statsOf(rows, '2026-11-07').stats;
  assert.equal(s.days, 5);
  assert.equal(s.bestStreak, 3);
  assert.equal(s.streak, 2, 'gestern gespielt: Serie läuft noch');
  assert.equal(statsOf(rows, '2026-11-08').stats.streak, 0, 'vorgestern zuletzt: Serie gerissen');
  assert.equal(s.points, 7200);
  assert.equal(s.distinct, 3);
  assert.equal(s.maxRepeat, 3);
  assert.ok(s.bestPct > 0 && s.bestPct < 1);
});

test('leer', () => {
  const s = statsOf([], '2026-11-07').stats;
  assert.equal(s.days, 0); assert.equal(s.streak, 0); assert.equal(s.maxRepeat, 0); assert.equal(s.bestPct, 0);
  assert.deepEqual(BADGES.earned(s), []);
});

test('Badge-Stufen', () => {
  const s = { days: 30, bestStreak: 7, distinct: 24, points: 1000000, commons: 20, uncommons: 10, epics: 0, bestPct: 0.995, maxRepeat: 10 };
  assert.deepEqual(BADGES.earned(s).sort(), ['highroller:0', 'highroller:1', 'hattrick:0', 'lucky:0', 'lucky:1', 'regular:0', 'regular:1', 'streak:0', 'tiers:0'].sort());
});

test('Perzentil steigt mit der Punktzahl', () => {
  assert.ok(percentile(500) <= percentile(10000));
  assert.ok(percentile(403032) > 0.999);
});
