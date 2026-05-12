import { RoomShape } from './RoomShape.js';
import { CorridorShape } from './CorridorShape.js';
import { BridgePath } from './BridgePath.js';
import { FloorPlanGraph } from './FloorPlanGraph.js';
import { StairShape } from './StairShape.js';
import { PropShape } from './PropShape.js';

let globalShapeCounter = 0;

export class PlanDocument {
  constructor() {
    this.shapes = [];
    this.graph = new FloorPlanGraph();
  }

  _nextId(prefix) {
    globalShapeCounter += 1;
    return `${prefix}_${String(globalShapeCounter).padStart(3, '0')}`;
  }

  _rememberId(id) {
    const match = String(id || '').match(/_(\d+)$/);
    if (!match) return;
    globalShapeCounter = Math.max(globalShapeCounter, Number(match[1]));
  }

  addRoom(points, floor, style) {
    const room = new RoomShape({
      id: this._nextId('room'),
      floor,
      points: points.map((p) => ({ x: p.x, z: p.z })),
      style,
    });
    this.shapes.push(room);
    this.graph.addShape(room);
    return room;
  }

  addCorridor(from, to, width, floor, style) {
    const corridor = new CorridorShape({
      id: this._nextId('corridor'),
      from,
      to,
      width,
      floor,
      style,
    });
    this.shapes.push(corridor);
    this.graph.addShape(corridor);
    return corridor;
  }

  addBridge(points, width, floor, style) {
    const bridge = new BridgePath({
      id: this._nextId('bridge'),
      points,
      width,
      floor,
      style,
    });
    this.shapes.push(bridge);
    this.graph.addShape(bridge);
    return bridge;
  }

  addStair({ x, z, direction = 'PX', length = 4, width = 2 }, floor, style) {
    const stair = new StairShape({
      id: this._nextId('stair'),
      floor,
      x,
      z,
      direction,
      length,
      width,
      style,
    });
    this.shapes.push(stair);
    this.graph.addShape(stair);
    return stair;
  }

  addProp({ x, z, prop = 'crateStack', direction = 'PZ' }, floor, style) {
    const decoration = new PropShape({
      id: this._nextId('prop'),
      floor,
      x,
      z,
      prop,
      direction,
      style,
    });
    this.shapes.push(decoration);
    this.graph.addShape(decoration);
    return decoration;
  }

  addShapeFromJSON(shape) {
    if (!shape || !shape.type) return null;
    let created = null;
    if (shape.type === 'room') {
      created = new RoomShape(shape);
    } else if (shape.type === 'corridor') {
      created = new CorridorShape(shape);
    } else if (shape.type === 'bridgePath') {
      created = new BridgePath(shape);
    } else if (shape.type === 'stair') {
      created = new StairShape(shape);
    } else if (shape.type === 'prop') {
      created = new PropShape(shape);
    }
    if (!created) return null;
    this.shapes.push(created);
    this.graph.addShape(created);
    this._rememberId(created.id);
    return created;
  }

  loadJSON(data) {
    this.clear();
    const shapes = Array.isArray(data) ? data : data?.shapes;
    if (!Array.isArray(shapes)) {
      throw new Error('Level JSON must contain a shapes array.');
    }
    for (const shape of shapes) this.addShapeFromJSON(shape);
    return this;
  }

  removeShapeById(id) {
    const idx = this.shapes.findIndex((shape) => shape.id === id);
    if (idx >= 0) {
      this.shapes.splice(idx, 1);
      this.graph.removeShape(id);
      return true;
    }
    return false;
  }

  clear() {
    this.shapes.length = 0;
    this.graph.clear();
    globalShapeCounter = 0;
  }

  toJSON() {
    return {
      shapes: this.shapes.map((shape) => shape.toJSON()),
    };
  }

  getShapes() {
    return this.shapes.slice();
  }
}
