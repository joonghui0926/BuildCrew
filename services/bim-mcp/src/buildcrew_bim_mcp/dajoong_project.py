from __future__ import annotations

import hashlib
import json
import os
import subprocess
from pathlib import Path
from typing import Any


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class DajoongProjectCompiler:
    """Build a reviewed Dajoong scene contract from a construction drawing.

    Dajoong's learned checkpoint proposes scene entities. Installation-critical
    positions remain backed by reviewed drawing regions before the graph is
    allowed to drive BIM geometry.
    """

    def __init__(self, root: Path | None = None) -> None:
        configured = os.getenv("DAJOONG_COMPILER_ROOT", "")
        self.root = root or Path(
            configured or r"C:\Users\jjoon\OneDrive\Documents\Dajoong-Spatial-Compiler"
        )

    @property
    def available(self) -> bool:
        return (
            (self.root / "src" / "dajoong_spatial_compiler").is_dir()
            and self.runtime_python.is_file()
        )

    @property
    def runtime_python(self) -> Path:
        configured = os.getenv("DAJOONG_PYTHON", "")
        if configured:
            return Path(configured)
        windows_python = self.root / ".venv" / "Scripts" / "python.exe"
        if windows_python.is_file():
            return windows_python
        return self.root / ".venv" / "bin" / "python"

    def compile_m601(self, drawing_path: Path, destination: Path) -> dict[str, Any]:
        if not self.available:
            raise RuntimeError(
                "Dajoong Spatial Compiler is unavailable. Set DAJOONG_COMPILER_ROOT "
                "and DAJOONG_PYTHON."
            )

        drawing_path = drawing_path.resolve(strict=True)
        entity_specs = [
            ("room-main", "room", "Mechanical Room", (0.098, 0.126, 0.606, 0.635), (8.0, 6.0, 1.6), (16.0, 12.0, 3.2)),
            ("wall-north", "wall", "North wall", (0.098, 0.126, 0.606, 0.018), (8.0, 0.0, 1.6), (16.0, 0.22, 3.2)),
            ("wall-south", "wall", "South wall", (0.098, 0.744, 0.606, 0.018), (8.0, 12.0, 1.6), (16.0, 0.22, 3.2)),
            ("wall-west", "wall", "West wall", (0.098, 0.126, 0.018, 0.636), (0.0, 6.0, 1.6), (0.22, 12.0, 3.2)),
            ("wall-east", "wall", "East wall", (0.687, 0.126, 0.018, 0.636), (16.0, 6.0, 1.6), (0.22, 12.0, 3.2)),
            ("door-north", "door", "North access door", (0.402, 0.126, 0.050, 0.074), (8.1, 0.0, 1.05), (1.2, 0.22, 2.1)),
            ("door-south", "door", "South-east access door", (0.650, 0.682, 0.055, 0.080), (14.7, 12.0, 1.05), (1.1, 0.22, 2.1)),
            ("column-nw", "column", "Column A1", (0.103, 0.126, 0.022, 0.034), (0.55, 0.45, 1.6), (0.45, 0.45, 3.2)),
            ("column-nc", "column", "Column A2", (0.361, 0.126, 0.022, 0.034), (7.4, 0.45, 1.6), (0.45, 0.45, 3.2)),
            ("column-ne", "column", "Column A3", (0.605, 0.126, 0.022, 0.034), (13.8, 0.45, 1.6), (0.45, 0.45, 3.2)),
            ("column-sw", "column", "Column C1", (0.103, 0.728, 0.022, 0.034), (0.55, 11.55, 1.6), (0.45, 0.45, 3.2)),
            ("column-sc", "column", "Column C2", (0.361, 0.728, 0.022, 0.034), (7.4, 11.55, 1.6), (0.45, 0.45, 3.2)),
            ("column-se", "column", "Column C3", (0.605, 0.728, 0.022, 0.034), (13.8, 11.55, 1.6), (0.45, 0.45, 3.2)),
            ("equipment-p401", "mechanical_equipment", "P-401", (0.414, 0.239, 0.176, 0.137), (10.1, 4.0, 0.72), (3.0, 1.35, 1.44)),
            ("equipment-p402", "mechanical_equipment", "P-402", (0.414, 0.439, 0.176, 0.137), (10.1, 8.0, 0.72), (3.0, 1.35, 1.44)),
        ]
        destination.mkdir(parents=True, exist_ok=True)
        manifest_path = destination / "m601-reviewed-input.json"
        manifest_path.write_text(
            json.dumps(
                {
                    "source_sha256": _sha256(drawing_path),
                    "entities": [
                        {
                            "id": entity_id,
                            "kind": kind,
                            "label": label,
                            "bbox": {
                                "x": box[0],
                                "y": box[1],
                                "width": box[2],
                                "height": box[3],
                            },
                            "center_m": center,
                            "size_m": size,
                            "confidence": 0.99,
                        }
                        for entity_id, kind, label, box, center, size in entity_specs
                    ],
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        bridge = Path(__file__).with_name("dajoong_bridge.py")
        completed = subprocess.run(
            [
                str(self.runtime_python),
                str(bridge),
                "--dajoong-root",
                str(self.root),
                "--drawing",
                str(drawing_path),
                "--manifest",
                str(manifest_path),
                "--destination",
                str(destination),
            ],
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        result = json.loads(completed.stdout.strip().splitlines()[-1])
        return {
            **result,
            "runtime": str(self.runtime_python),
            "review_manifest": str(manifest_path),
        }
