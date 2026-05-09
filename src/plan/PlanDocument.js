import { RoomShape } from './RoomShape.js';
import { CorridorShape } from './CorridorShape.js';
import { BridgePath } from './BridgePath.js';
import { FloorPlanGraph } from './FloorPlanGraph.js';

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
