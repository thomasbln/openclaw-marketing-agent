/**
 * Legal-Tech Radar Plugin – DB tools for OpenClaw
 * get_source_stats, get_signals, get_trend, run_scanner
 */

import Docker from "dockerode";
import { getSourceStats, getSignals, getTrend, getMessaging } from "./db.js";

export default function (api: { registerTool: (tool: unknown, opts?: { optional?: boolean }) => void }) {
  api.registerTool(
    {
      name: "get_source_stats",
      description: "Signal counts per source (hackernews, google_news_en). Optionally filter by last N days.",
      parameters: {
        type: "object",
        properties: {
          since_days: {
            type: "number",
            description: "Only signals from runs in last N days",
          },
        },
      },
      async execute(_id: string, params: { since_days?: number }) {
        const rows = await getSourceStats(params.since_days);
        const text = JSON.stringify(rows, null, 2);
        return { content: [{ type: "text" as const, text }] };
      },
    },
    { optional: true }
  );

  api.registerTool(
    {
      name: "get_signals",
      description: "Fetch recent signals (title, url, source, snippet). Filter by source, days, or keyword.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results (default 50, max 200)" },
          source: { type: "string", description: "Filter by source (hackernews, google_news_de, google_news_en, x). Use 'x' or 'x.com' for X.com/Twitter signals (EN only)." },
          since_days: { type: "number", description: "Only from last N days" },
          keyword: { type: "string", description: "Search in title/content" },
        },
      },
      async execute(_id: string, params: { limit?: number; source?: string; since_days?: number; keyword?: string }) {
        const rows = await getSignals(params);
        const text = JSON.stringify(rows, null, 2);
        return { content: [{ type: "text" as const, text }] };
      },
    },
    { optional: true }
  );

  api.registerTool(
    {
      name: "get_trend",
      description: "Compare signal counts between two periods (e.g. last 7 days vs last 30 days) per source. Returns period_a, period_b, delta (absolute), delta_pct (e.g. +12%, -8%).",
      parameters: {
        type: "object",
        properties: {
          days_a: { type: "number", description: "Shorter period, e.g. 7" },
          days_b: { type: "number", description: "Longer period, e.g. 30" },
        },
        required: ["days_a", "days_b"],
      },
      async execute(_id: string, params: { days_a: number; days_b: number }) {
        const result = await getTrend(params.days_a, params.days_b);
        const text = JSON.stringify(result, null, 2);
        return { content: [{ type: "text" as const, text }] };
      },
    },
    { optional: true }
  );

  api.registerTool(
    {
      name: "get_messaging",
      description:
        "Fetch landing-page messaging texts (headline, subheadline, pain_block, cta per page_id). Use for /wording 7d Block 4 – language contrast: Radar (market) vs. Your messaging.",
      parameters: { type: "object", properties: {} },
      async execute() {
        const rows = await getMessaging();
        const text = JSON.stringify(rows, null, 2);
        return { content: [{ type: "text" as const, text }] };
      },
    },
    { optional: true }
  );

  api.registerTool(
    {
      name: "run_scanner",
      description: "Trigger the signal radar scanner to fetch new signals from HN and Google News. Runs in background.",
      parameters: {
        type: "object",
        properties: {},
      },
      async execute() {
        const image = process.env.SCANNER_IMAGE ?? "signal-radar_signal-radar";
        const dbUrl = process.env.DATABASE_URL;
        const socketPath = process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock";
        const network = process.env.SCANNER_NETWORK ?? "radar-net";

        if (!dbUrl) {
          return {
            content: [
              {
                type: "text" as const,
                text: "DATABASE_URL not set. Scanner cannot run.",
              },
            ],
          };
        }

        try {
          const docker = new Docker({ socketPath });
          const container = await docker.createContainer({
            Image: image,
            Cmd: ["node", "index.js"],
            Env: [`DATABASE_URL=${dbUrl}`],
            HostConfig: {
              AutoRemove: true,
              NetworkMode: network,
            },
          });
          await container.start();
          return {
            content: [
              {
                type: "text" as const,
                text: "Scanner started. Results will be available in a few minutes.",
              },
            ],
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            content: [
              {
                type: "text" as const,
                text: `Scanner could not be started: ${msg}. Ensure Docker socket is mounted and SCANNER_IMAGE (default: signal-radar_signal-radar) exists.`,
              },
            ],
          };
        }
      },
    },
    { optional: true }
  );
}
