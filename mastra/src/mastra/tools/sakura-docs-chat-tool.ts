import { Tool } from '@mastra/core/tools';
import { z } from 'zod';

const API_BASE = process.env.SAKURA_AI_BASE_URL || "https://api.ai.sakura.ad.jp/v1";
const TOKEN = process.env.SAKURA_AI_TOKEN;

async function httpJson(url: string, opts: any = {}) {
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 60000; // Longer timeout for chat
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

export const sakuraDocsChatTool = new Tool({
  id: 'sakura_documents_chat',
  description: 'Chat with Sakura AI documents using the chat API for conversational responses',
  inputSchema: z.object({
    query: z.string().min(1).describe('The question or prompt to ask the documents'),
    model: z.string().default('multilingual-e5-large').describe('Embedding model (e.g., multilingual-e5-large)'),
    chat_model: z.string().default('gpt-oss-120b').describe('LLM model for generating response (e.g., gpt-oss-120b)'),
    top_k: z.number().int().positive().default(3).describe('Number of top results to retrieve'),
    threshold: z.number().min(0).max(1).default(0.3).describe('Similarity threshold for results'),
    timeoutMs: z.number().int().positive().max(180000).default(60000).describe('Request timeout in milliseconds'),
  }),
  
  execute: async (params) => {
    // Extract from context if available (new Mastra format), fallback to direct params
    const context = params.context || params;
    const { query, model = 'multilingual-e5-large', chat_model = 'gpt-oss-120b', top_k = 3, threshold = 0.3, timeoutMs = 60000 } = context;
    
    if (!TOKEN) {
      throw new Error("SAKURA_AI_TOKEN environment variable is required");
    }
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error("Query parameter is required and must be a non-empty string");
    }

    const payload = {
      model,
      chat_model,
      query: query.trim(),
      top_k,
      threshold
    };
    
    const url = `${API_BASE}/documents/chat/`;
    
    const json = await httpJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      timeoutMs,
    });

    // Extract response content from different possible formats
    const content = json?.choices?.[0]?.message?.content || 
                   json?.response || 
                   json?.answer || 
                   json?.content ||
                   JSON.stringify(json);

    const usage = json?.usage || {};
    const sources = json?.sources || json?.documents || [];

    return {
      success: true,
      data: {
        response: content,
        embedding_model: model,
        chat_model: chat_model,
        top_k: top_k,
        threshold: threshold,
        usage: {
          prompt_tokens: usage.prompt_tokens || 0,
          completion_tokens: usage.completion_tokens || 0,
          total_tokens: usage.total_tokens || 0
        },
        sources: sources.map((source: any, index: number) => ({
          id: source.id || index,
          name: source.name || source.title || 'Unknown',
          score: source.score || source.similarity || null,
          snippet: (source.text || source.content || '').slice(0, 200)
        })),
        raw: json
      }
    };
  },
});