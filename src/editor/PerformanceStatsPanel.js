export class PerformanceStatsPanel {
  constructor({ container, app, tileView, lightingConfig }) {
    this.container = container;
    this.app = app;
    this.tileView = tileView;
    this.lightingConfig = lightingConfig;
    this.intervalId = null;
  }

  start() {
    if (!this.container) return;
    this.render();
    this.intervalId = window.setInterval(() => this.render(), 500);
  }

  render() {
    const stats = this.app.getPerformanceStats();
    const fpsClass = stats.fps < 30 ? 'bad' : stats.fps < 50 ? 'warn' : '';
    const drawClass = stats.render.calls > 700 ? 'bad' : stats.render.calls > 350 ? 'warn' : '';
    const triangleClass = stats.render.triangles > 250000 ? 'bad' : stats.render.triangles > 100000 ? 'warn' : '';
    const shadowClass = stats.shadows.enabled && stats.shadows.casters > 300 ? 'warn' : '';

    this.container.replaceChildren(
      performanceRow('FPS', `${stats.fps.toFixed(1)} (${stats.frameMs.toFixed(1)}ms)`, fpsClass),
      performanceRow('Draw calls', formatNumber(stats.render.calls), drawClass),
      performanceRow('Triangles', formatNumber(stats.render.triangles), triangleClass),
      performanceRow('Lines / Points', `${formatNumber(stats.render.lines)} / ${formatNumber(stats.render.points)}`),
      performanceRow('GPU memory', `${stats.memory.geometries} geom / ${stats.memory.textures} tex / ${stats.memory.programs} shaders`),
      performanceRow('Scene objects', `${formatNumber(stats.scene.visibleObjects)} visible / ${formatNumber(stats.scene.objects)} total`),
      performanceRow('Meshes', `${formatNumber(stats.scene.meshes)} scene / ${formatNumber(this.tileView.meshes.size)} tile`),
      performanceRow('Lights', formatLightingStats(stats)),
      performanceRow('Point light cap', formatNumber(this.lightingConfig.maxPointLights)),
      performanceRow('Shadows', formatShadowStats(stats), shadowClass),
      performanceRow('Pixel ratio', stats.pixelRatio.toFixed(2))
    );
  }
}

function performanceRow(label, value, className = '') {
  const row = document.createElement('div');
  row.className = `perf-row ${className}`.trim();
  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  const valueEl = document.createElement('span');
  valueEl.textContent = value;
  row.append(labelEl, valueEl);
  return row;
}

function formatNumber(value) {
  return Math.round(Number(value || 0)).toLocaleString();
}

function formatLightingStats(stats) {
  const scene = stats.scene;
  return `${scene.lights} total (${scene.directionalLights} sun, ${scene.pointLights} point, ${scene.hemisphereLights} hemi, ${scene.ambientLights} amb)`;
}

function formatShadowStats(stats) {
  if (!stats.shadows.enabled) return 'off';
  const maps = stats.shadows.mapSizes.length ? ` ${stats.shadows.mapSizes.join(', ')}` : '';
  return `${stats.shadows.type}; ${stats.shadows.castingLights} lights; ${stats.shadows.casters} casters / ${stats.shadows.receivers} receivers${maps}`;
}
