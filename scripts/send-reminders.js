// Sends "today's Era is ready" to account holders who haven't played today.
// Intended to run once a day via Railway cron, e.g. at 08:00.
require('dotenv').config();
const db = require('../src/db');

async function main() {
  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set — skipping reminders');
    return;
  }
  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.REMINDER_FROM || 'Quotid <hello@quotidgames.com>';
  const appUrl = process.env.APP_URL || 'https://quotidgames.com';
  const today = new Date().toISOString().slice(0, 10);

  const { rows } = await db.query(
    `select u.email
       from users u
      where u.reminders = true
        and not exists (
          select 1 from plays p
           where p.user_id = u.id and p.game = 'era' and p.puzzle_date = $1
        )`,
    [today]
  );

  console.log(`Reminding ${rows.length} player(s)`);
  for (const { email } of rows) {
    try {
      await resend.emails.send({
        from,
        to: email,
        subject: "Today's Era puzzle is ready",
        html: `<p>A fresh set of moments is waiting.</p>
               <p><a href="${appUrl}/era">Play today's Era →</a></p>
               <p style="color:#888;font-size:12px">Keep your streak alive.</p>`,
      });
    } catch (e) {
      console.error('send failed for', email, e.message);
    }
  }

  await db.pool.end();
  console.log('done');
}

main().catch(e => { console.error(e); process.exit(1); });
