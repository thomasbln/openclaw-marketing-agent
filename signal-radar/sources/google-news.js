/**
 * Google News Scanner – RSS search, EN only.
 * Keywords: signal-radar/keywords/google-news.json
 */

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import Parser from "rss-parser";
import { insertRun, insertRawSignals } from "../lib/db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const GOOGLE_NEWS_SOURCES_DEFAULT = [
  {
    name: "google_news_en",
    params: "hl=en-US&gl=US&ceid=US:en",
    keywords: [
      "customer AND churn",
      "subscription AND cancel",
      "conversion AND rate",
      "cart AND abandonment",
      "customer AND complaint",
      "would not recommend",
      "return AND product AND reason",
      "customer AND retention",
      "unsubscribe AND reason",
    ],
  },
];

function loadGoogleNewsSources() {
  try {
    const path = join(__dirname, "../keywords/google-news.json");
    const data = JSON.parse(readFileSync(path, "utf8"));
    if (Array.isArray(data.sources) && data.sources.length > 0) {
      return data.sources;
    }
  } catch (_) {
    console.warn("[google_news_en] keywords/google-news.json not found or invalid, using defaults");
  }
  return GOOGLE_NEWS_SOURCES_DEFAULT;
}

const parser = new Parser();

const MAX_POSTS = 75;

async function fetchGoogleNews(query, params) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${params}`;
  const feed = await parser.parseURL(url);

  return (feed.items ?? []).map((item) => ({
    title: item.title ?? "",
    text: (item.contentSnippet ?? item.content ?? "").slice(0, 1500),
    url: item.link ?? "",
    subreddit: null,
  }));
}

export async function runGoogleNews(pg) {
  const sources = loadGoogleNewsSources();
  let allPosts = [];

  for (const { name, params, keywords } of sources) {
    console.log(`[${name}] Fetching…`);

    for (const q of keywords) {
      try {
        const posts = await fetchGoogleNews(q, params);
        allPosts.push(...posts.map((p) => ({ ...p, source: name })));
      } catch (err) {
        console.error(`[${name}] Error for "${q}":`, err.message);
      }
    }
  }

  const seen = new Set();
  const unique = allPosts.filter((p) => {
    if (!p.url || seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  });

  const toInsert = unique.slice(0, MAX_POSTS);
  if (toInsert.length === 0) {
    console.log("[google_news_en] No posts.");
    return;
  }

  const runId = await insertRun(pg, "google_news");
  const count = await insertRawSignals(pg, runId, sources[0].name, toInsert);
  console.log(`[${sources[0].name}] Run ${runId}: ${count} signals saved`);
}
