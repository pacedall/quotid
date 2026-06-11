-- Quotid · Era schema
-- Safe to run repeatedly (idempotent).

create extension if not exists "pgcrypto";

-- Accounts (optional — anonymous play works without one)
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  created_at    timestamptz not null default now(),
  reminders     boolean not null default true,
  email_verified boolean not null default false
);

-- For older databases that predate the column:
alter table users add column if not exists email_verified boolean not null default false;

-- One-time tokens for email verification and password reset.
create table if not exists tokens (
  token       text primary key,
  user_id     uuid not null references users(id) on delete cascade,
  kind        text not null,                 -- 'verify' | 'reset'
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists tokens_user_kind_idx on tokens (user_id, kind);

-- The content pool. Daily puzzles are selected deterministically from active rows.
create table if not exists events (
  id     serial primary key,
  text   text not null,
  year   int  not null,
  active boolean not null default true
);

-- One counted result per user per day per game. This is the single source of truth for streaks.
create table if not exists plays (
  id          bigserial primary key,
  user_id     uuid not null references users(id) on delete cascade,
  game        text not null default 'era',
  puzzle_date date not null,
  score       int  not null,
  created_at  timestamptz not null default now(),
  unique (user_id, game, puzzle_date)
);

create index if not exists plays_user_game_date_idx on plays (user_id, game, puzzle_date desc);
