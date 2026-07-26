from __future__ import annotations

import json
import os
from pathlib import Path
from shutil import copy2

from .dajoong import DajoongConnector
from .exporters import export_bcfzip, export_coordinated_glb, export_glb, export_ifc
from .schemas import (
    ArtifactSet,
    CandidateInput,
    CoordinationInput,
    CoordinationResult,
    PlacementInput,
    ReviewState,
)


def _aabb_intersects(
    first_min: tuple[float, float, float],
    first_max: tuple[float, float, float],
    second_min: tuple[float, float, float],
    second_max: tuple[float, float, float],
) -> bool:
    return all(first_min[index] <= second_max[index] and first_max[index] >= second_min[index] for index in range(3))


class BimEngine:
    def __init__(self, output_root: Path | None = None) -> None:
        configured = os.getenv("BUILDCREW_ARTIFACT_ROOT")
        self.output_root = output_root or Path(configured or "outputs/mcp_artifacts").resolve()
        self.output_root.mkdir(parents=True, exist_ok=True)
        self.dajoong = DajoongConnector()

    def _candidate_directory(self, case_id: str, candidate_id: str) -> Path:
        destination = self.output_root / case_id / candidate_id
        destination.mkdir(parents=True, exist_ok=True)
        return destination

    async def generate_semantic_bim(self, candidate: CandidateInput) -> ArtifactSet:
        destination = self._candidate_directory(candidate.case_id, candidate.candidate_id)
        proposal = await self.dajoong.propose_scene(candidate.manufacturer_drawing_paths)
        perception_mode = "dajoong_api" if proposal else "verified_dimensions"

        semantic_path = destination / "semantic-properties.json"
        glb_path = destination / f"{candidate.candidate_id}.glb"
        ifc_path = destination / f"{candidate.candidate_id}.ifc"
        source_map_path = destination / "source-map.json"
        confidence_path = destination / "confidence-report.json"

        geometry = candidate.verified_geometry
        semantic = {
            "schema_version": "1.0.0",
            "case_id": candidate.case_id,
            "candidate_id": candidate.candidate_id,
            "equipment_tag": candidate.equipment_tag,
            "ifc_class": candidate.ifc_class,
            "manufacturer": candidate.manufacturer,
            "model": candidate.model,
            "dimensions_mm": {
                "width": geometry.width.value_mm,
                "depth": geometry.depth.value_mm,
                "height": geometry.height.value_mm,
                "base_length": geometry.base_length.value_mm,
                "base_width": geometry.base_width.value_mm,
            },
            "connectors": [item.model_dump(mode="json") for item in geometry.connectors],
            "clearance_zones": [item.model_dump(mode="json") for item in geometry.clearance_zones],
            "review_state": ReviewState.VERIFIED,
            "perception_mode": perception_mode,
            "dajoong_proposal": proposal,
        }
        source_map = {
            "width": geometry.width.evidence.model_dump(mode="json"),
            "depth": geometry.depth.evidence.model_dump(mode="json"),
            "height": geometry.height.evidence.model_dump(mode="json"),
            "base_length": geometry.base_length.evidence.model_dump(mode="json"),
            "base_width": geometry.base_width.evidence.model_dump(mode="json"),
            "connectors": {
                item.connector_id: item.diameter_mm.evidence.model_dump(mode="json")
                for item in geometry.connectors
            },
        }
        confidence = {
            "critical_field_count": 5 + len(geometry.connectors),
            "verified_critical_field_count": 5 + len(geometry.connectors),
            "minimum_critical_confidence": min(
                [
                    geometry.width.evidence.confidence,
                    geometry.depth.evidence.confidence,
                    geometry.height.evidence.confidence,
                    geometry.base_length.evidence.confidence,
                    geometry.base_width.evidence.confidence,
                    *(item.diameter_mm.evidence.confidence for item in geometry.connectors),
                ]
            ),
            "export_allowed": True,
            "review_state": ReviewState.VERIFIED,
        }

        semantic_path.write_text(json.dumps(semantic, indent=2), encoding="utf-8")
        source_map_path.write_text(json.dumps(source_map, indent=2), encoding="utf-8")
        confidence_path.write_text(json.dumps(confidence, indent=2), encoding="utf-8")
        export_glb(candidate, glb_path)
        export_ifc(candidate, ifc_path)

        return ArtifactSet(
            candidate_id=candidate.candidate_id,
            output_directory=destination,
            semantic_model=semantic_path,
            glb=glb_path,
            ifc=ifc_path,
            source_map=source_map_path,
            confidence_report=confidence_path,
            review_state=ReviewState.VERIFIED,
            perception_mode=perception_mode,
        )

    def place_candidate_in_project(self, candidate: CandidateInput, placement: PlacementInput) -> dict:
        destination = self._candidate_directory(placement.case_id, placement.candidate_id)
        coordinated_glb = destination / f"{placement.candidate_id}-coordinated.glb"
        export_coordinated_glb(candidate, coordinated_glb, origin_mm=placement.origin_mm)
        placement_path = destination / "placement.json"
        result = {
            "case_id": placement.case_id,
            "candidate_id": placement.candidate_id,
            "replace_element_id": placement.replace_element_id,
            "origin_mm": placement.origin_mm,
            "rotation_degrees": placement.rotation_degrees,
            "coordinated_glb": str(coordinated_glb),
            "permanent_model_update": False,
            "review_state": ReviewState.VERIFIED,
        }
        placement_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        return result

    def run_coordination_check(self, coordination: CoordinationInput) -> CoordinationResult:
        semantic = json.loads(coordination.semantic_model_path.read_text(encoding="utf-8"))
        dimensions = semantic["dimensions_mm"]
        origin = coordination.origin_mm
        equipment_min = (
            origin[0] - dimensions["width"] / 2,
            origin[1] - dimensions["depth"] / 2,
            origin[2],
        )
        equipment_max = (
            origin[0] + dimensions["width"] / 2,
            origin[1] + dimensions["depth"] / 2,
            origin[2] + dimensions["height"],
        )

        clashes: list[dict] = []
        for obstacle in coordination.obstacles:
            if _aabb_intersects(equipment_min, equipment_max, obstacle.minimum_mm, obstacle.maximum_mm):
                clashes.append(
                    {
                        "type": "hard_clash",
                        "obstacle_id": obstacle.obstacle_id,
                        "label": obstacle.label,
                        "discipline": obstacle.discipline,
                        "description": f"Candidate envelope intersects {obstacle.label}.",
                    }
                )

        clearance_violations: list[dict] = []
        for zone in semantic.get("clearance_zones", []):
            zone_min = tuple(origin[index] + zone["origin_mm"][index] for index in range(3))
            zone_max = tuple(zone_min[index] + zone["size_mm"][index] for index in range(3))
            for obstacle in coordination.obstacles:
                if _aabb_intersects(zone_min, zone_max, obstacle.minimum_mm, obstacle.maximum_mm):
                    clearance_violations.append(
                        {
                            "type": "clearance_violation",
                            "zone_id": zone["zone_id"],
                            "purpose": zone["purpose"],
                            "obstacle_id": obstacle.obstacle_id,
                            "label": obstacle.label,
                            "description": f"{zone['purpose']} clearance overlaps {obstacle.label}.",
                        }
                    )

        target_by_id = {item.connector_id: item for item in coordination.target_connectors}
        connector_offsets: list[dict] = []
        modifications: list[dict] = []
        for connector in semantic["connectors"]:
            target = target_by_id.get(connector["connector_id"])
            if not target:
                continue
            actual = tuple(origin[index] + connector["position_mm"][index] for index in range(3))
            offset = sum((actual[index] - target.position_mm[index]) ** 2 for index in range(3)) ** 0.5
            record = {
                "connector_id": connector["connector_id"],
                "offset_mm": round(offset, 2),
                "tolerance_mm": target.tolerance_mm,
                "within_tolerance": offset <= target.tolerance_mm,
            }
            connector_offsets.append(record)
            if offset > target.tolerance_mm:
                modifications.append(
                    {
                        "type": "connector_reroute",
                        "connector_id": connector["connector_id"],
                        "offset_mm": round(offset, 2),
                        "description": f"Provide a {round(offset, 0):.0f} mm spool/routing adjustment.",
                    }
                )

        issues = [*clashes, *clearance_violations, *modifications]
        if clashes or clearance_violations:
            verdict = "reject"
        elif modifications:
            verdict = "fit_with_modification"
        else:
            verdict = "direct_fit"

        destination = self._candidate_directory(coordination.case_id, coordination.candidate_id)
        bcfzip = destination / f"{coordination.candidate_id}-coordination.bcfzip"
        report_path = destination / "coordination-report.json"
        export_bcfzip(bcfzip, candidate_id=coordination.candidate_id, issues=issues)
        result = CoordinationResult(
            candidate_id=coordination.candidate_id,
            verdict=verdict,
            critical_clashes=clashes,
            clearance_violations=clearance_violations,
            connector_offsets=connector_offsets,
            required_modifications=modifications,
            bcfzip=bcfzip,
            report_json=report_path,
        )
        report_path.write_text(result.model_dump_json(indent=2), encoding="utf-8")
        return result

    def export_bim_deliverables(
        self,
        *,
        case_id: str,
        candidate_id: str,
        destination: Path,
    ) -> dict:
        source = self._candidate_directory(case_id, candidate_id)
        destination.mkdir(parents=True, exist_ok=True)
        copied: list[str] = []
        for path in source.iterdir():
            if path.is_file():
                target = destination / path.name
                copy2(path, target)
                copied.append(str(target))
        manifest = {
            "schema_version": "1.0.0",
            "case_id": case_id,
            "candidate_id": candidate_id,
            "files": copied,
            "industrial_formats": ["IFC4", "GLB", "BCF 2.1", "JSON"],
            "revit_family_available": False,
            "review_state": ReviewState.VERIFIED,
        }
        manifest_path = destination / "delivery-manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        return {**manifest, "manifest": str(manifest_path)}
