import { createServer } from "node:http";
import { searchBody, selectEvidence } from "./evidence_selection.ts";
import { rerank, RerankError } from "./logistics_rerank.ts";

createServer(async (request, response) => {
  const send = (status: number, body: unknown) => {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
  };
  if (request.method !== "POST" || request.url !== "/search") {
    send(404, { message: "Use POST /search" });
    return;
  }
  try {
    let body = "";
    for await (const chunk of request) {
      body += chunk.toString();
      if (Buffer.byteLength(body) > 256000) {
        send(413, { message: "Evidence exceeds request size" });
        return;
      }
    }
    let json: unknown;
    try { json = JSON.parse(body); } catch {
      send(400, { message: "Send a JSON body" });
      return;
    }
    const parsed = searchBody.safeParse(json);
    if (!parsed.success) {
      send(400, { issues: parsed.error.issues });
      return;
    }
    const selected = selectEvidence(parsed.data);
    if (selected.length === 0) {
      send(200, { shipmentId: parsed.data.shipmentId, candidates: [], ranking: [] });
      return;
    }
    const ranking = await rerank(parsed.data.query, selected.map(item => item.text), Math.min(parsed.data.top_k, selected.length));
    send(200, { shipmentId: parsed.data.shipmentId, candidates: selected, ranking });
  } catch (error) {
    if (error instanceof RerankError) send(error.status, { error: error.detail });
    else send(502, { message: "Search could not complete" });
  }
}).listen(3000, () => console.log("Shipment search listening on http://localhost:3000"));
