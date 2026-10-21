// Keep this detector identical to SAMPLE in tools/import-design.mjs. Local documents are tested separately.
const PERSONAS = 'Alex|Morgan|Riley|Mira|Nora|Sam|Priya|Jordan';
export const SAMPLE_TEXT = new RegExp(String.raw`\b(?:[A-Z]{1,2}-\d{2,}|[a-z]{1,4}-\d{1,4}(?:@\d+)?|(?=[0-9a-f]*\d)[0-9a-f]{7,40}|[A-Z][a-z]+@\d+|#\d{2,}|fence \d+|seq \d+[–-]\d+|v\d+\.\d+\.\d+` +
  String.raw`|(?:rev|revision|draft|epoch|attempt|lease) \d+|r\d+|\d+(?:[.,]\d+)?\s?(?:ms|s|min|files?|tokens|KB|MB|GB|items|matches|results)|\d+\s*\/\s*\d+|[A-Z]=\d+(?:\.\d+)?` +
  String.raw`|(?:fld|doc|col|ws|org|prj|env|ctx|att|op|wf|inv|sess|trace|span|snap|idx|pkg)-[a-z][a-z0-9-]*|[\w.+-]+@[\w-]+\.[a-z]{2,}|${PERSONAS})\b` +
  String.raw`|\d+(?:\.\d+)?%|(?:→|->)\s*\d+|\$\d|in this fixture|Fixture:`);
