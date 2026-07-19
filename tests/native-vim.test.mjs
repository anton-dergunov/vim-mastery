import assert from "node:assert/strict";
import test from "node:test";
import { lessonFixtures, inputFixtures } from "./vim-fixtures.mjs";
import { runNativeVim } from "./native-vim-runner.mjs";

for (const fixture of [...lessonFixtures, ...inputFixtures]) {
  test(`native Vim: ${fixture.id}`, () => {
    const result = runNativeVim(fixture);
    assert.deepEqual(result.code, fixture.targetCode);
    if (fixture.targetCursor) assert.deepEqual(result.cursor, fixture.targetCursor);
  });
}
