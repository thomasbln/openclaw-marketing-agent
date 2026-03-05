/**
 * Signal Radar Scanner – Entry
 * Sources: HN, Google News, X.com. Use SCANNER_SOURCES to filter (e.g. "hackernews,google-news" = no X).
 */

import "dotenv/config";
import pg from "pg";

import { getSourceStats } from "./lib/db.js";
import { runHackerNews } from "./sources/hackernews.js";
import { runGoogleNews } from "./sources/google-news.js";
import { runX } from "./sources/x.js";

const SOURCES = [
  { name: "hackernews", run: runHackerNews },
  { name: "google-news", run: runGoogleNews },
  { name: "x", run: runX },
];

/**
 * SCANNER_SOURCES – optional comma-separated filter (e.g. "hackernews,google-news")
 * When set: only these sources. Otherwise: all.
 */
function getSourcesToRun() {
  const filter = process.env.SCANNER_SOURCES;
  if (!filter || !filter.trim()) return SOURCES;
  const names = filter.split(",").map((s) => s.trim().toLowerCase());
  return SOURCES.filter((s) => names.includes(s.name));
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("Missing DATABASE_URL in .env");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: dbUrl });

  try {
    const toRun = getSourcesToRun();
    console.log(`Running sources: ${toRun.map((s) => s.name).join(", ")}`);
    for (const { name, run } of toRun) {
      await run(pool);
    }

    const stats = await getSourceStats(pool);
    console.log("\n--- Source Stats (cumulative) ---");
    if (stats.length === 0) {
      console.log("  (no signals yet)");
    } else {
      const total = stats.reduce((s, r) => s + r.total, 0);
      for (const { source, total: n } of stats) {
        const pct = total > 0 ? ((n / total) * 100).toFixed(1) : "0";
        console.log(`  ${source.padEnd(18)} ${String(n).padStart(5)} (${pct}%)`);
      }
      console.log(`  ${"TOTAL".padEnd(18)} ${String(total).padStart(5)}`);
    }
    console.log("Scanner done.");
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
