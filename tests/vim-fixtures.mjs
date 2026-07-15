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
    id: "dot-repeat-word",
    initialCode: ["cache.old = loader;", "auth.old  = verifier;", "api.old   = router;"],
    cursor: [0, 7],
    keys: ["c", "i", "w", "n", "e", "w", "Escape", "j", "b", ".", "j", "b", "."],
    targetCode: ["cache.new = loader;", "auth.new  = verifier;", "api.new   = router;"],
  },
]);
