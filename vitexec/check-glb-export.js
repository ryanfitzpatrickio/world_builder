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

await waitFor(() => {
  const snapshot = debug.getSnapshot();
  return snapshot.ready && snapshot.scene.tileMeshes > 0;
}, 'generated level');

document.querySelector('#level-name').value = 'Godot Export Smoke';
const result = await debug.exportGlb({ download: false });
const header = new DataView(result.arrayBuffer, 0, 12);
const magic = header.getUint32(0, true);
const version = header.getUint32(4, true);
const length = header.getUint32(8, true);

console.log(
  'glb-export-debug',
  JSON.stringify({
    filename: result.filename,
    byteLength: result.byteLength,
    sourceMeshCount: result.sourceMeshCount,
    meshCount: result.meshCount,
    materialCount: result.materialCount,
    triangleCount: result.triangleCount,
    magic,
    version,
    length,
  })
);

if (magic !== 0x46546c67) throw new Error(`Expected GLB magic, got ${magic.toString(16)}`);
if (version !== 2) throw new Error(`Expected GLB version 2, got ${version}`);
if (length !== result.byteLength) throw new Error(`GLB header length ${length} did not match ${result.byteLength}`);
if (!result.filename.endsWith('.glb')) throw new Error(`Expected .glb filename, got ${result.filename}`);
if (result.meshCount <= 0) throw new Error('Expected exported GLB to contain meshes');
if (result.sourceMeshCount <= result.meshCount) throw new Error(`Expected mesh merge optimization, got ${result.sourceMeshCount} -> ${result.meshCount}`);
if (result.triangleCount <= 0) throw new Error('Expected exported GLB to contain triangles');
