# Atlas UI/UX implementation decisions

Scope: the existing React/TypeScript/Vite workspace and independent Observer SPA. SRS controls business behavior; ADR controls technology; existing Figma tokens control appearance. This document records applied decisions, rather than introducing a new product architecture.

## Skill application

The requested [ui-ux-pro-max skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) was reviewed at commit `1a2c459b35f26116fd165b0a0f30597f252749ff`. Its broad design-system search and one narrower retry returned a documentation landing-page pattern. That pattern did not fit Atlas's IDE workspace, so generated recommendations were not persisted or applied wholesale. Relevant loading, empty-state, keyboard, responsive and React guidance was checked against the actual app. No new dependency, external font service or animation framework was added.

| Decision | Implementation | Purpose |
| --- | --- | --- |
| Dense workspace, progressive detail | Preserve existing sidebar, workbench, inspector and lazy Monaco/React Flow/xterm modules | ADR-011 SPA and developer workflow |
| Two equal themes | Preserve dark/light semantic colors and self-hosted Inter/JetBrains Mono | Existing Figma design system |
| User text scaling | Shared typography uses rem sizes and relative line heights | Browser text preferences scale titles, body and controls |
| Full status disclosure | Footer wraps and its grid row grows with text; safe-area bottom padding | Read disconnected scope and acknowledgement semantics on narrow displays |
| Touch navigation | Header icons cannot shrink below 44×44px on small screens/coarse pointers; drawer and search rows gain height | Reliable touch targets while preserving desktop IDE density |
| Search all local records | Rank the complete collection before limiting each rendered group to 50; unique item IDs and short ID hints distinguish same-name drafts | Records beyond row 50 remain discoverable and same-name items remain independently selectable |
| Loading and partial failure | Busy list, polite status, available collection results, explicit partial-error copy | Avoid silent failures and premature empty results |
| Cancelled reads | Closing/reopening invalidates earlier asynchronous results | Late responses cannot replace current search results |
| Keyboard continuity | Visible shortcuts; Escape returns to invoker; selected navigation preserves route focus | Predictable keyboard workflow |
| System contrast | Selected search and navigation rows retain an outline in forced colors | Selection remains distinguishable beyond background color |

## Platform references

These are functional references, with Atlas tokens and requirements retained:

- [VS Code workbench](https://code.visualstudio.com/docs/editing/getting-started/userinterface): a persistent workspace with command access and keyboard navigation. Atlas keeps its own module hierarchy and authority model.
- [Linear search](https://linear.app/docs/search): search across records with relevant grouped results. Atlas's device search remains explicitly local; it does not imply access to service records.
- [GitHub Primer responsive foundations](https://primer.style/product/getting-started/foundations/responsive/): adaptable layouts, text scaling, useful touch targets and support for user display preferences.

## SRS/ADR boundaries

| Requirement | UI/UX behavior and evidence |
| --- | --- |
| ADR-011 React/TypeScript/Vite IDE SPA | Existing stack preserved; no framework migration or new dependency; production build checks both entries |
| FR-4.2 plan-first and human admission | Navigation/search opens existing views; it does not approve plans or execute commands against a service |
| FR-4.4 retry/recovery and Unknown | Footer keeps acknowledgement distinct from execution; existing service state/retry guards remain subject to E2E tests |
| FR-6.2 independent approval eligibility | Search and display changes do not infer rights from roles or bypass grants |
| FR-7.6, NFR-2.4 Observer isolation | Separate entry/router/store remains; real two-host/cookie acceptance still requires deployment evidence |
| NFR-2.2 secret absence | No draft content is added to search indexing; existing secret-policy tests and service redaction continue to gate the app |
| NFR-2.3 tenant isolation | Palette labels device drafts explicitly; no tenant authority is assigned to IndexedDB records |

For the full product matrix and unresolved backend requirements, see [SRS-ADR-CONFORMANCE.md](SRS-ADR-CONFORMANCE.md). For measured results and reproducible commands, see [UI-UX-ACCEPTANCE.md](UI-UX-ACCEPTANCE.md).
