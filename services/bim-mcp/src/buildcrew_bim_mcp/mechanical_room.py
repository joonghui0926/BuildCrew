from __future__ import annotations

import math
from pathlib import Path
from uuid import uuid4

import numpy as np
import trimesh


COLORS = {
    "concrete": "#D6D8D4",
    "floor": "#BFC4C0",
    "wall": "#F2F3EF",
    "steel": "#747D78",
    "dark_steel": "#313A35",
    "pipe": "#9AA29E",
    "rubber": "#252B28",
    "pump": "#5E6C65",
    "motor": "#59645F",
    "green": "#50C878",
    "green_dark": "#248D50",
    "amber": "#E7A537",
    "red": "#C55A54",
    "blue": "#4A7FA5",
}


def _rgba(color: str, alpha: int = 255) -> np.ndarray:
    return np.array([*bytes.fromhex(color.lstrip("#")), alpha], dtype=np.uint8)


def _paint(mesh: trimesh.Trimesh, color: str, alpha: int = 255) -> trimesh.Trimesh:
    mesh.visual.vertex_colors = np.tile(_rgba(color, alpha), (len(mesh.vertices), 1))
    return mesh


def _box(
    extents: tuple[float, float, float],
    center: tuple[float, float, float],
    color: str,
    alpha: int = 255,
) -> trimesh.Trimesh:
    mesh = trimesh.creation.box(extents=extents)
    mesh.apply_translation(center)
    return _paint(mesh, color, alpha)


def _cylinder(
    radius: float,
    length: float,
    center: tuple[float, float, float],
    color: str,
    axis: str = "z",
    sections: int = 64,
    alpha: int = 255,
) -> trimesh.Trimesh:
    mesh = trimesh.creation.cylinder(radius=radius, height=length, sections=sections)
    if axis == "x":
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [0, 1, 0]))
    elif axis == "y":
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [1, 0, 0]))
    mesh.apply_translation(center)
    return _paint(mesh, color, alpha)


def _sphere(
    radius: float,
    center: tuple[float, float, float],
    color: str,
    scale: tuple[float, float, float] = (1, 1, 1),
    alpha: int = 255,
) -> trimesh.Trimesh:
    mesh = trimesh.creation.icosphere(subdivisions=3, radius=radius)
    mesh.apply_scale(scale)
    mesh.apply_translation(center)
    return _paint(mesh, color, alpha)


def _torus(
    major_radius: float,
    minor_radius: float,
    center: tuple[float, float, float],
    color: str,
    axis: str = "z",
    alpha: int = 255,
) -> trimesh.Trimesh:
    mesh = trimesh.creation.torus(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_sections=64,
        minor_sections=16,
    )
    if axis == "x":
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [0, 1, 0]))
    elif axis == "y":
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [1, 0, 0]))
    mesh.apply_translation(center)
    return _paint(mesh, color, alpha)


