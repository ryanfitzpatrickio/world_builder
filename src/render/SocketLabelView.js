export class SocketLabelView {
  constructor(root) {
    this.root = root;
    this.overlay = document.createElement('div');
    this.overlay.style.position = 'absolute';
    this.overlay.style.top = '8px';
    this.overlay.style.left = '8px';
    this.overlay.style.color = '#b6d6ff';
    this.overlay.style.fontSize = '11px';
    this.overlay.style.pointerEvents = 'none';
    root.appendChild(this.overlay);
    this.overlay.textContent = '';
  }

  setText(text) {
    this.overlay.textContent = text || '';
  }
}
