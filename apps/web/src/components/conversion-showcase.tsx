"use client";

import { ArrowRight, Check, FileScan, Orbit, ScanLine } from "lucide-react";
import Image from "next/image";
import { BimDeltaViewer } from "./bim-delta-viewer";

const conversionSteps = [
  { label: "Drawing parsed", detail: "M-601 · 15 semantic entities", icon: FileScan },
  { label: "Evidence linked", detail: "31 / 31 requirements", icon: ScanLine },
  { label: "BIM generated", detail: "IFC · GLB · PlanGraph", icon: Orbit },
  { label: "Coordination passed", detail: "0 critical clashes", icon: Check },
];

export function ConversionShowcase() {
  return (
    <section className="conversion-proof" aria-label="2D drawing to BIM conversion">
      <div className="conversion-proof__heading">
        <div>
          <span className="eyebrow">SOURCE-TO-MODEL PROOF</span>
          <h2>The drawing became the coordinated model.</h2>
        </div>
        <div className="conversion-proof__status">
          <span />
          Source geometry linked
        </div>
      </div>

      <div className="conversion-visuals">
        <figure className="conversion-frame conversion-frame--drawing">
          <div className="conversion-frame__bar">
            <span>INPUT · M-601</span>
            <strong>Construction drawing</strong>
          </div>
          <Image
            alt="Professional MEP construction drawing for the P-401 and P-402 pump room"
            height={1024}
            priority
            src="/demo/m601-source-drawing.png"
            width={1536}
          />
          <figcaption>
            <span>2 pump trains</span>
            <span>CHWS / CHWR</span>
            <span>Plan + section + elevation</span>
          </figcaption>
        </figure>

        <div className="conversion-arrow" aria-hidden="true">
          <span>BuildCrew BIM Engine</span>
          <div><ArrowRight size={19} /></div>
          <small>2m 18s</small>
        </div>

        <div className="conversion-frame conversion-frame--bim">
          <div className="conversion-frame__bar">
            <span>OUTPUT · REV 37</span>
            <strong>Live generated BIM</strong>
          </div>
          <BimDeltaViewer compact />
          <div className="conversion-live-badge"><span /> Actual GLB · not a rendered image</div>
        </div>
      </div>

      <div className="conversion-steps">
        {conversionSteps.map(({ detail, icon: Icon, label }, index) => (
          <div className="conversion-step" key={label}>
            <span className="conversion-step__number">{index + 1}</span>
            <Icon size={17} />
            <span><strong>{label}</strong><small>{detail}</small></span>
          </div>
        ))}
      </div>
    </section>
  );
}
