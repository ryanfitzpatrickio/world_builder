import {
  BUILTIN_CUSTOM_PROP_DEFINITIONS,
  BUILTIN_PROP_TAGS,
  BUILTIN_PROP_TYPES,
  normalizePropId,
  propTypeTag,
} from './PropDefinitions.js';

export class PropLibrary {
  constructor({ brushPalette, onBrushPaletteChanged = () => {} }) {
    this.brushPalette = brushPalette;
    this.onBrushPaletteChanged = onBrushPaletteChanged;
    this.propTypes = [...BUILTIN_PROP_TYPES];
    this.definitions = new Map(BUILTIN_CUSTOM_PROP_DEFINITIONS.map((definition) => [definition.id, definition]));
  }

  loadDefinitions(definitions = []) {
    this.definitions.clear();
    this.propTypes.splice(0, this.propTypes.length, ...BUILTIN_PROP_TYPES);
    for (const definition of BUILTIN_CUSTOM_PROP_DEFINITIONS) this.registerDefinition(definition);
    for (const definition of definitions) this.registerDefinition(this.normalizeDefinition(definition));
  }

  registerDefinition(definition) {
    this.definitions.set(definition.id, definition);
    if (!this.propTypes.includes(definition.id)) this.propTypes.push(definition.id);
    const legacyTag = BUILTIN_PROP_TAGS[definition.id];
    const tags = ['walkable', 'propCandidate', propTypeTag(definition.id), 'propFacePZ'];
    if (legacyTag) tags.splice(2, 0, legacyTag);
    const brushId = `prop-${definition.id.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
    const existing = this.brushPalette.find((brush) => brush.id === brushId);
    const brush = {
      id: brushId,
      group: 'Props',
      label: definition.label,
      note: definition.description || `${definition.placement} prop`,
      occupancy: 'floor',
      fixedTile: 'floor_western_plank',
      style: 'western',
      tags,
    };
    if (existing) Object.assign(existing, brush);
    else this.brushPalette.splice(Math.max(0, this.brushPalette.length - 1), 0, brush);
    this.onBrushPaletteChanged();
  }

  getDefinitions() {
    return Array.from(this.definitions.values());
  }

  normalizeType(value) {
    const propId = normalizePropId(value);
    return this.propTypes.includes(propId) ? propId : 'crateStack';
  }

  normalizeDefinition(args) {
    const id = normalizePropId(args.id);
    const boxes = Array.isArray(args.boxes) ? args.boxes.slice(0, 24) : [];
    if (!boxes.length) throw new Error('define_prop requires at least one box part.');
    return {
      id,
      label: String(args.label || id),
      placement: args.placement === 'center' ? 'center' : 'wall',
      description: String(args.description || ''),
      boxes: boxes.map((box) => ({
        material: normalizePropMaterial(box.material),
        scale: sanitizeVector(box.scale, [0.25, 0.25, 0.25], 0.02, 1),
        position: sanitizeVector(box.position, [0, 0.25, 0], -0.5, 1.5),
        rotationY: clampNumber(box.rotationY, -Math.PI * 2, Math.PI * 2, 0),
      })),
      light: args.light
        ? {
            position: sanitizeVector(args.light.position, [0, 0.75, 0], -0.5, 1.5),
            color: /^#[0-9a-f]{6}$/i.test(String(args.light.color || '')) ? String(args.light.color) : '#ff9d3b',
            intensity: clampNumber(args.light.intensity, 0.05, 1.2, 0.32),
            distance: clampNumber(args.light.distance, 1, 6, 3),
          }
        : null,
    };
  }

  getTypesByPlacement(placement) {
    const byDefinition = this.getDefinitions()
      .filter((definition) => definition.placement === placement)
      .map((definition) => definition.id);
    const fallback =
      placement === 'center'
        ? ['pokerTable', 'rug', 'stoolPair']
        : ['barCounter', 'shelf', 'bedCot', 'piano', 'wantedPoster', 'lanternStand', 'crateStack', 'barrelStack'];
    return [...new Set([...fallback, ...byDefinition])];
  }

  isCenterPropId(propId) {
    if (this.definitions.get(propId)?.placement === 'center') return true;
    return propId === 'pokerTable' || propId === 'rug' || propId === 'stoolPair';
  }

  propIdFromTags(tags) {
    const typeTag = Array.from(tags).find((tag) => tag.startsWith('propType:'));
    if (typeTag) return normalizePropId(typeTag.slice('propType:'.length));
    if (tags.has('propPokerTable')) return 'pokerTable';
    if (tags.has('propRug')) return 'rug';
    if (tags.has('propStoolPair')) return 'stoolPair';
    if (tags.has('propBarCounter')) return 'barCounter';
    if (tags.has('propShelf')) return 'shelf';
    if (tags.has('propBedCot')) return 'bedCot';
    if (tags.has('propPiano')) return 'piano';
    if (tags.has('propWantedPoster')) return 'wantedPoster';
    if (tags.has('propLanternStand')) return 'lanternStand';
    if (tags.has('propCrateStack')) return 'crateStack';
    if (tags.has('propBarrelStack')) return 'barrelStack';
    if (tags.has('propGunRack')) return 'gunRack';
    return 'crateStack';
  }
}

export function normalizeDirection(value) {
  return ['PX', 'NX', 'PZ', 'NZ'].includes(value) ? value : 'PZ';
}

export function clampFloor(value) {
  return Math.max(0, Math.min(3, Math.round(Number(value || 0))));
}

export function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function normalizePropMaterial(value) {
  const material = String(value || 'furniture');
  return ['furniture', 'trim', 'wall', 'door', 'metal', 'rug', 'plant', 'planter', 'light'].includes(material) ? material : 'furniture';
}

function sanitizeVector(value, fallback, min, max) {
  if (!Array.isArray(value) || value.length < 3) return fallback;
  return [0, 1, 2].map((idx) => clampNumber(value[idx], min, max, fallback[idx]));
}
