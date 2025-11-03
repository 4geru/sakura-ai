/**
 * Sakura AI Documents Chat Tool
 * Chat with Sakura AI documents using the chat API for conversational responses
 */

import { Tool } from '@mastra/core/tools';
import { z } from 'zod';
import { httpJson, validateToken, getApiBase } from '../utils/sakura-http';

export const sakuraDocsChatTool = new Tool({
  id: 'sakura_documents_chat',
  description: 'Chat with Sakura AI documents using the chat API for conversational responses',

  inputSchema: z.object({
    query: z.string().min(1).describe('The question or prompt to ask the documents'),
    model: z.string().default('multilingual-e5-large').describe('Embedding model (e.g., multilingual-e5-large)'),
    chatModel: z.string().default('gpt-oss-120b').describe('LLM model for generating response (e.g., gpt-oss-120b)'),
    topK: z.number().int().positive().default(3).describe('Number of top results to retrieve'),
    threshold: z.number().min(0).max(1).default(0.3).describe('Similarity threshold for results'),
    timeoutMs: z.number().int().positive().max(180000).default(60000).describe('Request timeout in milliseconds (default: 60000)'),
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
      model = 'multilingual-e5-large',
      chatModel = 'gpt-oss-120b',
      topK = 3,
      threshold = 0.3,
      timeoutMs = 60000,
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
      model,
      chat_model: chatModel,
      query: query.trim(),
      top_k: topK,
      threshold
    };

    // ========================================
    // 3. Make API request
    // ========================================
    const url = `${getApiBase()}/documents/chat/`;

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
    const content = json?.choices?.[0]?.message?.content ||
                   json?.response ||
                   json?.answer ||
                   json?.content ||
                   JSON.stringify(json);

    const usage = json?.usage || {};
    const sources = json?.sources || json?.documents || [];

    const normalizedSources = sources.map((source: any, index: number) => ({
      id: source.id || index,
      name: source.name || source.title || 'Unknown',
      score: source.score || source.similarity || null,
      snippet: (source.text || source.content || '').slice(0, 200)
    }));

    // ========================================
    // 5. Build summary
    // ========================================
    const summary = content.length > 200 ? content.slice(0, 200) + "..." : content;

    // ========================================
    // 6. Return structured response
    // ========================================
    return {
      success: true,
      data: {
        summary,
        response: content,
        embeddingModel: model,
        chatModel: chatModel,
        topK,
        threshold,
        usage: {
          promptTokens: usage.prompt_tokens || 0,
          completionTokens: usage.completion_tokens || 0,
          totalTokens: usage.total_tokens || 0
        },
        sources: normalizedSources,
        totalSources: sources.length,
      }
    };
  },
});