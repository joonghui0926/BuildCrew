# BuildCrew Web

Firebase-hosted BuildCrew case workspace built with Next.js static export.

## Run

```bash
pnpm dev
```

Open `http://localhost:3000`.

Firebase configuration lives in `src/lib/firebase/client.ts`. Sensitive CrewAI and Autodesk tokens belong in Firebase Functions secrets, never in client code.

The page exports to `out/` and is deployed by the repository-level Firebase configuration.
