# Daily Hand

Five cards, once a day. Draw your hand, unlock achievements and fill your collection.

Play: https://david-westerhoff.github.io/dailyhand/

## How it works

- `index.html` is the whole game. It is built from `src/template.html`, `src/ach.js` and `src/data.json`.
- `src/precompute.js` counts all 2,598,960 possible hands and writes `src/data.json`: how rare each achievement is and how scores are distributed.
- Rebuild after changes:

```
node src/precompute.js
node src/build.js
```

Fonts: Fraunces and Bricolage Grotesque, SIL Open Font License 1.1 (see `fonts/`).
