import { z } from "zod";

export const caseStageSchema = z.enum([
  "intake",
  "evidence",
  "sourcing",
  "bim_generation",
  "coordination",
  "commercial_review",
  "package_compilation",
  "internal_approval",
  "engineer_approval",
  "final_procurement",
  "resolved",
]);

export const callbackSchema = z.object({
  case_id: z.string().min(1).max(160),
  flow_id: z.string().min(1).max(300),
  current_stage: caseStageSchema,
  status: z.string().min(1).max(80),
  progress_percent: z.number().min(0).max(100),
  timestamp: z.string().datetime(),
  idempotency_key: z.string().min(8).max(300),
  payload_version: z.literal("1.0"),
  summary: z.string().max(2000),
  candidate_count: z.number().int().min(0).max(100).optional(),
  deliverables: z.array(z.object({
    name: z.string().min(1).max(240),
    url: z.string().url(),
    kind: z.string().min(1).max(80),
  })).default([]),
  error: z.string().max(3000).optional(),
});

export type CrewCallback = z.infer<typeof callbackSchema>;

export const startCaseSchema = z.object({
  caseId: z.string().min(1).max(160),
});

export const approvalSchema = z.object({
  caseId: z.string().min(1).max(160),
  decision: z.enum(["approved", "needs_revision", "rejected"]),
  note: z.string().max(2000).default(""),
  gate: z.enum(["internal_submission", "final_procurement"]).default("internal_submission"),
});

