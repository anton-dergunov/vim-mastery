import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const rootPath = new URL("../", import.meta.url).pathname;
const contentPath = join(rootPath, "content");
const readJson = name => JSON.parse(readFileSync(join(contentPath, name), "utf8"));

const catalog = readJson("practice-samples.json");
const schema = readJson("practice-samples.schema.json");
const languageProfiles = readJson("language-profiles.json");
const profileIds = new Set(languageProfiles.profiles.map(profile => profile.id));

// The free practice slab exposes 296px of text column at 360px: 360 less the
// 8px game-area padding, the 2px slab border, the 10px code-body padding, the
// 26px line-number gutter, the 11px cm-content padding and the 7px cm-line
// padding. At 14px that is 35.2 monospace characters, and the horizontal axis
// is unreachable by touch because .game-area pins touch-action to pan-y. 34
// keeps a column of headroom for font-stack variation between macOS and CI.
const MAX_COLUMNS = 34;

// The brief names these sixteen. Pinning the exact set rather than a floor
// makes a silent language swap visible in the diff.
const EXPECTED_LANGUAGES = [
  "css", "csv", "go", "html", "javascript", "json", "log", "markdown",
  "prose", "python", "rust", "shell", "sql", "toml", "typescript", "yaml",
];

test("the practice sample schema keeps its published shape", () => {
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.$id, "https://vimwilds.local/schemas/practice-samples.schema.json");
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.schemaVersion, { const: 1 });
  assert.equal(schema.$defs.sample.additionalProperties, false);
  assert.deepEqual(schema.$defs.sample.required, ["id", "fileName", "languageId", "summary", "lines"]);
  assert.equal(schema.$defs.sample.properties.lines.minItems, 20);
  assert.equal(schema.$defs.sample.properties.lines.maxItems, 60);
  assert.equal(schema.$defs.sample.properties.lines.items.maxLength, MAX_COLUMNS);
  assert.equal(catalog.schemaVersion, 1);
  assert.match(catalog.contentVersion, /^[0-9]+\.[0-9]+\.[0-9]+$/);
});

test("the catalog ships twenty uniquely named buffers", () => {
  assert.equal(catalog.samples.length, 20);
  const ids = catalog.samples.map(sample => sample.id);
  const fileNames = catalog.samples.map(sample => sample.fileName);
  assert.equal(new Set(ids).size, ids.length, "sample ids must be unique");
  assert.equal(new Set(fileNames).size, fileNames.length, "file names must be unique");
  for (const sample of catalog.samples) {
    assert.match(sample.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${sample.id} is not a kebab id`);
    // The file name is what `%` and `Ctrl-r%` will read once the file-name
    // register lands, so it stays a bare name with no path separator.
    assert.match(sample.fileName, /^[A-Za-z0-9][A-Za-z0-9._-]*$/, `${sample.id} has an unusable file name`);
    assert(sample.summary.length > 0 && sample.summary.length <= 80,
      `${sample.id} summary is ${sample.summary.length} characters; it renders in a 360px picker row`);
  }
});

test("the buffers span the authored language set", () => {
  const languages = [...new Set(catalog.samples.map(sample => sample.languageId))].sort();
  assert.deepEqual(languages, EXPECTED_LANGUAGES);
  for (const sample of catalog.samples) {
    assert(profileIds.has(sample.languageId), `${sample.id} uses unregistered language ${sample.languageId}`);
  }
});

test("every buffer is long enough to automate and narrow enough to read", () => {
  for (const sample of catalog.samples) {
    const lines = sample.lines;
    assert(lines.length >= 20 && lines.length <= 60,
      `${sample.id} has ${lines.length} lines; automation needs 20 and a scratch file stops at 60`);
    lines.forEach((line, index) => {
      assert(line.length <= MAX_COLUMNS,
        `${sample.id}:${index + 1} is ${line.length} columns; the 360px slab shows ${MAX_COLUMNS}`);
      // A tab renders at a variable width, which breaks the column budget the
      // line above depends on. Space-indent even the Go sample.
      assert(!line.includes("\t"), `${sample.id}:${index + 1} contains a tab`);
      assert.equal(line, line.replace(/\s+$/, ""), `${sample.id}:${index + 1} has trailing whitespace`);
    });
  }
});

test("no buffer is uniform enough to make a poor automation target", () => {
  for (const sample of catalog.samples) {
    const widths = new Set(sample.lines.map(line => line.length));
    assert(widths.size >= 6,
      `${sample.id} has only ${widths.size} distinct line widths; scattered matches need ragged rows`);
    assert(Math.max(...widths) >= 24,
      `${sample.id} is too narrow to exercise horizontal motions`);
  }
  // Buffer length is an outcome of what each file needs, never a band authored
  // to. A catalog whose lengths clustered would mean the opposite happened.
  const lengths = new Set(catalog.samples.map(sample => sample.lines.length));
  assert(lengths.size >= 10, `only ${lengths.size} distinct buffer lengths across 20 samples`);
});
