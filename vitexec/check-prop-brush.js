async function waitFor(predicate, label, timeoutMs = 5000) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const debug = await waitFor(() => window.levelMakerDebug, 'levelMakerDebug');

await debug.loadPlanJSON({
  version: 1,
  name: 'Prop brush placement check',
  shapes: [
    {
      id: 'room_900',
      type: 'room',
      floor: 0,
      style: 'western',
      points: [
        { x: -2, z: -2 },
        { x: 2, z: -2 },
        { x: 2, z: 2 },
        { x: -2, z: 2 },
      ],
    },
  ],
});

document.querySelector('[data-brush-id="prop-gun-rack"]')?.click();
const autoRebuild = document.querySelector('#auto-rebuild');
if (autoRebuild?.checked) autoRebuild.click();

const wall = debug.grid.getAllCells().find((cell) => {
  if (cell.y !== 0 || cell.occupancy !== 'wall') return false;
  return adjacentWalkable(cell);
});

if (!wall) throw new Error('Could not find a wall with adjacent floor for gun-rack placement');

const beforeWallOccupancy = wall.occupancy;
const world = debug.grid.getWorldPosition(wall);
const screen = await worldToScreen(world.x, 0, world.z);
clickCanvas(screen.x, screen.y);

await waitFor(() => debug.exportPlanJSON().shapes.some((shape) => shape.type === 'prop' && shape.prop === 'gunRack'), 'gun rack prop shape');
const immediateWall = debug.grid.getCell(wall.x, wall.y, wall.z);
const immediateWallCount = debug.grid.getAllCells().filter((cell) => cell.occupancy === 'wall').length;

if (immediateWall.occupancy !== beforeWallOccupancy) {
  throw new Error(`Gun rack click changed wall occupancy before rebuild from ${beforeWallOccupancy} to ${immediateWall.occupancy}`);
}

if (immediateWallCount < 4) {
  throw new Error(`Gun rack placement with auto rebuild off cleared generated walls; wall count ${immediateWallCount}`);
}
await debug.rebuild();

const afterWall = debug.grid.getCell(wall.x, wall.y, wall.z);
const prop = debug.exportPlanJSON().shapes.find((shape) => shape.type === 'prop' && shape.prop === 'gunRack');
const propCell = debug.grid.cellAtWorld(prop.x, prop.floor, prop.z);

if (afterWall.occupancy !== beforeWallOccupancy) {
  throw new Error(`Gun rack click changed wall occupancy from ${beforeWallOccupancy} to ${afterWall.occupancy}`);
}

if (!propCell?.tags.has('propCandidate') || !propCell.tags.has('propType:gunRack')) {
  throw new Error(`Gun rack prop did not rasterize on the adjacent floor cell: ${JSON.stringify(prop)}`);
}

console.log(
  'prop-brush-debug',
  JSON.stringify({
    wall: { x: wall.x, y: wall.y, z: wall.z, occupancy: afterWall.occupancy },
    prop,
    propCell: { x: propCell.x, y: propCell.y, z: propCell.z, tags: Array.from(propCell.tags) },
  })
);

function adjacentWalkable(cell) {
  return [
    debug.grid.getCell(cell.x + 1, cell.y, cell.z),
    debug.grid.getCell(cell.x - 1, cell.y, cell.z),
    debug.grid.getCell(cell.x, cell.y, cell.z + 1),
    debug.grid.getCell(cell.x, cell.y, cell.z - 1),
  ].some((neighbor) => neighbor && ['floor', 'bridge', 'stair'].includes(neighbor.occupancy));
}

async function worldToScreen(x, y, z) {
  const THREE = await import('three');
  const point = new THREE.Vector3(x, y, z).project(debug.app.camera);
  const rect = debug.app.renderer.domElement.getBoundingClientRect();
  return {
    x: rect.left + ((point.x + 1) / 2) * rect.width,
    y: rect.top + ((1 - point.y) / 2) * rect.height,
  };
}

function clickCanvas(clientX, clientY) {
  const canvas = debug.app.renderer.domElement;
  canvas.setPointerCapture = () => {};
  canvas.releasePointerCapture = () => {};
  const options = {
    bubbles: true,
    cancelable: true,
    pointerId: 17,
    pointerType: 'mouse',
    button: 0,
    buttons: 1,
    clientX,
    clientY,
  };
  canvas.dispatchEvent(new PointerEvent('pointerdown', options));
  canvas.dispatchEvent(new PointerEvent('pointerup', { ...options, buttons: 0 }));
}
