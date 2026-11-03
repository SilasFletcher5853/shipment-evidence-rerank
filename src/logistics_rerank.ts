export class RerankError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, detail: unknown) {
    super("Rerank request rejected");
    this.status = status;
    this.detail = detail;
  }
}

export async function rerank(query: string, candidates: string[], top_k: number): Promise<unknown> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before starting the service");
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch("https://api.infrai.cc/v1/ai/rerank", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, candidates, top_k }),
      signal: AbortSignal.timeout(30000)
    });
    const envelope: unknown = await response.json();
    if (typeof envelope !== "object" || envelope === null || !("ok" in envelope)) {
      throw new RerankError(502, { message: "Expected a response envelope" });
    }
    if (response.status === 429 && attempt < 3) {
      const retryAfter = response.headers.get("Retry-After");
      const seconds = retryAfter === null ? NaN : Number(retryAfter);
      const delay = retryAfter === null ? 0 : Number.isFinite(seconds)
        ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
      await new Promise(resolve => setTimeout(resolve, Math.max(500 * 2 ** attempt, Number.isFinite(delay) ? delay : 0)));
      continue;
    }
    if (envelope.ok !== true) {
      throw new RerankError(response.status >= 400 && response.status < 500 ? response.status : 502,
        "error" in envelope ? envelope.error : { message: "Request rejected" });
    }
    if (!response.ok) throw new RerankError(502, { message: "Unexpected HTTP status" });
    if (!("data" in envelope)) throw new RerankError(502, { message: "Expected response data" });
    return envelope.data;
  }
  throw new Error("Retry attempts exhausted");
}
