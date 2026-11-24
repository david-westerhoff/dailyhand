# Daily Hand

Five cards, once a day. Draw your hand, unlock achievements and fill your collection.

## How it works

- **Page**: `src/template.html`, `src/ach.js` and `src/data.json` are built into `public/index.html` (`npm run build`).
- **Server**: a Cloudflare Worker (`worker/index.js`) with a D1 database (`migrations/`). It draws the cards, allows one hand per player and UTC day, stores the collection and signs players in with a 6-digit code by email (sent via Resend).
- `src/precompute.js` counts all 2,598,960 possible hands and writes `src/data.json`: how rare each achievement is and how scores are distributed.

## Local development

```
npm install
npm run db:local
npm run dev        # http://127.0.0.1:8787
npm test           # needs the dev server for the API tests
```

`.dev.vars` (not committed) for local runs:

```
MAIL_MODE=log
DEV=1
CODE_SECRET=anything-for-local-use
```

## Deploy

Secrets `CODE_SECRET` and `RESEND_API_KEY` are set with `wrangler secret put`, never in the repo.

```
npm run db:remote
npm run deploy
```

Fonts: Fraunces and Bricolage Grotesque, SIL Open Font License 1.1 (see `fonts/`).
