import assert from "node:assert/strict";
import test from "node:test";
import { conformanceFixtures, formatNativeExOutput, lessonFixtures, inputFixtures } from "./vim-fixtures.mjs";
import { runNativeVim } from "./native-vim-runner.mjs";

for (const fixture of [...lessonFixtures, ...inputFixtures, ...conformanceFixtures]) {
  test(`native Vim: ${fixture.id}`, () => {
    const result = runNativeVim(fixture);
    assert.deepEqual(result.code, fixture.targetCode);
    if (fixture.targetCursor) assert.deepEqual(result.cursor, fixture.targetCursor);
    if (fixture.targetMode) assert.equal(result.mode, fixture.targetMode);
    if (fixture.targetExOutput) assert.deepEqual(result.output, formatNativeExOutput(fixture.targetExOutput));
    for (const [name, expected] of Object.entries(fixture.targetRegisters || {})) {
      assert.deepEqual(result.registers[name], expected, `register ${name}`);
    }
  });
}
