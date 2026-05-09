import * as THREE from 'three';

export class HighlightView {
  constructor(scene, grid = null) {
    this.scene = scene;
    this.grid = grid;
    this.hover = null;
    this.selected = null;
    this.hoverMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 1.05, 1.05),
      new THREE.MeshBasicMaterial({ color: 0xffff66, wireframe: true })
    );
    this.selectMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.08, 1.08, 1.08),
      new THREE.MeshBasicMaterial({ color: 0x3fff6a, wireframe: true })
    );
    this.scene.add(this.hoverMesh);
    this.scene.add(this.selectMesh);
    this.hoverMesh.visible = false;
    this.selectMesh.visible = false;
  }

  setHover(cell) {
    this.hover = cell;
    if (!cell) {
      this.hoverMesh.visible = false;
      return;
    }
    this.hoverMesh.visible = true;
    const position = this.grid ? this.grid.getWorldPosition(cell) : { x: cell.x + 0.5, y: cell.y, z: cell.z + 0.5 };
    this.hoverMesh.position.set(position.x, position.y + 0.5, position.z);
  }

  setSelected(cell) {
    this.selected = cell;
    if (!cell) {
      this.selectMesh.visible = false;
      return;
    }
    this.selectMesh.visible = true;
    const position = this.grid ? this.grid.getWorldPosition(cell) : { x: cell.x + 0.5, y: cell.y, z: cell.z + 0.5 };
    this.selectMesh.position.set(position.x, position.y + 0.5, position.z);
  }

  dispose() {
    this.scene.remove(this.hoverMesh);
    this.scene.remove(this.selectMesh);
  }
}
