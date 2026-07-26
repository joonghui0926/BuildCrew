from __future__ import annotations

from hashlib import sha256
from pathlib import Path

import pytest
from pydantic import ValidationError

from buildcrew_bim_mcp.engine import BimEngine
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
