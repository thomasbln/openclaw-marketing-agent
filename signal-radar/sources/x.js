/**
 * X (Twitter) Scanner – X API v2 Recent Search
 * Bearer Token (App-Only Auth). EN only via keywords/x.json
 */

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { insertRun, insertRawSignals } from "../lib/db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const X_SOURCES_DEFAULT = [
  {
    name: "x",
    lang: "en",
    keywords: [
      "cancelled subscription",
      "switched provider",
      "churn",
      "cart abandonment",
      "disappointed with",
      "would not recommend",
      "best purchase",
      "returned because",
      "unsubscribed",
    ],
  },
];

function loadXSources() {
  try {
    const path = join(__dirname, "../keywords/x.json");
    const data = JSON.parse(readFileSync(path, "utf8"));
    if (Array.isArray(data.sources) && data.sources.length > 0) {
      return data.sources;
    }
  } catch (_) {
    console.warn("[x] keywords/x.json not found or invalid, using defaults");
  }
  return X_SOURCES_DEFAULT;
}

const API_BASE = "https://api.twitter.com";
const MAX_RESULTS_PER_QUERY = 50;
const MAX_TWEETS_PER_SOURCE = 75;

async function fetchXTweets(query, lang) {
  const bearerToken = process.env.X_BEARER_TOKEN;
  if (!bearerToken) {
    throw new Error("X_BEARER_TOKEN not set in .env");
  }

  const xQuery = lang ? `${query} lang:${lang}` : query;
  const params = new URLSearchParams({
    query: xQuery,
    max_results: String(Math.min(MAX_RESULTS_PER_QUERY, 100)),
    "tweet.fields": "created_at",
  });

  const url = `${API_BASE}/2/tweets/search/recent?${params}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`X API ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const tweets = data.data ?? [];

  return tweets.map((t) => ({
    title: (t.text ?? "").slice(0, 100),
    text: (t.text ?? "").slice(0, 1500),
    url: `https://x.com/i/status/${t.id}`,
    subreddit: null,
  }));
}

export async function runX(pg) {
  const bearerToken = process.env.X_BEARER_TOKEN;
  if (!bearerToken) {
    console.warn("[x] X_BEARER_TOKEN not set, skipping");
    return;
  }

  const X_SOURCES = loadXSources();
  let allTweets = [];

  for (const { name, lang, keywords } of X_SOURCES) {
    console.log(`[${name}] Fetching…`);

    for (const q of keywords) {
      try {
        const tweets = await fetchXTweets(q, lang);
        allTweets.push(...tweets.map((p) => ({ ...p, source: name })));
      } catch (err) {
        console.error(`[${name}] Error for "${q}":`, err.message);
      }
    }
  }

  const seen = new Set();
  const unique = allTweets.filter((p) => {
    if (!p.url || seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  });

  const toInsert = [];
  for (const { name } of X_SOURCES) {
    const sourcePosts = unique.filter((p) => p.source === name);
    toInsert.push(...sourcePosts.slice(0, MAX_TWEETS_PER_SOURCE));
  }

  if (toInsert.length === 0) {
    console.log("[x] No tweets found.");
    return;
  }

  const runId = await insertRun(pg, "x");
  for (const { name } of X_SOURCES) {
    const sourcePosts = toInsert.filter((p) => p.source === name);
    if (sourcePosts.length > 0) {
      const count = await insertRawSignals(pg, runId, name, sourcePosts);
      console.log(`[${name}] Run ${runId}: ${count} signals stored`);
    }
  }
}
