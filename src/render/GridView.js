import * as THREE from 'three';

export class GridView {
  constructor(scene, grid) {
    this.scene = scene;
    this.grid = grid;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this._build();
  }

  _build() {
    const helper = new THREE.GridHelper(
      Math.max(this.grid.width, this.grid.depth),
      Math.max(this.grid.width, this.grid.depth),
      0x74c7e8,
      0x3f5f78
    );
    helper.position.set(
      this.grid.originX + (this.grid.width * this.grid.cellSize) / 2,
      0,
      this.grid.originZ + (this.grid.depth * this.grid.cellSize) / 2
    );
    helper.rotation.y = Math.PI / 2;
    this.group.add(helper);

  }

  dispose() {
    this.scene.remove(this.group);
  }
}
