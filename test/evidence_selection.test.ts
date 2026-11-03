import { test } from "node:test";
import assert from "node:assert/strict";
import { searchBody, selectEvidence } from "../src/evidence_selection.ts";

test("dispatch search keeps this shipment's POD and active exception", () => {
  const input = searchBody.parse({
    shipmentId: "SHP-42", query: "Missing signature",
    evidence: [
      { kind: "pod", id: "receipt", shipmentId: "SHP-42", filename: "receipt.pdf", extractedText: "Signature pending" },
      { kind: "exception", id: "active", shipmentId: "SHP-42", status: "open", detail: "Receiver absent" },
      { kind: "exception", id: "closed", shipmentId: "SHP-42", status: "resolved", detail: "Address corrected" },
      { kind: "event", id: "other", shipmentId: "SHP-99", occurredAt: "2026-10-01T09:00:00Z", detail: "Delivered" }
    ]
  });
  assert.deepEqual(selectEvidence(input).map(item => item.id), ["receipt", "active"]);
  assert.equal(searchBody.safeParse({ shipmentId: "SHP-42", query: "", evidence: [] }).success, false);
});
