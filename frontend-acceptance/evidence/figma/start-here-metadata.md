# Figma file — pages and how it was read (corrected 2026-10-05, run 4)

File key `0md9BEFI1rU0aRAvf98TWO` ("AI Engineering Workspace — Full UI"), link supplied by the user. Read only; nothing written.

## Correction

Runs 2–3 stated that the file had only the pages "00 · Start here" and "03 · Design system", and blocked FIGMA-001 on that basis.
**That was wrong.** The MCP `get_metadata` listing returns only pages already loaded in the editor session. The Plugin API
(`use_figma`, `figma.root.children`) lists all 10 pages:

| Page id | Name | Used in run 4 for |
|---|---|---|
| 258:728 | 00 · Start here | file scope statements (below) |
| 236:728 | 01 · Current UI · Dark | 18 module frames `Atlas/Dark/<route>` → FIGMA-PARITY-*-DARK; 17 state frames; 49 `<type> · unified fields` frames → DEF-* oracle |
| 254:728 | 02 · Current UI · Light | 18 `Atlas/Light/<route>` frames → FIGMA-PARITY-*-LIGHT |
| 132:728 | 03 · Design system | components (not compared in run 4) |
| 342:3 | 04 · E2E Model | Planned inventory 210 (342:5) → canonical denominator; Journey register (342:8); Decision register (342:9); traceability 42 journeys / 174 steps (478:130933) → FE06-UXJ-042 |
| 359:592 | 05 · Gap closure · Dark | target designs for views missing in Current UI (referenced in coverage limitations) |
| 359:593 | 06 · Gap closure · Light | idem |
| 359:594 | 07 · Prototype flows | E2E review hub 501:117219 (the deployed app links here via "Open design review"); J01/J02 flows |
| 359:595 | 08 · Dev handoff | not used in run 4 |
| 278:728 | 90 · Archive | not used |

Transcriptions (fixed before the browser runs): `planned-inventory-210.{json,csv}`, `current-ui-frames.json`,
`definition-field-oracle-49.json`, `journey-trace-174.json`, `../../harness/data/figma-oracle.json`; generator `work/figma_data.py`, `work/figma_journeys.py`.

## Start-here statements (verbatim excerpts, frame 258:729)

- "184 Current views in Dark and Light · 49 authoring types per theme · 852 field instances."
- "This is a design and frontend review. It does not certify production or all 97 implementation packages. Illustrative content is labelled on every product frame."
- "97 UI packages, 210 planned views and 113 original UAT cases are not all completed or passed."
- "Proposed decisions and EX-LOCK-03 conflict remain open."

## Limits of the comparison

- Pixel comparison was not possible: figma.com render URLs are unreachable from the sandbox (egress proxy) and are short-lived credentials that must not be committed. Parity is measured on text/structure (titles, purpose lines, navigation IA, controls, field contracts) plus deployed screenshots.
- Illustrative sample content inside frames ("Design example · Illustrative UI content") is excluded from the parity oracle.
- Dark/Light module frames carry identical text: for all 18 pairs (`Atlas/Dark/<route>` vs `Atlas/Light/<route>`) the sorted unique text set has the same count and the same djb2 hash (e.g. home 63/b81e63c4, execution 71/ee87c63b, connection 55/2ca2b5c7). One transcribed oracle therefore serves both themes.
