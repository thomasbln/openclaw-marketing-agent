#!/usr/bin/env node
/**
 * Import messaging/*.md → Postgres messaging table
 * Reads key:value files, upserts into the messaging table
 *
 * Usage:
 *   node import-messaging.js              # Upsert (update existing)
 *   node import-messaging.js --replace    # Delete all, then import from files
 *
 * Env: DATABASE_URL (postgresql://...)
 * Messaging dir: MESSAGING_DIR or ./messaging relative to script
 */

import "dotenv/config";
import pg from "pg";
import { readdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const MESSAGING_DIR = process.env.MESSAGING_DIR || join(__dirname, "..", "messaging");
const REPLACE = process.argv.includes("--replace");

function parseMessagingFile(content) {
  const rows = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    rows[key] = value;
  }
  return rows;
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: dbUrl });

  try {
    const files = readdirSync(MESSAGING_DIR).filter((f) => f.endsWith(".md"));
    if (files.length === 0) {
      console.log("No .md files in", MESSAGING_DIR);
      return;
    }

    const pages = [];
    for (const file of files) {
      const path = join(MESSAGING_DIR, file);
      const content = readFileSync(path, "utf8");
      const row = parseMessagingFile(content);
      if (!row.page_id) {
        console.warn("Skip", file, ": no page_id");
        continue;
      }
      pages.push(row);
    }

    if (REPLACE) {
      await pool.query("DELETE FROM messaging");
      console.log("Cleared messaging table (--replace)");
    }

    const insertSql = `
      INSERT INTO messaging (page_id, headline, subheadline, pain_block, cta, version)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (page_id) DO UPDATE SET
        headline = EXCLUDED.headline,
        subheadline = EXCLUDED.subheadline,
        pain_block = EXCLUDED.pain_block,
        cta = EXCLUDED.cta,
        version = EXCLUDED.version,
        updated_at = NOW()
    `;

    for (const p of pages) {
      await pool.query(insertSql, [
        p.page_id || null,
        p.headline || null,
        p.subheadline || null,
        p.pain_block || null,
        p.cta || null,
        p.version || null,
      ]);
      console.log("Upserted:", p.page_id);
    }

    console.log("Done.", pages.length, "pages imported.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
