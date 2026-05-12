import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export async function exportLevelToGlb({ grid, tileView, name = 'level', download = true } = {}) {
  if (!grid || !tileView) throw new Error('GLB export requires a grid and tile view.');

  const sourceGroup = tileView.createExportGroup(grid);
  const optimized = optimizeLevelGroup(sourceGroup, name);
  const exporter = new GLTFExporter();
  const arrayBuffer = await exporter.parseAsync(optimized.group, {
    binary: true,
    trs: false,
    onlyVisible: true,
    maxTextureSize: 128,
    includeCustomExtensions: false,
  });

  const filename = `${safeFileBaseName(name)}.glb`;
  if (download) downloadArrayBuffer(arrayBuffer, filename);

  disposeExportGroup(optimized.group);
  return {
    arrayBuffer,
    filename,
    byteLength: arrayBuffer.byteLength,
    sourceMeshCount: optimized.sourceMeshCount,
    meshCount: optimized.meshCount,
    materialCount: optimized.materialCount,
    triangleCount: optimized.triangleCount,
  };
}

function optimizeLevelGroup(sourceGroup, name) {
  sourceGroup.updateMatrixWorld(true);
  const buckets = new Map();
  let sourceMeshCount = 0;

  sourceGroup.traverse((object) => {
    if (!object.isMesh || !object.geometry || !object.material || object.material.colorWrite === false) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (materials.length > 1 || object.geometry.groups?.length) {
      collectGroupedMesh(object, materials, buckets);
      sourceMeshCount += 1;
      return;
    }
    collectGeometry(object.geometry, object.matrixWorld, materials[0], buckets);
    sourceMeshCount += 1;
  });

  const group = new THREE.Group();
  group.name = safeNodeName(name || 'level');
  group.userData = {
    source: 'level-maker',
    optimizedFor: 'Godot GLB',
    compression: 'none',
  };

  let meshCount = 0;
  let triangleCount = 0;
  for (const bucket of buckets.values()) {
    const merged = mergeGeometries(bucket.geometries, false);
    for (const geometry of bucket.geometries) geometry.dispose();
    if (!merged) continue;
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    const material = cloneExportMaterial(bucket.material, bucket.name);
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = safeNodeName(`mesh_${String(meshCount + 1).padStart(2, '0')}_${bucket.name}`);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    triangleCount += estimateTriangles(merged);
    meshCount += 1;
  }

  return {
    group,
    sourceMeshCount,
    meshCount,
    materialCount: buckets.size,
    triangleCount,
  };
}

function collectGroupedMesh(mesh, materials, buckets) {
  const baseGeometry = mesh.geometry;
  for (const group of baseGeometry.groups || []) {
    const material = materials[group.materialIndex] || materials[0];
    if (!material || material.colorWrite === false) continue;
    const geometry = baseGeometry.clone();
    geometry.clearGroups();
    const index = geometry.index;
    if (index) {
      geometry.setIndex(new THREE.BufferAttribute(index.array.slice(group.start, group.start + group.count), 1));
    } else {
      const position = geometry.getAttribute('position');
      geometry.setDrawRange(group.start, group.count || position.count);
    }
    collectGeometry(geometry, mesh.matrixWorld, material, buckets, false);
  }
}

function collectGeometry(sourceGeometry, matrixWorld, material, buckets, clone = true) {
  const geometry = clone ? sourceGeometry.clone() : sourceGeometry;
  geometry.applyMatrix4(matrixWorld);
  geometry.deleteAttribute('color');
  geometry.deleteAttribute('tangent');
  const bucket = bucketForMaterial(material, buckets);
  bucket.geometries.push(geometry);
}

function bucketForMaterial(material, buckets) {
  const key = material.uuid;
  let bucket = buckets.get(key);
  if (!bucket) {
    const name = material.name || material.map?.name || `material_${buckets.size + 1}`;
    bucket = {
      material,
      name,
      geometries: [],
    };
    buckets.set(key, bucket);
  }
  return bucket;
}

function cloneExportMaterial(material, fallbackName) {
  const clone = material.clone();
  clone.name = safeNodeName(fallbackName || material.name || material.type || 'material');
  clone.side = THREE.FrontSide;
  clone.depthWrite = true;
  clone.depthTest = true;
  clone.transparent = false;
  clone.opacity = 1;
  return clone;
}

function estimateTriangles(geometry) {
  if (geometry.index) return Math.floor(geometry.index.count / 3);
  return Math.floor((geometry.getAttribute('position')?.count || 0) / 3);
}

function downloadArrayBuffer(arrayBuffer, filename) {
  const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function disposeExportGroup(group) {
  group.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    }
  });
}

function safeFileBaseName(value) {
  return (
    String(value || 'level')
      .trim()
      .replace(/\.glb$/i, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'level'
  );
}

function safeNodeName(value) {
  return safeFileBaseName(value).replace(/[.-]+/g, '_');
}
