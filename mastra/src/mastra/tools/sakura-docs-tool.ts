import { Tool } from '@mastra/core/tools';
import { z } from 'zod';

const API_BASE = process.env.SAKURA_AI_BASE_URL || "https://api.ai.sakura.ad.jp/v1";
const TOKEN = process.env.SAKURA_AI_TOKEN;

async function httpJson(url: string, opts: any = {}) {
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

export const sakuraDocsQueryTool = new Tool({
  id: 'sakura_documents_query',
  description: 'Query Sakura AI vector store for relevant documents',
  inputSchema: z.object({
    query: z.string().min(1).describe('The search query to find relevant documents'),
    tags: z.array(z.string()).optional().describe('Optional tags to filter documents'),
    topK: z.number().int().positive().max(50).default(5).describe('Number of results to return (max 50)'),
    timeoutMs: z.number().int().positive().max(120000).default(30000).describe('Request timeout in milliseconds'),
  }),
  
  execute: async (params) => {
    // Extract from context if available (new Mastra format), fallback to direct params
    const context = params.context || params;
    const { query, tags, topK = 5, timeoutMs = 30000 } = context;
    
    if (!TOKEN) {
      throw new Error("SAKURA_AI_TOKEN environment variable is required");
    }
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error("Query parameter is required and must be a non-empty string");
    }

    const payload = { 
      query: query.trim(), 
      ...(Array.isArray(tags) && tags.length ? { tags } : {}) 
    };
    
    const url = `${API_BASE}/documents/query/`;
    
    const json = await httpJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      timeoutMs,
    });

    const candidates = json?.results || json?.documents || json?.matches || json?.items || [];
    const toText = (it: any) =>
      it?.text ?? it?.content ?? it?.chunk ?? it?.document?.text ?? it?.document?.content ?? "";

    let normalized = candidates
      .map((it: any) => ({
        id: it.id ?? it.document_id ?? it.doc_id ?? null,
        name: it.name ?? it.title ?? it.document?.name ?? null,
        score: it.score ?? it.similarity ?? null,
        text: String(toText(it) || "").trim(),
        meta: it.meta ?? it.metadata ?? it.document?.metadata ?? null,
      }))
      .filter((n: any) => n.text);

    normalized.sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0));
    normalized = normalized.slice(0, topK);

    const brief = normalized.map((n: any, i: number) => ({
      idx: i + 1,
      id: n.id,
      name: n.name,
      score: n.score,
      textHead: n.text.slice(0, 160),
    }));

    const header =
      "Top document matches:\n" +
      (brief.length
        ? brief
            .map(
              (b) => `#${b.idx} name=${b.name ?? "-"} score=${b.score ?? "-"} text="${b.textHead}..."`
            )
            .join("\n")
        : "(no results)");

    return {
      success: true,
      data: {
        summary: header,
        topK,
        documents: normalized,
        totalFound: candidates.length,
      }
    };
  },
});