// Daily Hand – Server: zieht die Karten, speichert eine Hand je Konto und Tag, Login per E-Mail-Code.
// Ein Tag ist ein UTC-Tag, damit alle Spieler dieselbe Karte des Tages haben.
import TH from '../src/ach.js';
import DATA from '../src/data.json';

const DAY_MS = 864e5;
const SESSION_DAYS = 365;
const GUEST_KEEP_DAYS = 180;  // Gastkonten ohne Spiel so lange werden gelöscht
const CODE_MINUTES = 15;
const CODE_TRIES = 5;
const CODES_PER_EMAIL_HOUR = 5;
const CODES_PER_IP_HOUR = 20;
const COOKIE = 'dh_s';

// Punkte je Erfolg, einmal beim Start berechnet
const PTS = TH.LIST.map(a => TH.ptsOf(DATA.prob[a.id]));

export function dayOf(ms) { return new Date(ms).toISOString().slice(0, 10); }
export function dayCardOf(day) {
  const [y, m, d] = day.split('-').map(Number);
  return (Math.imul(y * 10000 + m * 100 + d, 2654435761) >>> 0) % 52;
}

// Fünf verschiedene Karten, gleichverteilt (Ablehnungsverfahren gegen Modulo-Verzerrung)
export function drawHand() {
  const deck = [...Array(52).keys()];
  const buf = new Uint32Array(1);
  for (let j = 0; j < 5; j++) {
    const n = 52 - j, lim = Math.floor(0x100000000 / n) * n;
    let x;
    do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= lim);
    const k = j + (x % n);
    [deck[j], deck[k]] = [deck[k], deck[j]];
  }
  return deck.slice(0, 5);
}

function hex(buf) { return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join(''); }
async function sha256(s) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); }
async function hmac(key, s) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(s)));
}
function randomToken() { const b = new Uint8Array(32); crypto.getRandomValues(b); return hex(b); }
function randomCode() {
  const buf = new Uint32Array(1);
  let x;
  do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= 4294000000); // 4 294 000 000 ist durch 10^6 teilbar
  return String(x % 1e6).padStart(6, '0');
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
  });
}
function cookieHeader(token, req) {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  if (!token) return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}
function readCookie(req) {
  const m = (req.headers.get('cookie') || '').match(/(?:^|;\s*)dh_s=([0-9a-f]{64})/);
  return m ? m[1] : null;
}
export function normEmail(s) {
  if (typeof s !== 'string') return null;
  const e = s.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
}

async function currentUser(env, req) {
  const token = readCookie(req);
  if (!token) return null;
  const row = await env.DB.prepare(
    'SELECT u.id, u.email, s.token_hash FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?'
  ).bind(await sha256(token), Date.now()).first();
  return row || null;
}

async function newSession(env, userId) {
  const token = randomToken(), now = Date.now();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), userId, now, now + SESSION_DAYS * DAY_MS).run();
  return token;
}

async function collection(env, userId) {
  const { results } = await env.DB.prepare('SELECT hits FROM plays WHERE user_id = ?').bind(userId).all();
  const coll = {};
  for (const r of results) for (const id of r.hits.split(',')) if (id) coll[id] = (coll[id] || 0) + 1;
  return coll;
}

function playOut(row) {
  return row ? { hand: JSON.parse(row.cards), firsts: row.firsts ? row.firsts.split(',') : [] } : null;
}

// ---------- Endpunkte ----------

async function getState(env, req) {
  const day = dayOf(Date.now());
  const user = await currentUser(env, req);
  let today = null, coll = {};
  if (user) {
    today = playOut(await env.DB.prepare('SELECT cards, firsts FROM plays WHERE user_id = ? AND day = ?').bind(user.id, day).first());
    coll = await collection(env, user.id);
  }
  return json({ day, dayCard: dayCardOf(day), user: user ? { email: user.email } : null, today, coll });
}

