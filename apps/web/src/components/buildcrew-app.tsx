"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  ArrowDownToLine,
  ArrowRight,
  Bell,
  Bot,
  Box,
  Check,
  ChevronRight,
  CircleCheck,
  Clock3,
  FileCheck2,
  FolderOpen,
  Gauge,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { BrandLogo } from "./brand-logo";
import { BimDeltaViewer } from "./bim-delta-viewer";
import { ConversionShowcase } from "./conversion-showcase";
import { ProjectsView } from "./projects-view";
import { EvidenceLibraryView } from "./evidence-library-view";
import { AgentActivityView } from "./agent-activity-view";
import { CandidateDetailView } from "./candidate-detail-view";
import { createAndStartCase } from "@/features/cases/firebase-case";
import { missionBayCase } from "@/features/cases/demo-case";
import type { Candidate } from "@/features/cases/types";
import { firebaseAuth } from "@/lib/firebase/client";
import { formatUsd } from "@/lib/format";

type WorkspaceTab = "coordination" | "evidence" | "deliverables";
type AppView = "case" | "candidate" | "projects" | "evidence" | "agents";

function CandidateRow({
  candidate,
  selected,
  onSelect,
}: {
  candidate: Candidate;
  selected: boolean;
  onSelect: () => void;
}) {
  const fitsProject = candidate.status === "recommended";
  const rowClasses = [
    "candidate-row",
    selected ? "candidate-row--selected" : "",
    fitsProject ? "candidate-row--fit" : "candidate-row--reject",
  ].filter(Boolean).join(" ");

  return (
    <button
      className={rowClasses}
      onClick={onSelect}
      type="button"
    >
      <span className={`candidate-state candidate-state--${candidate.status}`}>
        {candidate.status === "recommended" ? <Check size={14} /> : <X size={14} />}
      </span>
      <span className="candidate-copy">
        <span>{candidate.label}</span>
        <strong>{candidate.manufacturer} · {candidate.model}</strong>
        <em>{fitsProject ? "FITS PROJECT" : "DOES NOT FIT"}</em>
      </span>
      <span className="candidate-score">
        <strong>{candidate.criticalClashes}</strong>
        <small>critical</small>
      </span>
      <ChevronRight size={17} aria-hidden="true" />
    </button>
  );
}

