export class ConfigPanelController {
  constructor({ ui, typeConfig, tileView, isAutoRebuildEnabled, rebuild, updateTileView, onCellPanelRendered = () => {} }) {
    this.ui = ui;
    this.typeConfig = typeConfig;
    this.tileView = tileView;
    this.isAutoRebuildEnabled = isAutoRebuildEnabled;
    this.rebuild = rebuild;
    this.updateTileView = updateTileView;
    this.onCellPanelRendered = onCellPanelRendered;
  }

  renderCell(cell) {
    this.onCellPanelRendered();
    const type = getSemanticType(cell);
    this.ui.configKind.textContent = type ? `${type.toUpperCase()} settings apply to the whole level` : 'Select a wall, floor, door, window, roof, or prop.';
    this.ui.configDescription.textContent = type
      ? `Selected cell ${cell.x}, ${cell.y}, ${cell.z}. Changes below affect all generated ${type} modules.`
      : '';
    this.ui.configControls.innerHTML = '';
    if (!type || !this.typeConfig[type]) return;

    if (type === 'floor') {
      this.addSelectControl(type, 'texture', 'Texture', [
        ['woodPlanks', 'weathered wood planks'],
        ['scuffedWood', 'dark scuffed wood'],
        ['stonePavers', 'stone pavers'],
        ['packedDirt', 'packed dirt'],
      ]);
    }

    if (type === 'wall') {
      this.addSelectControl(type, 'texture', 'Wall texture', [
        ['crackedPlaster', 'cracked plaster'],
        ['woodSiding', 'wood siding'],
        ['redPaintedWood', 'red painted wood'],
        ['brick', 'old brick'],
        ['corrugatedMetal', 'corrugated metal'],
      ]);
      this.addSelectControl(type, 'trim', 'Trim material', [
        ['darkWood', 'dark wood beams'],
        ['rawWood', 'raw timber'],
        ['metal', 'dark metal'],
      ]);
    }

    if (type === 'door') {
      this.addRangeControl(type, 'maxPerShape', 'Max doors per room/shape', 0, 6, 1);
      this.addRangeControl(type, 'frequency', 'Door frequency %', 0, 100, 5);
      this.addSelectControl(type, 'texture', 'Door style', [
        ['saloonWood', 'saloon wood'],
        ['plainWood', 'plain wood'],
        ['darkMetal', 'dark metal'],
      ]);
    }

    if (type === 'window') {
      this.addRangeControl(type, 'maxPerShape', 'Max windows per room/shape', 0, 10, 1);
      this.addRangeControl(type, 'frequency', 'Window frequency %', 0, 100, 5);
      this.addSelectControl(type, 'texture', 'Window style', [
        ['woodFrame', 'wood frame'],
        ['smallAdobe', 'small adobe opening'],
        ['wideShop', 'wide shop window'],
      ]);
    }

    if (type === 'roof') {
      this.addSelectControl(type, 'texture', 'Roof / ceiling texture', [
        ['corrugatedRust', 'rusted corrugated metal'],
        ['darkWood', 'dark timber'],
        ['hay', 'hay/thatch'],
      ]);
      this.addRangeControl(type, 'lightFrequency', 'Ceiling lantern frequency %', 0, 50, 1);
    }

    if (type === 'prop') {
      this.addRangeControl(type, 'density', 'Prop density %', 0, 100, 5);
      this.addCheckboxControl(type, 'allowHallways', 'Allow props in hallways');
      this.addCheckboxControl(type, 'lighting', 'Props can emit light');
      this.addSelectControl(type, 'set', 'Prop set', [
        ['saloon', 'saloon'],
        ['storage', 'storage'],
        ['lodging', 'lodging'],
        ['mixed', 'mixed'],
      ]);
    }
  }

