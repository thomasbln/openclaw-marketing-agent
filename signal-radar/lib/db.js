/**
 * Shared DB helpers for Signal Radar sources.
 * Requires unique_signal_url constraint on signals.url (see migrations/).
 */

export async function insertRun(pg, source) {
  const res = await pg.query(
    "INSERT INTO runs (source) VALUES ($1) RETURNING id",
    [source]
  );
  return res.rows[0].id;
}

/**
 * Inserts signals, skipping duplicates by url (ON CONFLICT DO NOTHING).
 * Returns count of actually inserted rows.
 */
export async function insertRawSignals(pg, runId, source, posts) {
  let count = 0;
  for (const post of posts) {
    const res = await pg.query(
      `INSERT INTO signals (run_id, source, title, content, url, subreddit)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (url) DO NOTHING
       RETURNING id`,
      [runId, source, post.title, post.text, post.url ?? "", post.subreddit]
    );
    if (res.rowCount > 0) count++;
  }
  return count;
}

/**
 * Returns signal counts per source (cumulative in DB).
 */
export async function getSourceStats(pg) {
  const res = await pg.query(
    `SELECT source, COUNT(*)::int AS total FROM signals GROUP BY source ORDER BY total DESC`
  );
  return res.rows;
}