async function deal(env, req) {
  const now = Date.now(), day = dayOf(now);
  let user = await currentUser(env, req), setCookie = null;
  if (!user) {
    // Gastkonto erst beim ersten Spiel anlegen, nicht schon beim Seitenaufruf
    const id = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO users (id, email, created_at, last_seen) VALUES (?, NULL, ?, ?)').bind(id, now, now).run();
    setCookie = await newSession(env, id);
    user = { id, email: null };
  }
  const existing = await env.DB.prepare('SELECT cards, firsts FROM plays WHERE user_id = ? AND day = ?').bind(user.id, day).first();
  if (existing) return json({ day, ...playOut(existing), coll: await collection(env, user.id), again: true });

  const before = await collection(env, user.id);
  const hand = drawHand();
  const idx = TH.hits(hand, dayCardOf(day));
  const ids = idx.map(i => TH.LIST[i].id);
  const firsts = ids.filter(id => !before[id]);
  const score = idx.reduce((s, i) => s + PTS[i], 0);
  const res = await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO plays (user_id, day, cards, hits, firsts, score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(user.id, day, JSON.stringify(hand), ids.join(','), firsts.join(','), score, now),
    env.DB.prepare('UPDATE users SET last_seen = ? WHERE id = ?').bind(now, user.id)
  ]);
  if (!res[0].meta.changes) {
    // zwei Anfragen gleichzeitig: die erste gewinnt
    const row = await env.DB.prepare('SELECT cards, firsts FROM plays WHERE user_id = ? AND day = ?').bind(user.id, day).first();
    return json({ day, ...playOut(row), coll: await collection(env, user.id), again: true });
  }
  const coll = before;
  for (const id of ids) coll[id] = (coll[id] || 0) + 1;
  return json({ day, hand, firsts, coll }, 200, setCookie ? { 'set-cookie': cookieHeader(setCookie, req) } : {});
}

async function sendMail(env, to, code) {
  const subject = `${code} is your Daily Hand code`;
  const text = `Your Daily Hand sign-in code is ${code}\n\nIt is valid for ${CODE_MINUTES} minutes. ` +
    `If you did not ask for it, you can ignore this email.`;
  if (env.MAIL_MODE === 'log') { console.log(`[mail] an ${to}: ${subject}`); return true; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text })
  });
  if (!r.ok) console.log('[mail] Fehler', r.status, (await r.text()).slice(0, 200));
  return r.ok;
}

