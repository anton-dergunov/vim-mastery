export function findNextSequentialUnit(units, currentUnit) {
  const ordered = [...units].sort((left, right) => left.unitNumber - right.unitNumber);
  const currentIndex = ordered.findIndex(candidate => candidate.unitNumber === currentUnit.unitNumber);
  return currentIndex >= 0 ? ordered[currentIndex + 1] || null : null;
}
