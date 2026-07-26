# BuildCrew BIM Engine MCP

Four source-traceable tools expose the existing Dajoong spatial compiler as an industrial BuildCrew capability:

- `generate_semantic_bim`
- `place_candidate_in_project`
- `run_coordination_check`
- `export_bim_deliverables`

The engine never invents installation-critical dimensions. Dajoong may propose geometry, but a verified dimensional input and evidence reference are required before the object is exportable.

## Run

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -e ".[dev]"
.\.venv\Scripts\buildcrew-bim-mcp
```

The Streamable HTTP MCP endpoint is served at `http://127.0.0.1:8765/mcp`.

## Dajoong connector

Set `DAJOONG_SPATIAL_API_URL` and `DAJOONG_SPATIAL_API_KEY` to let Dajoong propose scene geometry. When they are absent, the engine uses only verified evidence values and explicitly reports `perception_mode=verified_dimensions`.
