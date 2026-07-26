from __future__ import annotations

import asyncio
import json
from pathlib import Path
from shutil import copy2

from buildcrew_bim_mcp.engine import BimEngine
from buildcrew_bim_mcp.schemas import (
    AabbObstacle,
    CandidateInput,
    CoordinationInput,
    PlacementInput,
    TargetConnector,
)


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
EXAMPLE = REPOSITORY_ROOT / "services" / "bim-mcp" / "examples" / "mission-bay-candidate.json"
OUTPUT_ROOT = REPOSITORY_ROOT / "outputs" / "demo"
WEB_DEMO_ROOT = REPOSITORY_ROOT / "apps" / "web" / "public" / "demo"


def candidate_variants() -> list[CandidateInput]:
    source = json.loads(EXAMPLE.read_text(encoding="utf-8"))
    candidate_c = CandidateInput.model_validate(source)

    candidate_a_data = candidate_c.model_dump(mode="json")
    candidate_a_data.update(
        candidate_id="candidate-a",
        manufacturer="KSB",
        model="Etanorm 065-040-250",
    )
    candidate_a_data["verified_geometry"]["width"]["value_mm"] = 1980
    candidate_a_data["verified_geometry"]["connectors"][0]["position_mm"] = [1050, 0, 520]

    candidate_b_data = candidate_c.model_dump(mode="json")
    candidate_b_data.update(
        candidate_id="candidate-b",
        manufacturer="Grundfos",
        model="NB 65-125/142",
    )
    candidate_b_data["verified_geometry"]["width"]["value_mm"] = 1880
    candidate_b_data["verified_geometry"]["clearance_zones"][0]["origin_mm"] = [-2100, -500, 0]

    return [
        CandidateInput.model_validate(candidate_a_data),
        CandidateInput.model_validate(candidate_b_data),
        candidate_c,
    ]


async def main() -> None:
    engine = BimEngine(OUTPUT_ROOT / "mcp_artifacts")
    WEB_DEMO_ROOT.mkdir(parents=True, exist_ok=True)
    summaries: list[dict] = []
    project_output = OUTPUT_ROOT / "BuildCrew_BC-2026-0142" / "project"
    project_result = engine.compile_project_bim(
        REPOSITORY_ROOT / "apps" / "web" / "public" / "demo" / "m601-source-drawing.png",
        project_output,
    )
    for artifact_name in (
        "m601-dajoong-bim.glb",
        "m601-dajoong-bim.ifc",
        "m601-dajoong-scene.json",
        "m601-plan-graph.json",
    ):
        copy2(project_output / artifact_name, WEB_DEMO_ROOT / artifact_name)
    (WEB_DEMO_ROOT / "m601-conversion-result.json").write_text(
        json.dumps(project_result, indent=2),
        encoding="utf-8",
    )

    for candidate in candidate_variants():
        artifacts = await engine.generate_semantic_bim(candidate)
        placement = PlacementInput(
            case_id=candidate.case_id,
            candidate_id=candidate.candidate_id,
            semantic_model_path=artifacts.semantic_model,
            candidate_glb_path=artifacts.glb,
            replace_element_id="P-401-EXISTING",
        )
        placed = engine.place_candidate_in_project(candidate, placement)

        obstacles = []
        if candidate.candidate_id == "candidate-a":
            obstacles = [
                AabbObstacle(
                    obstacle_id="CHWR-24",
                    label="Existing chilled-water return pipe",
                    minimum_mm=(830, -250, 350),
                    maximum_mm=(1240, 250, 860),
                    discipline="Mechanical",
                )
            ]
        elif candidate.candidate_id == "candidate-b":
            obstacles = [
                AabbObstacle(
                    obstacle_id="WALL-C01",
                    label="Concrete shear wall",
                    minimum_mm=(-1650, -800, 0),
                    maximum_mm=(-1450, 800, 2200),
                    discipline="Structural",
                )
            ]

        coordination = engine.run_coordination_check(
            CoordinationInput(
                case_id=candidate.case_id,
                candidate_id=candidate.candidate_id,
                semantic_model_path=artifacts.semantic_model,
                obstacles=obstacles,
                target_connectors=[
                    TargetConnector(
                        connector_id="inlet",
                        position_mm=(915, 0, 520),
                        tolerance_mm=10,
                    )
                ],
            )
        )
        package_root = OUTPUT_ROOT / "BuildCrew_BC-2026-0142" / candidate.candidate_id
        delivery = engine.export_bim_deliverables(
            case_id=candidate.case_id,
            candidate_id=candidate.candidate_id,
            destination=package_root,
        )

        for path in (artifacts.glb, artifacts.ifc, coordination.bcfzip):
            (WEB_DEMO_ROOT / path.name).write_bytes(path.read_bytes())
        coordinated = Path(placed["coordinated_glb"])
        (WEB_DEMO_ROOT / coordinated.name).write_bytes(coordinated.read_bytes())

        summaries.append(
            {
                "candidate_id": candidate.candidate_id,
                "manufacturer": candidate.manufacturer,
                "model": candidate.model,
                "verdict": coordination.verdict,
                "critical_clashes": coordination.critical_clashes,
                "clearance_violations": coordination.clearance_violations,
                "connector_offsets": coordination.connector_offsets,
                "delivery_manifest": delivery["manifest"],
            }
        )

    summary_path = OUTPUT_ROOT / "BuildCrew_BC-2026-0142" / "candidate-comparison.json"
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps(summaries, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                "candidate_summary": str(summary_path),
                "project_bim": project_result,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    asyncio.run(main())
