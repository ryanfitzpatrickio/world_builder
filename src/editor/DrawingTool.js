export class DrawingTool {
  constructor() {
    this.mode = 'select';
    this.start = null;
  }

  setMode(mode) {
    this.mode = mode;
    this.start = null;
  }

  cancel() {
    this.start = null;
  }

  handlePointer(point, onCreateShape, context) {
    if (this.mode === 'select') return { handled: false };

    if (this.mode === 'room') {
      if (!this.start) {
        this.start = point;
        return { handled: true, message: 'Room start set' };
      }
      const end = point;
      const x1 = Math.min(this.start.x, end.x);
      const x2 = Math.max(this.start.x, end.x);
      const z1 = Math.min(this.start.z, end.z);
      const z2 = Math.max(this.start.z, end.z);
      const room = {
        points: [
          { x: x1, z: z1 },
          { x: x2, z: z1 },
          { x: x2, z: z2 },
          { x: x1, z: z2 },
        ],
      };

      const shape = onCreateShape('room', room, context);
      this.start = null;
      return { handled: true, shape };
    }

    if (this.mode === 'corridor' || this.mode === 'bridge') {
      if (!this.start) {
        this.start = point;
        return { handled: true, message: `${this.mode} start set` };
      }

      const end = point;
      const pts = [this.start, end];
      const payload = { points: pts, width: 2 };
      const shape = onCreateShape(this.mode, payload, context);
      this.start = null;
      return { handled: true, shape };
    }

    return { handled: false };
  }
}
