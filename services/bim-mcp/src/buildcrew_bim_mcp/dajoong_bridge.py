from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compile a reviewed construction drawing through Dajoong contracts."
    )
    parser.add_argument("--dajoong-root", type=Path, required=True)
    parser.add_argument("--drawing", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--destination", type=Path, required=True)
    args = parser.parse_args()

    dajoong_root = args.dajoong_root.resolve(strict=True)
    sys.path.insert(0, str(dajoong_root / "src"))

    from dajoong_spatial_compiler.connectors.buili import BuiliPlanGraphConnector
    from dajoong_spatial_compiler.contracts import (
        BoundingBox2D,
        EvidenceRef,
        MetricPose,
        ModelTrace,
        SpatialEntity,
        SpatialRelation,
        SpatialSceneGraph,
    )

    drawing = args.drawing.resolve(strict=True)
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    checkpoint = (
        dajoong_root
        / "models"
        / "checkpoints"
        / "candidate"
        / "dajoong-spatial-lite-0.1"
        / "best.pt"
    )
    taxonomy = dajoong_root / "configs" / "taxonomy-v1.json"
    evidence_id = "m601-source-drawing"
    evidence = EvidenceRef(
        id=evidence_id,
        uri=str(drawing),
        sha256=sha256(drawing),
        media_type="image/png",
        source_type="drawing",
        license="BuildCrew demo project evidence",
        metadata={
            "doc_id": "M-601",
            "sheet_id": "M-601",
            "pixels_per_meter": 59.0,
            "review_method": "dajoong_model_proposal_plus_verified_dimension_review",
            "critical_geometry_policy": "dimensioned_drawing_is_authoritative",
        },
    )

    entities = [
        SpatialEntity(
            id=item["id"],
            domain="architecture",
            kind=item["kind"],
            label=item["label"],
            confidence=item.get("confidence", 0.99),
            epistemic_uncertainty=1 - item.get("confidence", 0.99),
            bbox=BoundingBox2D(**item["bbox"]),
            pose=MetricPose(
                center_m=tuple(item["center_m"]),
                size_m=tuple(item["size_m"]),
                coordinate_frame="M-601-metric",
            ),
            attributes={
                **item.get("attributes", {}),
                "source_sheet": "M-601",
                "verification": "accepted_from_dimensioned_drawing",
            },
            evidence_ids=[evidence_id],
            model_version="dajoong-spatial-lite-0.1+reviewed-plan",
            review_state="accepted",
        )
        for item in manifest["entities"]
    ]
    relations = [
        SpatialRelation(
            id=f"contains-{index:03d}",
            subject_id="room-main",
            predicate="contains",
            object_id=entity.id,
            confidence=0.99,
            evidence_ids=[evidence_id],
        )
        for index, entity in enumerate(entities)
        if entity.id != "room-main"
    ]
    graph = SpatialSceneGraph(
        scene_id="mission-bay-m601",
        domain="architecture",
        coordinate_system="image_metric",
        entities=entities,
        relations=relations,
        evidence=[evidence],
        model=ModelTrace(
            model_version="dajoong-spatial-lite-0.1",
            checkpoint_sha256=sha256(checkpoint),
            taxonomy_sha256=sha256(taxonomy),
            dataset_sha256="",
            stage="candidate",
            inference_ms=0,
        ),
        review_required=False,
    ).finalize()
    plan_graph = BuiliPlanGraphConnector().export(
        graph,
        project_id="MB-DC",
        sheet_id="M-601",
    )

    destination = args.destination.resolve()
    destination.mkdir(parents=True, exist_ok=True)
    scene_path = destination / "m601-dajoong-scene.json"
    plan_path = destination / "m601-plan-graph.json"
    scene_path.write_text(graph.model_dump_json(indent=2), encoding="utf-8")
    plan_path.write_text(json.dumps(plan_graph, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                "scene_graph": str(scene_path),
                "plan_graph": str(plan_path),
                "content_sha256": graph.content_sha256,
                "entities": len(graph.entities),
                "relations": len(graph.relations),
                "model_version": graph.model.model_version,
                "checkpoint_stage": graph.model.stage,
                "review_required": graph.review_required,
            }
        )
    )


if __name__ == "__main__":
    main()
