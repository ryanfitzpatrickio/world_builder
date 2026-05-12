export function validateStairPlacement({ grid, x, z, floor, direction, length, width }) {
  const d = getStairDirectionVector(direction);
  const start = grid.worldToCell(x, z, floor);
  const sideOffsetStart = -Math.floor(width / 2);
  const missing = [];
  const check = (offsetAlong, targetFloor, role) => {
    for (let side = 0; side < width; side++) {
      const sideOffset = sideOffsetStart + side;
      const cell = grid.getCell(
        start.x + d.x * offsetAlong + d.sideX * sideOffset,
        targetFloor,
        start.z + d.z * offsetAlong + d.sideZ * sideOffset
      );
      if (isClearForStairPlacement(cell)) continue;
      missing.push({
        role,
        x: cell?.x ?? start.x + d.x * offsetAlong + d.sideX * sideOffset,
        y: targetFloor,
        z: cell?.z ?? start.z + d.z * offsetAlong + d.sideZ * sideOffset,
        occupancy: cell?.occupancy || 'out-of-bounds',
      });
    }
  };

  check(-1, floor, 'bottomLanding');
  check(-1, floor + 1, 'bottomHeadroomCutout');
  for (let step = 0; step < length; step++) {
    check(step, floor, 'lowerStairRun');
    check(step, floor + 1, 'upperStairwellCutout');
  }
  check(length, floor + 1, 'topLanding');
  return { valid: missing.length === 0, missing };
}

export function isClearForStairPlacement(cell) {
  if (!cell || !['floor', 'bridge', 'stair'].includes(cell.occupancy)) return false;
  return !cell.tags.has('authoredProp');
}

export function getStairLandingRequirement({ x, z, floor, direction, length, width }) {
  const d = getStairDirectionVector(direction);
  const sideOffsetStart = -Math.floor(width / 2);
  const row = (offsetAlong, targetFloor) => {
    const cells = [];
    for (let side = 0; side < width; side++) {
      const sideOffset = sideOffsetStart + side;
      cells.push({
        floor: targetFloor,
        x: x + d.x * offsetAlong + d.sideX * sideOffset,
        z: z + d.z * offsetAlong + d.sideZ * sideOffset,
      });
    }
    return cells;
  };
  return {
    bottomLanding: row(-1, floor),
    bottomHeadroomCutout: row(-1, floor + 1),
    topLanding: row(length, floor + 1),
    note: 'Keep the bottom landing, the upper-floor cutout above that landing, the stair run, and the top landing inside authored rooms and clear of props, doors, walls, and corridors.',
  };
}

export function getStairDirectionVector(direction) {
  if (direction === 'NX') return { x: -1, z: 0, sideX: 0, sideZ: 1 };
  if (direction === 'PZ') return { x: 0, z: 1, sideX: 1, sideZ: 0 };
  if (direction === 'NZ') return { x: 0, z: -1, sideX: 1, sideZ: 0 };
  return { x: 1, z: 0, sideX: 0, sideZ: 1 };
}
