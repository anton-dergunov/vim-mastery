import assert from "node:assert/strict";
import test from "node:test";
import { classifySemanticEffect } from "../vim-effects.js";

function offsetFor(text, [row, column]) {
  return text.split("\n").slice(0, row).reduce((total, line) => total + line.length + 1, 0) + column;
}

function snapshot({
  text,
  cursor = [0, 0],
  anchor = cursor,
  mode = "normal",
  ranges = null,
  registers = {},
  recording = false,
  macroRegister = null,
}) {
  const cursorOffset = offsetFor(text, cursor);
  const anchorOffset = offsetFor(text, anchor);
  return {
    text,
    cursor: cursorOffset,
    head: cursorOffset,
    anchor: anchorOffset,
    cursorPosition: cursor,
    anchorPosition: anchor,
    mode,
    ranges: ranges || [{
      anchor,
      head: cursor,
      from: anchorOffset <= cursorOffset ? anchor : cursor,
      to: anchorOffset <= cursorOffset ? cursor : anchor,
    }],
    registers,
    macro: { recording, playing: false, register: macroRegister },
  };
}

function change(before, after, deletedText = "", insertedText = "") {
  return { before, after, deletedText, insertedText };
}

test("classifies operator and text-object ranges in source document coordinates", () => {
  const dw = classifySemanticEffect({
    before: snapshot({ text: "one two" }),
    after: snapshot({ text: "two" }),
    keys: ["d", "w"],
    changes: [change(
      { from: [0, 0], to: [0, 4] },
      { from: [0, 0], to: [0, 0] },
      "one ",
      "",
    )],
  });
  assert.deepEqual(dw.ranges, [{ from: [0, 0], to: [0, 4] }]);
  assert.equal(dw.type, "range-change");
  assert.equal(dw.operation, "delete");

  const inside = classifySemanticEffect({
    before: snapshot({ text: "call(one, two)", cursor: [0, 7] }),
    after: snapshot({ text: "call()", cursor: [0, 5] }),
    keys: ["d", "i", "("],
    changes: [change(
      { from: [0, 5], to: [0, 13] },
      { from: [0, 5], to: [0, 5] },
      "one, two",
      "",
    )],
  });
  assert.deepEqual(inside.ranges, [{ from: [0, 5], to: [0, 13] }]);
  assert.equal(inside.operation, "delete");
});

test("classifies linewise yank and put without treating the yank as a document edit", () => {
  const before = snapshot({ text: "alpha\nbeta", cursor: [0, 2], registers: {} });
  const yanked = snapshot({
    text: "alpha\nbeta",
    cursor: [0, 2],
    registers: {
      "0": { text: "alpha\n", type: "linewise" },
      '"': { text: "alpha\n", type: "linewise" },
    },
  });
  const capture = classifySemanticEffect({ before, after: yanked, keys: ["y", "y"] });
  assert.equal(capture.type, "capture");
  assert.equal(capture.operation, "yank");
  assert.deepEqual(capture.ranges, [{ from: [0, 0], to: [1, 0] }]);

  const put = classifySemanticEffect({
    before: yanked,
    after: snapshot({ text: "alpha\nalpha\nbeta", cursor: [1, 0], registers: yanked.registers }),
    keys: ["p"],
    changes: [change(
      { from: [1, 0], to: [1, 0] },
      { from: [1, 0], to: [2, 0] },
      "",
      "alpha\n",
    )],
  });
  assert.equal(put.type, "materialize");
  assert.deepEqual(put.ranges, [{ from: [1, 0], to: [2, 0] }]);
});

test("preserves distinct Visual Character, Line, and Block geometry", () => {
  const character = classifySemanticEffect({
    before: snapshot({ text: "alpha" }),
    after: snapshot({ text: "alpha", mode: "visual", anchor: [0, 0], cursor: [0, 4] }),
    keys: ["v", "e"],
  });
  assert.equal(character.selectionKind, "character");
  assert.deepEqual(character.ranges, [{ from: [0, 0], to: [0, 4] }]);

  const line = classifySemanticEffect({
    before: snapshot({ text: "alpha\nbeta" }),
    after: snapshot({ text: "alpha\nbeta", mode: "visual-line", anchor: [0, 0], cursor: [1, 0] }),
    keys: ["V", "j"],
  });
  assert.equal(line.selectionKind, "line");
  assert.deepEqual(line.ranges, [{ from: [0, 0], to: [1, 4] }]);

  const blockRanges = [
    { anchor: [0, 1], head: [0, 3], from: [0, 1], to: [0, 3] },
    { anchor: [1, 1], head: [1, 3], from: [1, 1], to: [1, 3] },
    { anchor: [2, 1], head: [2, 3], from: [2, 1], to: [2, 3] },
  ];
  const block = classifySemanticEffect({
    before: snapshot({ text: "abcd\nabcd\nabcd" }),
    after: snapshot({
      text: "abcd\nabcd\nabcd",
      mode: "visual-block",
      anchor: [0, 1],
      cursor: [2, 2],
      ranges: blockRanges,
    }),
    keys: ["Ctrl-v", "2", "j", "l"],
  });
  assert.equal(block.selectionKind, "block");
  assert.deepEqual(block.ranges, blockRanges.map(({ from, to }) => ({ from, to })));
});

