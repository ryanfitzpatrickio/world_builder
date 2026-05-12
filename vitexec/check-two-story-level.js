async function waitFor(predicate, label, timeoutMs = 7000) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const debug = await waitFor(() => window.levelMakerDebug, 'levelMakerDebug');
await debug.loadPlanFromUrl('/levels/two-story-saloon.json');

const snapshot = await waitFor(() => {
  const next = debug.getSnapshot();
  return next.planShapes.length === 11 && next.solver.solved ? next : null;
}, 'two-story generated level');
const floor0View = debug.getSnapshot();
const floor1View = debug.setCurrentFloor(1);
const floor1VisibleRoofs = countVisibleOccupancy('roof');
const floor1VisibleStairs = countVisibleOccupancy('stair');
const floor2View = debug.setCurrentFloor(2);
const floor2VisibleRoofs = countVisibleOccupancy('roof');
const floor2VisibleStairs = countVisibleOccupancy('stair');
const floor3View = debug.setCurrentFloor(3);
const floor3VisibleRoofs = countVisibleOccupancy('roof');

const stairOpeningCells = [];
for (let x = -8; x <= -4; x++) {
  for (const z of [-5, -4]) {
    const cell = debug.grid.cellAtWorld(x + 0.5, 1, z + 0.5);
    stairOpeningCells.push({
      x,
      z,
      occupancy: cell?.occupancy,
      collapsedTile: cell?.collapsedTile,
      tags: cell ? Array.from(cell.tags) : [],
    });
  }
}

console.log(
  'two-story-level',
  JSON.stringify({
    shapes: snapshot.planShapes.length,
    occupancy: snapshot.counts.occupancy,
    collapsed: snapshot.counts.collapsed,
    contradictions: snapshot.counts.contradictions,
    solved: snapshot.solver.solved,
    tileMeshes: snapshot.scene.tileMeshes,
    floor0TileMeshes: floor0View.scene.tileMeshes,
    floor1TileMeshes: floor1View.scene.tileMeshes,
    floor1VisibleRoofs,
    floor1VisibleStairs,
    floor2TileMeshes: floor2View.scene.tileMeshes,
    floor2VisibleRoofs,
    floor2VisibleStairs,
    floor3TileMeshes: floor3View.scene.tileMeshes,
    floor3VisibleRoofs,
    stairwell: snapshot.counts.occupancy.stairwell || 0,
    generatedBounds: snapshot.scene.generatedBounds,
  })
);

if (snapshot.counts.occupancy.floor < 400) {
  throw new Error(`Expected hundreds of floor cells, got ${snapshot.counts.occupancy.floor}`);
}

if (snapshot.counts.occupancy.wall < 120) {
  throw new Error(`Expected full wall perimeter, got ${snapshot.counts.occupancy.wall}`);
}

if (snapshot.counts.contradictions > 0) {
  throw new Error(`Found ${snapshot.counts.contradictions} WFC contradictions`);
}

const coveredStairOpening = stairOpeningCells.filter((cell) => cell.occupancy !== 'stairwell' || cell.collapsedTile !== 'empty');
if (coveredStairOpening.length > 0) {
  throw new Error(`Upper floor still covers stair opening: ${JSON.stringify(coveredStairOpening)}`);
}

if (floor0View.scene.tileMeshes >= snapshot.counts.collapsed) {
  throw new Error(`Floor 0 view should hide upper levels, got ${floor0View.scene.tileMeshes} visible of ${snapshot.counts.collapsed}`);
}

if (floor1View.scene.tileMeshes <= floor0View.scene.tileMeshes) {
  throw new Error(`Floor 1 view should include lower exterior context plus active floor, got ${floor1View.scene.tileMeshes}`);
}

if (floor1VisibleRoofs > 0) {
  throw new Error(`Floor 1 should not show the roof layer, got ${floor1VisibleRoofs} visible roof tiles`);
}

if (floor2VisibleRoofs <= 0) {
  throw new Error('Floor 2 should show the roof layer above the last occupied floor');
}

if (floor3VisibleRoofs <= 0) {
  throw new Error('Higher floors should still show lower roof tops as exterior context');
}

if (floor1VisibleStairs <= 0) {
  throw new Error('Floor 1 should show the stair run coming up from floor 0');
}

if (floor2VisibleStairs > 0) {
  throw new Error(`Floor 2 should not keep showing the floor 0 stair run, got ${floor2VisibleStairs}`);
}

function countVisibleOccupancy(occupancy) {
  let count = 0;
  for (const key of debug.tileView.meshes.keys()) {
    const [x, y, z] = key.split(',').map(Number);
    const cell = debug.grid.getCell(x, y, z);
    if (cell?.occupancy === occupancy) count += 1;
  }
  return count;
}
