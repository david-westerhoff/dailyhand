// Badges: Ziele über die Zeit, unabhängig vom Glück einer einzelnen Hand (Davids Wunsch, 27.11.2026).
// Jedes Badge hat drei Stufen (Bronze, Silber, Gold); jede Stufe ist erreicht, wenn stats[stat] >= goal.
// Die Werte in stats rechnet der Server aus den gespeicherten Händen (worker/index.js, statsOf).
var BADGES = (function () {
  var LIST = [
    { id: 'regular', name: 'Regular', desc: 'Days played', icon: 'D',
      steps: [{ stat: 'days', goal: 7 }, { stat: 'days', goal: 30 }, { stat: 'days', goal: 100 }] },
    { id: 'streak', name: 'Streak', desc: 'Days in a row, your best run', icon: '≫',
      steps: [{ stat: 'bestStreak', goal: 7 }, { stat: 'bestStreak', goal: 30 }, { stat: 'bestStreak', goal: 100 }] },
    { id: 'collector', name: 'Collector', desc: 'Different achievements unlocked', icon: '#',
      steps: [{ stat: 'distinct', goal: 25 }, { stat: 'distinct', goal: 50 }, { stat: 'distinct', goal: 70 }] },
    { id: 'highroller', name: 'High Roller', desc: 'Points from all your hands', icon: 'Σ',
      steps: [{ stat: 'points', goal: 100000 }, { stat: 'points', goal: 1000000 }, { stat: 'points', goal: 3000000 }] },
    { id: 'tiers', name: 'Climber', desc: 'Rarity milestones', icon: '▲',
      steps: [{ stat: 'commons', goal: 20, label: 'All Common' }, { stat: 'epics', goal: 1, label: 'First Epic' },
        { stat: 'uncommons', goal: 38, label: 'All Uncommon' }] },
    { id: 'lucky', name: 'Lucky Day', desc: 'One hand better than this share of all hands', icon: '%',
      steps: [{ stat: 'bestPct', goal: 0.9, label: '90%' }, { stat: 'bestPct', goal: 0.99, label: '99%' },
        { stat: 'bestPct', goal: 0.999, label: '99.9%' }] },
    { id: 'hattrick', name: 'Hat Trick', desc: 'The same achievement again and again', icon: '×',
      steps: [{ stat: 'maxRepeat', goal: 10, label: '10×' }, { stat: 'maxRepeat', goal: 25, label: '25×' },
        { stat: 'maxRepeat', goal: 50, label: '50×' }] }
  ];
  var LEVELS = ['Bronze', 'Silver', 'Gold'];
  // Liste der erreichten Stufen als "id:index", z. B. "streak:0"
  function earned(stats) {
    var out = [];
    if (!stats) return out;
    LIST.forEach(function (b) { b.steps.forEach(function (s, i) { if ((stats[s.stat] || 0) >= s.goal) out.push(b.id + ':' + i); }); });
    return out;
  }
  return { LIST: LIST, LEVELS: LEVELS, earned: earned };
})();
if (typeof module !== 'undefined') module.exports = BADGES;
