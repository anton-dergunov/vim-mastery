import { exercises } from "../exercise-data.js";

export const lessonFixtures = exercises.map(exercise => ({
  id: exercise.id,
  initialCode: exercise.initialCode,
  targetCode: exercise.targetCode,
  cursor: exercise.cursor,
  keys: exercise.solution,
}));

export const inputFixtures = Object.freeze([
  {
    id: "visual-block-replace",
    initialCode: ["a [ ]", "b [ ]", "c [ ]", "d [ ]"],
    cursor: [0, 3],
    keys: ["Ctrl-v", "3", "j", "r", "x"],
    targetCode: ["a [x]", "b [x]", "c [x]", "d [x]"],
  },
  {
    id: "visual-block-insert-prefix",
    initialCode: ["one", "two", "six"],
    cursor: [0, 0],
    keys: ["Ctrl-v", "2", "j", "I", ">", " ", "Escape"],
    targetCode: ["> one", "> two", "> six"],
    targetCursor: [0, 0],
  },
  {
    id: "visual-block-append-suffix",
    initialCode: ["one", "two", "six"],
    cursor: [0, 2],
    keys: ["Ctrl-v", "2", "j", "A", "!", "Escape"],
    targetCode: ["one!", "two!", "six!"],
    targetCursor: [0, 2],
  },
  {
    id: "visual-block-indent",
    initialCode: ["aa", "bb", "cc"],
    cursor: [0, 0],
    keys: ["Ctrl-v", "2", "j", ">"],
    targetCode: ["  aa", "  bb", "  cc"],
    targetCursor: [0, 0],
  },
  {
    id: "visual-character-gq",
    initialCode: ["This compact paragraph contains several words for wrapping."],
    cursor: [0, 0],
    keys: ["v", "$", "g", "q"],
    textWidth: 24,
    targetCode: ["This compact paragraph", "contains several words", "for wrapping."],
    targetCursor: [2, 0],
  },
  {
    id: "visual-opposite-end",
    initialCode: ["alpha beta", "gamma delta"],
    cursor: [0, 1],
    keys: ["v", "j", "l", "o", "d"],
    targetCode: ["ama delta"],
    targetCursor: [0, 1],
  },
  {
    id: "visual-block-same-row-corner",
    initialCode: ["abcde", "fghij", "klmno"],
    cursor: [0, 1],
    keys: ["Ctrl-v", "2", "j", "2", "l", "O", "r", "x"],
    targetCode: ["axxxe", "fxxxj", "kxxxo"],
    targetCursor: [0, 1],
  },
  {
    id: "visual-reselect-lines",
    initialCode: ["one", "two", "six"],
    cursor: [0, 0],
    keys: ["V", "j", ">", "g", "v", "<"],
    targetCode: ["one", "two", "six"],
    targetCursor: [0, 0],
  },
  {
    id: "dot-repeat-word",
    initialCode: ["cache.old = loader;", "auth.old  = verifier;", "api.old   = router;"],
    cursor: [0, 7],
    keys: ["c", "i", "w", "n", "e", "w", "Escape", "j", "b", ".", "j", "b", "."],
    targetCode: ["cache.new = loader;", "auth.new  = verifier;", "api.new   = router;"],
  },
]);
