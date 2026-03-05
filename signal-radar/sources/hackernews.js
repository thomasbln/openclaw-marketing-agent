/**
 * Hacker News Scanner – Raw data via Algolia API
 * Keywords from signal-radar/keywords/hackernews.json; fallback for quality discussions.
 * search_by_date + points>20 + num_comments>10
 */

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { insertRun, insertRawSignals } from "../lib/db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const HN_QUERIES_DEFAULT = [
  "why I cancelled subscription",
  "customer churn",
  "conversion rate",
  "cart abandonment",
  "customer complaint",
  "would not recommend",
  "returned product",
  "unsubscribed because",
  "customer retention",
  "what made me buy",
];

function loadHNQueries() {
  try {
    const path = join(__dirname, "../keywords/hackernews.json");
    const data = JSON.parse(readFileSync(path, "utf8"));
    if (Array.isArray(data.queries) && data.queries.length > 0) {
      return data.queries;
    }
  } catch (_) {
    console.warn("[hn] keywords/hackernews.json not found or invalid, using defaults");
  }
  return HN_QUERIES_DEFAULT;
}

const MIN_POINTS = 20;
const MIN_COMMENTS = 10;

const MAX_POSTS = 100;

async function fetchHNPosts(query) {
  const filters = `points>${MIN_POINTS},num_comments>${MIN_COMMENTS}`;
  const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=20&numericFilters=${encodeURIComponent(filters)}`;
  const res = await fetch(url);
  const data = await res.json();

  return (data.hits ?? []).map((hit) => ({
    title: hit.title ?? "",
    text: (hit.story_text ?? "").slice(0, 1500),
    url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
    subreddit: null,
  }));
}

export async function runHackerNews(pg) {
  const HN_QUERIES = loadHNQueries();
  console.log("[hn] Fetching…");

  let allPosts = [];
  for (const q of HN_QUERIES) {
    const posts = await fetchHNPosts(q);
    allPosts.push(...posts);
  }

  const seen = new Set();
  const unique = allPosts.filter((p) => {
    if (seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  });

  const toInsert = unique.slice(0, MAX_POSTS);
  if (toInsert.length === 0) {
    console.log("[hn] No posts.");
    return;
  }

  const runId = await insertRun(pg, "hackernews");
  const count = await insertRawSignals(pg, runId, "hackernews", toInsert);
  console.log(`[hn] Run ${runId}: ${count} signals saved`);
}
