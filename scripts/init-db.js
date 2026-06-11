// Creates tables and loads the event pool. Safe to run repeatedly.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../src/db');

async function main() {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await db.query(schema);
  console.log('✓ schema applied');

  const events = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'db', 'events.json'), 'utf8'));

  // Only seed if the pool is empty, so re-runs don't duplicate.
  const { rows } = await db.query('select count(*)::int as n from events');
  if (rows[0].n > 0) {
    console.log(`• events table already has ${rows[0].n} rows — skipping seed`);
  } else {
    for (const e of events) {
      await db.query('insert into events (text, year) values ($1, $2)', [e.text, e.year]);
    }
    console.log(`✓ seeded ${events.length} events`);
  }

  await db.pool.end();
  console.log('done');
}

main().catch(e => { console.error(e); process.exit(1); });
