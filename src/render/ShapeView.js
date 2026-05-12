import * as THREE from 'three';

export class ShapeView {
  constructor(scene, grid) {
    this.scene = scene;
    this.grid = grid;
    this.group = new THREE.Group();
    this.scene.add(this.group);
  }

  _polyShape(points, styleColor, y, closed = true, { selected = false } = {}) {
    if (!points.length) return;
    const material = new THREE.LineBasicMaterial({ color: selected ? 0xffd166 : styleColor, transparent: true, opacity: selected ? 1 : 0.9 });
    const verts = points.map((p) => new THREE.Vector3(p.x, y + (selected ? 0.06 : 0.02), p.z));
    if (closed && verts.length) {
      verts.push(verts[0].clone());
    }
    const g = new THREE.BufferGeometry().setFromPoints(verts);
    const line = closed ? new THREE.LineLoop(g, material) : new THREE.Line(g, material);
    this.group.add(line);
  }

  update(planDocument, view = {}) {
    for (const child of this.group.children) child.geometry?.dispose();
    this.group.clear();
    const activeFloor = Number.isFinite(view.activeFloor) ? view.activeFloor : null;

    for (const shape of planDocument.getShapes()) {
      if (activeFloor !== null && shape.floor !== activeFloor) continue;
      const color = shape.style === 'wood' ? 0xa87b44 : shape.style === 'metal' ? 0x5f6f8a : 0x6d8bff;
      const selected = view.selectedShapeId === shape.id;
      if (shape.type === 'room' && shape.points.length >= 3) {
        const pts = shape.points.map((p) => ({
          x: p.x,
          z: p.z,
        }));
        const y = shape.floor + 0.01;
        this._polyShape(pts, color, y, true, { selected });
      }
      if (shape.type === 'corridor' || shape.type === 'bridgePath') {
        const pts = shape.points || [shape.from, shape.to];
        if (pts.length >= 2) {
          const y = shape.floor + 0.01;
          this._polyShape(pts, color, y, false, { selected });
        }
      }
      if (shape.type === 'stair') {
        const dir = {
          PX: { x: 1, z: 0 },
          NX: { x: -1, z: 0 },
          PZ: { x: 0, z: 1 },
          NZ: { x: 0, z: -1 },
        }[shape.direction] || { x: 1, z: 0 };
        const y = shape.floor + 0.04;
        this._polyShape(
          [
            { x: shape.x, z: shape.z },
            { x: shape.x + dir.x * shape.length, z: shape.z + dir.z * shape.length },
          ],
          0xffc857,
          y,
          false,
          { selected }
        );
      }
      if (shape.type === 'prop') {
        const y = shape.floor + 0.07;
        this._polyShape(
          [
            { x: shape.x - 0.18, z: shape.z },
            { x: shape.x + 0.18, z: shape.z },
          ],
          0xff9d3b,
          y,
          false
        );
        this._polyShape(
          [
            { x: shape.x, z: shape.z - 0.18 },
            { x: shape.x, z: shape.z + 0.18 },
          ],
          0xff9d3b,
          y,
          false
        );
      }
    }
  }

  clear() {
    this.group.clear();
  }
}
