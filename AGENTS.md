# BuildCrew engineering rules

## Product

BuildCrew turns a delayed construction-equipment order into an evidence-backed,
install-ready BIM replacement.

## Repository

- `apps/web`: Next.js Firebase web application.
- `functions`: Firebase Functions for CrewAI callbacks and approval transitions.
- `services/bim-mcp`: MCP server that wraps the Dajoong Spatial Compiler and
  produces BIM coordination artifacts.
- `demo-assets`: Google Drive-ready demo documents, quotes, and drawings.

## Architecture

- Keep CrewAI outside this repository. This repository exposes the BIM MCP and
  the Firebase product surface that CrewAI calls.
- Reuse the Dajoong Spatial Compiler through an adapter. Do not copy or fork its
  learned perception code.
- Learned perception may propose spatial entities. Deterministic geometry,
  evidence validation, clash checks, cost calculations, and state transitions
  make operational decisions.
- Never present bootstrap or candidate-model output as production accuracy.
- Never infer installation-critical dimensions. Missing connector, mounting,
  envelope, or maintenance-clearance evidence must produce
  `review_required`.
- Every generated BIM property must retain source file, page, region when
  available, source hash, confidence, and review state.
- Final purchase, inventory reservation, and permanent model updates require
  explicit approval.

## Frontend

- Follow Toss Frontend Fundamentals: readability, predictability, cohesion, and
  controlled coupling.
- Keep feature logic close to its feature; keep Firebase and Three.js adapters
  behind narrow modules.
- Prefer semantic HTML, explicit loading/error/empty states, and accessible
  touch targets.
- Desktop uses the Buili green visual language. Mobile uses a Toss-like reading
  hierarchy, bottom navigation, full-width actions, and progressive disclosure.
- Avoid decorative card grids. Use whitespace, rails, dividers, and the BIM
  canvas as the primary structure.

## Required checks

1. `pnpm --dir apps/web lint`
2. `pnpm --dir apps/web build`
3. `pnpm --dir functions build`
4. `services\bim-mcp\.venv\Scripts\python -m pytest services\bim-mcp\tests -q`
5. Inspect `git diff --check` and ensure no secrets are committed.

