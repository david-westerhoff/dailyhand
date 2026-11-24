// Ende-zu-Ende-Test gegen den lokalen Server (npm run dev, .dev.vars mit DEV=1 und MAIL_MODE=log).
// Aufruf: node --test test/   (überspringt sich, wenn kein lokaler Server läuft)
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.DH_BASE || 'http://127.0.0.1:8787';
let up = true;
try { await fetch(BASE + '/api/state'); } catch (e) { up = false; }

function client() {
  let cookie = '';
  return async function call(path, body, extra = {}) {
    const r = await fetch(BASE + '/api/' + path, {
      method: body ? 'POST' : 'GET',
      headers: { ...(body ? { 'content-type': 'application/json', origin: BASE } : {}), ...(cookie ? { cookie } : {}), ...extra },
      body: body ? JSON.stringify(body) : undefined
    });
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0].endsWith('=') ? '' : sc.split(';')[0];
    return { status: r.status, data: await r.json(), cookie };
  };
}
const mail = () => `t${Date.now()}${Math.random().toString(36).slice(2, 6)}@example.com`;

test('Gast: eine Hand je Tag, Sammlung zählt', { skip: !up }, async () => {
  const c = client();
  const s0 = await c('state');
  assert.equal(s0.data.user, null);
  assert.equal(s0.data.today, null);
  assert.match(s0.data.day, /^\d{4}-\d{2}-\d{2}$/);
  const d1 = await c('deal', {});
  assert.equal(d1.data.hand.length, 5);
  assert.equal(new Set(d1.data.hand).size, 5);
  assert.ok(d1.data.hand.every(x => x >= 0 && x < 52));
  assert.ok(d1.cookie, 'Cookie gesetzt');
  const d2 = await c('deal', {});
  assert.deepEqual(d2.data.hand, d1.data.hand, 'zweiter Zug liefert dieselbe Hand');
  assert.equal(d2.data.again, true);
  const s1 = await c('state');
  assert.deepEqual(s1.data.today.hand, d1.data.hand);
  assert.ok(Object.keys(s1.data.coll).length >= 1);
  assert.ok(Object.values(s1.data.coll).every(n => n === 1));
});

test('Fremde Herkunft wird abgewiesen', { skip: !up }, async () => {
  const c = client();
  const r = await c('deal', {}, { origin: 'https://evil.example' });
  assert.equal(r.status, 403);
});

test('Login: Gast wird zum Konto, Sammlung bleibt; zweites Gerät sieht dieselbe Hand', { skip: !up }, async () => {
  const email = mail();
  const a = client();
  const d = await a('deal', {});
  const st = await a('auth/start', { email: email.toUpperCase() });
  assert.equal(st.status, 200);
  assert.match(st.data.devCode, /^\d{6}$/);
  const wrong = await a('auth/verify', { email, code: st.data.devCode === '000000' ? '111111' : '000000' });
  assert.equal(wrong.status, 400);
  const ok = await a('auth/verify', { email, code: st.data.devCode });
  assert.equal(ok.status, 200);
  const s = await a('state');
  assert.equal(s.data.user.email, email);
  assert.deepEqual(s.data.today.hand, d.data.hand);

  // zweites Gerät: als Gast schon gespielt, dann Login → Konto behält seine Hand, Gastkonto verschwindet
  const b = client();
  await b('deal', {});
  const st2 = await b('auth/start', { email });
  await b('auth/verify', { email, code: st2.data.devCode });
  const s2 = await b('state');
  assert.equal(s2.data.user.email, email);
  assert.deepEqual(s2.data.today.hand, d.data.hand);

  // Code nur einmal gültig
  const again = await b('auth/verify', { email, code: st2.data.devCode });
  assert.equal(again.status, 400);

  // Abmelden
  await b('auth/logout', {});
  assert.equal((await b('state')).data.user, null);
});

test('Code: nach 5 Fehlversuchen gesperrt', { skip: !up }, async () => {
  const email = mail(), c = client();
  const st = await c('auth/start', { email });
  const bad = st.data.devCode === '123456' ? '654321' : '123456';
  for (let i = 0; i < 5; i++) await c('auth/verify', { email, code: bad });
  const r = await c('auth/verify', { email, code: st.data.devCode });
  assert.equal(r.status, 400);
});

test('Ungültige E-Mail und zu viele Codes', { skip: !up }, async () => {
  const c = client();
  assert.equal((await c('auth/start', { email: 'kein-at' })).status, 400);
  const email = mail();
  let last;
  for (let i = 0; i < 6; i++) last = await c('auth/start', { email });
  assert.equal(last.status, 429);
});

test('Konto löschen entfernt alles', { skip: !up }, async () => {
  const email = mail(), c = client();
  await c('deal', {});
  const st = await c('auth/start', { email });
  await c('auth/verify', { email, code: st.data.devCode });
  assert.equal((await c('account/delete', {})).status, 200);
  assert.equal((await c('state')).data.user, null);
  // gleiche E-Mail erneut: neues, leeres Konto
  const st2 = await c('auth/start', { email });
  await c('auth/verify', { email, code: st2.data.devCode });
  const s = await c('state');
  assert.equal(s.data.today, null);
  assert.deepEqual(s.data.coll, {});
});
