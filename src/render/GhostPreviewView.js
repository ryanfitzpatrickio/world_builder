import * as THREE from 'three';

const TOOL_COLORS = {
  room: 0x58d4ff,
  corridor: 0xffc857,
  bridge: 0x72f2a7,
};

export class GhostPreviewView {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'Authoring ghost preview';
    this.scene.add(this.group);

    this.anchorMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
  }

  setPreview({ mode, start, end, floor = 0, width = 2 } = {}) {
    this.clear();
    if (!mode || !start) return;

    const color = TOOL_COLORS[mode] || 0xffffff;
    const y = floor + 0.045;

    this._addAnchor(start, y, color);
    if (!end) return;

    if (mode === 'room') {
      this._addRoomPreview(start, end, y, color);
      return;
    }

    if (mode === 'corridor' || mode === 'bridge') {
      this._addPathPreview(start, end, y, width, color, mode === 'bridge');
    }
  }

  clear() {
    for (const child of this.group.children) {
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    }
    this.group.clear();
  }

  _addAnchor(point, y, color) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.42, 32),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(point.x, y + 0.012, point.z);
    ring.renderOrder = 50;
    this.group.add(ring);

    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 8), this.anchorMaterial.clone());
    pin.position.set(point.x, y + 0.22, point.z);
    pin.renderOrder = 51;
    this.group.add(pin);
  }

  _addRoomPreview(start, end, y, color) {
    const x1 = Math.min(start.x, end.x);
    const x2 = Math.max(start.x, end.x);
    const z1 = Math.min(start.z, end.z);
    const z2 = Math.max(start.z, end.z);
    const width = Math.max(0.05, x2 - x1);
    const depth = Math.max(0.05, z2 - z1);
    const centerX = (x1 + x2) / 2;
    const centerZ = (z1 + z2) / 2;

    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    fill.rotation.x = -Math.PI / 2;
    fill.position.set(centerX, y, centerZ);
    fill.renderOrder = 40;
    this.group.add(fill);

    this._addOutline(
      [
        { x: x1, z: z1 },
        { x: x2, z: z1 },
        { x: x2, z: z2 },
        { x: x1, z: z2 },
        { x: x1, z: z1 },
      ],
      y + 0.018,
      color
    );

    this._addSizeLabel(`${Math.round(width)} x ${Math.round(depth)}`, centerX, y + 0.08, centerZ, color);
  }

  _addPathPreview(start, end, y, width, color, dashed = false) {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.max(0.05, Math.hypot(dx, dz));
    const angle = Math.atan2(dz, dx);
    const centerX = (start.x + end.x) / 2;
    const centerZ = (start.z + end.z) / 2;

    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(length, width),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: dashed ? 0.2 : 0.18,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    fill.rotation.x = -Math.PI / 2;
    fill.rotation.z = -angle;
    fill.position.set(centerX, y, centerZ);
    fill.renderOrder = 40;
    this.group.add(fill);

    const normalX = -dz / length;
    const normalZ = dx / length;
    const half = width / 2;
    this._addOutline(
      [
        { x: start.x + normalX * half, z: start.z + normalZ * half },
        { x: end.x + normalX * half, z: end.z + normalZ * half },
        { x: end.x - normalX * half, z: end.z - normalZ * half },
        { x: start.x - normalX * half, z: start.z - normalZ * half },
        { x: start.x + normalX * half, z: start.z + normalZ * half },
      ],
      y + 0.018,
      color
    );

    this._addSizeLabel(`${Math.round(length)} cells`, centerX, y + 0.08, centerZ, color);
  }

  _addOutline(points, y, color) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(p.x, y, p.z)));
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      })
    );
    line.renderOrder = 52;
    this.group.add(line);
  }

  _addSizeLabel(text, x, y, z, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(8, 15, 24, 0.82)';
    ctx.roundRect(8, 8, 240, 48, 14);
    ctx.fill();
    ctx.font = '700 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 128, 33);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      color,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x, y + 0.2, z);
    sprite.scale.set(1.9, 0.48, 1);
    sprite.renderOrder = 60;
    this.group.add(sprite);
  }
}
