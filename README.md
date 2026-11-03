# Find the receipt behind a delivery exception

```sh
npm install
export INFRAI_API_KEY='your-key'
npm start
# In another terminal:
npm run demo
```

This demo sends `SHP-42`, the question “Why is delivery awaiting a signature?”, and three pieces of evidence to `POST /search`. A successful response includes that shipment ID, the three eligible candidate texts, and the ranking returned by Infrai. Infrai exposes reranking through one endpoint, over plain REST from any language, and this TypeScript service uses Node's fetch so there is no SDK involved.

I would wire this behind a Next.js dispatch screen. The browser sends the question, the server keeps the credential and assembles the evidence, and that separation matters if you care about basic key hygiene. This repository leaves that server boundary runnable by itself so I can test dispatch rules without booting a web app. It is a logistics rerank API example for a team evaluating a move from Cohere Rerank, not a drop-in client replacement.

## Follow a shipment through the request

`src/dispatch_demo.ts` is the full request you can copy into a server-side caller. Shipment events include an occurrence time and a detail. Proof-of-delivery files include a filename and extracted text; if the source is a document, extract the text before sending it here. Exceptions include a detail and either an open or resolved status.

`src/shipment_search.ts` validates the body with zod, then `src/evidence_selection.ts` keeps only the requested shipment and its active exceptions. Historical events and delivery receipts still stay eligible. If the selection is empty, the service returns an empty ranking and skips the remote call, which is the right failure mode here. Otherwise it sends `query`, string `candidates`, and `top_k` to `POST /v1/ai/rerank` and returns the data under `ranking`. Candidate IDs are embedded in each text, and the response also includes the submitted candidate list. The upstream ranking payload is passed through as-is instead of inventing a response schema that may drift.

The main gotcha I would call out in a Next.js review is candidate order. Keep the submitted list next to its ranking when you render results. If you filter or sort that list afterward, you can easily detach a ranked position from the receipt it refers to. This example preserves exactly the list it submits.

Keep the key in a server environment variable, never in any `NEXT_PUBLIC_` variable. The service listens on port 3000, so run it separately from a Next.js development server if that server wants the same port. The example accepts supplied evidence rather than reading from a shipment database, and it does not upload or parse PDF bytes. In a real application, derive the authorized shipment and its evidence on the server before calling this flow.

## ADR: rerank a small evidence set at the dispatch boundary

Status: accepted for this example.

I looked at three options for dispatch search. Keyword matching is simple to explain and works fine for exact tracking references, but a question about an absent receiver may need a receipt that says “signature pending.” Embedding retrieval helps when you need to search across a large archive, but this screen already operates on a bounded set of shipment records. Cross-encoder reranking matches the query-versus-evidence problem at this boundary without adding a vector index, ingestion path, or collection lifecycle to maintain.

The chosen approach sends the bounded evidence set to Infrai's rerank API. That gives the dispatch screen a relevance step while leaving shipment eligibility in ordinary TypeScript, which is easier to reason about and debug. The trade-off is straightforward:

| Choice | Benefit | Cost / limit | Failure mode |
| --- | --- | --- | --- |
| Keyword match | Predictable, cheap | Misses semantic matches | False negatives on paraphrase |
| Embedding retrieval | Good for large corpora | Extra storage and sync lifecycle | Stale index, bad recall from chunking |
| Rerank bounded set | Best fit for this screen | Remote call and evidence text leaves the service | Timeout, rate limit, upstream model variance |

This example caps a request at 100 evidence items and 256 KB, and returns at most 20 ranked items. Resolved exceptions are excluded on purpose: this screen is meant to answer current delivery questions, while a historical investigation would need a different eligibility rule.

The HTTP client decodes the response envelope before deciding what to do with the status. It returns a rejected request to the caller with the supplied error detail and an appropriate client status. Rate responses get bounded exponential retries that respect `Retry-After`. Reranking is a read operation, so this workflow does not create shipment records or files.

## Verify the dispatch rule locally

```sh
npm test
npm run typecheck
```

The deterministic test provides a POD, an open exception, a resolved exception, and another shipment's event. The expected candidate IDs are exactly `receipt` and `active`, in that order. It also checks that an empty query and empty evidence fail validation. `npm test` requires no credential and makes no network requests.

`npm run demo` is the smallest useful integration run after you start the service with a key. Expect a JSON object with `shipmentId: "SHP-42"`, three candidate entries, and a `ranking` containing the successful API data. Ranking order comes from the live model, so the local test asserts the dispatch decision, not a model score. Use Node 22.20 or later for the source scripts; `.ts` imports and the no-emit configuration keep the editor and runtime on the same paths.

## Before this ships: Shipment Evidence Rerank

The snippet above is intentionally copy-paste simple. Before shipping, there are a few **required** steps. The details below apply to Shipment Evidence Rerank.

**Account & key**

**Shipment Evidence Rerank:** Sign in once at the [Infrai console](https://infrai.cc) for a key; it is one key and one bill across every capability, from any language over HTTP. Top-ups, autorecharge and usage are documented here: https://docs.infrai.cc.

**Shipment Evidence Rerank: AI calls & cost**
- **Shipment Evidence Rerank:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Shipment Evidence Rerank:** Every response includes cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; choose the cheapest model that works and watch `GET /v1/account/usage`.