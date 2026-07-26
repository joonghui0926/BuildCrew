from __future__ import annotations

import json
import zipfile
from hashlib import sha256
from pathlib import Path
from uuid import uuid4

import numpy as np
import trimesh

from .schemas import CandidateInput, ClearanceZone, CoordinationResult


def _rgba(hex_color: str, alpha: int = 255) -> np.ndarray:
    return np.array([*bytes.fromhex(hex_color.lstrip("#")), alpha], dtype=np.uint8)


def _box(size_m: tuple[float, float, float], center_m: tuple[float, float, float], color: str):
    mesh = trimesh.creation.box(extents=size_m)
    mesh.apply_translation(center_m)
    mesh.visual.vertex_colors = np.tile(_rgba(color), (len(mesh.vertices), 1))
    return mesh


def _cylinder(radius_m: float, height_m: float, center_m: tuple[float, float, float], color: str, axis: str = "z"):
    mesh = trimesh.creation.cylinder(radius=radius_m, height=height_m, sections=48)
    if axis == "x":
        mesh.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0]))
    elif axis == "y":
        mesh.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
    mesh.apply_translation(center_m)
    mesh.visual.vertex_colors = np.tile(_rgba(color), (len(mesh.vertices), 1))
    return mesh


def _pump_scene(candidate: CandidateInput) -> trimesh.Scene:
    geometry = candidate.verified_geometry
    width = geometry.width.value_mm / 1000
    depth = geometry.depth.value_mm / 1000
    height = geometry.height.value_mm / 1000
    base_length = geometry.base_length.value_mm / 1000
    base_width = geometry.base_width.value_mm / 1000

    scene = trimesh.Scene()
    scene.add_geometry(_box((base_length, base_width, 0.1), (0, 0, 0.05), "#248D50"), node_name="equipment_base")
    motor_length = width * 0.48
    motor_radius = min(depth * 0.32, height * 0.31)
    motor_center_x = -width * 0.18
    motor_center_z = max(height * 0.52, motor_radius + 0.1)
    scene.add_geometry(
        _cylinder(motor_radius, motor_length, (motor_center_x, 0, motor_center_z), "#9AA7A0", "x"),
        node_name="motor",
    )
    for index in range(-5, 6):
        x_value = motor_center_x + index * motor_length / 13
        scene.add_geometry(
            _box((0.018, motor_radius * 1.75, motor_radius * 1.72), (x_value, 0, motor_center_z), "#66736D"),
            node_name=f"motor_fin_{index + 5:02d}",
        )

    casing_radius = min(depth * 0.38, height * 0.34)
    casing = trimesh.creation.icosphere(subdivisions=3, radius=casing_radius)
    casing.apply_scale((0.82, 1.0, 1.0))
    casing.apply_translation((width * 0.27, 0, casing_radius + 0.13))
    casing.visual.vertex_colors = np.tile(_rgba("#50C878"), (len(casing.vertices), 1))
    scene.add_geometry(casing, node_name="pump_casing")

    for connector in geometry.connectors:
        position = tuple(value / 1000 for value in connector.position_mm)
        radius = connector.diameter_mm.value_mm / 2000
        direction = np.array(connector.direction, dtype=float)
        axis = "z"
        if abs(direction[0]) > 0.5:
            axis = "x"
        elif abs(direction[1]) > 0.5:
            axis = "y"
        scene.add_geometry(
            _cylinder(radius, max(radius * 1.9, 0.16), position, "#146C48", axis),
            node_name=f"connector_{connector.connector_id}",
        )

    return scene


