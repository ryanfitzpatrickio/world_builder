export class CommandHistory {
  constructor(limit = 200) {
    this.limit = limit;
    this.undos = [];
    this.redos = [];
  }

  do(command) {
    command.execute();
    this.undos.push(command);
    if (this.undos.length > this.limit) this.undos.shift();
    this.redos.length = 0;
  }

  undo() {
    const command = this.undos.pop();
    if (!command) return;
    command.undo();
    this.redos.push(command);
  }

  redo() {
    const command = this.redos.pop();
    if (!command) return;
    command.execute();
    this.undos.push(command);
  }

  clear() {
    this.undos.length = 0;
    this.redos.length = 0;
  }
}
