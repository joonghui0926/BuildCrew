export type CaseStage =
  | "evidence"
  | "sourcing"
  | "bim_generation"
  | "coordination"
  | "commercial_review"
  | "internal_approval";

export type CandidateStatus = "rejected" | "modification" | "recommended";

export interface Candidate {
  id: string;
  manufacturer: string;
  model: string;
  label: string;
  status: CandidateStatus;
  arrival: string;
  evidenceCoverage: number;
  requirementsPassed: number;
  requirementsTotal: number;
  criticalClashes: number;
  minorClashes: number;
  connectorOffsetMm: number;
  totalInstalledCost: number;
  costDelta: number;
  scheduleImpactDays: number;
  reason: string;
}

export interface PipelineStage {
  id: CaseStage;
  label: string;
  detail: string;
  state: "done" | "active" | "queued";
}

export interface EvidenceItem {
  id: string;
  claim: string;
  value: string;
  source: string;
  grade: "A" | "B";
  confidence: number;
}

export interface DemoCase {
  id: string;
  project: string;
  equipmentTag: string;
  equipmentName: string;
  delayDays: number;
  requiredOnSite: string;
  status: "awaiting_internal_approval";
  progress: number;
  selectedCandidateId: string;
  candidates: Candidate[];
  pipeline: PipelineStage[];
  evidence: EvidenceItem[];
}
