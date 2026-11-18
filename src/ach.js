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
    var sum = 0; for (var k = 0; k < 5; k++) sum += num(ranks[k]);
    return { ids: ids, rc: rc, sc: sc, ranks: ranks, suits: suits, groups: groups, flush: flush,
      straight: straight, lo: lo, run: best, dayCard: dayCard, has: has, sum: sum, distinct: distinct,
      nSuits: sc.filter(function (c) { return c > 0; }).length, maxSuit: Math.max.apply(null, sc) };
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

  function only(h, set) { return every(h, function (r) { return set.indexOf(num(r)) >= 0; }); }
  function pairOf(r) { return function (h) { return h.rc[r] >= 2; }; }
  function isPrime(n) { if (n < 2) return false; for (var d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; }
  function gutshot(h) {
    if (h.straight || h.run >= 4) return false;
    for (var s = 1; s <= 10; s++) {
      var miss = -1, n = 0;
      for (var j = 0; j < 5; j++) { if (h.has(s + j)) n++; else miss = j; }
      if (n === 4 && miss >= 1 && miss <= 3) return true;
    }
    return false;
  }
  function spread(h) {
    if (!h.distinct) return false;
    for (var r = 1; r <= 13; r++) if (h.has(r) && h.has(r + 1)) return false;
    return true;
  }
  function suitedConnectors(h) {
    for (var i = 0; i < 5; i++) for (var j = 0; j < 5; j++) {
      if (i === j || h.suits[i] !== h.suits[j]) continue;
      var a = h.ranks[i], b = h.ranks[j];
      if (b - a === 1 || (a === 14 && b === 2)) return true;
    }
    return false;
  }
  function twins(h) {
    for (var r = 2; r <= 14; r++) {
      if (h.rc[r] < 2) continue;
      var red = 0, black = 0;
      for (var i = 0; i < 5; i++) if (h.ranks[i] === r) { if (h.suits[i] === 1 || h.suits[i] === 2) red++; else black++; }
      if (red >= 2 || black >= 2) return true;
    }
    return false;
  }
  function almostRoyal(h) {
    if (h.ph === 'royal') return false;
    for (var s = 0; s < 4; s++) {
      var n = 0;
      for (var r = 10; r <= 14; r++) if (holds(h, cardId(r, s))) n++;
      if (n === 4) return true;
    }
    return false;
  }
  function facePairs(h) { var n = 0; for (var r = 11; r <= 13; r++) if (h.rc[r] === 2) n++; return n; }
  function reds(h) { return count(h, function (r, s) { return s === 1 || s === 2; }); }

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
    { id: 'deadman', g: 'besonders', name: 'Dead Man’s Hand', desc: 'Ace and 8 of spades, ace and 8 of clubs', t: function (h) { return holds(h, cardId(14, 0)) && holds(h, cardId(14, 3)) && holds(h, cardId(8, 0)) && holds(h, cardId(8, 3)); } },

    // Seit 18.11.2026: 66 weitere Erfolge, damit es 100 sind
    { id: 'diamonds5', g: 'farben', name: 'Diamond Mine', desc: 'Five diamonds', t: function (h) { return h.sc[2] === 5; } },
    { id: 'spades5', g: 'farben', name: 'Shovel Ready', desc: 'Five spades', t: function (h) { return h.sc[0] === 5; } },
    { id: 'clubs5', g: 'farben', name: 'Club Night', desc: 'Five clubs', t: function (h) { return h.sc[3] === 5; } },
    { id: 'twotone', g: 'farben', name: 'Two-Tone', desc: 'Exactly two suits', t: function (h) { return h.nSuits === 2; } },
    { id: 'tricolor', g: 'farben', name: 'Tricolor', desc: 'Exactly three suits', t: function (h) { return h.nSuits === 3; } },
    { id: 'heartless', g: 'farben', name: 'Heartless', desc: 'Not a single heart', t: function (h) { return h.sc[1] === 0; } },
    { id: 'oddone', g: 'farben', name: 'Odd One Out', desc: 'Four cards of one colour, one of the other', t: function (h) { var n = reds(h); return n === 1 || n === 4; } },
    { id: 'suitup', g: 'farben', name: 'Suit Up', desc: 'Exactly three cards of one suit', t: function (h) { return h.maxSuit === 3; } },
    { id: 'suitedconn', g: 'farben', name: 'Suited Connectors', desc: 'Two neighbouring ranks in the same suit, e.g. 8 and 9 of clubs', t: suitedConnectors },
    { id: 'twins', g: 'farben', name: 'Twins', desc: 'A pair in the same colour', t: twins },

    { id: 'acespades', g: 'besonders', name: 'Death Card', desc: 'Ace of spades', t: function (h) { return holds(h, cardId(14, 0)); } },
    { id: 'queenspades', g: 'besonders', name: 'Black Lady', desc: 'Queen of spades', t: function (h) { return holds(h, cardId(12, 0)); } },
    { id: 'suicideking', g: 'besonders', name: 'Suicide King', desc: 'King of hearts, the king with the sword', t: function (h) { return holds(h, cardId(13, 1)); } },
    { id: 'oneeyed', g: 'besonders', name: 'One-Eyed Jacks', desc: 'Jack of spades and jack of hearts', t: function (h) { return holds(h, cardId(11, 0)) && holds(h, cardId(11, 1)); } },
    { id: 'truelove', g: 'besonders', name: 'True Love', desc: 'King and queen of hearts', t: function (h) { return holds(h, cardId(13, 1)) && holds(h, cardId(12, 1)); } },
    { id: 'blackjack2', g: 'besonders', name: 'Black Jack', desc: 'Ace of spades and a black jack', t: function (h) { return holds(h, cardId(14, 0)) && (holds(h, cardId(11, 0)) || holds(h, cardId(11, 3))); } },
    { id: 'family', g: 'bilder', name: 'Family Portrait', desc: 'Jack, queen and king of the same suit', t: function (h) { for (var s = 0; s < 4; s++) if (holds(h, cardId(11, s)) && holds(h, cardId(12, s)) && holds(h, cardId(13, s))) return true; return false; } },
    { id: 'sevendeuce', g: 'zahlen', name: 'Seven-Deuce', desc: 'A 7 and a 2 of different suits, the worst start in Hold’em', t: function (h) { for (var i = 0; i < 5; i++) for (var j = 0; j < 5; j++) if (h.ranks[i] === 7 && h.ranks[j] === 2 && h.suits[i] !== h.suits[j]) return true; return false; } },

    { id: 'ducks', g: 'zahlen', name: 'Ducks', desc: 'A pair of twos', t: pairOf(2) },
    { id: 'crabs', g: 'zahlen', name: 'Crabs', desc: 'A pair of threes', t: pairOf(3) },
    { id: 'sailboats', g: 'zahlen', name: 'Sailboats', desc: 'A pair of fours', t: pairOf(4) },
    { id: 'presto', g: 'zahlen', name: 'Presto', desc: 'A pair of fives', t: pairOf(5) },
    { id: 'route66', g: 'zahlen', name: 'Route 66', desc: 'A pair of sixes', t: pairOf(6) },
    { id: 'sticks', g: 'zahlen', name: 'Walking Sticks', desc: 'A pair of sevens', t: pairOf(7) },
    { id: 'snowmen', g: 'zahlen', name: 'Snowmen', desc: 'A pair of eights', t: pairOf(8) },
    { id: 'dimes', g: 'zahlen', name: 'Dimes', desc: 'A pair of tens', t: pairOf(10) },
    { id: 'hooks', g: 'bilder', name: 'Hooks', desc: 'A pair of jacks', t: pairOf(11) },
    { id: 'ladies', g: 'bilder', name: 'Ladies', desc: 'A pair of queens', t: pairOf(12) },
    { id: 'cowboys', g: 'bilder', name: 'Cowboys', desc: 'A pair of kings', t: pairOf(13) },

    { id: 'bigslick', g: 'bilder', name: 'Big Slick', desc: 'An ace and a king', t: function (h) { return h.rc[14] > 0 && h.rc[13] > 0; } },
    { id: 'highslows', g: 'zahlen', name: 'Highs and Lows', desc: 'An ace and a two', t: function (h) { return h.rc[14] > 0 && h.rc[2] > 0; } },
    { id: 'threeaces', g: 'bilder', name: 'Three Aces', desc: 'At least three aces', t: function (h) { return h.rc[14] >= 3; } },
    { id: 'fouraces', g: 'bilder', name: 'Ace Collector', desc: 'All four aces', t: function (h) { return h.rc[14] === 4; } },
    { id: 'fourkings', g: 'bilder', name: 'Kingdom', desc: 'All four kings', t: function (h) { return h.rc[13] === 4; } },
    { id: 'wedding', g: 'bilder', name: 'Royal Wedding', desc: 'Two kings and two queens', t: function (h) { return h.rc[13] >= 2 && h.rc[12] >= 2; } },
    { id: 'acesandeights', g: 'bilder', name: 'Aces and Eights', desc: 'Two aces and two eights in any suits', t: function (h) { return h.rc[14] === 2 && h.rc[8] === 2; } },
    { id: 'twofaces', g: 'bilder', name: 'Two Faces', desc: 'Exactly two face cards (J, Q, K)', t: function (h) { return count(h, isFace) === 2; } },
    { id: 'singledigits', g: 'zahlen', name: 'Single Digits', desc: 'Only 2 to 9', t: function (h) { return every(h, function (r) { return r >= 2 && r <= 9; }); } },
    { id: 'lowtide', g: 'zahlen', name: 'Low Tide', desc: 'Only A to 7', t: function (h) { return every(h, function (r) { return num(r) <= 7; }); } },
    { id: 'middle', g: 'zahlen', name: 'Middle Class', desc: 'Only 6, 7, 8 and 9', t: function (h) { return every(h, function (r) { return r >= 6 && r <= 9; }); } },
    { id: 'doubledigits', g: 'zahlen', name: 'Double Digits', desc: 'Only 10, J, Q and K', t: function (h) { return every(h, function (r) { return r >= 10 && r <= 13; }); } },
    { id: 'spread', g: 'zahlen', name: 'Spread Out', desc: 'Five different ranks, no two next to each other', t: spread },
    { id: 'gutshot', g: 'zahlen', name: 'Gutshot', desc: 'A straight with one gap in the middle, e.g. 5-6-8-9', t: gutshot },
    { id: 'acehigh', g: 'bilder', name: 'Ace-High Nothing', desc: 'High card only, but with an ace', t: function (h) { return h.ph === 'luft' && h.rc[14] > 0; } },

    { id: 'wheel', g: 'besonders', name: 'The Wheel', desc: 'Straight A-2-3-4-5', t: function (h) { return h.straight && h.rc[14] > 0 && h.rc[2] > 0; } },
    { id: 'broadway', g: 'besonders', name: 'Broadway', desc: 'Straight 10-J-Q-K-A', t: function (h) { return h.straight && h.lo === 10; } },
    { id: 'wisemen', g: 'bilder', name: 'Three Wise Men', desc: 'Three kings', t: function (h) { return h.rc[13] >= 3; } },
    { id: 'rainbowroad', g: 'besonders', name: 'Rainbow Road', desc: 'A straight with all four suits', t: function (h) { return h.straight && h.nSuits === 4; } },
    { id: 'acesfull', g: 'besonders', name: 'Aces Full', desc: 'Full house with three aces', t: function (h) { return h.ph === 'fullhouse' && h.rc[14] === 3; } },
    { id: 'palace', g: 'besonders', name: 'Palace', desc: 'Full house of face cards only', t: function (h) { return h.ph === 'fullhouse' && count(h, isFace) === 5; } },
    { id: 'humbleflush', g: 'besonders', name: 'Humble Flush', desc: 'A flush with no card above 8', t: function (h) { return h.flush && every(h, function (r) { return r <= 8; }); } },
    { id: 'courtcase', g: 'besonders', name: 'Court Case', desc: 'Two pair, both pairs face cards', t: function (h) { return h.ph === 'zweipaare' && facePairs(h) === 2; } },
    { id: 'almostroyal', g: 'besonders', name: 'Almost Royal', desc: 'Four cards of a royal flush', t: almostRoyal },

    { id: 'evensum', g: 'zahlen', name: 'Even Stevens', desc: 'Card values add up to an even number (A = 1, J = 11, Q = 12, K = 13)', t: function (h) { return h.sum % 2 === 0; } },
    { id: 'primesum', g: 'zahlen', name: 'Prime Sum', desc: 'Card values add up to a prime number (A = 1, J = 11, Q = 12, K = 13)', t: function (h) { return isPrime(h.sum); } },
    { id: 'squaresum', g: 'zahlen', name: 'Square Sum', desc: 'Card values add up to 16, 25, 36, 49 or 64', t: function (h) { return [16, 25, 36, 49, 64].indexOf(h.sum) >= 0; } },
    { id: 'bakers', g: 'zahlen', name: 'Baker’s Dozen', desc: 'Card values add up to exactly 13 (A = 1)', t: function (h) { return h.sum === 13; } },
    { id: 'answer', g: 'zahlen', name: 'The Answer', desc: 'Card values add up to exactly 42 (J = 11, Q = 12, K = 13)', t: function (h) { return h.sum === 42; } },
    { id: 'halfcentury', g: 'zahlen', name: 'Half Century', desc: 'Card values add up to exactly 50 (J = 11, Q = 12, K = 13)', t: function (h) { return h.sum === 50; } },
    { id: 'queenbee', g: 'bilder', name: 'Queen Bee', desc: 'Three queens', t: function (h) { return h.rc[12] >= 3; } },
    { id: 'jacksbetter', g: 'bilder', name: 'Jacks or Better', desc: 'A pair of jacks or higher', t: function (h) { for (var r = 11; r <= 14; r++) if (h.rc[r] >= 2) return true; return false; } },
    { id: 'fibonacci', g: 'zahlen', name: 'Fibonacci', desc: 'Only A, 2, 3, 5, 8 and K (1, 2, 3, 5, 8, 13)', t: function (h) { return only(h, [1, 2, 3, 5, 8, 13]); } },
    { id: 'squares', g: 'zahlen', name: 'Perfect Squares', desc: 'Only A, 4 and 9 (1, 4, 9)', t: function (h) { return only(h, [1, 4, 9]); } },
    { id: 'threes', g: 'zahlen', name: 'Triple Threat', desc: 'Only 3, 6, 9 and Q (multiples of three)', t: function (h) { return only(h, [3, 6, 9, 12]); } },

    { id: 'overachiever', g: 'besonders', meta: true, name: 'Overachiever', desc: 'At least 13 other achievements in one hand', t: function (h, n) { return n >= 13; } },
    { id: 'bare', g: 'besonders', meta: true, name: 'Bare Minimum', desc: 'Only two other achievements, a truly plain hand', t: function (h, n) { return n <= 2; } }
  ];

  var TIERS = [
    { id: 'legendaer', name: 'Legendary', max: 1e-4, pts: 5000 },
    { id: 'episch', name: 'Epic', max: 1e-3, pts: 1000 },
    { id: 'selten', name: 'Rare', max: 1e-2, pts: 250 },
    { id: 'ungewoehnlich', name: 'Uncommon', max: 1e-1, pts: 50 },
    { id: 'gewoehnlich', name: 'Common', max: 2, pts: 10 }
  ];
  function tierOf(p) { for (var i = 0; i < TIERS.length; i++) if (p < TIERS[i].max) return TIERS[i]; }
  // Punkte genau aus der Seltenheit: 500 × √(1/p), auf ganze Zahlen (Davids Wunsch: mal 100, zwei Stellen genauer)
  // High Card -> 706, Two Pair -> 2 293, Four of a Kind -> 32 268, Royal Flush -> 403 032
  function ptsOf(p) { return Math.max(1, Math.round(500 * Math.sqrt(1 / p))); }

  // Gibt Indizes der erreichten Erfolge zurück; Meta-Erfolge zählen die übrigen
  function hits(ids, dayCard) {
    var h = analyse(ids, dayCard), ph = pokerHand(h), out = [], metas = [];
    h.ph = ph;
    for (var i = 0; i < LIST.length; i++) {
      var a = LIST[i];
      if (a.meta) { metas.push(i); continue; }
      if (a.g === 'poker' ? a.id === ph : a.t(h)) out.push(i);
    }
    var n = out.length;
    metas.forEach(function (i) { if (LIST[i].t(h, n)) out.push(i); });
    return out;
  }

  return { LIST: LIST, TIERS: TIERS, tierOf: tierOf, ptsOf: ptsOf, hits: hits, rankOf: rankOf, suitOf: suitOf,
    rankLabel: rankLabel, cardId: cardId };
})();
if (typeof module !== 'undefined') module.exports = TH;
