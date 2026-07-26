import { Check, FileSpreadsheet, FileText, Search, ShieldCheck } from "lucide-react";
import Image from "next/image";

const evidenceRows = [
  ["Design flow", "420 gpm", "M-601 · equipment schedule", "A", "100%"],
  ["Suction connection", "4 in FLG", "Armstrong submittal · sheet 6", "A", "99%"],
  ["Motor removal clearance", "915 mm", "Installation manual · page 18", "A", "98%"],
  ["Available inventory", "2 units", "Pacific Pump · quote 7614", "B", "100%"],
  ["Earliest delivery", "Aug 19", "Distributor confirmation · 09:42 PDT", "B", "100%"],
];

export function EvidenceLibraryView() {
  return (
    <div className="section-view evidence-library">
      <header className="section-view__hero">
        <div>
          <span className="eyebrow">TRACEABLE ENGINEERING</span>
          <h1>Evidence library</h1>
          <p>Every extracted value remains connected to its drawing, sheet, region, and verifier.</p>
        </div>
        <div className="evidence-search"><Search size={17} /><span>Search 126 evidence items</span></div>
      </header>

      <div className="evidence-library__metrics">
        <div><strong>126</strong><span>claims</span></div>
        <div><strong>118</strong><span>grade A</span></div>
        <div><strong>8</strong><span>grade B</span></div>
        <div className="evidence-library__verified"><ShieldCheck size={18} /><strong>100%</strong><span>critical coverage</span></div>
      </div>

      <div className="evidence-workbench">
        <section className="source-document">
          <div className="source-document__heading">
            <span><FileText size={17} /> M-601_Pump_Room.pdf</span>
            <strong>Source drawing</strong>
          </div>
          <div className="source-document__canvas">
            <Image
              alt="M-601 source construction drawing"
              height={1024}
              src="/demo/m601-source-drawing.png"
              width={1536}
            />
            <span className="source-hotspot source-hotspot--one">P-401</span>
            <span className="source-hotspot source-hotspot--two">915 mm</span>
          </div>
          <div className="source-document__foot">
            <span>Sheet M-601</span><span>Rev 12</span><span>Verified 10:41 PDT</span>
          </div>
        </section>

        <section className="evidence-register">
          <div className="evidence-register__heading">
            <div><span className="eyebrow">P-401</span><h2>Requirement register</h2></div>
            <span className="evidence-register__pass"><Check size={15} /> 31 / 31 linked</span>
          </div>
          <div className="evidence-table">
            {evidenceRows.map(([claim, value, source, grade, confidence]) => (
              <div className="evidence-table__row" key={claim}>
                <span className={`evidence-grade evidence-grade--${grade.toLowerCase()}`}>{grade}</span>
                <span><small>{claim}</small><strong>{value}</strong></span>
                <span className="evidence-table__source">{source}</span>
                <strong>{confidence}</strong>
              </div>
            ))}
          </div>
          <button className="evidence-export" type="button">
            <FileSpreadsheet size={16} /> Open complete evidence ledger
          </button>
        </section>
      </div>
    </div>
  );
}