export function BuildCrewApp() {
  const [activeView, setActiveView] = useState<AppView>("case");
  const [selectedCandidateId, setSelectedCandidateId] = useState(missionBayCase.selectedCandidateId);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("coordination");
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [showNewCase, setShowNewCase] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [delayEmail, setDelayEmail] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const fileInputReference = useRef<HTMLInputElement>(null);
  const selectedCandidate = useMemo(
    () => missionBayCase.candidates.find((item) => item.id === selectedCandidateId) ?? missionBayCase.candidates[2],
    [selectedCandidateId],
  );

  useEffect(() => onAuthStateChanged(firebaseAuth, setUser), []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeView]);

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3200);
  };

  const authenticate = async () => {
    if (firebaseAuth.currentUser) return firebaseAuth.currentUser;
    const credential = await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
    return credential.user;
  };

  const handleAccount = async () => {
    try {
      if (user) {
        await signOut(firebaseAuth);
        notify("Signed out.");
        return;
      }
      await authenticate();
      notify("Signed in with Google.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Google sign-in failed.");
    }
  };

  const handleCreateCase = async () => {
    if (!delayEmail.trim()) {
      notify("Paste the supplier delay email first.");
      return;
    }
    setIsCreating(true);
    try {
      const authenticatedUser = await authenticate();
      const result = await createAndStartCase({
        delayEmail: delayEmail.trim(),
        files: selectedFiles,
        user: authenticatedUser,
      });
      setShowNewCase(false);
      setDelayEmail("");
      setSelectedFiles([]);
      notify(
        result.crewAiConnected
          ? `${result.caseId} started in CrewAI.`
          : `${result.caseId} is queued. Connect CrewAI secrets to continue.`,
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "The case could not be created.");
    } finally {
      setIsCreating(false);
    }
  };

  const initials =
    user?.displayName
      ?.split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "JH";

  const openView = (view: AppView) => {
    setActiveView(view);
    setSidebarOpen(false);
  };

  const openCandidate = (candidateId: string) => {
    setSelectedCandidateId(candidateId);
    openView("candidate");
  };

  return (
    <div className="app-shell">
      <header className="mobile-header">
        <button className="icon-button" onClick={() => setSidebarOpen(true)} type="button" aria-label="Open navigation">
          <Menu size={22} />
        </button>
        <BrandLogo />
        <button className="icon-button" type="button" aria-label="Notifications">
          <Bell size={20} />
        </button>
      </header>

      <aside className={isSidebarOpen ? "sidebar sidebar--open" : "sidebar"}>
        <div className="sidebar__top">
          <BrandLogo />
          <button className="sidebar__close icon-button" onClick={() => setSidebarOpen(false)} type="button">
            <X size={20} />
          </button>
        </div>
        <button className="new-case-button" onClick={() => setShowNewCase(true)} type="button">
          <Plus size={18} />
          New disruption case
        </button>
        <nav className="primary-nav" aria-label="Primary navigation">
          <button className={activeView === "case" || activeView === "candidate" ? "nav-link nav-link--active" : "nav-link"} onClick={() => openView("case")} type="button"><Gauge size={18} />Active cases</button>
          <button className={activeView === "projects" ? "nav-link nav-link--active" : "nav-link"} onClick={() => openView("projects")} type="button"><FolderOpen size={18} />Projects</button>
          <button className={activeView === "evidence" ? "nav-link nav-link--active" : "nav-link"} onClick={() => openView("evidence")} type="button"><FileCheck2 size={18} />Evidence library</button>
          <button className={activeView === "agents" ? "nav-link nav-link--active" : "nav-link"} onClick={() => openView("agents")} type="button"><Bot size={18} />Agent activity</button>
        </nav>
        <div className="sidebar__section">
          <span className="sidebar__label">OPEN CASES</span>
          <button className="case-link case-link--active" onClick={() => openView("case")} type="button">
            <span className="case-link__marker" />
            <span>
              <strong>{missionBayCase.equipmentTag} · Pump delay</strong>
              <small>Awaiting your approval</small>
            </span>
          </button>
          <button className="case-link" type="button">
            <span className="case-link__marker case-link__marker--amber" />
            <span>
              <strong>AHU-12 · Backorder</strong>
              <small>Collecting evidence</small>
            </span>
          </button>
        </div>
        <button className="sidebar__account" onClick={handleAccount} type="button">
          <span className="avatar">{initials}</span>
          <span>
            <strong>{user?.displayName ?? "Connect Google account"}</strong>
            <small>{user?.email ?? "Firebase Authentication"}</small>
          </span>
          <ChevronRight size={16} />
        </button>
      </aside>
      {isSidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}

      <main className="workspace" id="workspace">
        <div className="workspace__topbar">
          <div className="search-field">
            <Search size={17} />
            <span>Search cases, equipment, evidence</span>
          </div>
          <div className="top-actions">
            <button className="icon-button" type="button"><Bell size={19} /></button>
            <button className="text-button" type="button">Help</button>
          </div>
        </div>

        {activeView === "case" ? (
          <>
        <section className="case-hero">
          <div>
            <div className="case-breadcrumb">
              Active cases <ChevronRight size={14} /> {missionBayCase.id}
            </div>
            <h1>{missionBayCase.equipmentTag} · {missionBayCase.equipmentName}</h1>
            <p>{missionBayCase.project} · Required on site {missionBayCase.requiredOnSite}</p>
          </div>
          <div className="case-hero__risk">
            <span>{missionBayCase.delayDays}</span>
            <small>days of delay avoided</small>
          </div>
        </section>

        <section className="pipeline" aria-label="BuildCrew case stages">
          {missionBayCase.pipeline.map((stage, index) => (
            <div className={`pipeline-stage pipeline-stage--${stage.state}`} key={stage.id}>
              <div className="pipeline-stage__track">
                <span>{stage.state === "done" ? <Check size={13} /> : index + 1}</span>
              </div>
              <strong>{stage.label}</strong>
              <small>{stage.detail}</small>
            </div>
          ))}
        </section>

        <ConversionShowcase />

        <div className="workspace-grid">
          <div className="model-area">
            <BimDeltaViewer candidate={selectedCandidate} />
            <div className="workspace-tabs" role="tablist">
              <button className={activeTab === "coordination" ? "workspace-tab workspace-tab--active" : "workspace-tab"} onClick={() => setActiveTab("coordination")} type="button">Coordination</button>
              <button className={activeTab === "evidence" ? "workspace-tab workspace-tab--active" : "workspace-tab"} onClick={() => setActiveTab("evidence")} type="button">Evidence <span>31</span></button>
              <button className={activeTab === "deliverables" ? "workspace-tab workspace-tab--active" : "workspace-tab"} onClick={() => setActiveTab("deliverables")} type="button">Deliverables <span>8</span></button>
            </div>

            {activeTab === "coordination" && (
              <section className="detail-strip">
                <div className="detail-metric">
                  <span className="metric-icon metric-icon--green"><CircleCheck size={18} /></span>
                  <span><small>Hard requirements</small><strong>{selectedCandidate.requirementsPassed} / {selectedCandidate.requirementsTotal}</strong></span>
                </div>
                <div className="detail-metric">
                  <span className={selectedCandidate.criticalClashes ? "metric-icon metric-icon--red" : "metric-icon metric-icon--green"}><TriangleAlert size={18} /></span>
                  <span><small>Critical clashes</small><strong>{selectedCandidate.criticalClashes}</strong></span>
                </div>
                <div className="detail-metric">
                  <span className="metric-icon metric-icon--amber"><ArrowRight size={18} /></span>
                  <span><small>Pipe modification</small><strong>{selectedCandidate.connectorOffsetMm} mm</strong></span>
                </div>
                <div className="detail-note">
                  <strong>Change impact</strong>
                  <p>{selectedCandidate.reason}</p>
                </div>
              </section>
            )}

            {activeTab === "evidence" && (
              <section className="evidence-list" id="evidence">
                {missionBayCase.evidence.map((item) => (
                  <div className="evidence-row" key={item.id}>
                    <span className={`evidence-grade evidence-grade--${item.grade.toLowerCase()}`}>{item.grade}</span>
                    <span><small>{item.claim}</small><strong>{item.value}</strong></span>
                    <span className="evidence-source">{item.source}</span>
                    <span>{Math.round(item.confidence * 100)}%</span>
                  </div>
                ))}
              </section>
            )}

            {activeTab === "deliverables" && (
              <section className="deliverable-list" id="deliverables">
                {["P-401_Armstrong_Replacement.ifc", "P-401_Armstrong_Replacement.glb", "P-401_Coordination.bcfzip", "Substitution_Request_SR-081.pdf"].map((file, index) => (
                  <button className="deliverable-row" key={file} type="button" onClick={() => notify("Demo package is ready in the repository output folder.")}>
                    <span className="file-kind">{file.split(".").pop()?.toUpperCase()}</span>
                    <span><strong>{file}</strong><small>{index < 2 ? "BIM model · source-traceable" : "Approval package"}</small></span>
                    <ArrowDownToLine size={18} />
                  </button>
                ))}
              </section>
            )}
          </div>

          <aside className="decision-rail">
            <div className="decision-rail__heading">
              <span className="eyebrow">CANDIDATE REVIEW</span>
              <h2>One replacement fits.</h2>
              <p>Agents reviewed 14 alternatives. Three passed technical screening; one survives BIM coordination.</p>
            </div>

            <div className="candidate-stack">
              {missionBayCase.candidates.map((candidate) => (
                <CandidateRow
                  candidate={candidate}
                  key={candidate.id}
                  selected={candidate.id === selectedCandidateId}
                  onSelect={() => openCandidate(candidate.id)}
                />
              ))}
            </div>

            <div className="decision-summary">
              <div className="decision-summary__title">
                <span className="metric-icon metric-icon--green"><ShieldCheck size={19} /></span>
                <span><small>Recommended</small><strong>{selectedCandidate.manufacturer} {selectedCandidate.model}</strong></span>
              </div>
              <dl>
                <div><dt>Arrival</dt><dd>{selectedCandidate.arrival}</dd></div>
                <div><dt>Total installed cost</dt><dd>{formatUsd(selectedCandidate.totalInstalledCost)}</dd></div>
                <div><dt>Cost delta</dt><dd>+{formatUsd(selectedCandidate.costDelta)}</dd></div>
                <div><dt>Schedule impact</dt><dd className="positive">{selectedCandidate.scheduleImpactDays} days</dd></div>
                <div><dt>Evidence coverage</dt><dd>{selectedCandidate.evidenceCoverage}%</dd></div>
              </dl>
            </div>

            <div className="approval-callout">
              <Clock3 size={18} />
              <span><strong>Gate A · Internal submission</strong><small>Approval sends the package for engineering review. It does not issue a purchase order.</small></span>
            </div>
            <button className="approve-button" onClick={() => notify("Internal submission approved in demo mode.")} type="button">
              Approve for submission <ArrowRight size={18} />
            </button>
            <button className="secondary-button" onClick={() => notify("Revision request opened.")} type="button">
              Request revision
            </button>
          </aside>
        </div>
          </>
        ) : activeView === "candidate" ? (
          <CandidateDetailView
            candidate={selectedCandidate}
            caseData={missionBayCase}
            onBack={() => openView("case")}
            onSelectCandidate={setSelectedCandidateId}
          />
        ) : activeView === "projects" ? (
          <ProjectsView
            onOpenCandidate={() => openCandidate(missionBayCase.selectedCandidateId)}
            onOpenCase={() => openView("case")}
          />
        ) : activeView === "evidence" ? (
          <EvidenceLibraryView />
        ) : (
          <AgentActivityView />
        )}
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button className={activeView === "case" || activeView === "candidate" ? "mobile-nav__active" : ""} onClick={() => openView("case")} type="button"><Gauge size={20} /><span>Case</span></button>
        <button className={activeView === "projects" ? "mobile-nav__active" : ""} onClick={() => openView("projects")} type="button"><Box size={20} /><span>Projects</span></button>
        <button className={activeView === "evidence" ? "mobile-nav__active" : ""} onClick={() => openView("evidence")} type="button"><FileCheck2 size={20} /><span>Evidence</span></button>
        <button className={activeView === "agents" ? "mobile-nav__active" : ""} onClick={() => openView("agents")} type="button"><Bot size={20} /><span>Agents</span></button>
      </nav>

      {showNewCase && (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="new-case-title">
          <button className="modal-scrim" onClick={() => setShowNewCase(false)} aria-label="Close new case" />
          <section className="new-case-sheet">
            <button className="new-case-sheet__close icon-button" onClick={() => setShowNewCase(false)} type="button"><X size={20} /></button>
            <span className="eyebrow">NEW DISRUPTION</span>
            <h2 id="new-case-title">What was delayed?</h2>
            <p>Start with the supplier email. BuildCrew will identify the project and request only missing evidence.</p>
            <label className="field-label" htmlFor="delay-email">Supplier delay email</label>
            <textarea
              id="delay-email"
              onChange={(event) => setDelayEmail(event.target.value)}
              placeholder="Paste the supplier delay email here…"
              rows={7}
              value={delayEmail}
            />
            <input
              accept=".pdf,.ifc,.dwg,.dxf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              className="visually-hidden"
              multiple
              onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))}
              ref={fileInputReference}
              type="file"
            />
            <button
              className="drop-zone"
              onClick={() => fileInputReference.current?.click()}
              type="button"
            >
              <Plus size={20} />
              <span>
                <strong>
                  {selectedFiles.length
                    ? `${selectedFiles.length} project file${selectedFiles.length === 1 ? "" : "s"} selected`
                    : "Add project files"}
                </strong>
                <small>Specification, drawings, IFC, original submittal</small>
              </span>
            </button>
            <button
              className="approve-button"
              disabled={isCreating}
              onClick={handleCreateCase}
              type="button"
            >
              {isCreating ? "Creating secure case…" : "Create case"} <ArrowRight size={18} />
            </button>
          </section>
        </div>
      )}

      {notice && <div className="toast"><CircleCheck size={18} />{notice}</div>}
    </div>
  );
}
