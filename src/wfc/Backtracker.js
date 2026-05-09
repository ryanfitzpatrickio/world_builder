export class Backtracker {
  constructor({ rng = Math.random } = {}) {
    this.rng = rng;
  }

  next(n) {
    if (!n) return 0;
    if (this.rng === Math.random) {
      return Math.floor(Math.random() * n);
    }
    return this.rng() * n;
  }
}
