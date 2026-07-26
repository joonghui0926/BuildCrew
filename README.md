# BuildCrew

**Turn supplier delays into install-ready BIM replacements.**

BuildCrew is the product surface around a CrewAI procurement and substitution
flow. CrewAI investigates alternatives and manages approvals. This repository
provides the two systems outside CrewAI:

1. a Firebase web app for case intake, live progress, 3D coordination, approval,
   and deliverables;
2. a production-shaped MCP server that adapts the Dajoong Spatial Compiler into
   semantic BIM generation, placement, clash/clearance analysis, and IFC/GLB/BCF
   export.

## Repository layout

```text
apps/web           Next.js 16 static Firebase web app
functions          Firebase Functions v2 callbacks and approvals
services/bim-mcp   Python MCP server and deterministic BIM engine
outputs/demo       Drive-ready BIM, approval, quote, and evidence artifacts
scripts/demo       Reproducible BIM and approval-package generators
```

## Local setup

```powershell
pnpm install
pnpm --dir apps/web dev

cd services\bim-mcp
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install -e ".[dev]"
.\.venv\Scripts\python -m buildcrew_bim_mcp.server
```

The MCP endpoint uses Streamable HTTP at `http://127.0.0.1:8765/mcp` by
default. For direct Dajoong inference, set `DAJOONG_SPATIAL_API_URL` and
`DAJOONG_SPATIAL_API_KEY`. Without an approved Dajoong production checkpoint,
the server still generates deterministic BIM from verified dimensional inputs
and marks learned-perception claims as review-required.

The service exposes:

```text
compile_project_bim
generate_semantic_bim
place_candidate_in_project
run_coordination_check
export_bim_deliverables
```

Its guaranteed deliverables are IFC, GLB, BCF, semantic properties, source
maps, and confidence reports. Native RFA/RVT export is intentionally not
claimed until an Autodesk APS/Revit Automation exporter is connected.

### Actual 2D-to-BIM demo path

The checked M-601 demo is not a rendered BIM image. It runs through two isolated
runtimes:

```text
M-601 construction drawing
→ Dajoong Spatial Compiler runtime
→ reviewed SpatialSceneGraph + Buili PlanGraph v2
→ BuildCrew deterministic mechanical-room compiler
→ 618-component GLB + semantic IFC4
→ Three.js interactive coordination viewer
```

The Dajoong checkpoint is still marked `candidate`. Installation-critical
coordinates are therefore accepted only after dimensioned-drawing review and
carry the source image SHA-256 into the SceneGraph and IFC property set. Set
`DAJOONG_COMPILER_ROOT` and, when needed, `DAJOONG_PYTHON` to use another local
compiler checkout/runtime.

## Firebase

The web app is configured for project `build-crew`. Public Firebase SDK config
is committed intentionally; privileged tokens belong only in Firebase secrets.
Enable Google as a Firebase Authentication provider before using the sign-in
and secure case-upload flow.

```powershell
firebase use build-crew
pnpm build
firebase deploy
```

Required Functions secrets:

```text
CREWAI_AUTOMATION_URL
CREWAI_AUTOMATION_TOKEN
CREWAI_CALLBACK_SECRET
```

If CrewAI secrets are absent, `startBuildCrewCase` creates the production-shaped
case state but does not impersonate a successful CrewAI run.

## Demo artifacts

Generate the source-traceable three-candidate coordination package:

```powershell
.\services\bim-mcp\.venv\Scripts\python services\bim-mcp\scripts\generate_demo.py
python scripts\demo\generate_demo_documents.py
node scripts\demo\generate_quote_workbook.mjs
```

The checked demo is `BC-2026-0142`: Candidate A fails a pipe clash, Candidate B
fails motor-removal clearance, and Candidate C is installable with a documented
25 mm spool adjustment.
