---
name: market-radar
description: Signal output format + Commands /brief, /trend, /hooks, /problem, /wording 7d. Daily Alignment Check (cron 07:00 UTC).
---

# Market Radar – Output & Commands

## Signal Format

When returning signals (get_signals), format each:

```
🟥 Relevance X/10 | Pain Y/10
Title: [Original]
Insight: [1 sentence – core, market/problem relevance]
Emotion: [e.g. fear, frustration, worry]
Link: [URL]
```

- **Relevance 1–10:** Market/problem relevance (e.g. churn, conversion, access, conflict)
- **Pain 1–10:** Emotional pressure, urgency
- **Insight:** Derive from title+snippet. No fabrication.

---

## Example scenario (Shipping / E-Commerce)

**Context:** Product messaging = "Fast delivery for everyone. No hidden fees, clear pricing at checkout." Core problem = high shipping costs killing conversion.

**Sample signals to classify:**

- "Shoppers abandon cart when shipping cost appears at checkout"
- "Free shipping threshold frustrates small orders"
- "Unexpected delivery prices – survey says #1 complaint"

**Expected style:** Rate Relevance and Pain from real wording; Insight = one sentence on market/problem; Emotion = e.g. frustration, surprise. For /wording 7d or /problem shipping: contrast "Radar (market)" phrases (e.g. "shipping at checkout", "hidden delivery cost") with "Yours" (headline + pain_block) and recommend moving copy closer to how people actually complain.

---

## Daily Alignment Check (07:00 UTC)

For "Alignment Check", "Daily Check":

1. Call `get_signals` with `since_days: 1`, `limit: 50`
2. Output:

```
Daily Alignment Check — 07:00 UTC

**Conflict Detected**
[Main conflict from signals]

**Theme A**
[Cluster from signals]

**Theme B**
[Cluster from signals]

**Emotional Signal**
[Frustration / Uncertainty / Fear]

**Alignment Status**
Review messaging | Drift: ±X% WoW
```

---

## Commands

### /brief 7d

`get_signals(since_days: 7, limit: 80)` → Dominant themes, market focus, narrative recommendation.

### /trend

`get_trend(days_a, days_b)` → Compares signal frequency across time windows (e.g. last 7 days vs last 30 days per source). Returns period_a, period_b, delta, delta_pct.

### /hooks

`get_signals(limit: 80)` → 5 emotional LinkedIn post hooks.

### /problem <keyword>

`get_signals(keyword: X)` → Main problem, patterns, market relevance.

### /wording 7d

**Required:** Call both `get_signals` (since_days: 7, limit: 80) and `get_messaging`.

1. Analyze signals: frequent formulations, emotional words, context clusters
2. Analyze messaging texts (headline, pain_block, cta per page_id from get_messaging)
3. Output:

```
📊 Language Patterns (last 7 days)
[X] signals analyzed

1️⃣ Frequent problem formulations
[From signals]

2️⃣ Dominant emotional words
[From signals]

3️⃣ Context clusters
[From signals]

4️⃣ Language contrast (required!)
Radar (market): [frequent phrases from signals]
Yours (from get_messaging): [headline + pain_block per page_id]
→ Tip: Be more concrete, closer to problem language

5️⃣ Assessment
Gap between Radar and Yours: [1–2 sentences – concrete recommendation]
```

**Important:** Without get_messaging, Block 4+5 are incomplete. If get_messaging is empty: "No messaging texts – run trigger-import-messaging.sh".

---

## Phrases

- "Source Stats" → get_source_stats
- "Latest signals" → get_signals
- "/trend", "Trend", "Trend 7 days" → get_trend
- "Alignment Check" → Daily Alignment Check
- "Brief 7d", "/brief 7d" → /brief 7d
- "Hooks" → /hooks
- "Problem X", "/problem X" → /problem X
- "wording 7d", "Language patterns 7 days", "What do people say" → /wording 7d (get_signals + get_messaging)
- "X.com entries", "Twitter signals" → get_signals with source: "x" (EN only)
- "Start scanner", "Start now", "Scan now", "Run scanner", "run_scanner" → run_scanner
