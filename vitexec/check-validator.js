async function waitFor(predicate, label, timeoutMs = 8000) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const debug = await waitFor(() => window.levelMakerDebug, 'levelMakerDebug');

await debug.loadPlanJSON({
  version: 1,
  name: 'validator smoke',
  shapes: [
    {
      id: 'room_001',
      type: 'room',
      floor: 0,
      style: 'western',
      tags: ['validator-smoke'],
      points: [
        { x: -4, z: -4 },
        { x: 4, z: -4 },
        { x: 4, z: 4 },
        { x: -4, z: 4 },
      ],
    },
    {
      id: 'room_002',
      type: 'room',
      floor: 1,
      style: 'western',
      tags: ['validator-smoke'],
      points: [
        { x: -4, z: -4 },
        { x: 4, z: -4 },
        { x: 4, z: 4 },
        { x: -4, z: 4 },
      ],
    },
    {
      id: 'prop_900',
      type: 'prop',
      floor: 0,
      style: 'western',
      tags: ['validator-smoke'],
      x: -0.5,
      z: -3.5,
      prop: 'shelf',
      direction: 'NZ',
    },
  ],
});

const report = await debug.validateLevel();
const snapshot = debug.getSnapshot();
const cells = debug.grid.getAllCells();
const lockedDoors = cells.filter((cell) => cell.lockedByUser && cell.tags.has('forcedDoor'));
const lockedWindows = cells.filter((cell) => cell.lockedByUser && cell.tags.has('variantWindow'));
const windows = cells.filter((cell) => cell.tags.has('variantWindow') || String(cell.collapsedTile || cell.fixedTile || '').includes('window'));
const stairs = snapshot.planShapes.filter((shape) => shape.type === 'stair');
const propBlockedFloor = debug.grid.cellAtWorld(-0.5, 0, -3.5);
const propBlockedDoor = lockedDoors.some((door) => {
  return doorInteriorFloors(door).some((cell) => cell?.x === propBlockedFloor.x && cell.y === propBlockedFloor.y && cell.z === propBlockedFloor.z);
});

console.log(
  'validator-debug',
  JSON.stringify({
    report,
    lockedDoors: lockedDoors.length,
    lockedWindows: lockedWindows.length,
    windows: windows.length,
    stairs: stairs.length,
    propBlockedDoor,
    occupancy: snapshot.counts.occupancy,
  })
);

if (report.checkedRooms !== 2) throw new Error(`Expected 2 checked rooms, got ${report.checkedRooms}`);
if (lockedDoors.length < 2) throw new Error(`Expected validator to lock at least 2 exterior doors, got ${lockedDoors.length}`);
if (lockedDoors.some((door) => !door.tags.has('openDoorway') || !door.tags.has('exportEmpty'))) {
  throw new Error('Expected validator doors to be tagged as open/export-empty doorways');
}
if (windows.length < 2) throw new Error(`Expected at least 2 room windows after validation, got ${windows.length}`);
if (stairs.length < 1) throw new Error('Expected validator to add a stair between floors 0 and 1');
if (propBlockedDoor) throw new Error('Validator placed a door at or next to the wall-backed prop cell');
if (snapshot.counts.contradictions > 0) throw new Error(`Validator produced ${snapshot.counts.contradictions} contradictions`);

function doorInteriorFloors(door) {
  return [
    debug.grid.getCell(door.x + 1, door.y, door.z),
    debug.grid.getCell(door.x - 1, door.y, door.z),
    debug.grid.getCell(door.x, door.y, door.z + 1),
    debug.grid.getCell(door.x, door.y, door.z - 1),
  ].filter((cell) => cell?.occupancy === 'floor');
}
