/**
 * Sakura AI HTTP Utilities
 * Common HTTP functions for Sakura AI API interactions
 */

const API_BASE = process.env.SAKURA_AI_BASE_URL || "https://api.ai.sakura.ad.jp/v1";
const TOKEN = process.env.SAKURA_AI_TOKEN;

export interface HttpJsonOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelay?: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Makes HTTP requests with automatic retry logic for transient failures
 * @param url - The URL to fetch
 * @param opts - Request options including retry configuration
 * @returns Parsed JSON response
 */
export async function httpJson(url: string, opts: HttpJsonOptions = {}): Promise<any> {
  const maxRetries = opts.maxRetries ?? 3;
  const retryDelay = opts.retryDelay ?? 2000;
  const timeoutMs = opts.timeoutMs ?? 30000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: opts.method,
        body: opts.body,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${TOKEN}`,
          ...(opts.headers || {}),
        },
        signal: controller.signal,
      });

      const text = await res.text();

      // 503 Service Unavailable - リトライ可能
      if (res.status === 503 && attempt < maxRetries) {
        console.warn(`[Sakura API] 503 Service Unavailable, retrying (${attempt + 1}/${maxRetries})...`);
        clearTimeout(timer);
        await sleep(retryDelay * (attempt + 1)); // exponential backoff
        continue;
      }

      // 429 Too Many Requests - リトライ可能
      if (res.status === 429 && attempt < maxRetries) {
        console.warn(`[Sakura API] 429 Too Many Requests, retrying (${attempt + 1}/${maxRetries})...`);
        clearTimeout(timer);
        await sleep(retryDelay * (attempt + 1) * 2); // longer backoff for rate limits
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}\n${text?.slice(0, 2000) || ""}`);
      }

      if (!text) return {};

      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Failed to parse JSON:\n${text?.slice(0, 2000)}`);
      }
    } catch (error) {
      clearTimeout(timer);

      // AbortErrorやネットワークエラーの場合もリトライ
      if (attempt < maxRetries && error instanceof Error &&
          (error.name === 'AbortError' || error.message.includes('fetch failed'))) {
        console.warn(`[Sakura API] Network error, retrying (${attempt + 1}/${maxRetries})...`);
        await sleep(retryDelay * (attempt + 1));
        continue;
      }

      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error('Max retries exceeded');
}

/**
 * Validates that the Sakura AI token is configured
 * @throws Error if token is not set
 */
export function validateToken(): void {
  if (!TOKEN) {
    throw new Error("SAKURA_AI_TOKEN environment variable is required");
  }
}

/**
 * Gets the Sakura AI API base URL
 * @returns The configured API base URL
 */
export function getApiBase(): string {
  return API_BASE;
}

/**
 * Gets the Sakura AI API token
 * @returns The configured API token
 */
export function getToken(): string | undefined {
  return TOKEN;
}
