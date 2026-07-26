import { ArrowRight, Building2, Check, Clock3, FolderKanban, MapPin } from "lucide-react";
import { BimDeltaViewer } from "./bim-delta-viewer";

type ProjectsViewProps = {
  onOpenCase: () => void;
  onOpenCandidate: () => void;
};

const projects = [
  {
    id: "MB-DC",
    name: "Mission Bay Data Center",
    location: "San Francisco, CA",
    cases: 4,
    resolved: 3,
    status: "1 approval waiting",
  },
  {
    id: "SJC-05",
    name: "San Jose Clinical Expansion",
    location: "San Jose, CA",
    cases: 7,
    resolved: 7,
    status: "All cases resolved",
  },
  {
    id: "OAK-L2",
    name: "Oakland Logistics Hub",
    location: "Oakland, CA",
    cases: 2,
    resolved: 1,
    status: "Collecting evidence",
  },
];

export function ProjectsView({ onOpenCase, onOpenCandidate }: ProjectsViewProps) {
  return (
    <div className="section-view">
      <header className="section-view__hero">
        <div>
          <span className="eyebrow">PROJECT PORTFOLIO</span>
          <h1>Projects</h1>
          <p>Every disruption, source document, BIM revision, and approval in one place.</p>
        </div>
        <button className="new-case-button section-view__action" onClick={onOpenCase} type="button">
          Open Mission Bay case <ArrowRight size={17} />
        </button>
      </header>

      <div className="portfolio-metrics">
        <div><strong>3</strong><span>active projects</span></div>
        <div><strong>13</strong><span>substitution cases</span></div>
        <div><strong>11</strong><span>resolved without delay</span></div>
        <div><strong>5.2 days</strong><span>average work removed</span></div>
      </div>

      <section className="project-feature">
        <div className="project-feature__image">
          <BimDeltaViewer compact />
          <span>LIVE PROJECT</span>
        </div>
        <div className="project-feature__copy">
          <span className="project-code">{projects[0].id}</span>
          <h2>{projects[0].name}</h2>
          <p><MapPin size={14} /> {projects[0].location}</p>
          <div className="project-feature__status">
            <span><Clock3 size={16} /> P-401 awaiting internal approval</span>
            <span><Check size={16} /> 3 prior cases resolved</span>
          </div>
          <button className="text-link" onClick={onOpenCandidate} type="button">
            Review coordinated replacement <ArrowRight size={16} />
          </button>
        </div>
      </section>

      <div className="project-list-heading">
        <span>PROJECT</span><span>CASES</span><span>RESOLVED</span><span>STATUS</span>
      </div>
      <div className="project-list">
        {projects.slice(1).map((project) => (
          <button className="project-list__row" key={project.id} type="button">
            <span className="project-list__identity">
              <span className="project-list__icon"><Building2 size={18} /></span>
              <span><strong>{project.name}</strong><small>{project.id} · {project.location}</small></span>
            </span>
            <strong>{project.cases}</strong>
            <strong>{project.resolved}</strong>
            <span>{project.status}</span>
            <ArrowRight size={16} />
          </button>
        ))}
      </div>

      <div className="portfolio-footnote">
        <FolderKanban size={17} />
        Project data remains isolated by Firebase owner and CrewAI case state.
      </div>
    </div>
  );
}
