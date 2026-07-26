import { describe, expect, it } from "vitest";
import { missionBayCase } from "./demo-case";

describe("Mission Bay coordination demo", () => {
  it("selects exactly one installable replacement", () => {
    const recommended = missionBayCase.candidates.filter(
      (candidate) => candidate.status === "recommended",
    );

    expect(recommended).toHaveLength(1);
    expect(recommended[0].id).toBe(missionBayCase.selectedCandidateId);
    expect(recommended[0].criticalClashes).toBe(0);
    expect(recommended[0].requirementsPassed).toBe(recommended[0].requirementsTotal);
  });

  it("keeps rejected candidates visibly tied to coordination failures", () => {
    const rejected = missionBayCase.candidates.filter(
      (candidate) => candidate.status === "rejected",
    );

    expect(rejected).toHaveLength(2);
    expect(rejected.every((candidate) => candidate.criticalClashes > 0)).toBe(true);
  });

  it("requires a minor modification without adding schedule delay", () => {
    const selected = missionBayCase.candidates.find(
      (candidate) => candidate.id === missionBayCase.selectedCandidateId,
    );

    expect(selected?.connectorOffsetMm).toBe(25);
    expect(selected?.scheduleImpactDays).toBe(0);
  });

  it("searches broadly before spending BIM resources on a shortlist", () => {
    const bimReviewed = missionBayCase.discoveredAlternatives.filter(
      (alternative) => alternative.stage === "bim_reviewed",
    );

    expect(missionBayCase.discoveredAlternatives).toHaveLength(14);
    expect(bimReviewed).toHaveLength(3);
    expect(
      missionBayCase.discoveredAlternatives.every(
        (alternative) => alternative.discoverySource && alternative.decision,
      ),
    ).toBe(true);
  });
});
