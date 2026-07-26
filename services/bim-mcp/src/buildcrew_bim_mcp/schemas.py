from __future__ import annotations

from enum import StrEnum
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class ReviewState(StrEnum):
    VERIFIED = "verified"
    REVIEW_REQUIRED = "review_required"
    REJECTED = "rejected"


class EvidenceRef(BaseModel):
    source_id: str = Field(min_length=1)
    document_name: str = Field(min_length=1)
    page_or_sheet: str = Field(min_length=1)
    source_region: tuple[float, float, float, float] | None = None
    source_hash: str = Field(min_length=8)
    confidence: float = Field(ge=0, le=1)
    grade: Literal["A", "B", "C", "D"]


class DimensionValue(BaseModel):
    value_mm: float = Field(gt=0)
    evidence: EvidenceRef


class ConnectorSpec(BaseModel):
    connector_id: str
    system: Literal["hydronic_supply", "hydronic_return", "electrical", "controls"]
    diameter_mm: DimensionValue
    position_mm: tuple[float, float, float]
    direction: tuple[float, float, float]


class ClearanceZone(BaseModel):
    zone_id: str
    purpose: str
    size_mm: tuple[float, float, float]
    origin_mm: tuple[float, float, float]
    evidence: EvidenceRef


class VerifiedGeometry(BaseModel):
    width: DimensionValue
    depth: DimensionValue
    height: DimensionValue
    base_length: DimensionValue
    base_width: DimensionValue
    connectors: list[ConnectorSpec] = Field(min_length=1)
    clearance_zones: list[ClearanceZone] = Field(default_factory=list)

    @model_validator(mode="after")
    def critical_evidence_must_be_authoritative(self) -> "VerifiedGeometry":
        critical = [
            self.width,
            self.depth,
            self.height,
            self.base_length,
            self.base_width,
            *(connector.diameter_mm for connector in self.connectors),
        ]
        unsupported = [
            item.evidence.source_id
            for item in critical
            if item.evidence.grade not in {"A", "B"} or item.evidence.confidence < 0.95
        ]
        if unsupported:
            raise ValueError(
                "Installation-critical geometry requires grade A/B evidence with confidence >= 0.95: "
                + ", ".join(unsupported)
            )
        return self


class CandidateInput(BaseModel):
    case_id: str
    candidate_id: str
    manufacturer: str
    model: str
    equipment_tag: str
    ifc_class: str = "IfcPump"
    verified_geometry: VerifiedGeometry
    manufacturer_drawing_paths: list[Path] = Field(default_factory=list)
    target_lod: Literal["coordination"] = "coordination"


class ArtifactSet(BaseModel):
    candidate_id: str
    output_directory: Path
    semantic_model: Path
    glb: Path
    ifc: Path
    source_map: Path
    confidence_report: Path
    review_state: ReviewState
    perception_mode: str


class AabbObstacle(BaseModel):
    obstacle_id: str
    label: str
    minimum_mm: tuple[float, float, float]
    maximum_mm: tuple[float, float, float]
    discipline: str = "MEP"


class TargetConnector(BaseModel):
    connector_id: str
    position_mm: tuple[float, float, float]
    tolerance_mm: float = 50


class PlacementInput(BaseModel):
    case_id: str
    candidate_id: str
    semantic_model_path: Path
    candidate_glb_path: Path
    replace_element_id: str
    origin_mm: tuple[float, float, float] = (0, 0, 0)
    rotation_degrees: float = 0


class CoordinationInput(BaseModel):
    case_id: str
    candidate_id: str
    semantic_model_path: Path
    obstacles: list[AabbObstacle] = Field(default_factory=list)
    target_connectors: list[TargetConnector] = Field(default_factory=list)
    origin_mm: tuple[float, float, float] = (0, 0, 0)


class CoordinationResult(BaseModel):
    candidate_id: str
    verdict: Literal["direct_fit", "fit_with_modification", "reject", "request_more_evidence"]
    critical_clashes: list[dict]
    clearance_violations: list[dict]
    connector_offsets: list[dict]
    required_modifications: list[dict]
    bcfzip: Path
    report_json: Path
