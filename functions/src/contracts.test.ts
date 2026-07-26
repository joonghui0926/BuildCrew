import { describe, expect, it } from "vitest";
import { approvalSchema, callbackSchema } from "./contracts.js";

describe("callbackSchema", () => {
  it("accepts an idempotent CrewAI progress callback", () => {
    const result = callbackSchema.parse({
      case_id: "BC-0142",
      flow_id: "flow-1",
      current_stage: "coordination",
      status: "running",
      progress_percent: 64,
      timestamp: "2026-07-26T18:00:00.000Z",
      idempotency_key: "BC-0142-coordination-1",
      payload_version: "1.0",
      summary: "Candidate C passed coordination.",
      deliverables: [],
    });
    expect(result.current_stage).toBe("coordination");
  });
});

describe("approvalSchema", () => {
  it("defaults to the internal submission gate", () => {
    const result = approvalSchema.parse({ caseId: "BC-0142", decision: "approved" });
    expect(result.gate).toBe("internal_submission");
  });
});

