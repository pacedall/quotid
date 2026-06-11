# Quotid · Era

A daily timeline puzzle. Read the event, slide the marker to the year it happened. One puzzle set per day, the same for everyone, with streaks that carry across devices once you make an account.

This is the first deployable game of the Quotid hub. Stack: **Node/Express + Postgres + JWT + Resend**, built to run on **Railway**.

## How it works

- **Daily engine** (`src/daily.js`) — picks 5 events for the day deterministically from the event pool. Same date → same set for every player. No event repeats within a full pass of the pool.
- **Streaks** (`plays` table) — one counted result per user per day. Current and best streak are computed from play history, server-side.
- **Anonymous-first** — you can play with no account; progress is kept in the browser. Making an account *protects* that streak and unlocks daily reminders. The account prompt only appears after you finish a run.
- **Reminders** (`scripts/send-reminders.js`) — emails account-holders who haven't played today. Run once a day via cron.

## Local setup

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL and JWT_SECRET
npm run init-db               # creates tables, seeds the event pool
npm start                     # http://localhost:3000
```

## Deploy on Railway

1. Push this repo to GitHub (`pacedall/quotid-era` or similar).
2. New Railway project → **Deploy from GitHub repo**.
3. Add the **Postgres** plugin. Railway sets `DATABASE_URL` automatically.
4. Add service variables: `JWT_SECRET` (a long random string), and later `RESEND_API_KEY`, `REMINDER_FROM`, `APP_URL`.
5. After the first deploy, run the DB init once — either locally pointed at the Railway DB, or as a one-off Railway command:
   ```
   npm run init-db
   ```
6. Point `quotidgames.com` at the service. The game serves at `/` and `/era`.

### Daily reminder cron

Add a Railway **cron** schedule (e.g. `0 8 * * *`) running:
```
npm run reminders
```
Requires `RESEND_API_KEY` and a verified `REMINDER_FROM` domain in Resend.

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/era/today` | Today's 5 rounds (+ your progress if logged in) |
| POST | `/api/era/result` | Record a finished run (auth) → returns streak |
| GET | `/api/era/me` | Your current/best streak (auth) |
| POST | `/api/auth/register` | `{email,password}` → JWT, sends verification email |
| POST | `/api/auth/login` | `{email,password}` → JWT (+ verified flag) |
| GET | `/api/auth/verify?token=` | Confirms an email (link target) |
| POST | `/api/auth/resend-verification` | Re-sends the verification email (auth) |
| POST | `/api/auth/forgot` | `{email}` → emails a reset link (always 200) |
| POST | `/api/auth/reset` | `{token,password}` → sets a new password |

**Password policy:** at least 8 characters, including a letter, a number and a symbol — enforced on both register and reset, client and server.

**Email verification:** registration issues the account immediately (so the streak is saved and play continues), marks the email unverified, and sends a verification link. Reminders only go to verified emails. To *require* verification before login instead, reject unverified users in the `/login` handler — it's a one-line change.

**Password reset:** `/reset?token=` serves a page to choose a new password. Reset links expire in 1 hour; verification links in 7 days. In local dev (no `RESEND_API_KEY`), all email links print to the server console so you can test the full flow.

## Honest notes / next steps

- **Verify the content.** Event years in `db/events.json` should be spot-checked before launch — a wrong answer is brand-poison. The pool is ~64 events; grow it past **150** to guarantee no repeats within any 30-day window.
- **Scoring is client-side.** Today the client sends its own score. Fine for a casual daily, but if leaderboards arrive, move year-validation server-side (send rounds without the answer, score on `/result`).
- **Email reminders need a verified Resend domain** before they'll send.
- This game is standalone; folding it under the Quotid hub is just routing once the other games exist.
