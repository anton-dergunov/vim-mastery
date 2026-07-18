export function findNextSequentialUnit(units, currentUnit) {
  return units.find(candidate => candidate.unitNumber === currentUnit.unitNumber + 1) || null;
}
