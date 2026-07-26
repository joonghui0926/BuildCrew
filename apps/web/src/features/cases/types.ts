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
  supplier: string;
  quoteReference: string;
  inventory: string;
  verifiedAt: string;
  shipFrom: string;
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

export type AlternativeStage =
  | "bim_reviewed"
  | "technical_reject"
  | "evidence_reject"
  | "schedule_reject";

export interface DiscoveredAlternative {
  id: string;
  manufacturer: string;
  model: string;
  discoverySource: string;
  evidence: string;
  delivery: string;
  stage: AlternativeStage;
  decision: string;
  candidateId?: string;
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
  discoveredAlternatives: DiscoveredAlternative[];
  pipeline: PipelineStage[];
  evidence: EvidenceItem[];
}