async function authStart(env, req, body) {
  const email = normEmail(body.email);
  if (!email) return json({ error: 'Please enter a valid email address.' }, 400);
  const now = Date.now(), hourAgo = now - 36e5;
  const ipHash = await hmac(env.CODE_SECRET, 'ip:' + (req.headers.get('cf-connecting-ip') || 'local'));
  const [byMail, byIp] = await env.DB.batch([
    env.DB.prepare('SELECT COUNT(*) AS n FROM login_codes WHERE email = ? AND created_at > ?').bind(email, hourAgo),
    env.DB.prepare('SELECT COUNT(*) AS n FROM login_codes WHERE ip_hash = ? AND created_at > ?').bind(ipHash, hourAgo)
  ]);
  if (byMail.results[0].n >= CODES_PER_EMAIL_HOUR || byIp.results[0].n >= CODES_PER_IP_HOUR)
    return json({ error: 'Too many codes requested. Please try again in an hour.' }, 429);
  const code = randomCode();
  await env.DB.prepare('INSERT INTO login_codes (email, code_hash, ip_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(email, await hmac(env.CODE_SECRET, email + ':' + code), ipHash, now, now + CODE_MINUTES * 60e3).run();
  if (!(await sendMail(env, email, code))) return json({ error: 'The email could not be sent. Please try again later.' }, 502);
  return json(env.DEV === '1' ? { ok: true, devCode: code } : { ok: true });
}

async function authVerify(env, req, body) {
  const email = normEmail(body.email), code = String(body.code || '').replace(/\D/g, '');
  if (!email || code.length !== 6) return json({ error: 'Please enter the 6-digit code from the email.' }, 400);
  const now = Date.now();
  const row = await env.DB.prepare(
    'SELECT id, code_hash, attempts FROM login_codes WHERE email = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 1'
  ).bind(email, now).first();
  if (!row || row.attempts >= CODE_TRIES) return json({ error: 'This code has expired. Please request a new one.' }, 400);
  await env.DB.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?').bind(row.id).run();
  if ((await hmac(env.CODE_SECRET, email + ':' + code)) !== row.code_hash)
    return json({ error: row.attempts + 1 >= CODE_TRIES ? 'Too many wrong tries. Please request a new code.' : 'That code is not right.' }, 400);

  const guest = await currentUser(env, req);
  const account = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  const stmts = [env.DB.prepare('DELETE FROM login_codes WHERE email = ?').bind(email)];
  let userId;
  if (account) {
    userId = account.id;
    if (guest && !guest.email && guest.id !== account.id) {
      // Gastspiele ins Konto übernehmen, wo das Konto an dem Tag noch nichts hat; dann Gastkonto löschen
      stmts.push(
        env.DB.prepare('INSERT OR IGNORE INTO plays (user_id, day, cards, hits, firsts, score, created_at) SELECT ?, day, cards, hits, firsts, score, created_at FROM plays WHERE user_id = ?').bind(account.id, guest.id),
        env.DB.prepare('DELETE FROM plays WHERE user_id = ?').bind(guest.id),
        env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(guest.id),
        env.DB.prepare('DELETE FROM users WHERE id = ?').bind(guest.id)
      );
    } else if (guest) {
      stmts.push(env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(guest.token_hash));
    }
  } else if (guest && !guest.email) {
    // Gast bekommt einfach die E-Mail: Sammlung bleibt
    userId = guest.id;
    stmts.push(env.DB.prepare('UPDATE users SET email = ? WHERE id = ?').bind(email, guest.id),
      env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(guest.token_hash));
  } else {
    userId = crypto.randomUUID();
    stmts.push(env.DB.prepare('INSERT INTO users (id, email, created_at, last_seen) VALUES (?, ?, ?, ?)').bind(userId, email, now, now));
    if (guest) stmts.push(env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(guest.token_hash));
  }
  stmts.push(env.DB.prepare('UPDATE users SET last_seen = ? WHERE id = ?').bind(now, userId));
  await env.DB.batch(stmts);
  const token = await newSession(env, userId);
  return json({ ok: true }, 200, { 'set-cookie': cookieHeader(token, req) });
}

async function logout(env, req) {
  const user = await currentUser(env, req);
  if (user) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(user.token_hash).run();
  return json({ ok: true }, 200, { 'set-cookie': cookieHeader(null, req) });
}

async function deleteAccount(env, req) {
  const user = await currentUser(env, req);
  if (user) {
    const stmts = [
      env.DB.prepare('DELETE FROM plays WHERE user_id = ?').bind(user.id),
      env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
      env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id)
    ];
    if (user.email) stmts.push(env.DB.prepare('DELETE FROM login_codes WHERE email = ?').bind(user.email));
    await env.DB.batch(stmts);
  }
  return json({ ok: true }, 200, { 'set-cookie': cookieHeader(null, req) });
}

export async function cleanup(env, now = Date.now()) {
  const old = now - GUEST_KEEP_DAYS * DAY_MS;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM login_codes WHERE expires_at < ?').bind(now - DAY_MS),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
    env.DB.prepare('DELETE FROM plays WHERE user_id IN (SELECT id FROM users WHERE email IS NULL AND last_seen < ?)').bind(old),
    env.DB.prepare('DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email IS NULL AND last_seen < ?)').bind(old),
    env.DB.prepare('DELETE FROM users WHERE email IS NULL AND last_seen < ?').bind(old)
  ]);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    if (!env.CODE_SECRET) return json({ error: 'Server not configured' }, 500);
    try {
      if (req.method === 'GET' && url.pathname === '/api/state') return await getState(env, req);
      if (req.method !== 'POST') return json({ error: 'Not found' }, 404);
      // Schutz gegen fremde Seiten, die Anfragen im Namen des Spielers schicken
      const origin = req.headers.get('origin');
      if (!origin || new URL(origin).host !== url.host) return json({ error: 'Forbidden' }, 403);
      let body = {};
      try { body = await req.json(); } catch (e) {}
      switch (url.pathname) {
        case '/api/deal': return await deal(env, req);
        case '/api/auth/start': return await authStart(env, req, body);
        case '/api/auth/verify': return await authVerify(env, req, body);
        case '/api/auth/logout': return await logout(env, req);
        case '/api/account/delete': return await deleteAccount(env, req);
      }
      return json({ error: 'Not found' }, 404);
    } catch (e) {
      console.log('[fehler]', e && e.stack || e);
      return json({ error: 'Something went wrong. Please try again.' }, 500);
    }
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(cleanup(env)); }
};
