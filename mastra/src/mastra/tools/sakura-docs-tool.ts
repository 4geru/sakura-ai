/**
 * Sakura AI Documents Query Tool
 * Query Sakura AI vector store for relevant documents
 */

import { Tool } from '@mastra/core/tools';
import { z } from 'zod';
import { httpJson, validateToken, getApiBase } from '../utils/sakura-http';

export const sakuraDocsQueryTool = new Tool({
  id: 'sakura_documents_query',
  description: 'Query Sakura AI vector store for relevant documents',

  inputSchema: z.object({
    query: z.string().min(1).describe('The search query to find relevant documents'),
    tags: z.array(z.string()).optional().describe('Optional tags to filter documents'),
    topK: z.number().int().positive().max(50).default(5).describe('Number of results to return (max 50)'),
    timeoutMs: z.number().int().positive().max(120000).default(30000).describe('Request timeout in milliseconds (default: 30000)'),
    maxRetries: z.number().int().min(0).max(5).default(3).describe('Maximum number of retry attempts for failed requests (default: 3)'),
    retryDelay: z.number().int().positive().max(10000).default(2000).describe('Initial delay between retries in milliseconds (default: 2000)'),
  }),

  execute: async (params) => {
    // ========================================
    // 1. Extract and validate parameters
    // ========================================
    const context = params.context || params;
    const {
      query,
      tags,
      topK = 5,
      timeoutMs = 30000,
      maxRetries = 3,
      retryDelay = 2000
    } = context;

    validateToken();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error("Query parameter is required and must be a non-empty string");
    }

    // ========================================
    // 2. Build request payload
    // ========================================
    const payload = {
      query: query.trim(),
      ...(Array.isArray(tags) && tags.length ? { tags } : {})
    };

    // ========================================
    // 3. Make API request
    // ========================================
    const url = `${getApiBase()}/documents/query/`;

    const json = await httpJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      timeoutMs,
      maxRetries,
      retryDelay,
    });

    // ========================================
    // 4. Process response
    // ========================================
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

    // Sort by score and limit to topK
    normalized.sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0));
    normalized = normalized.slice(0, topK);

    // ========================================
    // 5. Build summary
    // ========================================
    const brief = normalized.map((n: any, i: number) => ({
      idx: i + 1,
      id: n.id,
      name: n.name,
      score: n.score,
      textHead: n.text.slice(0, 160),
    }));

    const summary =
      "Top document matches:\n" +
      (brief.length
        ? brief
            .map(
              (b) => `#${b.idx} name=${b.name ?? "-"} score=${b.score ?? "-"} text="${b.textHead}..."`
            )
            .join("\n")
        : "(no results)");

    // ========================================
    // 6. Return structured response
    // ========================================
    return {
      success: true,
      data: {
        summary,
        topK,
        documents: normalized,
        totalFound: candidates.length,
      }
    };
  },
});