test("classifies dot and macro replay as reduced-intensity ordinary range effects", () => {
  const repeated = classifySemanticEffect({
    before: snapshot({ text: "old old", cursor: [0, 4] }),
    after: snapshot({ text: "old new", cursor: [0, 6] }),
    keys: ["."],
    changes: [change(
      { from: [0, 4], to: [0, 7] },
      { from: [0, 4], to: [0, 7] },
      "old",
      "new",
    )],
  });
  assert.equal(repeated.type, "repeat");
  assert.equal(repeated.operation, "dot");
  assert.equal(repeated.replayType, "range-change");
  assert.equal(repeated.intensity, 0.7);

  const macro = classifySemanticEffect({
    before: snapshot({ text: "call()\ncall()", cursor: [1, 0] }),
    after: snapshot({ text: "// call()\n// call()", cursor: [1, 3] }),
    keys: ["@", "a"],
    changes: [
      change({ from: [0, 0], to: [0, 0] }, { from: [0, 0], to: [0, 3] }, "", "// "),
      change({ from: [1, 0], to: [1, 0] }, { from: [1, 0], to: [1, 3] }, "", "// "),
    ],
  });
  assert.equal(macro.type, "repeat");
  assert.equal(macro.operation, "macro");
  assert.equal(macro.replayType, "materialize");
  assert.equal(macro.ranges.length, 2);
});

test("classifies search and substitution matches without including nonmatches", () => {
  const search = classifySemanticEffect({
    before: snapshot({ text: "draft keep draft" }),
    after: snapshot({ text: "draft keep draft", cursor: [0, 11] }),
    keys: ["/", ..."draft", "Enter"],
  });
  assert.equal(search.type, "matches");
  assert.equal(search.phase, "search");
  assert.deepEqual(search.ranges, [
    { from: [0, 0], to: [0, 5] },
    { from: [0, 11], to: [0, 16] },
  ]);

  const substitute = classifySemanticEffect({
    before: snapshot({ text: "old keep old" }),
    after: snapshot({ text: "new keep new" }),
    keys: [":", ..."s/old/new/g", "Enter"],
    changes: [
      change({ from: [0, 0], to: [0, 3] }, { from: [0, 0], to: [0, 3] }, "old", "new"),
      change({ from: [0, 9], to: [0, 12] }, { from: [0, 9], to: [0, 12] }, "old", "new"),
    ],
  });
  assert.equal(substitute.type, "matches");
  assert.equal(substitute.operation, "substitute");
  assert.deepEqual(substitute.ranges, [
    { from: [0, 0], to: [0, 3] },
    { from: [0, 9], to: [0, 12] },
  ]);

  const globalDelete = classifySemanticEffect({
    before: snapshot({ text: "DEBUG one\nkeep\nDEBUG two" }),
    after: snapshot({ text: "keep" }),
    keys: [":", ..."g/DEBUG/d", "Enter"],
    changes: [change(
      { from: [0, 0], to: [2, 9] },
      { from: [0, 0], to: [0, 0] },
      "DEBUG one\nkeep\nDEBUG two",
      "keep",
    )],
  });
  assert.equal(globalDelete.type, "matches");
  assert.equal(globalDelete.phase, "global");
  assert.equal(globalDelete.operation, null);
  assert.deepEqual(globalDelete.ranges, [
    { from: [0, 0], to: [1, 0] },
    { from: [2, 0], to: [2, 9] },
  ]);
});

test("classifies macro recording, mark jumps, undo, and redo vocabulary", () => {
  const record = classifySemanticEffect({
    before: snapshot({ text: "alpha" }),
    after: snapshot({ text: "alpha", recording: true, macroRegister: "a" }),
    keys: ["q", "a"],
  });
  assert.equal(record.operation, "macro");
  assert.equal(record.phase, "record-start");

  const jump = classifySemanticEffect({
    before: snapshot({ text: "one\ntwo", cursor: [1, 2] }),
    after: snapshot({ text: "one\ntwo", cursor: [0, 1] }),
    keys: ["`", "a"],
  });
  assert.equal(jump.type, "jump");
  assert.deepEqual(jump.trace, { from: [1, 2], to: [0, 1] });

  for (const [key, direction] of [["u", "undo"], ["Ctrl-r", "redo"]]) {
    const rewind = classifySemanticEffect({
      before: snapshot({ text: "alpha;" }),
      after: snapshot({ text: "alpha" }),
      keys: [key],
      changes: [change(
        { from: [0, 5], to: [0, 6] },
        { from: [0, 5], to: [0, 5] },
        ";",
        "",
      )],
    });
    assert.equal(rewind.type, "rewind");
    assert.equal(rewind.direction, direction);
  }
});

test("does not emit one effect per literal Insert-mode character", () => {
  const effect = classifySemanticEffect({
    before: snapshot({ text: "a", mode: "insert", cursor: [0, 1] }),
    after: snapshot({ text: "ab", mode: "insert", cursor: [0, 2] }),
    keys: ["b"],
    changes: [change(
      { from: [0, 1], to: [0, 1] },
      { from: [0, 1], to: [0, 2] },
      "",
      "b",
    )],
  });
  assert.equal(effect, null);
});
