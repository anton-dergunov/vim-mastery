/* Target: whether an editor snapshot has reached an activity's target state.
 * Pure, so the route audit in scripts/route-audit/ judges "done" exactly as
 * the lesson does.
 */

export function matchesTarget(snapshot, target) {
  if (!target) return false;
  const registersMatch = Object.entries(target.registers || {}).every(([name, expected]) => {
    const actual = snapshot.registers?.[name];
    return actual?.text === expected.text && actual.type === expected.type;
  });
  const viewportMatches = !target.viewport
    || (snapshot.viewport?.topLine === target.viewport.topLine && snapshot.viewport?.bottomLine === target.viewport.bottomLine);
  return snapshot.text === target.lines.join("\n")
    && snapshot.mode === target.mode
    && snapshot.cursorPosition[0] === target.cursor[0]
    && snapshot.cursorPosition[1] === target.cursor[1]
    && registersMatch
    && viewportMatches;
}