class MechanicalRoomScene:
    """Detailed parametric scene generated from the Dajoong M-601 plan graph."""

    def __init__(self) -> None:
        self.scene = trimesh.Scene()
        self.counter = 0
        self.layer_prefix = ""
        self.replacement_rejected = False

    def add(self, mesh: trimesh.Trimesh, name: str) -> None:
        self.counter += 1
        prefix = f"{self.layer_prefix}-" if self.layer_prefix else ""
        self.scene.add_geometry(mesh, node_name=f"{prefix}{name}-{self.counter:04d}")

    def add_flange(
        self,
        center: tuple[float, float, float],
        pipe_radius: float,
        axis: str = "x",
        color: str = COLORS["steel"],
    ) -> None:
        self.add(_cylinder(pipe_radius * 1.38, 0.07, center, color, axis), "flange")
        offsets = [
            (math.cos(angle) * pipe_radius * 1.12, math.sin(angle) * pipe_radius * 1.12)
            for angle in np.linspace(0, math.tau, 8, endpoint=False)
        ]
        for first, second in offsets:
            if axis == "x":
                bolt_center = (center[0], center[1] + first, center[2] + second)
                bolt_axis = "x"
            elif axis == "y":
                bolt_center = (center[0] + first, center[1], center[2] + second)
                bolt_axis = "y"
            else:
                bolt_center = (center[0] + first, center[1] + second, center[2])
                bolt_axis = "z"
            self.add(_cylinder(0.018, 0.10, bolt_center, COLORS["dark_steel"], bolt_axis, 24), "flange-bolt")

    def add_handwheel_valve(
        self,
        x: float,
        y: float,
        z: float,
        pipe_radius: float,
        color: str = COLORS["steel"],
    ) -> None:
        self.add(_sphere(pipe_radius * 1.32, (x, y, z), color, (0.75, 1, 1)), "valve-body")
        self.add(_cylinder(0.035, 0.48, (x, y, z + 0.30), color), "valve-stem")
        self.add(_torus(0.20, 0.025, (x, y, z + 0.55), COLORS["dark_steel"]), "handwheel")
        for angle in np.linspace(0, math.tau, 6, endpoint=False):
            end = (x + math.cos(angle) * 0.19, y + math.sin(angle) * 0.19, z + 0.55)
            spoke = _cylinder(0.009, 0.19, ((x + end[0]) / 2, (y + end[1]) / 2, z + 0.55), COLORS["dark_steel"], "x", 16)
            spoke.apply_transform(
                trimesh.transformations.rotation_matrix(angle, [0, 0, 1], point=(x, y, z + 0.55))
            )
            self.add(spoke, "handwheel-spoke")
        self.add_flange((x - 0.16, y, z), pipe_radius)
        self.add_flange((x + 0.16, y, z), pipe_radius)

    def add_flexible_connector(self, x: float, y: float, z: float, pipe_radius: float) -> None:
        self.add(_cylinder(pipe_radius * 1.05, 0.34, (x, y, z), COLORS["rubber"], "x"), "flex")
        for offset in np.linspace(-0.14, 0.14, 7):
            self.add(_torus(pipe_radius * 1.08, 0.012, (x + offset, y, z), COLORS["steel"], "x"), "flex-ring")
        self.add_flange((x - 0.20, y, z), pipe_radius)
        self.add_flange((x + 0.20, y, z), pipe_radius)

    def add_gauge(self, x: float, y: float, z: float) -> None:
        self.add(_cylinder(0.018, 0.27, (x, y, z + 0.15), COLORS["steel"]), "gauge-stem")
        self.add(_cylinder(0.10, 0.045, (x, y, z + 0.33), "#ECEDE9", "y", 48), "gauge-face")
        self.add(_torus(0.095, 0.012, (x, y, z + 0.33), COLORS["dark_steel"], "y"), "gauge-rim")

    def add_y_strainer(self, x: float, y: float, z: float, pipe_radius: float) -> None:
        self.add(_cylinder(pipe_radius * 1.08, 0.48, (x, y, z), COLORS["steel"], "x"), "strainer-main")
        branch = _cylinder(pipe_radius * 0.78, 0.46, (x + 0.05, y, z - 0.18), COLORS["steel"], "z")
        branch.apply_transform(
            trimesh.transformations.rotation_matrix(-math.pi / 4, [0, 1, 0], point=(x, y, z))
        )
        self.add(branch, "strainer-branch")
        self.add_flange((x - 0.27, y, z), pipe_radius)
        self.add_flange((x + 0.27, y, z), pipe_radius)

    def add_pipe_support(self, x: float, y: float, z: float, pipe_radius: float) -> None:
        self.add(_box((0.10, 0.10, z - pipe_radius), (x, y, (z - pipe_radius) / 2), COLORS["dark_steel"]), "support-post")
        self.add(_box((0.42, 0.10, 0.08), (x, y, 0.04), COLORS["dark_steel"]), "support-foot")
        self.add(_torus(pipe_radius * 1.08, 0.018, (x, y, z), COLORS["dark_steel"], "x"), "pipe-clamp")

    def add_motor(self, center: tuple[float, float, float], length: float, radius: float, color: str) -> None:
        x, y, z = center
        self.add(_cylinder(radius, length, center, color, "x", 96), "motor-shell")
        self.add(_cylinder(radius * 0.92, 0.12, (x - length / 2 - 0.05, y, z), color, "x"), "motor-end")
        self.add(_cylinder(radius * 0.42, 0.10, (x + length / 2 + 0.04, y, z), COLORS["dark_steel"], "x"), "motor-shaft")
        for offset in np.linspace(-length * 0.42, length * 0.42, 18):
            self.add(_box((0.022, radius * 2.17, 0.045), (x + offset, y, z + radius * 0.84), COLORS["dark_steel"]), "motor-fin-top")
            self.add(_box((0.022, radius * 2.17, 0.045), (x + offset, y, z - radius * 0.84), COLORS["dark_steel"]), "motor-fin-bottom")
        self.add(_box((0.38, 0.34, 0.22), (x - 0.12, y, z + radius + 0.13), color), "terminal-box")
        for side in (-1, 1):
            self.add(_box((0.42, 0.12, 0.13), (x + side * length * 0.29, y, z - radius - 0.03), COLORS["dark_steel"]), "motor-foot")

    def add_pump(
        self,
        x: float,
        y: float,
        *,
        selected: bool,
        ghost: bool = False,
    ) -> None:
        previous_prefix = self.layer_prefix
        self.layer_prefix = "removed-existing" if ghost else ("replacement" if selected else "existing-duty")
        color = (
            COLORS["red"]
            if selected and self.replacement_rejected
            else (COLORS["green"] if selected else COLORS["pump"])
        )
        alpha = 70 if ghost else 255
        base_color = COLORS["steel"] if ghost else COLORS["dark_steel"]
        self.add(_box((3.05, 1.40, 0.18), (x, y, 0.19), base_color, alpha), "pump-skid")
        self.add(_box((3.35, 1.70, 0.18), (x, y, 0.09), COLORS["concrete"], alpha), "housekeeping-pad")
        for bx in (x - 1.40, x + 1.40):
            for by in (y - 0.55, y + 0.55):
                self.add(_cylinder(0.035, 0.24, (bx, by, 0.20), COLORS["dark_steel"], "z", 24, alpha), "anchor-bolt")

        motor_center = (x - 0.62, y, 0.79)
        self.add_motor(motor_center, 1.36, 0.42, color if not ghost else COLORS["steel"])
        self.add(_cylinder(0.28, 0.46, (x + 0.24, y, 0.80), COLORS["dark_steel"], "x", 64, alpha), "coupling-guard")
        ghost_color = COLORS["steel"]
        self.add(_sphere(0.52, (x + 0.78, y, 0.83), color if not ghost else ghost_color, (0.82, 1, 1), alpha), "pump-volute")
        self.add(_torus(0.38, 0.10, (x + 0.72, y, 0.83), color if not ghost else ghost_color, "x", alpha), "pump-volute-ring")
        self.add(_cylinder(0.20, 0.60, (x + 1.22, y, 0.83), color if not ghost else ghost_color, "x", 64, alpha), "pump-suction")
        self.add_flange((x + 1.52, y, 0.83), 0.20, color=color if not ghost else ghost_color)
        self.add(_cylinder(0.17, 0.58, (x + 0.78, y, 1.27), color if not ghost else ghost_color, "z", 64, alpha), "pump-discharge")
        self.add_flange((x + 0.78, y, 1.56), 0.17, axis="z", color=color if not ghost else ghost_color)
        self.layer_prefix = previous_prefix

    def add_pipe_train(self, y: float, *, selected: bool) -> None:
        z = 1.55
        pipe_radius = 0.18
        segments = [(-7.8, -6.25), (-5.95, -4.65), (-4.35, -2.80), (-2.42, 0.58)]
        for left, right in segments:
            self.add(
                _cylinder(pipe_radius, right - left, ((left + right) / 2, y, z), COLORS["pipe"], "x", 64),
                "chilled-water-pipe",
            )
        self.add_flexible_connector(-6.10, y, z, pipe_radius)
        self.add_handwheel_valve(-5.35, y, z, pipe_radius)
        self.add_y_strainer(-3.85, y, z, pipe_radius)
        self.add_handwheel_valve(-2.15, y, z, pipe_radius)
        self.add_gauge(-1.45, y, z)
        for x in (-7.15, -4.75, -2.65, -0.75):
            self.add_pipe_support(x, y, z, pipe_radius)

        pump_x = 2.0
        self.add_pump(pump_x, y, selected=selected)
        if selected:
            self.add_pump(pump_x - 0.18, y + 0.08, selected=False, ghost=True)
        self.add(_cylinder(pipe_radius, 1.55, (4.86, y, z), COLORS["pipe"], "x", 64), "discharge-pipe")
        self.add_handwheel_valve(4.22, y, z, pipe_radius)
        modified_color = (
            COLORS["red"]
            if selected and self.replacement_rejected
            else (COLORS["amber"] if selected else COLORS["pipe"])
        )
        impact_prefix = "impact-" if selected else ""
        self.add(_cylinder(pipe_radius, 1.05, (5.78, y, z), modified_color, "x", 64), f"{impact_prefix}modified-spool")
        self.add(_sphere(pipe_radius * 1.03, (6.30, y, z), modified_color), f"{impact_prefix}elbow")
        self.add(_cylinder(pipe_radius, 1.55, (6.30, y, 0.80), modified_color, "z", 64), f"{impact_prefix}vertical-riser")
        self.add_flange((5.25, y, z), pipe_radius)
        self.add_flange((6.30, y, 0.20), pipe_radius, axis="z")

    def add_room(self) -> None:
        self.add(_box((16.0, 12.0, 0.22), (0, 0, -0.11), COLORS["floor"]), "floor")
        for x in np.linspace(-7.5, 7.5, 21):
            self.add(_box((0.012, 12.0, 0.008), (x, 0, 0.006), "#AEB4B0"), "floor-joint")
        self.add(_box((16.0, 0.22, 3.2), (0, -6.0, 1.6), COLORS["wall"]), "north-wall")
        self.add(_box((0.22, 12.0, 3.2), (-8.0, 0, 1.6), COLORS["wall"]), "west-wall")
        self.add(_box((0.22, 12.0, 3.2), (8.0, 0, 1.6), COLORS["wall"]), "east-wall")
        self.add(_box((12.6, 0.22, 3.2), (-1.7, 6.0, 1.6), COLORS["wall"]), "south-wall-left")
        self.add(_box((1.85, 0.22, 3.2), (7.05, 6.0, 1.6), COLORS["wall"]), "south-wall-right")
        self.add(_box((1.25, 0.08, 2.25), (5.22, 5.84, 1.12), "#6A6259"), "access-door")
        for x in (-7.45, -0.60, 5.80):
            for y in (-5.55, 5.55):
                self.add(_box((0.45, 0.45, 3.2), (x, y, 1.6), COLORS["concrete"]), "column")
        for x in (-5.5, 0, 5.5):
            self.add(_box((2.2, 0.26, 0.09), (x, -5.72, 2.62), "#F7F3DD"), "light")
        for rail_y in (-5.55, -5.25):
            self.add(_box((14.7, 0.04, 0.08), (0, rail_y, 2.93), COLORS["dark_steel"]), "cable-tray-rail")
        for x in np.linspace(-7.2, 7.2, 28):
            self.add(_box((0.035, 0.44, 0.035), (x, -5.40, 2.93), COLORS["dark_steel"]), "cable-tray-rung")
        self.add(_box((0.44, 0.44, 0.03), (-6.3, 4.9, 0.02), COLORS["dark_steel"]), "floor-drain")

    def add_clearance(self, x: float, y: float) -> None:
        self.add(_box((4.05, 2.55, 1.85), (x - 0.20, y, 0.93), "#BCE8C9", 35), "maintenance-clearance")

    def build(self, candidate_id: str = "candidate-c") -> trimesh.Scene:
        self.replacement_rejected = candidate_id in {"candidate-a", "candidate-b"}
        self.add_room()
        self.add_pipe_train(-2.15, selected=True)
        self.add_pipe_train(2.15, selected=False)
        self.add_clearance(2.0, -2.15)
        if candidate_id == "candidate-a":
            self.add(
                _cylinder(
                    0.24,
                    3.3,
                    (3.25, -2.15, 1.12),
                    COLORS["red"],
                    "z",
                    64,
                    180,
                ),
                "critical-clash-existing-return",
            )
        elif candidate_id == "candidate-b":
            self.add(
                _box(
                    (0.34, 3.0, 2.3),
                    (0.25, -2.15, 1.15),
                    COLORS["red"],
                    135,
                ),
                "critical-clearance-wall",
            )
        return self.scene