  renderLight(lightId) {
    const info = this.tileView.getLightInfo(lightId);
    this.ui.configControls.innerHTML = '';
    if (!info) {
      this.ui.configKind.textContent = 'Light no longer exists after rebuild';
      this.ui.configDescription.textContent = 'Select another light handle.';
      return;
    }

    this.ui.configKind.textContent = 'LIGHT settings';
    this.ui.configDescription.textContent = `Selected ${info.id} in cell ${info.cellKey}. These controls affect this individual light.`;
    this.addLightRangeControl(lightId, 'position.x', 'Local X', -1.5, 1.5, 0.01, info.position.x);
    this.addLightRangeControl(lightId, 'position.y', 'Local Y', 0, 2.4, 0.01, info.position.y);
    this.addLightRangeControl(lightId, 'position.z', 'Local Z', -1.5, 1.5, 0.01, info.position.z);
    this.addLightRangeControl(lightId, 'intensity', 'Intensity', 0, 3, 0.02, info.intensity);
    this.addLightRangeControl(lightId, 'distance', 'Range', 0.5, 10, 0.1, info.distance);
    this.addLightColorControl(lightId, info.color);
  }

  addLightRangeControl(lightId, key, label, min, max, step, currentValue) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const value = document.createElement('small');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(currentValue);
    const sync = () => {
      value.textContent = `${label}: ${input.value}`;
    };
    sync();
    input.addEventListener('input', () => {
      sync();
      this.updateLightOverride(lightId, key, Number(input.value));
    });
    wrap.append(value, input);
    this.ui.configControls.appendChild(wrap);
  }

  addLightColorControl(lightId, currentColor) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const label = document.createElement('label');
    label.textContent = 'Color';
    const input = document.createElement('input');
    input.type = 'color';
    input.value = currentColor;
    input.addEventListener('input', () => this.updateLightOverride(lightId, 'color', input.value));
    wrap.append(label, input);
    this.ui.configControls.appendChild(wrap);
  }

  updateLightOverride(lightId, key, value) {
    const current = this.tileView.getLightInfo(lightId);
    if (!current) return;
    if (key.startsWith('position.')) {
      const axis = key.split('.')[1];
      this.tileView.setLightOverride(lightId, {
        position: {
          ...current.position,
          [axis]: value,
        },
      });
      return;
    }
    this.tileView.setLightOverride(lightId, { [key]: value });
  }

  addSelectControl(type, key, label, options) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    const select = document.createElement('select');
    for (const [value, text] of options) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      select.appendChild(option);
    }
    select.value = this.typeConfig[type][key];
    select.addEventListener('change', () => this.updateTypeConfig(type, key, select.value));
    wrap.append(labelEl, select);
    this.ui.configControls.appendChild(wrap);
  }

  addRangeControl(type, key, label, min, max, step) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const labelEl = document.createElement('label');
    const value = document.createElement('small');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(this.typeConfig[type][key]);
    const sync = () => {
      value.textContent = `${label}: ${input.value}`;
    };
    sync();
    input.addEventListener('input', sync);
    input.addEventListener('change', () => this.updateTypeConfig(type, key, Number(input.value)));
    wrap.append(labelEl, value, input);
    this.ui.configControls.appendChild(wrap);
  }

  addCheckboxControl(type, key, label) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const labelEl = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!this.typeConfig[type][key];
    input.addEventListener('change', () => this.updateTypeConfig(type, key, input.checked));
    labelEl.append(input, ` ${label}`);
    wrap.appendChild(labelEl);
    this.ui.configControls.appendChild(wrap);
  }

  updateTypeConfig(type, key, value) {
    this.typeConfig[type][key] = value;
    this.tileView.setTypeConfig(this.typeConfig);
    if (this.isAutoRebuildEnabled()) this.rebuild();
    else this.updateTileView();
  }
}

export function getSemanticType(cell) {
  if (!cell) return null;
  if (cell.tags.has('propCandidate')) return 'prop';
  if (cell.tags.has('forcedDoor') || cell.collapsedTile?.includes('door') || cell.fixedTile?.includes('door')) return 'door';
  if (cell.tags.has('variantWindow') || cell.collapsedTile?.includes('window') || cell.fixedTile?.includes('window')) return 'window';
  if (cell.occupancy === 'floor' || cell.occupancy === 'bridge') return 'floor';
  if (cell.occupancy === 'wall' || cell.tags.has('railing')) return 'wall';
  if (cell.occupancy === 'roof') return 'roof';
  return cell.occupancy === 'empty' ? null : cell.occupancy;
}
