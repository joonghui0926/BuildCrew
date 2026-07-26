"use client";

import {
  ArrowLeft,
  Bot,
  Check,
  Clock3,
  FileCheck2,
  Search,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import type { Candidate, DemoCase, DiscoveredAlternative } from "@/features/cases/types";
import { formatUsd } from "@/lib/format";
import { BimDeltaViewer } from "./bim-delta-viewer";

type CandidateDetailViewProps = {
  caseData: DemoCase;
  candidate: Candidate;
  onBack: () => void;
  onSelectCandidate: (candidateId: string) => void;
};

const requirements = [
  ["Design flow", "420 gpm", "M-601 · Equipment Schedule"],
  ["Total head", "60 ft", "M-601 · Equipment Schedule"],
  ["Motor", "15 hp · 480 V", "Division 23 Specification"],
  ["Inlet connection", "4 in · flanged", "Manufacturer submittal"],
  ["Outlet connection", "3 in · flanged", "Manufacturer submittal"],
  ["Maintenance access", "Motor removal zone", "Installation manual"],
];

const discoveryStage: Record<
  DiscoveredAlternative["stage"],
  { label: string; className: string }
> = {
  bim_reviewed: { label: "BIM REVIEWED", className: "search-stage--bim" },
  technical_reject: { label: "TECHNICAL FILTER", className: "search-stage--technical" },
  evidence_reject: { label: "EVIDENCE GAP", className: "search-stage--evidence" },
  schedule_reject: { label: "SCHEDULE FILTER", className: "search-stage--schedule" },
};

function CandidateVerdict({ candidate }: { candidate: Candidate }) {
  const rejected = candidate.status === "rejected";
  return (
    <span className={rejected ? "candidate-verdict candidate-verdict--rejected" : "candidate-verdict"}>
      {rejected ? <X size={14} /> : <Check size={14} />}
      {rejected ? "Rejected by coordination" : "Recommended for submission"}
    </span>
  );
}

export function CandidateDetailView({
  caseData,
  candidate,
  onBack,
  onSelectCandidate,
}: CandidateDetailViewProps) {
  const bestCandidate =
    caseData.candidates.find((item) => item.status === "recommended")
    ?? caseData.candidates[caseData.candidates.length - 1];
  const findings =
    candidate.id === "candidate-a"
      ? [
          "180 mm discharge alignment offset",
          "Existing chilled-water return pipe creates one critical clash",
          "Resolving the clash requires rerouting an operating system",
        ]
      : candidate.id === "candidate-b"
        ? [
            "Pump duty and connectors satisfy the technical requirements",
            "Motor-removal envelope intersects the concrete shear wall",
            "Future maintenance would require a structural modification",
          ]
        : [
            "All 31 hard requirements are supported by evidence",
            "No critical clash or maintenance-access violation",
            "One 25 mm field spool adjustment is included in installed cost",
          ];
  const comparison =
    candidate.id === "candidate-a"
      ? {
          title: "Existing return pipe blocks the discharge.",
          summary: "This option is cheaper, but it creates an operating-system reroute that the selected Armstrong option avoids.",
          bestAdvantage: "Armstrong clears the return pipe and needs only a 25 mm field spool.",
          change: "Reroute CHWR pipe · new supports · shutdown coordination",
        }
      : candidate.id === "candidate-b"
        ? {
            title: "The motor cannot be removed for service.",
            summary: "The pump fits at installation, but its maintenance envelope enters the structural wall.",
            bestAdvantage: "Armstrong preserves the full removal path without structural work.",
            change: "Structural opening or equipment relocation",
          }
        : {
            title: "No critical conflict remains.",
            summary: "This is the only BIM-reviewed option that protects installation, service access, and the required date.",
            bestAdvantage: "A 25 mm spool adjustment resolves the only coordination difference.",
            change: "25 mm field spool adjustment",
          };

  return (
    <div className="candidate-page">
      <button className="candidate-page__back" onClick={onBack} type="button">
        <ArrowLeft size={17} /> Back to case
      </button>

      <header className="candidate-page__hero">
        <div>
          <span className="eyebrow">ALTERNATIVE INTELLIGENCE · {caseData.id}</span>
          <h1>{candidate.manufacturer} {candidate.model}</h1>
          <p>{candidate.reason}</p>
        </div>
        <CandidateVerdict candidate={candidate} />
      </header>

      <nav className="candidate-switcher" aria-label="BIM-reviewed candidates">
        {caseData.candidates.map((item) => (
          <button
            className={item.id === candidate.id ? "candidate-switch candidate-switch--active" : "candidate-switch"}
            key={item.id}
            onClick={() => onSelectCandidate(item.id)}
            type="button"
          >
            <span>{item.label}</span>
            <strong>{item.manufacturer} {item.model}</strong>
            <small>{item.criticalClashes} critical clashes</small>
          </button>
        ))}
      </nav>

      <section className="candidate-model-review">
        <div className="candidate-page__model">
          <BimDeltaViewer candidate={candidate} />
        </div>
        <aside className={candidate.criticalClashes ? "candidate-impact candidate-impact--rejected" : "candidate-impact"}>
          <span className="eyebrow">MODEL IMPACT</span>
          <h2>{comparison.title}</h2>
          <p>{comparison.summary}</p>
          <div className="impact-key">
            <span className={candidate.criticalClashes ? "impact-key__swatch impact-key__swatch--red" : "impact-key__swatch"} />
            <span>
              <small>{candidate.criticalClashes ? "Highlighted in red" : "Selected replacement"}</small>
              <strong>{candidate.criticalClashes ? findings[1] : "Coordination-ready placement"}</strong>
            </span>
          </div>
          <dl className="impact-comparison">
            <div><dt>Required change</dt><dd>{comparison.change}</dd></div>
            <div><dt>Critical clashes</dt><dd>{candidate.criticalClashes}</dd></div>
            <div><dt>Installed cost</dt><dd>{formatUsd(candidate.totalInstalledCost)}</dd></div>
            <div><dt>Best option</dt><dd>{bestCandidate.manufacturer} {bestCandidate.model}</dd></div>
          </dl>
          <div className="impact-best">
            <ShieldCheck size={17} />
            <span><small>WHY THE BEST OPTION WINS</small><strong>{comparison.bestAdvantage}</strong></span>
          </div>
        </aside>
      </section>

      <section className="candidate-facts">
        <div>
          <small>Supplier</small>
          <strong>{candidate.supplier}</strong>
          <span>{candidate.quoteReference}</span>
        </div>
        <div>
          <small>Inventory evidence</small>
          <strong>{candidate.inventory}</strong>
          <span>Verified {candidate.verifiedAt} · demo supplier data</span>
        </div>
        <div>
          <small>Ship from / arrival</small>
          <strong>{candidate.shipFrom}</strong>
          <span>{candidate.arrival}</span>
        </div>
        <div>
          <small>Total installed cost</small>
          <strong>{formatUsd(candidate.totalInstalledCost)}</strong>
          <span>+{formatUsd(candidate.costDelta)} from specified product</span>
        </div>
      </section>

      <div className="candidate-analysis-grid">
        <section className="candidate-analysis">
          <div className="candidate-section-heading">
            <span className="eyebrow">TECHNICAL EQUIVALENCE</span>
            <h2>{candidate.requirementsPassed}/{candidate.requirementsTotal} hard requirements</h2>
          </div>
          <div className="requirement-table">
            {requirements.map(([requirement, value, source]) => (
              <div className="requirement-row" key={requirement}>
                <span className="requirement-pass"><Check size={13} /></span>
                <span><small>{requirement}</small><strong>{value}</strong></span>
                <span>{source}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="candidate-analysis candidate-analysis--coordination">
          <div className="candidate-section-heading">
            <span className="eyebrow">COORDINATION VERDICT</span>
            <h2>{candidate.criticalClashes ? "Not installable as submitted" : "Installable with minor work"}</h2>
          </div>
          <div className="coordination-score">
            <div><strong>{candidate.criticalClashes}</strong><span>critical clashes</span></div>
            <div><strong>{candidate.connectorOffsetMm} mm</strong><span>connector adjustment</span></div>
            <div><strong>{candidate.evidenceCoverage}%</strong><span>evidence coverage</span></div>
          </div>
          <ul className="finding-list">
            {findings.map((finding, index) => (
              <li key={finding}>
                {candidate.criticalClashes && index > 0 ? <TriangleAlert size={15} /> : <ShieldCheck size={15} />}
                {finding}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="search-report">
        <header className="search-report__heading">
          <div>
            <span className="eyebrow">CREWAI SOURCING RUN</span>
            <h2>14 alternatives found across the market.</h2>
            <p>Agents searched broadly, verified available evidence, and advanced only three products to the expensive BIM coordination stage.</p>
          </div>
          <div className="search-report__metrics">
            <span><strong>23</strong> source results</span>
            <span><strong>14</strong> products reviewed</span>
            <span><strong>3</strong> BIM coordinated</span>
          </div>
        </header>

        <div className="agent-search-trail">
          {[
            [Search, "Product Scout", "Manufacturer catalogs, distributor portals, approved vendors"],
            [FileCheck2, "Evidence Verifier", "Model numbers, curves, manuals, quotes, timestamps"],
            [Clock3, "Inventory Agent", "Availability, ship-from location, delivery window"],
            [Bot, "Technical Pre-Filter", "31 hard requirements before BIM generation"],
            [ShieldCheck, "Coordination Crew", "Geometry, connectors, clashes, clearance"],
          ].map(([Icon, agent, task]) => {
            const AgentIcon = Icon as typeof Search;
            return (
              <div key={String(agent)}>
                <span><AgentIcon size={16} /></span>
                <strong>{String(agent)}</strong>
                <small>{String(task)}</small>
              </div>
            );
          })}
        </div>

        <div className="discovery-table">
          <div className="discovery-table__head">
            <span>PRODUCT</span><span>DISCOVERY SOURCE</span><span>EVIDENCE</span><span>DELIVERY</span><span>DECISION</span>
          </div>
          {caseData.discoveredAlternatives.map((alternative) => {
            const stage = discoveryStage[alternative.stage];
            return (
              <button
                className={alternative.candidateId === candidate.id ? "discovery-row discovery-row--active" : "discovery-row"}
                disabled={!alternative.candidateId}
                key={alternative.id}
                onClick={() => alternative.candidateId && onSelectCandidate(alternative.candidateId)}
                type="button"
              >
                <span><strong>{alternative.manufacturer}</strong><small>{alternative.model}</small></span>
                <span>{alternative.discoverySource}</span>
                <span>{alternative.evidence}</span>
                <span>{alternative.delivery}</span>
                <span>
                  <em className={`search-stage ${stage.className}`}>{stage.label}</em>
                  <small>{alternative.decision}</small>
                </span>
              </button>
            );
          })}
        </div>
        <p className="search-report__note">Supplier, inventory, quote, and delivery values on this page are fixed demo evidence for the hackathon workflow.</p>
      </section>
    </div>
  );
}
