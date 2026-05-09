import { Shape } from './Shape.js';

export class BridgePath extends Shape {
  constructor({ id, floor = 0, points = [{ x: 0, z: 0 }, { x: 2, z: 0 }], width = 2, style = 'stone', tags = [] } = {}) {
    super({ id, type: 'bridgePath', floor, style, tags });
    this.points = points;
    this.width = width;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      points: this.points.map((p) => ({ x: p.x, z: p.z })),
      width: this.width,
    };
  }
}
