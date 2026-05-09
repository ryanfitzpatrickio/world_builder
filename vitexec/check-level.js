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

await waitFor(() => {
  const snapshot = debug.getSnapshot();
  return snapshot.scene.canvas.clientWidth > 0 && snapshot.scene.canvas.clientHeight > 0 && snapshot.scene.tileMeshes > 0;
}, 'painted level scene');

const snapshot = debug.getSnapshot();
debug.selectWorld(-5.5, -3.5, 0);
const firstSelection = debug.getSnapshot().selected;
debug.selectWorld(7.5, -0.5, 0);
const secondSelection = debug.getSnapshot().selected;
debug.selectWorld(-5.51, -3.49, 0);
const offsetSelection = debug.getSnapshot().selected;

if (!firstSelection || !secondSelection) {
  throw new Error('Select tool debug hook failed to select cells');
}

if (firstSelection.x === secondSelection.x || firstSelection.z === secondSelection.z) {
  throw new Error(
    `Selection did not move across both axes: ${JSON.stringify({
      firstSelection,
      secondSelection,
    })}`
  );
}

if (offsetSelection.x !== firstSelection.x || offsetSelection.z !== firstSelection.z) {
  throw new Error(
    `Tiny pick offset changed selected cell unexpectedly: ${JSON.stringify({
      firstSelection,
      offsetSelection,
    })}`
  );
}

const gl = debug.app.renderer.getContext();
const pixels = new Uint8Array(4);
gl.readPixels(
  Math.floor(snapshot.scene.canvas.width / 2),
  Math.floor(snapshot.scene.canvas.height / 2),
  1,
  1,
  gl.RGBA,
  gl.UNSIGNED_BYTE,
  pixels
);

console.log(
  'level-debug',
  JSON.stringify({
    ready: snapshot.ready,
    shapes: snapshot.planShapes.length,
    occupancy: snapshot.counts.occupancy,
    collapsed: snapshot.counts.collapsed,
    contradictions: snapshot.counts.contradictions,
    solved: snapshot.solver.solved,
    tileMeshes: snapshot.scene.tileMeshes,
    shapeLines: snapshot.scene.shapeLines,
    selectionProbe: {
      first: firstSelection,
      second: secondSelection,
      offset: offsetSelection,
    },
    camera: snapshot.scene.camera,
    target: snapshot.scene.target,
    generatedBounds: snapshot.scene.generatedBounds,
    canvas: snapshot.scene.canvas,
    centerPixel: Array.from(pixels),
  })
);

if (!snapshot.scene.generatedBounds) {
  throw new Error('Missing generated bounds for camera fit');
}

const THREE = await import('three');
const bounds = snapshot.scene.generatedBounds;
const points = [
  [bounds.minX, bounds.minY, bounds.minZ],
  [bounds.minX, bounds.minY, bounds.maxZ],
  [bounds.minX, bounds.maxY, bounds.minZ],
  [bounds.minX, bounds.maxY, bounds.maxZ],
  [bounds.maxX, bounds.minY, bounds.minZ],
  [bounds.maxX, bounds.minY, bounds.maxZ],
  [bounds.maxX, bounds.maxY, bounds.minZ],
  [bounds.maxX, bounds.maxY, bounds.maxZ],
];
const frustum = new THREE.Frustum();
const matrix = new THREE.Matrix4().multiplyMatrices(debug.app.camera.projectionMatrix, debug.app.camera.matrixWorldInverse);
frustum.setFromProjectionMatrix(matrix);
const outsideCorners = points.filter(([x, y, z]) => !frustum.containsPoint(new THREE.Vector3(x, y, z)));
const projectedCorners = points.map(([x, y, z]) => new THREE.Vector3(x, y, z).project(debug.app.camera));
const lowMarginCorners = projectedCorners.filter((point) => Math.abs(point.x) > 0.72 || Math.abs(point.y) > 0.72);

if (outsideCorners.length > 0) {
  throw new Error(`Generated bounds are clipped by camera frustum: ${JSON.stringify(outsideCorners)}`);
}

if (lowMarginCorners.length > 0) {
  throw new Error(
    `Generated bounds have insufficient screen margin: ${JSON.stringify(
      lowMarginCorners.map((point) => ({ x: point.x, y: point.y, z: point.z }))
    )}`
  );
}

if (!snapshot.solver.solved) {
  throw new Error('WFC did not solve the seeded level');
}

if (snapshot.counts.contradictions > 0) {
  throw new Error(`Found ${snapshot.counts.contradictions} WFC contradictions`);
}

if (snapshot.scene.tileMeshes < 100) {
  throw new Error(`Expected at least 100 rendered tile meshes, got ${snapshot.scene.tileMeshes}`);
}

if (snapshot.scene.canvas.clientWidth < 400 || snapshot.scene.canvas.clientHeight < 300) {
  throw new Error('Viewport canvas is too small or not mounted');
}