def export_m601_dajoong_bim(
    destination: Path,
    *,
    candidate_id: str = "candidate-c",
) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    scene = MechanicalRoomScene().build(candidate_id)
    destination.write_bytes(scene.export(file_type="glb"))
    return destination


def _ifc_guid() -> str:
    alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$"
    value = uuid4().int
    output = ""
    for _ in range(22):
        output = alphabet[value & 63] + output
        value >>= 6
    return output


def export_m601_ifc(destination: Path, *, scene_digest: str) -> Path:
    """Export the M-601 room as an IFC4 semantic coordination model.

    The high-detail display geometry lives in the GLB. The IFC intentionally
    keeps stable, coordination-grade envelopes and semantic equipment classes.
    """

    destination.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "ISO-10303-21;",
        "HEADER;",
        "FILE_DESCRIPTION(('ViewDefinition [CoordinationView_V2.0]'),'2;1');",
        "FILE_NAME('m601-dajoong-bim.ifc','2026-07-26T12:00:00',('BuildCrew'),"
        "('BuildCrew'),'Dajoong Spatial Compiler + BuildCrew BIM Engine','BuildCrew','');",
        "FILE_SCHEMA(('IFC4'));",
        "ENDSEC;",
        "DATA;",
        "#1=IFCPERSON($,'BuildCrew',$,$,$,$,$,$);",
        "#2=IFCORGANIZATION($,'BuildCrew',$,$,$);",
        "#3=IFCPERSONANDORGANIZATION(#1,#2,$);",
        "#4=IFCAPPLICATION(#2,'0.2.0','BuildCrew BIM Engine','BUILDCREW');",
        "#5=IFCOWNERHISTORY(#3,#4,$,.ADDED.,$,$,$,0);",
        "#6=IFCDIRECTION((1.,0.,0.));",
        "#7=IFCDIRECTION((0.,1.,0.));",
        "#8=IFCDIRECTION((0.,0.,1.));",
        "#9=IFCCARTESIANPOINT((0.,0.,0.));",
        "#10=IFCAXIS2PLACEMENT3D(#9,#8,#6);",
        "#11=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-5,#10,$);",
        "#12=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);",
        "#13=IFCUNITASSIGNMENT((#12));",
        f"#14=IFCPROJECT('{_ifc_guid()}',#5,'BC-2026-0142',$,$,$,$,(#11),#13);",
        "#15=IFCLOCALPLACEMENT($,#10);",
        f"#16=IFCSITE('{_ifc_guid()}',#5,'Mission Bay Data Center',$,$,#15,$,$,.ELEMENT.,$,$,$,$,$);",
        f"#17=IFCBUILDING('{_ifc_guid()}',#5,'Mission Bay Data Center',$,$,#15,$,$,.ELEMENT.,$,$,$);",
        f"#18=IFCBUILDINGSTOREY('{_ifc_guid()}',#5,'Mechanical Level',$,$,#15,$,$,.ELEMENT.,0.);",
        f"#19=IFCRELAGGREGATES('{_ifc_guid()}',#5,$,$,#14,(#16));",
        f"#20=IFCRELAGGREGATES('{_ifc_guid()}',#5,$,$,#16,(#17));",
        f"#21=IFCRELAGGREGATES('{_ifc_guid()}',#5,$,$,#17,(#18));",
    ]
    next_id = 30
    products: list[int] = []

    def add_box_product(
        ifc_type: str,
        name: str,
        center: tuple[float, float, float],
        size: tuple[float, float, float],
        predefined: str | None = None,
    ) -> None:
        nonlocal next_id
        point, axis, placement, profile_point, profile_axis, profile, solid, shape, product_shape, product = range(
            next_id, next_id + 10
        )
        next_id += 10
        bottom_z = center[2] - size[2] / 2
        lines.extend(
            [
                f"#{point}=IFCCARTESIANPOINT(({center[0]:.6f},{center[1]:.6f},{bottom_z:.6f}));",
                f"#{axis}=IFCAXIS2PLACEMENT3D(#{point},#8,#6);",
                f"#{placement}=IFCLOCALPLACEMENT(#15,#{axis});",
                f"#{profile_point}=IFCCARTESIANPOINT((0.,0.));",
                f"#{profile_axis}=IFCAXIS2PLACEMENT2D(#{profile_point},$);",
                f"#{profile}=IFCRECTANGLEPROFILEDEF(.AREA.,$,#{profile_axis},{size[0]:.6f},{size[1]:.6f});",
                f"#{solid}=IFCEXTRUDEDAREASOLID(#{profile},#10,#8,{size[2]:.6f});",
                f"#{shape}=IFCSHAPEREPRESENTATION(#11,'Body','SweptSolid',(#{solid}));",
                f"#{product_shape}=IFCPRODUCTDEFINITIONSHAPE($,$,(#{shape}));",
            ]
        )
        safe_name = name.replace("'", "")
        if predefined is None:
            product_line = (
                f"#{product}={ifc_type}('{_ifc_guid()}',#5,'{safe_name}',$,$,"
                f"#{placement},#{product_shape},'{safe_name}');"
            )
        else:
            product_line = (
                f"#{product}={ifc_type}('{_ifc_guid()}',#5,'{safe_name}',$,$,"
                f"#{placement},#{product_shape},'{safe_name}',.{predefined}.);"
            )
        lines.append(product_line)
        products.append(product)

    add_box_product("IFCSLAB", "Mechanical Room Floor", (0, 0, -0.11), (16, 12, 0.22), "FLOOR")
    add_box_product("IFCWALL", "North Wall", (0, -6, 1.6), (16, 0.22, 3.2))
    add_box_product("IFCWALL", "West Wall", (-8, 0, 1.6), (0.22, 12, 3.2))
    add_box_product("IFCWALL", "East Wall", (8, 0, 1.6), (0.22, 12, 3.2))
    add_box_product("IFCWALL", "South Wall", (0, 6, 1.6), (16, 0.22, 3.2))
    for index, (x, y) in enumerate(
        [(-7.45, -5.55), (-0.60, -5.55), (5.80, -5.55), (-7.45, 5.55), (-0.60, 5.55), (5.80, 5.55)],
        start=1,
    ):
        add_box_product("IFCCOLUMN", f"Structural Column C{index:02d}", (x, y, 1.6), (0.45, 0.45, 3.2))
    add_box_product("IFCPUMP", "P-401 Proposed Replacement", (2.0, -2.15, 0.72), (3.0, 1.35, 1.44), "USERDEFINED")
    add_box_product("IFCPUMP", "P-402 Existing Duty Pump", (2.0, 2.15, 0.72), (3.0, 1.35, 1.44), "USERDEFINED")

    contained_id = next_id
    next_id += 1
    lines.append(
        f"#{contained_id}=IFCRELCONTAINEDINSPATIALSTRUCTURE('{_ifc_guid()}',#5,$,$,"
        f"({','.join(f'#{item}' for item in products)}),#18);"
    )
    digest_property = next_id
    pset = next_id + 1
    relation = next_id + 2
    lines.extend(
        [
            f"#{digest_property}=IFCPROPERTYSINGLEVALUE('DajoongSceneDigest',$,IFCTEXT('{scene_digest}'),$);",
            f"#{pset}=IFCPROPERTYSET('{_ifc_guid()}',#5,'Pset_BuildCrewProvenance',$,(#{digest_property}));",
            f"#{relation}=IFCRELDEFINESBYPROPERTIES('{_ifc_guid()}',#5,$,$,"
            f"({','.join(f'#{item}' for item in products)}),#{pset});",
            "ENDSEC;",
            "END-ISO-10303-21;",
        ]
    )
    destination.write_text("\n".join(lines), encoding="utf-8")
    return destination
