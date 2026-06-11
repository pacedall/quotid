const express = require('express');
const db = require('../db');
const { requireUser } = require('../auth');
const { dailyRounds, computeStreaks, ROUNDS } = require('../daily');

const router = express.Router();
const GAME = 'era';

// UTC date string the server treats as "today".
function todayStr() { return new Date().toISOString().slice(0, 10); }

async function activeEvents() {
  const { rows } = await db.query('select id, text, year from events where active = true order by id');
  return rows;
}

async function streakFor(userId) {
  const { rows } = await db.query(
    'select to_char(puzzle_date, \'YYYY-MM-DD\') as d from plays where user_id = $1 and game = $2 order by puzzle_date desc',
    [userId, GAME]
  );
  const dates = rows.map(r => r.d);
  const { current, best } = computeStreaks(dates, todayStr());
  return { current, best, playedToday: dates.includes(todayStr()) };
}

// Today's puzzle — same five events for everyone, deterministic by date.
router.get('/today', async (req, res) => {
  try {
    const events = await activeEvents();
    const date = todayStr();
    const rounds = dailyRounds(events, date).map(e => ({ id: e.id, text: e.text, year: e.year }));
    let progress = null;
    if (req.user) progress = await streakFor(req.user.uid);
    res.json({ date, rounds, minYear: 1965, maxYear: 2025, progress });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Record a finished daily run. One counted result per day; we keep the best score.
router.post('/result', requireUser, async (req, res) => {
  const score = Math.max(0, Math.min(500, parseInt(req.body?.score, 10) || 0));
  const date = todayStr();
  try {
    await db.query(
      `insert into plays (user_id, game, puzzle_date, score)
       values ($1, $2, $3, $4)
       on conflict (user_id, game, puzzle_date)
       do update set score = greatest(plays.score, excluded.score)`,
      [req.user.uid, GAME, date, score]
    );
    res.json({ ok: true, progress: await streakFor(req.user.uid) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});

router.get('/me', requireUser, async (req, res) => {
  res.json({ progress: await streakFor(req.user.uid) });
});

module.exports = router;
