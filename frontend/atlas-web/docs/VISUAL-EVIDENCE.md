# Visual regression and private evidence

Public CI retains source, test cases and JSON/log results without screenshot, video or trace bytes. Automatic approval review rejected public screenshot publication, so the original PNG baselines and review images remain private. Images are not republished using another path or encoding.

`layout-chromium` checks 150 cases: 25 views at 390, 1024 and 1440 CSS pixels in both themes, including opened editors. It asserts visible headings, page bounds and the selected theme. Performance is checked separately. These are layout checks, not pixel-comparison results.

`visual-chromium` retains the original Playwright pixel comparator with a maximum changed-pixel ratio of 0.005. Exact SHA comparison was investigated but rejected because harmless rasterization and hover differences made it unreliable. SHA-256 remains useful for evidence integrity, not visual equality. The pixel gate requires private PNG baselines and runs locally; it is not claimed as a public CI gate.

```sh
# Public source/functional/layout pipeline
npx playwright test --project=chromium --project=firefox --project=webkit
npx playwright test --project=layout-chromium

# Private visual acceptance: restore reviewed baseline PNGs into this private folder first
ATLAS_VISUAL_BASELINE_DIR=/absolute/private/baselines npx playwright test e2e/visual.spec.ts --project=visual-chromium
```

For an intentional UI change, capture candidate baselines privately with Playwright `--update-snapshots`, inspect them, then rerun without that flag. Baseline generation is calibration, not acceptance. Browser engine, operating system, fonts, dimensions and masks must be recorded with the evidence. No live staging, backend or production claim follows from local frontend checks.
