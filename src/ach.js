// Karten: id 0..51, Rang = id%13 + 2 (2..14, 14 = Ass), Farbe = floor(id/13): 0 Pik, 1 Herz, 2 Karo, 3 Kreuz
var TH = (function () {
  var RANK_NAMES = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  function rankOf(id) { return (id % 13) + 2; }
  function suitOf(id) { return Math.floor(id / 13); }
  function rankLabel(r) { return RANK_NAMES[r] || String(r); }
  function num(r) { return r === 14 ? 1 : r; } // Ass zählt als 1 für Zahlen-Erfolge
  function cardId(rank, suit) { return suit * 13 + (rank - 2); }

  function analyse(ids, dayCard) {
    var rc = new Array(15).fill(0), sc = [0, 0, 0, 0], ranks = [], suits = [];
    for (var i = 0; i < 5; i++) {
      var r = rankOf(ids[i]), s = suitOf(ids[i]);
      rc[r]++; sc[s]++; ranks.push(r); suits.push(s);
    }
    var groups = rc.filter(function (c) { return c > 0; }).sort(function (a, b) { return b - a; });
    var flush = Math.max.apply(null, sc) === 5;
    var distinct = groups.length === 5;
    var lo = Math.min.apply(null, ranks), hi = Math.max.apply(null, ranks);
    var wheel = distinct && rc[14] && rc[2] && rc[3] && rc[4] && rc[5];
    var straight = distinct && (hi - lo === 4 || wheel);
    // längste Folge aufeinanderfolgender Ränge (Ass auch als 1)
    var has = function (r) { return r === 1 ? rc[14] > 0 : rc[r] > 0; };
    var run = 0, best = 0;
    for (var r = 1; r <= 14; r++) { run = has(r) ? run + 1 : 0; if (run > best) best = run; }
    return { ids: ids, rc: rc, sc: sc, ranks: ranks, suits: suits, groups: groups, flush: flush,
      straight: straight, lo: lo, run: best, dayCard: dayCard };
  }

  function pokerHand(h) {
    var g = h.groups;
    if (h.straight && h.flush) return h.lo === 10 ? 'royal' : 'sflush';
    if (g[0] === 4) return 'vierling';
    if (g[0] === 3 && g[1] === 2) return 'fullhouse';
    if (h.flush) return 'flush';
    if (h.straight) return 'strasse';
    if (g[0] === 3) return 'drilling';
    if (g[0] === 2 && g[1] === 2) return 'zweipaare';
    if (g[0] === 2) return 'paar';
    return 'luft';
  }

  function every(h, fn) { for (var i = 0; i < 5; i++) if (!fn(h.ranks[i], h.suits[i])) return false; return true; }
  function count(h, fn) { var n = 0; for (var i = 0; i < 5; i++) if (fn(h.ranks[i], h.suits[i])) n++; return n; }
  function holds(h, id) { return h.ids.indexOf(id) >= 0; }
  function isFace(r) { return r >= 11 && r <= 13; }
  var PRIMES = { 2: 1, 3: 1, 5: 1, 7: 1, 11: 1, 13: 1 };

  function can21(h) {
    var sum = 0;
    for (var i = 0; i < 5; i++) { var r = h.ranks[i]; sum += r === 14 ? 1 : Math.min(r, 10); }
    for (var a = 0; a <= h.rc[14]; a++) if (sum + 10 * a === 21) return true;
    return false;
  }

  // gruppe: poker | farben | bilder | zahlen | besonders
  var LIST = [
    { id: 'luft', g: 'poker', name: 'High Card', desc: 'No pair, no straight, no flush' },
    { id: 'paar', g: 'poker', name: 'One Pair', desc: 'Two cards of the same rank' },
    { id: 'zweipaare', g: 'poker', name: 'Two Pair', desc: 'Two different pairs' },
    { id: 'drilling', g: 'poker', name: 'Three of a Kind', desc: 'Three cards of the same rank' },
    { id: 'strasse', g: 'poker', name: 'Straight', desc: 'Five ranks in a row, e.g. 5-6-7-8-9' },
    { id: 'flush', g: 'poker', name: 'Flush', desc: 'Five cards of one suit' },
    { id: 'fullhouse', g: 'poker', name: 'Full House', desc: 'Three of a kind plus a pair' },
    { id: 'vierling', g: 'poker', name: 'Four of a Kind', desc: 'Four cards of the same rank' },
    { id: 'sflush', g: 'poker', name: 'Straight Flush', desc: 'A straight in one suit' },
    { id: 'royal', g: 'poker', name: 'Royal Flush', desc: '10-J-Q-K-A in one suit' },

    { id: 'rot', g: 'farben', name: 'Seeing Red', desc: 'Only hearts and diamonds', t: function (h) { return every(h, function (r, s) { return s === 1 || s === 2; }); } },
    { id: 'schwarz', g: 'farben', name: 'Blackout', desc: 'Only spades and clubs', t: function (h) { return every(h, function (r, s) { return s === 0 || s === 3; }); } },
    { id: 'vierfarben', g: 'farben', name: 'Full Spectrum', desc: 'All four suits in your hand', t: function (h) { return h.sc.every(function (c) { return c > 0; }); } },
    { id: 'fastflush', g: 'farben', name: 'Almost a Flush', desc: 'Four cards of one suit', t: function (h) { return Math.max.apply(null, h.sc) === 4; } },
    { id: 'liebesbrief', g: 'farben', name: 'Love Letter', desc: 'Five hearts', t: function (h) { return h.sc[1] === 5; } },

    { id: 'hofstaat', g: 'bilder', name: 'Royal Court', desc: 'At least three face cards (J, Q, K)', t: function (h) { return count(h, isFace) >= 3; } },
    { id: 'nurbilder', g: 'bilder', name: 'Nobility', desc: 'Five face cards', t: function (h) { return count(h, isFace) === 5; } },
    { id: 'ehepaar', g: 'bilder', name: 'Royal Couple', desc: 'King and queen of the same suit', t: function (h) { for (var s = 0; s < 4; s++) if (holds(h, cardId(13, s)) && holds(h, cardId(12, s))) return true; return false; } },
    { id: 'volk', g: 'bilder', name: 'Commoners', desc: 'No jack, queen, king or ace', t: function (h) { return every(h, function (r) { return r <= 10; }); } },
    { id: 'einass', g: 'bilder', name: 'Ace up the Sleeve', desc: 'Exactly one ace', t: function (h) { return h.rc[14] === 1; } },
    { id: 'asse', g: 'bilder', name: 'Aces High', desc: 'At least two aces', t: function (h) { return h.rc[14] >= 2; } },

    { id: 'faststrasse', g: 'zahlen', name: 'Almost a Straight', desc: 'Four ranks in a row, but no straight', t: function (h) { return !h.straight && h.run === 4; } },
    { id: 'treppe', g: 'zahlen', name: 'Stairs', desc: 'Three ranks in a row', t: function (h) { return h.run === 3; } },
    { id: 'gerade', g: 'zahlen', name: 'All Even', desc: 'Only even values (J = 11, Q = 12, K = 13, A = 1)', t: function (h) { return every(h, function (r) { return num(r) % 2 === 0; }); } },
    { id: 'ungerade', g: 'zahlen', name: 'All Odd', desc: 'Only odd values (J = 11, Q = 12, K = 13, A = 1)', t: function (h) { return every(h, function (r) { return num(r) % 2 === 1; }); } },
    { id: 'primzahlen', g: 'zahlen', name: 'Prime Time', desc: 'Only 2, 3, 5, 7, J (11) and K (13)', t: function (h) { return every(h, function (r) { return PRIMES[num(r)]; }); } },
    { id: 'klein', g: 'zahlen', name: 'Small Change', desc: 'Only A, 2, 3, 4 and 5', t: function (h) { return every(h, function (r) { return num(r) <= 5; }); } },
    { id: 'hoch', g: 'zahlen', name: 'High Society', desc: 'Only 10, J, Q, K and A', t: function (h) { return every(h, function (r) { return r >= 10; }); } },
    { id: 'einundzwanzig', g: 'zahlen', name: 'Blackjack', desc: 'Card values add up to exactly 21 (faces 10, ace 1 or 11)', t: can21 },

    { id: 'tageskarte', g: 'besonders', name: 'Card of the Day', desc: 'Today’s card is in your hand', t: function (h) { return holds(h, h.dayCard); } },
    { id: 'sieben', g: 'besonders', name: 'Lucky Sevens', desc: 'Three sevens', t: function (h) { return h.rc[7] >= 3; } },
    { id: 'teufel', g: 'besonders', name: '666', desc: 'Three sixes', t: function (h) { return h.rc[6] >= 3; } },
    { id: 'pech', g: 'besonders', name: 'Worst Hand', desc: '7-5-4-3-2 without a flush, the worst hand in poker', t: function (h) { return !h.flush && h.rc[7] && h.rc[5] && h.rc[4] && h.rc[3] && h.rc[2] ? true : false; } },
    { id: 'deadman', g: 'besonders', name: 'Dead Man’s Hand', desc: 'Ace and 8 of spades, ace and 8 of clubs', t: function (h) { return holds(h, cardId(14, 0)) && holds(h, cardId(14, 3)) && holds(h, cardId(8, 0)) && holds(h, cardId(8, 3)); } }
  ];

  var TIERS = [
    { id: 'legendaer', name: 'Legendary', max: 1e-4, pts: 5000 },
    { id: 'episch', name: 'Epic', max: 1e-3, pts: 1000 },
    { id: 'selten', name: 'Rare', max: 1e-2, pts: 250 },
    { id: 'ungewoehnlich', name: 'Uncommon', max: 1e-1, pts: 50 },
    { id: 'gewoehnlich', name: 'Common', max: 2, pts: 10 }
  ];
  function tierOf(p) { for (var i = 0; i < TIERS.length; i++) if (p < TIERS[i].max) return TIERS[i]; }
  // Punkte wachsen mit der Wurzel der Seltenheit: 1 von 4 -> 10, 1 von 100 -> 50, 1 von 650 000 -> 4030
  function ptsOf(p) { return Math.max(5, Math.round(Math.sqrt(1 / p)) * 5); }

  // Gibt Indizes der erreichten Erfolge zurück
  function hits(ids, dayCard) {
    var h = analyse(ids, dayCard), ph = pokerHand(h), out = [];
    for (var i = 0; i < LIST.length; i++) {
      var a = LIST[i];
      if (a.g === 'poker' ? a.id === ph : a.t(h)) out.push(i);
    }
    return out;
  }

  return { LIST: LIST, TIERS: TIERS, tierOf: tierOf, ptsOf: ptsOf, hits: hits, rankOf: rankOf, suitOf: suitOf,
    rankLabel: rankLabel, cardId: cardId };
})();
if (typeof module !== 'undefined') module.exports = TH;
