export {};

async function dispatchDemo() {
  const response = await fetch("http://localhost:3000/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      shipmentId: "SHP-42", query: "Why is delivery awaiting a signature?", top_k: 2,
      evidence: [
        { kind: "event", id: "ev-1", shipmentId: "SHP-42", occurredAt: "2026-10-01T09:00:00Z", detail: "Driver arrived at receiving dock" },
        { kind: "pod", id: "pod-1", shipmentId: "SHP-42", filename: "dock-receipt.pdf", extractedText: "Receiver signature pending" },
        { kind: "exception", id: "ex-1", shipmentId: "SHP-42", status: "open", detail: "Receiver absent; signature required" }
      ]
    })
  });
  const result: unknown = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(result));
  console.log(JSON.stringify(result, null, 2));
}

dispatchDemo().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
