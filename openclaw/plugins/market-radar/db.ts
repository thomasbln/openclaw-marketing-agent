/**
 * DB helper for legal_intel (signals, runs).
 * Uses DATABASE_URL from env.
 */

import pg from "pg";

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    pool = new pg.Pool({ connectionString: url });
  }
  return pool;
}

export async function getSourceStats(sinceDays?: number): Promise<{ source: string; total: number; pct: string }[]> {
  const p = getPool();
  let res: pg.QueryResult;

  if (sinceDays != null) {
    res = await p.query(
      `SELECT s.source, COUNT(*)::int AS total
       FROM signals s
       JOIN runs r ON s.run_id = r.id
       WHERE r.created_at > NOW() - INTERVAL '1 day' * $1
       GROUP BY s.source
       ORDER BY total DESC`,
      [sinceDays]
    );
  } else {
    res = await p.query(
      `SELECT source, COUNT(*)::int AS total FROM signals GROUP BY source ORDER BY total DESC`
    );
  }

  const rows = res.rows as { source: string; total: number }[];
  const total = rows.reduce((s, r) => s + r.total, 0);

  return rows.map((r) => ({
    source: r.source,
    total: r.total,
    pct: total > 0 ? ((r.total / total) * 100).toFixed(1) : "0",
  }));
}

export interface SignalRow {
  title: string;
  url: string;
  source: string;
  snippet: string;
}

export async function getSignals(opts: {
  limit?: number;
  source?: string;
  sinceDays?: number;
  keyword?: string;
}): Promise<SignalRow[]> {
  const p = getPool();
  const limit = Math.min(opts.limit ?? 50, 80);
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (opts.source) {
    // X.com/Twitter: user says "x" or "x.com", DB stores "x" (EN only)
    const src = opts.source.toLowerCase().replace(".com", "");
    if (src === "x" || src === "twitter") {
      params.push("x");
      conditions.push(`s.source = $${params.length}`);
    } else {
      params.push(opts.source);
      conditions.push(`s.source = $${params.length}`);
    }
  }
  if (opts.sinceDays != null) {
    params.push(opts.sinceDays);
    conditions.push(`r.created_at > NOW() - INTERVAL '1 day' * $${params.length}`);
  }
  if (opts.keyword) {
    params.push(`%${opts.keyword}%`);
    conditions.push(`(s.title ILIKE $${params.length} OR s.content ILIKE $${params.length})`);
  }
  params.push(limit);

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const res = await p.query(
    `SELECT s.title, s.url, s.source, LEFT(s.content, 200) AS snippet
     FROM signals s
     JOIN runs r ON s.run_id = r.id
     ${where}
     ORDER BY r.created_at DESC
     LIMIT $${params.length}`,
    params
  );

  return res.rows as SignalRow[];
}

export interface TrendResult {
  period_a: Record<string, number>;
  period_b: Record<string, number>;
  delta: Record<string, number>;
  delta_pct: Record<string, string>;
}

function formatDeltaPct(a: number, b: number): string {
  if (b === 0) return a > 0 ? "+∞" : "0%";
  const pct = ((a - b) / b) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${Math.round(pct)}%`;
}

export async function getTrend(daysA: number, daysB: number): Promise<TrendResult> {
  const p = getPool();

  const [resA, resB] = await Promise.all([
    p.query(
      `SELECT s.source, COUNT(*)::int AS total
       FROM signals s
       JOIN runs r ON s.run_id = r.id
       WHERE r.created_at > NOW() - INTERVAL '1 day' * $1
       GROUP BY s.source`,
      [daysA]
    ),
    p.query(
      `SELECT s.source, COUNT(*)::int AS total
       FROM signals s
       JOIN runs r ON s.run_id = r.id
       WHERE r.created_at > NOW() - INTERVAL '1 day' * $1
       GROUP BY s.source`,
      [daysB]
    ),
  ]);

  const periodA: Record<string, number> = {};
  const periodB: Record<string, number> = {};
  (resA.rows as { source: string; total: number }[]).forEach((r) => (periodA[r.source] = r.total));
  (resB.rows as { source: string; total: number }[]).forEach((r) => (periodB[r.source] = r.total));

  const allSources = new Set([...Object.keys(periodA), ...Object.keys(periodB)]);
  const delta: Record<string, number> = {};
  const deltaPct: Record<string, string> = {};
  for (const src of allSources) {
    const a = periodA[src] ?? 0;
    const b = periodB[src] ?? 0;
    delta[src] = a - b;
    deltaPct[src] = formatDeltaPct(a, b);
  }

  return { period_a: periodA, period_b: periodB, delta, delta_pct: deltaPct };
}

export interface MessagingRow {
  page_id: string;
  headline: string | null;
  subheadline: string | null;
  pain_block: string | null;
  cta: string | null;
}

export async function getMessaging(): Promise<MessagingRow[]> {
  const p = getPool();
  const res = await p.query(
    `SELECT page_id, headline, subheadline, pain_block, cta FROM messaging ORDER BY page_id`
  );
  return res.rows as MessagingRow[];
}
