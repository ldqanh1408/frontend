// Captures the real production/review builds locally; this does not publish either build.
import { preview } from 'vite';
import { chromium } from 'playwright-core';
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
const out = path.resolve(process.argv[2] || 'ui-review/evidence');
const modules = ['home', 'specifications', 'code', 'agents', 'resources', 'workflow', 'execution', 'governance', 'memory', 'gateway', 'collaboration', 'configuration', 'identity', 'tenancy', 'saas', 'desktop', 'observer', 'connection'];
const production = await preview({ preview: { host: '127.0.0.1', port: 4173, strictPort: true } });
const review = await preview({ build: { outDir: 'dist-review' }, preview: { host: '127.0.0.1', port: 4174, strictPort: true } });
const browser = await chromium.launch();
const metrics = [];
const nativeStates = JSON.parse(await readFile('src/generated/native-states.json', 'utf8'));
const focusExecution = async page => {
  await page.locator('.review-state-control').evaluate(el => {
  const main = document.getElementById('main');
  if (main) main.scrollTop += el.getBoundingClientRect().top - main.getBoundingClientRect().top - 16;
  });
  if (page.viewportSize().width >= 1024) {
    await page.locator('.react-flow__edge-path').first().waitFor({ state: 'attached' });
    await page.waitForFunction(() => [...document.querySelectorAll('.react-flow__edge-path')].every(path => path.getAttribute('d')));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
};
const scenes = (await Promise.all((await readdir('src/generated/scenes')).map(async file => JSON.parse(await readFile(`src/generated/scenes/${file}`, 'utf8'))))).flat();
try {
  for (const theme of ['dark', 'light']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: theme });
    await context.addInitScript(t => { localStorage.setItem('atlas.theme', t); localStorage.setItem('atlas.observer.theme', t); }, theme);
    const page = await context.newPage();
    for (const name of [...modules, 'sign-in', 'sign-in/help', 'invitations', 'observer/sign-in']) {
      await page.goto(`http://127.0.0.1:4173/${name === 'home' ? '' : name}`, { waitUntil: 'networkidle' });
      await page.locator('h1').first().waitFor(); await page.evaluate(() => document.fonts.ready);
      await mkdir(`${out}/after`, { recursive: true });
      await page.screenshot({ path: `${out}/after/${name.replaceAll('/', '_')}-${theme}.png` });
      if (theme === 'dark') metrics.push({ name, ...await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, jsBytes: performance.getEntriesByType('resource').filter(r => r.name.endsWith('.js')).reduce((a, r) => a + r.encodedBodySize, 0) })) });
    }
    for (const [name, route] of [['specifications-open', '/specifications'], ['code-open', '/code'], ['agents-draft', '/agents'], ['resources-draft', '/resources'], ['memory-draft', '/memory'], ['configuration-draft', '/configuration']]) {
      await page.goto(`http://127.0.0.1:4173${route}`, { waitUntil: 'networkidle' });
      if (name.startsWith('specifications')) { await page.getByRole('button', { name: 'New document' }).first().click(); await page.getByRole('button', { name: 'Create', exact: true }).click(); await page.locator('.monaco-editor').waitFor(); }
      else if (name.startsWith('code')) { await page.locator('input[type=file]').setInputFiles(path.resolve('src/lib')); await page.getByRole('treeitem', { name: /storage\.ts/ }).click(); await page.locator('.monaco-editor').waitFor(); }
      else { await page.locator('.page-head').getByRole('button', { name: /^New / }).click(); await page.locator('#definition-name').waitFor(); }
      for (const dismiss of await page.locator('.toast-region button').all()) await dismiss.click();
      await page.screenshot({ path: `${out}/after/${name}-${theme}.png` });
      for (const width of [390, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        await page.screenshot({ path: `${out}/after/${name}-${width}-${theme}.png` });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    for (const width of [390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const name of ['home', 'execution', 'sign-in', 'governance']) {
        await page.goto(`http://127.0.0.1:4174/${name === 'home' ? '' : name}`, { waitUntil: 'networkidle' });
        await page.locator('h1').first().waitFor();
        if (name === 'execution') await focusExecution(page);
        await mkdir(`${out}/review`, { recursive: true });
        await page.screenshot({ path: `${out}/review/${name}-${width}-${theme}.png` });
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('http://127.0.0.1:4174/execution', { waitUntil: 'networkidle' });
    await focusExecution(page);
    for (const state of ['parallel', 'checkpoint', 'failed', 'budget', 'paused', 'cleanup', 'completed']) {
      await page.getByLabel('Review run state').selectOption(state);
      await page.screenshot({ path: `${out}/review/execution-${state}-${theme}.png` });
    }
    await page.getByLabel('Review run state').selectOption('running');
    for (const tab of ['Context', 'Access']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await page.screenshot({ path: `${out}/review/execution-inspector-${tab.toLowerCase()}-${theme}.png` });
    }
    await page.getByRole('tab', { name: 'Task', exact: true }).click();
    for (const tab of ['Terminal', 'Artifacts', 'Memory', 'Thought tree']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await page.locator('.execution-dock').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${out}/review/execution-dock-${tab.toLowerCase().replaceAll(' ', '-')}-${theme}.png` });
    }
    await mkdir(`${out}/native`, { recursive: true });
    for (const state of nativeStates) {
      const route = state.module === 'observer' ? `/observer/states/${state.key}` : `/states/${state.key}`;
      await page.goto(`http://127.0.0.1:4174${route}`, { waitUntil: 'networkidle' });
      await page.locator(`[data-native-state="${state.key}"]`).waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${out}/native/${state.key}-${theme}.png`, fullPage: state.module === 'observer' });
    }
    await mkdir(`${out}/archive`, { recursive: true });
    for (const [module, heading] of [['tenancy','Organization setup & readiness'],['identity','Membership, invitations & effective access'],['agents','Workspace resource inheritance'],['memory','Workspace memory layers'],['workflow','Plan-first · service proposals'],['collaboration','Your inbox'],['gateway','Budget layers & resolved limits'],['governance','Risk & independent approval'],['observer','Observation health']]) {
      await page.goto(`http://127.0.0.1:4173/${module}`, { waitUntil: 'networkidle' });
      const panel = page.getByRole('heading', { name: heading, exact: true });
      await panel.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${out}/archive/${module}-${theme}.png` });
    }
    await mkdir(`${out}/scenes`, { recursive: true });
    for (const kind of ['ide', 'review', 'table', 'statepattern', 'run', 'observer', 'trace', 'terminal', 'diff', 'merge', 'plan', 'tasklist', 'workflow', 'palette']) {
      const scene = scenes.find(s => s.kind === kind && (kind === 'tasklist' || !/^execution(?:-|$)/.test(s.key)));
      await page.goto(`http://127.0.0.1:4173/execution/runs?state=${encodeURIComponent(scene.id)}`, { waitUntil: 'networkidle' });
      await page.locator('h1').first().waitFor();
      await page.screenshot({ path: `${out}/scenes/${kind}-${theme}.png` });
    }
    await mkdir(`${out}/definitions`, { recursive: true });
    const shotDefinition = async key => page.screenshot({ path: `${out}/definitions/${key}-${theme}.png` });
    await page.goto('http://127.0.0.1:4173/definitions', { waitUntil: 'networkidle' });
    await shotDefinition('catalogue');
    await page.goto('http://127.0.0.1:4173/definitions/agent', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Create local definition' }).click();
    await page.getByRole('button', { name: 'Validate complete definition' }).click();
    await page.locator('.error-summary').waitFor();
    await shotDefinition('validation');
    await page.fill('#definition-name', 'UI review device draft');
    await page.getByRole('button', { name: 'Save local revision' }).click();
    await page.getByText('Device revision 2', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'History / compare' }).click();
    await page.getByRole('dialog', { name: 'Saved definition history' }).waitFor();
    await shotDefinition('history');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    await page.getByText('Archived definitions are read-only. Restore to edit.').waitFor();
    await shotDefinition('archive');
    await page.getByRole('button', { name: 'Restore', exact: true }).click();
    await page.locator('#definition-name:not([disabled])').waitFor();
    const other = await context.newPage();
    await other.goto(page.url(), { waitUntil: 'networkidle' });
    await other.fill('#definition-name', 'Saved in another tab');
    await page.fill('#definition-name', 'Unsaved in this tab');
    await other.getByRole('button', { name: 'Save local revision' }).click();
    await page.getByText('Changed in another tab', { exact: true }).waitFor();
    await shotDefinition('conflict');
    await other.close();
    await page.getByRole('button', { name: /^Discard and load/ }).click();
    await page.getByRole('complementary', { name: 'Lifecycle and readiness' }).scrollIntoViewIfNeeded();
    await shotDefinition('handoff');
    await page.getByRole('button', { name: 'Select saved revisions' }).first().click();
    await page.getByRole('dialog').waitFor();
    await shotDefinition('revision-pins');
    await context.close();
  }
  await writeFile(`${out}/capture-metrics.json`, JSON.stringify(metrics, null, 2));
  console.log('Captured production, review states, opened IDEs and draft workbenches in both themes.');
} finally { await browser.close(); await new Promise(r => production.httpServer.close(r)); await new Promise(r => review.httpServer.close(r)); }
