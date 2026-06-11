// Deterministic daily puzzle engine + streak maths.
// Pure functions: given the same date and event pool, every player gets the same set.

const ROUNDS = 5;          // events per daily puzzle
const EPOCH = Date.UTC(2025, 0, 1); // day-index origin

// Small seeded PRNG (mulberry32) so selection is stable and reproducible.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(arr, seed) {
  const r = mulberry32(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dayIndex(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z').getTime();
  return Math.floor((d - EPOCH) / 86400000);
}

// Pick today's rounds. No event repeats within a full pass of the pool
// (pool.length / ROUNDS days); the order reshuffles each pass.
function dailyRounds(events, dateStr, rounds = ROUNDS) {
  if (!events.length) return [];
  const perCycle = Math.max(1, Math.floor(events.length / rounds));
  const di = dayIndex(dateStr);
  const cycle = Math.floor(di / perCycle);
  const within = ((di % perCycle) + perCycle) % perCycle;
  const order = seededShuffle(events, 9973 + cycle);
  const start = within * rounds;
  return order.slice(start, start + rounds);
}

// Current + best streak from a descending list of played dates (YYYY-MM-DD strings).
function computeStreaks(playedDatesDesc, todayStr) {
  const set = new Set(playedDatesDesc);
  const dayMs = 86400000;
  const parse = s => new Date(s + 'T00:00:00Z').getTime();
  const fmt = ms => new Date(ms).toISOString().slice(0, 10);

  // current: walk back from today (or yesterday if today not yet played)
  let current = 0;
  let cursor = parse(todayStr);
  if (!set.has(fmt(cursor))) cursor -= dayMs; // allow streak to stand until day ends
  while (set.has(fmt(cursor))) { current++; cursor -= dayMs; }

  // best: longest consecutive run anywhere
  const asc = [...set].sort();
  let best = 0, run = 0, prev = null;
  for (const s of asc) {
    const t = parse(s);
    run = (prev !== null && t - prev === dayMs) ? run + 1 : 1;
    if (run > best) best = run;
    prev = t;
  }
  return { current, best };
}

module.exports = { ROUNDS, dailyRounds, computeStreaks, dayIndex };
