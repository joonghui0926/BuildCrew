from __future__ import annotations

from hashlib import sha256
from pathlib import Path

import pytest
import trimesh
from pydantic import ValidationError

from buildcrew_bim_mcp.engine import BimEngine
from buildcrew_bim_mcp.mechanical_room import MechanicalRoomScene, export_m601_dajoong_bim, export_m601_ifc
from buildcrew_bim_mcp.schemas import (
    AabbObstacle,
    CandidateInput,
    ClearanceZone,
    ConnectorSpec,
    CoordinationInput,
    DimensionValue,
    EvidenceRef,
    TargetConnector,
    VerifiedGeometry,
)


def evidence(source_id: str, *, confidence: float = 0.99, grade: str = "A") -> EvidenceRef:
    return EvidenceRef(
        source_id=source_id,
        document_name="Armstrong_Submittal.pdf",
        page_or_sheet="6",
        source_hash=sha256(source_id.encode()).hexdigest(),
        confidence=confidence,
        grade=grade,
    )


def dimension(source_id: str, value: float) -> DimensionValue:
    return DimensionValue(value_mm=value, evidence=evidence(source_id))


def candidate() -> CandidateInput:
    return CandidateInput(
        case_id="BC-2026-0142",
        candidate_id="candidate-c",
        manufacturer="Armstrong",
        model="4030 4x3x10",
        equipment_tag="P-401",
        verified_geometry=VerifiedGeometry(
            width=dimension("width", 1780),
            depth=dimension("depth", 760),
            height=dimension("height", 980),
            base_length=dimension("base-length", 1840),
            base_width=dimension("base-width", 780),
            connectors=[
                ConnectorSpec(
                    connector_id="inlet",
                    system="hydronic_return",
                    diameter_mm=dimension("inlet-diameter", 100),
                    position_mm=(890, 0, 520),
                    direction=(1, 0, 0),
                ),
                ConnectorSpec(
                    connector_id="outlet",
                    system="hydronic_supply",
                    diameter_mm=dimension("outlet-diameter", 80),
                    position_mm=(440, 0, 980),
                    direction=(0, 0, 1),
                ),
            ],
            clearance_zones=[
                ClearanceZone(
                    zone_id="motor-removal",
                    purpose="motor removal",
                    size_mm=(915, 1000, 1200),
                    origin_mm=(-1780, -500, 0),
                    evidence=evidence("clearance"),
                )
            ],
        ),
    )


@pytest.mark.asyncio
async def test_generate_semantic_bim_exports_industrial_files(tmp_path: Path):
    engine = BimEngine(tmp_path)
    result = await engine.generate_semantic_bim(candidate())

    assert result.glb.read_bytes()[:4] == b"glTF"
    assert "IFCPUMP" in result.ifc.read_text(encoding="utf-8")
    assert result.source_map.exists()
    assert result.confidence_report.exists()


@pytest.mark.asyncio
async def test_coordination_reports_connector_modification(tmp_path: Path):
    engine = BimEngine(tmp_path)
    generated = await engine.generate_semantic_bim(candidate())
    result = engine.run_coordination_check(
        CoordinationInput(
            case_id="BC-2026-0142",
            candidate_id="candidate-c",
            semantic_model_path=generated.semantic_model,
            obstacles=[],
            target_connectors=[
                TargetConnector(connector_id="inlet", position_mm=(915, 0, 520), tolerance_mm=10),
            ],
        )
    )

    assert result.verdict == "fit_with_modification"
    assert result.connector_offsets[0]["offset_mm"] == 25
    assert result.bcfzip.exists()


def test_rejects_low_confidence_critical_geometry():
    with pytest.raises(ValidationError):
        VerifiedGeometry(
            width=DimensionValue(value_mm=1780, evidence=evidence("width", confidence=0.7)),
            depth=dimension("depth", 760),
            height=dimension("height", 980),
            base_length=dimension("base-length", 1840),
            base_width=dimension("base-width", 780),
            connectors=[
                ConnectorSpec(
                    connector_id="inlet",
                    system="hydronic_return",
                    diameter_mm=dimension("inlet", 100),
                    position_mm=(0, 0, 0),
                    direction=(1, 0, 0),
                )
            ],
        )


def test_project_bim_exports_high_detail_glb_and_semantic_ifc(tmp_path: Path):
    glb = export_m601_dajoong_bim(tmp_path / "m601-dajoong-bim.glb")
    ifc = export_m601_ifc(tmp_path / "m601-dajoong-bim.ifc", scene_digest="abc123")
    scene = trimesh.load(glb)

    assert glb.read_bytes()[:4] == b"glTF"
    assert len(scene.geometry) >= 600
    ifc_text = ifc.read_text(encoding="utf-8")
    assert "IFCPUMP" in ifc_text
    assert "IFCWALL" in ifc_text
    assert "DajoongSceneDigest" in ifc_text


def test_candidate_bim_uses_fit_verdict_highlight_color():
    rejected_scene = MechanicalRoomScene().build("candidate-a")
    accepted_scene = MechanicalRoomScene().build("candidate-c")

    def pump_color(scene: trimesh.Scene) -> tuple[int, int, int, int]:
        node = next(name for name in scene.graph.nodes_geometry if name.startswith("replacement-pump-volute-"))
        _, geometry_name = scene.graph[node]
        color = scene.geometry[geometry_name].visual.vertex_colors[0]
        return tuple(int(channel) for channel in color)

    assert pump_color(rejected_scene) == (197, 90, 84, 255)
    assert pump_color(accepted_scene) == (80, 200, 120, 255)


def test_replacement_and_existing_envelope_share_mounting_datum():
    scene = MechanicalRoomScene().build("candidate-c")

    def geometry_bounds(prefix: str) -> tuple[tuple[float, ...], tuple[float, ...]]:
        node = next(name for name in scene.graph.nodes_geometry if name.startswith(prefix))
        _, geometry_name = scene.graph[node]
        bounds = scene.geometry[geometry_name].bounds
        return tuple(bounds[0]), tuple(bounds[1])

    assert geometry_bounds("replacement-housekeeping-pad-") == geometry_bounds(
        "removed-existing-housekeeping-pad-"
    )


@pytest.mark.asyncio
async def test_coordination_rejects_hard_clash(tmp_path: Path):
    engine = BimEngine(tmp_path)
    generated = await engine.generate_semantic_bim(candidate())
    result = engine.run_coordination_check(
        CoordinationInput(
            case_id="BC-2026-0142",
            candidate_id="candidate-c",
            semantic_model_path=generated.semantic_model,
            obstacles=[
                AabbObstacle(
                    obstacle_id="wall-01",
                    label="Concrete wall",
                    minimum_mm=(200, -900, 0),
                    maximum_mm=(400, 900, 1500),
                    discipline="Structural",
                )
            ],
        )
    )

    assert result.verdict == "reject"
    assert result.critical_clashes[0]["obstacle_id"] == "wall-01"