def export_glb(candidate: CandidateInput, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(_pump_scene(candidate).export(file_type="glb"))


def export_coordinated_glb(
    candidate: CandidateInput,
    destination: Path,
    *,
    origin_mm: tuple[float, float, float],
) -> None:
    scene = _pump_scene(candidate)
    room = _box((8.0, 6.0, 0.12), (0, 0, -0.06), "#DDE2DE")
    scene.add_geometry(room, node_name="room_slab")
    scene.add_geometry(_box((8.0, 0.12, 3.6), (0, -3, 1.8), "#F4F5F2"), node_name="back_wall")
    scene.add_geometry(_box((0.12, 6.0, 3.6), (-4, 0, 1.8), "#F4F5F2"), node_name="side_wall")
    scene.apply_translation(tuple(value / 1000 for value in origin_mm))
    destination.write_bytes(scene.export(file_type="glb"))


def _ifc_guid() -> str:
    alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$"
    value = uuid4().int
    output = ""
    for _ in range(22):
        output = alphabet[value & 63] + output
        value >>= 6
    return output


def export_ifc(candidate: CandidateInput, destination: Path) -> None:
    geometry = candidate.verified_geometry
    width = geometry.width.value_mm / 1000
    depth = geometry.depth.value_mm / 1000
    height = geometry.height.value_mm / 1000
    model_name = f"{candidate.manufacturer} {candidate.model}".replace("'", "")
    source_digest = sha256(
        "|".join(
            [
                geometry.width.evidence.source_hash,
                geometry.depth.evidence.source_hash,
                geometry.height.evidence.source_hash,
            ]
        ).encode()
    ).hexdigest()
    ifc = f"""ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView_V2.0]'),'2;1');
FILE_NAME('{candidate.candidate_id}.ifc','2026-07-26T12:00:00',('BuildCrew'),('BuildCrew'),'BuildCrew BIM Engine','BuildCrew','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCPERSON($,'BuildCrew',$,$,$,$,$,$);
#2=IFCORGANIZATION($,'BuildCrew',$,$,$);
#3=IFCPERSONANDORGANIZATION(#1,#2,$);
#4=IFCAPPLICATION(#2,'0.1.0','BuildCrew BIM Engine','BUILDCREW');
#5=IFCOWNERHISTORY(#3,#4,$,.ADDED.,$,$,$,0);
#6=IFCDIRECTION((1.,0.,0.));
#7=IFCDIRECTION((0.,1.,0.));
#8=IFCDIRECTION((0.,0.,1.));
#9=IFCCARTESIANPOINT((0.,0.,0.));
#10=IFCAXIS2PLACEMENT3D(#9,#8,#6);
#11=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-5,#10,$);
#12=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);
#13=IFCUNITASSIGNMENT((#12));
#14=IFCPROJECT('{_ifc_guid()}',#5,'{candidate.case_id}',$,$,$,$,(#11),#13);
#15=IFCLOCALPLACEMENT($,#10);
#16=IFCSITE('{_ifc_guid()}',#5,'BuildCrew Coordination Site',$,$,#15,$,$,.ELEMENT.,$,$,$,$,$);
#17=IFCBUILDING('{_ifc_guid()}',#5,'Mission Bay Data Center',$,$,#15,$,$,.ELEMENT.,$,$,$);
#18=IFCBUILDINGSTOREY('{_ifc_guid()}',#5,'Mechanical Level',$,$,#15,$,$,.ELEMENT.,0.);
#19=IFCRELAGGREGATES('{_ifc_guid()}',#5,$,$,#14,(#16));
#20=IFCRELAGGREGATES('{_ifc_guid()}',#5,$,$,#16,(#17));
#21=IFCRELAGGREGATES('{_ifc_guid()}',#5,$,$,#17,(#18));
#30=IFCCARTESIANPOINT((0.,0.));
#31=IFCAXIS2PLACEMENT2D(#30,$);
#32=IFCRECTANGLEPROFILEDEF(.AREA.,$,#31,{width:.6f},{depth:.6f});
#33=IFCEXTRUDEDAREASOLID(#32,#10,#8,{height:.6f});
#34=IFCSHAPEREPRESENTATION(#11,'Body','SweptSolid',(#33));
#35=IFCPRODUCTDEFINITIONSHAPE($,$,(#34));
#36=IFCPUMP('{_ifc_guid()}',#5,'{model_name}','Coordination-ready replacement for {candidate.equipment_tag}',$,'#15',#35,'{candidate.equipment_tag}',.USERDEFINED.);
#37=IFCRELCONTAINEDINSPATIALSTRUCTURE('{_ifc_guid()}',#5,$,$,(#36),#18);
#40=IFCPROPERTYSINGLEVALUE('Manufacturer',$,IFCLABEL('{candidate.manufacturer}'),$);
#41=IFCPROPERTYSINGLEVALUE('Model',$,IFCLABEL('{candidate.model}'),$);
#42=IFCPROPERTYSINGLEVALUE('EvidenceDigest',$,IFCTEXT('{source_digest}'),$);
#43=IFCPROPERTYSINGLEVALUE('ReviewState',$,IFCLABEL('VERIFIED'),$);
#44=IFCPROPERTYSET('{_ifc_guid()}',#5,'Pset_BuildCrewEvidence',$,(#40,#41,#42,#43));
#45=IFCRELDEFINESBYPROPERTIES('{_ifc_guid()}',#5,$,$,(#36),#44);
ENDSEC;
END-ISO-10303-21;
"""
    destination.write_text(ifc.replace("'#15'", "#15"), encoding="utf-8")


def export_bcfzip(
    destination: Path,
    *,
    candidate_id: str,
    issues: list[dict],
) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    version = '<?xml version="1.0" encoding="UTF-8"?><Version VersionId="2.1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>'
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("bcf.version", version)
        archive.writestr(
            "project.bcfp",
            f'<?xml version="1.0" encoding="UTF-8"?><ProjectExtension><Project ProjectId="{candidate_id}"><Name>BuildCrew Coordination</Name></Project></ProjectExtension>',
        )
        for issue in issues:
            topic_id = str(uuid4())
            title = str(issue.get("label") or issue.get("type") or "Coordination issue")
            description = str(issue.get("description") or json.dumps(issue))
            markup = f"""<?xml version="1.0" encoding="UTF-8"?>
<Markup><Topic Guid="{topic_id}" TopicType="Issue" TopicStatus="Open">
<Title>{title}</Title><Description>{description}</Description>
<CreationDate>2026-07-26T12:00:00Z</CreationDate><CreationAuthor>BuildCrew</CreationAuthor>
</Topic></Markup>"""
            archive.writestr(f"{topic_id}/markup.bcf", markup)
