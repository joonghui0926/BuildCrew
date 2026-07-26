import {
  Bot,
  Check,
  Database,
  FileSearch,
  Globe2,
  Mail,
  Search,
  Wrench,
} from "lucide-react";

const agents = [
  ["Specification Engineer", "31 requirements extracted", "complete"],
  ["Product Scout", "14 manufacturer models reviewed", "complete"],
  ["Inventory Verifier", "3 supplier sources confirmed", "complete"],
  ["BIM Equipment Engineer", "3 candidate BIM objects generated", "complete"],
  ["Coordination Auditor", "2 candidates rejected", "complete"],
  ["Package Compiler", "8 approval assets assembled", "active"],
];

const trace = [
  { time: "10:42:01", agent: "Specification Engineer", icon: FileSearch, action: "Opened M-601 and specification 23 21 23", result: "42 relevant regions" },
  { time: "10:42:08", agent: "Product Scout", icon: Search, action: "Searched approved pump equivalents · 420 gpm · 60 ft head", result: "14 products" },
  { time: "10:42:16", agent: "Product Scout", icon: Globe2, action: "Read manufacturer catalogs and product data", result: "5 viable" },
  { time: "10:42:28", agent: "Inventory Verifier", icon: Mail, action: "Matched quote 7614 to exact Armstrong SKU", result: "2 units verified" },
  { time: "10:43:03", agent: "BIM Equipment Engineer", icon: Wrench, action: "Called generate_semantic_bim for candidates A, B, C", result: "3 IFC + GLB" },
  { time: "10:44:19", agent: "Coordination Auditor", icon: Database, action: "Ran connector, clash, and maintenance-volume checks", result: "Candidate C passes" },
];

export function AgentActivityView() {
  return (
    <div className="section-view agent-activity">
      <header className="section-view__hero">
        <div>
          <span className="eyebrow">CREWAI EXECUTION · BC-2026-0142</span>
          <h1>Agent activity</h1>
          <p>See what each agent searched, opened, verified, generated, and rejected.</p>
        </div>
        <div className="run-status"><span /><strong>Flow running</strong><small>Package compiler · 82%</small></div>
      </header>

      <section className="agent-map">
        {agents.map(([name, detail, state], index) => (
          <div className={`agent-node agent-node--${state}`} key={name}>
            <span className="agent-node__icon"><Bot size={18} /></span>
            <span><small>AGENT {index + 1}</small><strong>{name}</strong><em>{detail}</em></span>
            <span className="agent-node__state">{state === "complete" ? <Check size={14} /> : "82%"}</span>
          </div>
        ))}
      </section>

      <div className="agent-workspace">
        <section className="trace-stream">
          <div className="trace-stream__heading">
            <div><span className="eyebrow">LIVE TRACE</span><h2>Research and tool calls</h2></div>
            <span>6.2k tokens · $0.41</span>
          </div>
          {trace.map(({ action, agent, icon: Icon, result, time }) => (
            <div className="trace-event" key={time}>
              <time>{time}</time>
              <span className="trace-event__icon"><Icon size={16} /></span>
              <span><strong>{agent}</strong><p>{action}</p></span>
              <em>{result}</em>
            </div>
          ))}
        </section>

        <aside className="agent-evidence">
          <span className="eyebrow">EVIDENCE FOUND</span>
          <h2>Claims added to state</h2>
          <div><span>A</span><p><strong>420 gpm design flow</strong><small>M-601 · P-401 row</small></p></div>
          <div><span>A</span><p><strong>915 mm motor clearance</strong><small>Installation manual · p.18</small></p></div>
          <div><span>B</span><p><strong>2 units available</strong><small>Quote 7614 · 09:42 PDT</small></p></div>
          <div className="agent-evidence__decision">
            <Check size={17} /><p><strong>Candidate C survives</strong><small>0 critical clashes · 25 mm spool</small></p>
          </div>
        </aside>
      </div>
    </div>
  );
}
