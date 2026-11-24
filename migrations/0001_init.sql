-- Konten: Gastkonto ohne E-Mail oder Konto mit E-Mail
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);

-- Anmeldungen: nur der SHA-256-Wert des Cookies wird gespeichert
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

-- Eine Hand je Konto und Tag (UTC); hits = Erfolge, firsts = an diesem Tag zum ersten Mal erreicht
CREATE TABLE plays (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  cards TEXT NOT NULL,
  hits TEXT NOT NULL,
  firsts TEXT NOT NULL,
  score INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, day)
);

-- Login-Codes: nur als HMAC gespeichert, 15 Minuten gültig, höchstens 5 Versuche
CREATE TABLE login_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX login_codes_email ON login_codes(email, created_at);
CREATE INDEX login_codes_ip ON login_codes(ip_hash, created_at);
