import { z } from "zod";

const evidence = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("event"), id: z.string().min(1), shipmentId: z.string().min(1), occurredAt: z.string().datetime(), detail: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("pod"), id: z.string().min(1), shipmentId: z.string().min(1), filename: z.string().min(1), extractedText: z.string().min(1) }).strict(),
  z.object({ kind: z.literal("exception"), id: z.string().min(1), shipmentId: z.string().min(1), status: z.enum(["open", "resolved"]), detail: z.string().min(1) }).strict()
]);

export const searchBody = z.object({
  shipmentId: z.string().min(1),
  query: z.string().min(1).max(1000),
  top_k: z.number().int().min(1).max(20).default(5),
  evidence: z.array(evidence).min(1).max(100)
}).strict();

export function selectEvidence(input: z.infer<typeof searchBody>) {
  return input.evidence.filter(item => item.shipmentId === input.shipmentId &&
    (item.kind !== "exception" || item.status === "open")).map(item => ({
      id: item.id,
      text: item.kind === "pod"
        ? `${item.id} | Proof of delivery ${item.filename}: ${item.extractedText}`
        : item.kind === "event"
          ? `${item.id} | Shipment event ${item.occurredAt}: ${item.detail}`
          : `${item.id} | Open exception: ${item.detail}`
    }));
}
