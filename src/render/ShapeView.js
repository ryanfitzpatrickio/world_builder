import * as THREE from 'three';

export class ShapeView {
  constructor(scene, grid) {
    this.scene = scene;
    this.grid = grid;
    this.group = new THREE.Group();
    this.scene.add(this.group);
  }

  _polyShape(points, styleColor, y, closed = true) {
    if (!points.length) return;
    const material = new THREE.LineBasicMaterial({ color: styleColor, transparent: true, opacity: 0.9 });
    const verts = points.map((p) => new THREE.Vector3(p.x, y + 0.02, p.z));
    if (closed && verts.length) {
      verts.push(verts[0].clone());
    }
    const g = new THREE.BufferGeometry().setFromPoints(verts);
    const line = closed ? new THREE.LineLoop(g, material) : new THREE.Line(g, material);
    this.group.add(line);
  }

  update(planDocument) {
    for (const child of this.group.children) child.geometry?.dispose();
    this.group.clear();

    for (const shape of planDocument.getShapes()) {
      const color = shape.style === 'wood' ? 0xa87b44 : shape.style === 'metal' ? 0x5f6f8a : 0x6d8bff;
      if (shape.type === 'room' && shape.points.length >= 3) {
        const pts = shape.points.map((p) => ({
          x: p.x,
          z: p.z,
        }));
        const y = shape.floor + 0.01;
        this._polyShape(pts, color, y, true);
      }
      if (shape.type === 'corridor' || shape.type === 'bridgePath') {
        const pts = shape.points || [shape.from, shape.to];
        if (pts.length >= 2) {
          const y = shape.floor + 0.01;
          this._polyShape(pts, color, y, false);
        }
      }
    }
  }

  clear() {
    this.group.clear();
  }
}
