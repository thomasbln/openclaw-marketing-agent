# Market Signal Radar — AI Agent for Problem-Market Drift Detection

This **OpenClaw** AI Agent blueprint brings **Problem–Market Observability** to life: it scans Hacker News, Google News, and X.com for market signals, analyzes them via LLM, and delivers daily alignment digests to Telegram.

**📖 Read the article:** [**Detecting Problem–Market Drift Before Your Metrics Break**](https://medium.com/@thomasrehmer/stop-guessing-detect-problem-market-drift-with-an-openclaw-agent-2a41679b556d)

---

### What it does

* **Signal Radar:** Multi-source scanning (Hacker News, Google News, X.com) for friction signals (churn, conversion, complaints).
* **OpenClaw Agent:** Intelligent classification using LLMs (Claude/GPT) against your product's core messaging.
* **Strategic Insights:** Automated Problem–Market Alignment reports (daily digest, trend comparison, language gaps).
* **Telegram Interface:** Command-driven access to `/trend`, `/brief`, `/problem`, and `/wording 7d`.

### Quick Start

1. **Clone the repo.**
2. **Setup Environment:** Copy the `.env.example` files in the subfolders and add your API keys.
3. **No Secrets:** This repo contains no secrets or pre-configured keys.
4. **Deploy:** Use the provided `docker-compose` files to spin up the Postgres DB and the Agent. See detailed steps below.

---

### Fork & Adapt

This is a **demo and blueprint agent**. It is functional out of the box but designed to be extended. **Feel free to fork, adapt, and improve it for your own specific use case.** If you build something cool on top of this or find a better way to detect drift, pull requests and feedback are always welcome.

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  signal-radar   │────▶│  Postgres        │◀────│  OpenClaw   │
│  (HN, GNews, X) │     │  radar           │     │  + Plugin   │
└─────────────────┘     └──────────────────┘     └──────┬──────┘
        ▲                           ▲                    │
        │ Cron                      │ SQL                │ Telegram
        │                           │                    ▼
┌───────┴───────────┐     ┌─────────┴────────┐   ┌──────────────┐
│ trigger-radar-    │     │ market-radar     │   │  You (DM)    │
│ digest.sh         │     │ plugin (tools)   │   │  or Channel  │
└───────────────────┘     └──────────────────┘   └──────────────┘
```

**Stack:** Node.js, PostgreSQL (pgvector), Docker, OpenClaw.  
**Sources:** Hacker News, Google News RSS, X.com.

---

## How the bot works

1. **You send a message** to the Telegram bot (e.g. "Latest signals", "Brief 7d", "Start now").
2. **OpenClaw** receives it and routes to the market-radar skill.
3. **The skill** maps your phrase to a tool:
   - `get_signals` – Fetch signals from the DB (filter by days, keyword, source)
   - `get_source_stats` – Counts per source
   - `get_trend` – Compare two time periods
   - `run_scanner` – Trigger a new scan (requires elevated permission)
4. **The plugin** runs the tool (SQL or Docker) and returns data.
5. **The LLM** (Claude/GPT) formats the response and sends it back to you.

**Example flow:** "Start now" → `run_scanner` → plugin starts `signal-radar` container → "Scanner started. Results in a few minutes."

---

## Components

| Folder | Role |
|--------|------|
| **signal-radar/** | Scanner (HN, Google News) → Postgres |
| **openclaw/** | AI agent (Telegram), skills, digest webhook |
| **postgres/** | Postgres + pgvector, `radar` DB |

---

## Prerequisites

- Docker & Docker Compose
- Anthropic API key (Claude) – OpenAI key optional for rate-limit fallback
- Telegram Bot Token ([@BotFather](https://t.me/BotFather))
- ~10 min setup

---

## Quick Start

### 1. Network & Postgres

```bash
docker network create radar-net
cd postgres && docker-compose up -d
```

Connect to Postgres and init the DB:

```sql
CREATE DATABASE radar;
CREATE USER radar_user WITH PASSWORD 'your_secure_password';
GRANT ALL ON DATABASE radar TO radar_user;
\c radar
CREATE TABLE runs (id SERIAL PRIMARY KEY, source TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE signals (id SERIAL PRIMARY KEY, run_id INT REFERENCES runs(id), source TEXT, title TEXT, content TEXT, url TEXT UNIQUE, subreddit TEXT);
CREATE TABLE messaging (page_id TEXT PRIMARY KEY, headline TEXT, subheadline TEXT, pain_block TEXT, cta TEXT, version TEXT, updated_at TIMESTAMPTZ DEFAULT NOW());
GRANT ALL ON runs, signals, messaging TO radar_user;
GRANT USAGE, SELECT ON SEQUENCE runs_id_seq, signals_id_seq TO radar_user;
```

### 2. Signal Radar

```bash
cd signal-radar
cp .env.example .env
# Edit .env: DATABASE_URL=postgresql://radar_user:your_secure_password@pgvector-db:5432/radar
docker-compose build
docker-compose run --rm signal-radar   # Test run
```

### 3. OpenClaw

```bash
cd openclaw
cp .env.example .env
# Edit .env – see "Env variables" below
mkdir -p config
cp ../openclaw.example.json config/openclaw.json
# config uses ${VAR} – values come from .env
cd plugins/market-radar && npm install && cd ../..
docker-compose up -d
```

### 3b. Messaging import (for /wording 7d)

```bash
cd openclaw
./scripts/trigger-import-messaging.sh   # Import messaging/homepage.md → DB
```

### 4. Auth profiles (API keys)

OpenClaw needs API keys in `auth-profiles.json`. Either run `openclaw onboard` interactively, or add them via env: `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` in `.env` are picked up if auth profiles reference them.

### 5. Cron (optional – daily digest)

```bash
crontab -e
# Add: 0 8 * * * cd /path/to/openclaw && ./scripts/trigger-radar-digest.sh
```

---

## Env variables

Set these in `openclaw/.env` (no secrets in the repo):

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude (primary model) |
| `OPENAI_API_KEY` | Fallback on rate limit |
| `DATABASE_URL` | Postgres for plugin (same as signal-radar) |
| `TELEGRAM_BOT_TOKEN` | From [@BotFather](https://t.me/BotFather) |
| `OPENCLAW_HOOKS_TOKEN` | Digest webhook auth – generate a random string |
| `OPENCLAW_GATEWAY_TOKEN` | Gateway auth – generate a random string |
| `TELEGRAM_CHAT_ID` | Where to send digest (group/channel ID) |
| `TELEGRAM_USER_ID` | Your Telegram user ID (for "Start now") – get via [@userinfobot](https://t.me/userinfobot) |
| `X_BEARER_TOKEN` | X (Twitter) API Bearer Token – for X.com signals (optional, set in signal-radar/.env) |
| `SCANNER_SOURCES` | Limit sources, e.g. `hackernews,google-news` = no X.com (optional, saves API costs) |

`openclaw.example.json` uses `${TELEGRAM_BOT_TOKEN}`, `${OPENCLAW_HOOKS_TOKEN}`, `${OPENCLAW_GATEWAY_TOKEN}`, `${TELEGRAM_USER_ID}` – all resolved from `.env`.

---

## Bot commands & phrases

| You say | Tool | Result |
|---------|------|--------|
| "Latest signals", "What's new" | get_signals | Recent signals from DB |
| "Source stats" | get_source_stats | Counts per source |
| "Trend 7 days" | get_trend | Compare periods |
| "Brief 7d", "Weekly brief" | get_signals + LLM | Thematic brief, narrative recommendation |
| "Hooks", "LinkedIn hooks" | get_signals + LLM | 5 emotional post hooks |
| "Problem X", "Problem churn" | get_signals + LLM | Problem spotlight |
| "Wording 7d", "Language patterns" | get_signals + **get_messaging** + LLM | Market signals vs. your messaging (Block 4 contrast) |
| "X.com entries", "Twitter signals" | get_signals (source: x) | X.com/Twitter signals (EN only) |
| "Start now", "Scan now" | run_scanner | Trigger new scan |

**Note:** `/wording 7d` requires `get_messaging` – add your landing-page texts in `openclaw/messaging/*.md`, run import, and ensure `get_messaging` is in `tools.allow`.

---

## run_scanner ("Start now")

To let the bot trigger scans via Telegram:

1. **Docker socket** – `docker-compose` already mounts `/var/run/docker.sock` and `group_add: "docker"`. If you get "Unable to find group docker", use your socket's GID: `group_add: ["1001"]` (see `ls -la /var/run/docker.sock`).
2. **Config** – `openclaw.example.json` already has `run_scanner` in `tools.allow` and `tools.elevated.allowFrom.telegram` → `${TELEGRAM_USER_ID}`. Set `TELEGRAM_USER_ID` in `.env`.
3. **Image** – Ensure signal-radar is built: `cd signal-radar && docker-compose build`.

---

## File layout

```
.
├── openclaw.example.json   # Config template (uses ${VAR} from .env)
├── openclaw/
│   ├── config/             # openclaw.json lives here (not committed)
│   ├── messaging/          # Landing-page texts for /wording 7d (homepage.md etc.)
│   ├── plugins/market-radar/
│   ├── scripts/            # trigger-radar-digest.sh, import-messaging.js, trigger-import-messaging.sh
│   └── workspace/skills/market-radar/
├── signal-radar/
│   ├── sources/            # hackernews, google-news, x (X.com/Twitter)
│   └── keywords/           # EN only: hackernews.json, google-news.json, x.json
└── postgres/
```

**Never commit:** `.env`, `openclaw/config/openclaw.json`, `openclaw/config/agents/`. Use `.env.example` and `openclaw.example.json` as templates.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "DATABASE_URL not set" | Add to `openclaw/.env`, same as signal-radar |
| "elevated is not available" | Add `TELEGRAM_USER_ID` to `.env`, ensure `tools.elevated.enabled: true` |
| "EACCES /var/run/docker.sock" | Use `group_add: ["1001"]` (or your docker GID) in docker-compose |
| "Image signal-radar_signal-radar not found" | `cd signal-radar && docker-compose build` |
| Digest not arriving | Check `OPENCLAW_HOOKS_TOKEN` matches `hooks.token`, `TELEGRAM_CHAT_ID` correct |

---

## License

MIT

---

crafted by [thomas](https://medium.com/@thomasbln) @ [awareo.io](https://awareo.io)
