/**
 * RAG minimal sample:
 *   1) Query vector store (/v1/documents/query)
 *   2) Build context prompt
 *   3) Call chat completions (/v1/chat/completions)
 */
import 'dotenv/config';

const API_BASE = "https://api.ai.sakura.ad.jp/v1";
const TOKEN = process.env.SAKURA_AI_TOKEN;
if (!TOKEN) {
  console.error("ERROR: Please set env SAKURA_AI_TOKEN to your Bearer token.");
  process.exit(1);
}

// ---- CLI 引数 ----
// 例: node index.mjs "個人情報とは" --tags=PII --model=gpt-oss-120b
const argv = process.argv.slice(2);
if (argv.length === 0) {
  console.error("Usage: node index.mjs \"質問文\" [--tags=tag1,tag2] [--model=gpt-oss-120b]");
  process.exit(1);
}

const USER_QUERY = argv[0]; // 最初の引数を質問に
const argPairs = argv.slice(1).map((a) => {
  const m = a.match(/^--([^=]+)=(.*)$/);
  return m ? [m[1], m[2]] : [a.replace(/^--/, ""), true];
});
const args = Object.fromEntries(argPairs);

const TAGS = (args.tags ? String(args.tags).split(",") : []).filter(Boolean);
const MODEL = args.model || "gpt-oss-120b";
const TEMPERATURE = args.temperature != null ? Number(args.temperature) : 0.7;
const MAX_TOKENS = args.maxTokens != null ? Number(args.maxTokens) : 1000;
const TOP_K = args.topK != null ? Number(args.topK) : 5;

async function httpJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${TOKEN}`,
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  return text ? JSON.parse(text) : {};
}

/** ベクトル検索 */
async function vectorQuery({ query, tags }) {
  const url = `${API_BASE}/documents/query/`;
  const payload = { query, tags };
  const json = await httpJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const candidates = json?.results || json?.documents || json?.matches || json?.items || [];
  const toText = (it) =>
    it?.text ?? it?.content ?? it?.chunk ?? it?.document?.text ?? it?.document?.content ?? "";

  const normalized = candidates
    .map((it) => ({
      id: it.id ?? it.document_id ?? null,
      name: it.name ?? it.title ?? null,
      score: it.score ?? it.similarity ?? null,
      text: String(toText(it) || "").trim(),
    }))
    .filter((it) => it.text);

  normalized.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return normalized.slice(0, TOP_K);
}

/** プロンプト組み立て */
function buildMessages({ userQuery, snippets }) {
  const ctx = snippets
    .map((s, i) => `#${i + 1}${s.name ? " " + s.name : ""}\n${s.text.slice(0, 500)}`)
    .join("\n\n");

  const system =
    "You are a helpful assistant. Answer in Japanese. Use the provided context faithfully.";
  const user = `質問: ${userQuery}\n\n参照コンテキスト:\n${ctx || "なし"}`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/** Chat 完了 */
async function chatComplete({ model, messages, temperature, max_tokens }) {
  const url = `${API_BASE}/chat/completions`;
  const payload = { model, messages, temperature, max_tokens, stream: false };
  const json = await httpJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return (
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.text ??
    json?.output ??
    ""
  );
}

(async () => {
  console.log("Vector query:", USER_QUERY, "tags:", TAGS);
  const snippets = await vectorQuery({ query: USER_QUERY, tags: TAGS });
  console.log(`→ ${snippets.length} snippet(s) found`);

  const messages = buildMessages({ userQuery: USER_QUERY, snippets });
  const answer = await chatComplete({
    model: MODEL,
    messages,
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
  });

  console.log("\n RAG Answer:\n");
  console.log(answer);
})();
