# R2-002 bundle extraction (remote, 2026-10-05T07:09Z)

Source: `GET /assets/index-CNIcNnJO.js` (334,974 chars, SHA-256 verified in R2-001) and `/assets/Connection-AA1_Uk-L.js`, fetched inside Cloudflare Browser Rendering. Snippets only; used for test design, not as PASS evidence.

## Router (index-CNIcNnJO.js)
- `function gt(e){let t=e.replace(/^#/,'').split('?')[0]||'home';return re.includes(t)?t:null}` → hash router, unknown route → `null`.
- `function _t(e){return new URLSearchParams(e.split('?')[1]||'')}` → query params inside the hash.
- Definition deep link builder: `new URLSearchParams({authority:'definitions',definition:e.id})` + optional `schema` → `#<module>?authority=definitions&definition=<id>&schema=<schemaId>`.
- Navigation guard: `hashchange` listener → if `yt(prev,next) && n().length` (unsaved work) keep a pending navigation (`a(e)`), otherwise navigate; cancel path uses `history.replaceState(null,'',r.current||'#home')`.
- Error boundary actions: `Reload workspace`, `Review recovery drafts`, `Return to overview` (`location.hash='#home'`).

## Theme / prefs
- Default theme state `'dark'`; `useEffect(()=>{document.documentElement.dataset.theme=s})`; `setTheme` persists with `repository.putPref('theme', …)` (IndexedDB `atlas-device-workspace-v10`, no localStorage use found).
- Diagnostics payload includes `displayDensity: documentElement.dataset.density`.

## Not found in index chunk
- `document.title` (no per-route title updates), `prefers-reduced-motion`, `forced-colors`, `showModal`, `"Escape"` (may live in `ui-BHoQ7tHD.js`/CSS — not concluded absent).

## index.html (served, 494 bytes)
`<!doctype html><html lang="en" data-theme="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>Atlas · Workspace</title> <script type="module" crossorigin src="/assets/index-CNIcNnJO.js"></script> <link rel="modulepreload" crossorigin href="/assets/ui-BHoQ7tHD.js"> <link rel="stylesheet" crossorigin href="/assets/index-CGLbd-qV.css"></head><body><div id="root"></div></body></html>`

## Connection chunk (Connection-AA1_Uk-L.js) — behaviour relevant to FX-SERVICE
- Audience select: `workspace` ("Workspace · authorized collaboration") / `observer` ("Observer · distinct public projection").
- Endpoint input `#service-endpoint` (type url), hint "HTTPS endpoint, or HTTP on localhost…".
- `Connect & inspect authority` → `client.connect(endpoint)`; success toast "Authenticated <audience> session loaded. Individual provider health and business outcomes remain unverified."
- `Disconnect UI` blocked with reason "No active session." when no session; toast "UI connection cleared. Server-side session revocation has not been asserted."
- `Request & verify service logout` blocked "Service logout capability not exposed." unless `caps.logoutHref`.
- Observed authority shows Subject/Scope/Expires/Grants/Exposed collections.
- Operation journal table (≤200 rows) with stage badge, `Reconcile original ID` (blocked when `NotSent`, scope mismatch, or no session).
- Notice: "Service adapter contract is proposed … requires Atlas UI v1 capability/session/collection/command responses".
