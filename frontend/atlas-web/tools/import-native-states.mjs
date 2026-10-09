// Reproduce the read-only Figma state transcription and Observer's independent route metadata.
import fs from 'node:fs';
const read = name => JSON.parse(fs.readFileSync(name, 'utf8'));
const frames = read('design-source/current-ui-frames.json').state;
const layouts = read('design-source/native-state-layout.json').frames;
const states = Object.entries(frames).map(([key, spec]) => {
  const frame = layouts.find(f => f.id === spec.dark);
  if (!frame) throw new Error(`Missing Figma transcription: ${key}`);
  const texts = frame.texts;
  const headings = texts.filter(t => t.x === 42 && t.size === 16).sort((a, b) => a.y - b.y);
  const rows = (x, valueX, from, to) => texts.filter(t => t.x === x && t.size === 12 && t.y > from && t.y < to).flatMap(t => {
    const value = texts.find(v => v.x === valueX && Math.abs(v.y - t.y) < 1);
    return value ? [{ label: t.text, example: value.text }] : [];
  });
  const scope = texts.find(t => t.x === 774 && t.text === 'Scope and lifecycle');
  const actions = texts.find(t => t.x === 774 && t.text === 'Available actions');
  if (!scope || !actions) throw new Error(`Missing state sections: ${key}`);
  return { key, module: spec.owner_route, dark: spec.dark, light: spec.light,
    title: texts.find(t => t.x === 25 && t.size === 24).text,
    purpose: texts.find(t => t.x === 25 && t.y === 107).text,
    panels: headings.map((h, i) => ({ title: h.text, rows: rows(42, 220, h.y, headings[i + 1]?.y ?? 900) })),
    scope: rows(774, 952, scope.y, actions.y),
    actions: texts.filter(t => t.x >= 786 && t.size === 12 && t.y > actions.y).map(t => t.text),
  };
});
if (states.length !== 18 || states.some(s => s.scope.length !== 3 || !s.panels.length)) throw new Error('Incomplete Current state transcription.');
fs.writeFileSync('src/generated/native-states.json', JSON.stringify(states, null, 2) + '\n');
const views = read('src/generated/views.json');
const scenes = fs.readdirSync('src/generated/scenes').flatMap(f => read(`src/generated/scenes/${f}`));
const observer = read('src/generated/routes.json').filter(r => r.module === 'observer').map(route => {
  const view = views.find(v => v.id === route.id);
  const scene = scenes.find(s => s.id === view.defaultScene);
  return { ...route, kind: scene.kind, purpose: scene.prodCopy, review: scene.copy, fields: scene.fields };
});
fs.writeFileSync('src/telemetry-console/routes.json', JSON.stringify(observer, null, 2) + '\n');
console.log(`Generated ${states.length} native states and ${observer.length} independent Observer routes.`);
