#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = process.env.SAKURA_AI_BASE_URL || "https://api.ai.sakura.ad.jp/v1";
const TOKEN = process.env.SAKURA_AI_TOKEN;

if (!TOKEN) {
  console.error("ERROR: env SAKURA_AI_TOKEN is required (Bearer token).");
  process.exit(1);
}

async function httpJson(url, opts = {}) {
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 30000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...opts,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${TOKEN}`,
        ...(opts.headers || {}),
      },
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}\n${text?.slice(0, 2000) || ""}`);
    }
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Failed to parse JSON:\n${text?.slice(0, 2000)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

const server = new McpServer({ name: "sakura-docquery-mcp", version: "1.0.0" });

server.registerTool(
  "sakura_documents_query",
  {
    title: "Sakura Documents Query",
    description: "Query Sakura AI vector store (POST /v1/documents/query/).",
    inputSchema: {
      query: z.string().min(1, "query is required"),
      tags: z.array(z.string()).optional(),
      topK: z.number().int().positive().max(50).optional(),
      timeoutMs: z.number().int().positive().max(120000).optional(),
    },
  },
  async ({ query, tags, topK, timeoutMs }) => {
    const payload = { query, ...(Array.isArray(tags) && tags.length ? { tags } : {}) };
    const url = `${API_BASE}/documents/query/`;
    const json = await httpJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      timeoutMs,
    });

    const candidates = json?.results || json?.documents || json?.matches || json?.items || [];
    const toText = (it) =>
      it?.text ?? it?.content ?? it?.chunk ?? it?.document?.text ?? it?.document?.content ?? "";

    let normalized = candidates
      .map((it) => ({
        id: it.id ?? it.document_id ?? it.doc_id ?? null,
        name: it.name ?? it.title ?? it.document?.name ?? null,
        score: it.score ?? it.similarity ?? null,
        text: String(toText(it) || "").trim(),
        meta: it.meta ?? it.metadata ?? it.document?.metadata ?? null,
      }))
      .filter((n) => n.text);

    normalized.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const limit = topK ?? 5;
    normalized = normalized.slice(0, limit);

    const brief = normalized.map((n, i) => ({
      idx: i + 1,
      id: n.id,
      name: n.name,
      score: n.score,
      textHead: n.text.slice(0, 160),
    }));

    const header =
      "Top hits (brief):\n" +
      (brief.length
        ? brief
            .map(
              (b) => `#${b.idx} name=${b.name ?? "-"} score=${b.score ?? "-"} text="${b.textHead}..."`
            )
            .join("\n")
        : "(no results)");

    const out = {
      topK: limit,
      normalized,
      raw: json,
    };

    return {
      content: [
        {
          type: "text",
          text: `${header}\n\n-----\nJSON (normalized+raw):\n${JSON.stringify(out, null, 2).slice(0, 50_000)}`,
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[sakura-docquery-mcp] stdio server started");