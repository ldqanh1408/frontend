# atlas-web

Atlas — AI engineering workspace frontend, rebuilt from the Figma E2E delivery (file `0md9BEFI1rU0aRAvf98TWO`) and the
`Atlas-E2E-Delivery` package in `design-source/`.

## Run

```bash
npm ci
npm run dev            # http://localhost:5173
npm run check          # typecheck + unit tests + production build
npx playwright test    # e2e + axe (WCAG 2.2 AA) against `vite preview`, which serves the production headers
```

Chromium for Playwright is expected at `PLAYWRIGHT_BROWSERS_PATH` (CI installs it with `npx playwright install chromium`).

## How the app is put together

| Area | Where |
|---|---|
| Design data (210 views, 751 scenes, 49 definition types, 39 lifecycles, 55 source actions) | `tools/import-design.mjs` → `src/generated/` (`npm run import:design`) |
| Shell (nav 236px, app bar, status bar, palette, help, preferences) | `src/shell/` |
| Device authority: IndexedDB drafts, revisions, CAS across tabs | `src/lib/storage.ts`, `definitions.ts`, `documents.ts`, `workflows.ts`, `sources.ts` |
| Service authority: proposed `atlas-ui/v1` adapter | `src/data/service.ts` |
| Module pages (service records, device-draft modules, connection) | `src/views/modules/` |
| Specifications IDE, Code intelligence, Workflow | `src/views/specs/`, `src/views/code/`, `src/views/workflow/` |
| The 210 planned views | `src/views/ViewPage.tsx` + `src/views/scene/` |

Rules the UI keeps everywhere:

- Nothing is shown as a service result unless a service returned it. Without a session, views show their structure and
  "Not observed"; protected actions stay visible but disabled with the specific reason.
- Roles never authorize by name; an action is enabled only by a grant in the current session.
- Commands: one POST per activation (`Idempotency-Key`, `X-CSRF-Token`, `If-Match`); any unclear outcome is `Unknown`
  and is reconciled by status read, never re-sent; `Effective` requires an effect readback that matches operation,
  scope, resource and input fingerprint; 401 or expiry ends the session and withdraws service feedback.
- Fixture wording from the design (sample ids, SHAs) appears only in the review build (`npm run build:review`), labelled
  "Illustrative". The production build contains no fixture data or synthetic success handlers.

## Release and staging

```bash
npm run release                          # build with the source commit as build id, write release/staging + SHA-256 manifest
git add release/staging && git commit    # the artifact commit
npm run worker:staging -- <artifact-commit-sha>   # writes deploy/staging-worker.js pinned to that commit
```

`deploy/staging-worker.js` serves only the files listed in the release manifest, fetched from the artifact commit and
verified by SHA-256 before they are served or cached, with the security headers from `public/_headers`. CI
(`.github/workflows/atlas-web.yml`) re-checks that the release rebuilds byte-for-byte from its source commit and runs the
e2e suite plus HTTP checks (`RELEASE_CHECK=1`) against the URL in `deploy/staging-target.json`.
