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
  name: 'room transform smoke',
  shapes: [
    {
      id: 'room_100',
      type: 'room',
      floor: 0,
      style: 'western',
      points: [
        { x: -3, z: -3 },
        { x: 1, z: -3 },
        { x: 1, z: 1 },
        { x: -3, z: 1 },
      ],
    },
    {
      id: 'prop_100',
      type: 'prop',
      floor: 0,
      style: 'western',
      x: -1,
      z: -1,
      prop: 'gunRack',
      direction: 'NZ',
    },
  ],
});

const selected = debug.selectRoomAt(-1, -1, 0);
if (!selected || selected.id !== 'room_100') throw new Error(`Expected to select room_100, got ${JSON.stringify(selected)}`);

const moved = await debug.moveSelectedRoom(5, 4);
const snapshot = debug.getSnapshot();
const movedProp = snapshot.planShapes.find((shape) => shape.id === 'prop_100');
const oldCell = debug.grid.cellAtWorld(-1, 0, -1);
const newCell = debug.grid.cellAtWorld(4, 0, 3);

console.log(
  'room-transform-debug',
  JSON.stringify({
    selectedShape: snapshot.selectedShape,
    moved,
    movedProp,
    oldCell: oldCell ? { x: oldCell.x, y: oldCell.y, z: oldCell.z, occupancy: oldCell.occupancy } : null,
    newCell: newCell ? { x: newCell.x, y: newCell.y, z: newCell.z, occupancy: newCell.occupancy, tags: Array.from(newCell.tags) } : null,
  })
);

if (!moved || moved.id !== 'room_100') throw new Error('Move did not return the selected room');
if (moved.points[0].x !== 2 || moved.points[0].z !== 1) {
  throw new Error(`Room points were not translated by 5,4: ${JSON.stringify(moved.points)}`);
}
if (!movedProp || movedProp.x !== 4 || movedProp.z !== 3) {
  throw new Error(`Prop inside moved room was not translated with the room: ${JSON.stringify(movedProp)}`);
}
if (!snapshot.selectedShape || snapshot.selectedShape.id !== 'room_100') {
  throw new Error(`Room selection was not preserved after rebuild: ${JSON.stringify(snapshot.selectedShape)}`);
}
if (oldCell?.occupancy === 'floor') {
  throw new Error('Rebuild left floor geometry behind in the old room position');
}
if (!newCell || !['floor', 'prop'].includes(newCell.occupancy)) {
  throw new Error(`Moved room did not rebuild usable floor at the new prop cell: ${JSON.stringify(newCell)}`);
}
