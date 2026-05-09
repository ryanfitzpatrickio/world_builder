export class DebugPanel {
  constructor() {
    this.output = document.getElementById('debug-output');
  }

  log(msg) {
    const line = typeof msg === 'string' ? msg : JSON.stringify(msg);
    this.output.textContent = `${line}\n${this.output.textContent}`;
    if (this.output.textContent.length > 5000) {
      this.output.textContent = this.output.textContent.slice(0, 5000);
    }
  }
}
