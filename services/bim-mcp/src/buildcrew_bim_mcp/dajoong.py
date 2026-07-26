from __future__ import annotations

import os
from pathlib import Path

import httpx


class DajoongConnector:
    """Optional proposal-only connector to the existing Dajoong compiler."""

    def __init__(self) -> None:
        self.base_url = os.getenv("DAJOONG_SPATIAL_API_URL", "").rstrip("/")
        self.api_key = os.getenv("DAJOONG_SPATIAL_API_KEY", "")

    @property
    def configured(self) -> bool:
        return bool(self.base_url and self.api_key)

    async def propose_scene(self, drawing_paths: list[Path]) -> dict | None:
        if not self.configured or not drawing_paths:
            return None

        drawing = drawing_paths[0]
        headers = {"authorization": f"Bearer {self.api_key}"}
        async with httpx.AsyncClient(timeout=120) as client:
            with drawing.open("rb") as handle:
                response = await client.post(
                    f"{self.base_url}/v1/compile",
                    headers=headers,
                    files={"file": (drawing.name, handle, "application/octet-stream")},
                    data={"review_state": "review_required"},
                )
            response.raise_for_status()
            return response.json()
