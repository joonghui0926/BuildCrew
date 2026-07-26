from __future__ import annotations

import os
from pathlib import Path

from mcp.server.fastmcp import FastMCP

from .engine import BimEngine
from .schemas import CandidateInput, CoordinationInput, PlacementInput

mcp = FastMCP(
    "BuildCrew BIM Engine",
    instructions=(
        "Generate source-traceable coordination BIM only from verified dimensional evidence. "
        "Never infer installation-critical geometry."
    ),
    stateless_http=True,
    json_response=True,
    host=os.getenv("BUILDCREW_MCP_HOST", "127.0.0.1"),
    port=int(os.getenv("BUILDCREW_MCP_PORT", "8765")),
)
engine = BimEngine()


@mcp.tool()
def compile_project_bim(drawing_path: str, destination: str) -> dict:
    """Compile a construction drawing through Dajoong into semantic IFC and detailed GLB."""
    return engine.compile_project_bim(
        drawing_path=Path(drawing_path).resolve(),
        destination=Path(destination).resolve(),
    )


@mcp.tool()
async def generate_semantic_bim(candidate: CandidateInput) -> dict:
    """Generate verified semantic BIM artifacts from manufacturer evidence."""
    result = await engine.generate_semantic_bim(candidate)
    return result.model_dump(mode="json")


@mcp.tool()
def place_candidate_in_project(candidate: CandidateInput, placement: PlacementInput) -> dict:
    """Create a non-destructive coordinated project preview for a candidate."""
    return engine.place_candidate_in_project(candidate, placement)


@mcp.tool()
def run_coordination_check(coordination: CoordinationInput) -> dict:
    """Check hard clashes, clearance zones, and connector offsets deterministically."""
    return engine.run_coordination_check(coordination).model_dump(mode="json")


@mcp.tool()
def export_bim_deliverables(case_id: str, candidate_id: str, destination: str) -> dict:
    """Compile IFC, GLB, BCF, source maps, and reports into a delivery directory."""
    return engine.export_bim_deliverables(
        case_id=case_id,
        candidate_id=candidate_id,
        destination=Path(destination).resolve(),
    )


def main() -> None:
    mcp.run(transport="streamable-http")


if __name__ == "__main__":
    main()
