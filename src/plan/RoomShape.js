import { Shape } from './Shape.js';

export class RoomShape extends Shape {
  constructor({ id, floor = 0, points = [], style = 'stone', tags = [] } = {}) {
    super({ id, type: 'room', floor, style, tags });
    this.points = points;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      points: this.points.map((p) => ({ x: p.x, z: p.z })),
    };
  }

  contains(x, z) {
    if (this.points.length < 3) return false;
    let inside = false;
    for (let i = 0, j = this.points.length - 1; i < this.points.length; j = i++) {
      const xi = this.points[i].x;
      const zi = this.points[i].z;
      const xj = this.points[j].x;
      const zj = this.points[j].z;
      const intersect = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-9) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }
}
