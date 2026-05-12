import { BUILTIN_CUSTOM_PROP_DEFINITIONS, BUILTIN_PROP_TYPES } from '../props/PropDefinitions.js';

export function createRuleToggles() {
  return {
    walls: true,
    doors: true,
    windows: true,
    bridges: true,
    roofs: true,
    props: true,
  };
}

export function createTypeConfig() {
  return {
    floor: { texture: 'woodPlanks' },
    wall: { texture: 'crackedPlaster', trim: 'darkWood' },
    door: { maxPerShape: 2, frequency: 100, texture: 'saloonWood' },
    window: { maxPerShape: 3, frequency: 25, texture: 'woodFrame' },
    roof: { texture: 'corrugatedRust', lightFrequency: 16 },
    prop: { density: 38, allowHallways: false, lighting: true, set: 'saloon' },
  };
}

export function createLightingConfig() {
  return {
    sunIntensity: 1.25,
    sunElevation: 38,
    sunAzimuth: 305,
    skyFill: 0.72,
    interiorAmbient: 0.18,
    exposure: 1.08,
    maxPointLights: 12,
    moduleShadows: false,
    roofShadows: false,
  };
}

export function createBrushPalette() {
  return [
    { id: 'floor-western', group: 'Floors', label: 'Wood floor', note: 'walkable plank cell', occupancy: 'floor', fixedTile: 'floor_western_plank', style: 'western', tags: ['walkable'] },
    { id: 'wall-plaster', group: 'Walls', label: 'Plaster wall', note: 'plain wall', occupancy: 'wall', fixedTile: 'wall_western_plaster', style: 'western', tags: ['wall', 'verticalSurface'] },
    { id: 'wall-corner', group: 'Walls', label: 'Corner post', note: 'timber post wall', occupancy: 'wall', fixedTile: 'wall_western_corner_post', style: 'western', tags: ['wall', 'corner', 'verticalSurface'] },
    { id: 'door-saloon', group: 'Openings', label: 'Doorway', note: 'open forced doorway', occupancy: 'wall', fixedTile: 'wall_western_open_doorway', style: 'western', tags: ['wall', 'forcedDoor', 'variantDoor', 'openDoorway', 'exportEmpty', 'verticalSurface'] },
    { id: 'window-wood', group: 'Openings', label: 'Window', note: 'forced window', occupancy: 'wall', fixedTile: 'wall_western_window', style: 'western', tags: ['wall', 'variantWindow', 'verticalSurface'] },
    { id: 'rail-western', group: 'Walls', label: 'Railing', note: 'boardwalk rail', occupancy: 'wall', fixedTile: 'wall_western_railing', style: 'western', tags: ['wall', 'railing', 'verticalSurface'] },
    { id: 'roof-trim', group: 'Roof', label: 'Roof trim', note: 'ceiling/roof cue', occupancy: 'roof', fixedTile: 'roof_western_trim', style: 'western', tags: ['roof'] },
    { id: 'bridge-boardwalk', group: 'Floors', label: 'Boardwalk', note: 'bridge/deck cell', occupancy: 'bridge', fixedTile: 'bridge_western_boardwalk', style: 'western', tags: ['bridge', 'walkable'] },
    { id: 'support-post', group: 'Walls', label: 'Support post', note: 'vertical support', occupancy: 'support', fixedTile: 'support_western_post', style: 'western', tags: ['support', 'verticalSurface'] },
    { id: 'prop-bar', group: 'Props', label: 'Bar counter', note: 'saloon bar', occupancy: 'floor', fixedTile: 'floor_western_plank', style: 'western', tags: ['walkable', 'propCandidate', 'propBarCounter', 'propFacePZ'] },
    { id: 'prop-poker', group: 'Props', label: 'Poker table', note: 'table and stools', occupancy: 'floor', fixedTile: 'floor_western_plank', style: 'western', tags: ['walkable', 'propCandidate', 'propPokerTable', 'propFacePZ'] },
    { id: 'prop-barrel', group: 'Props', label: 'Barrels', note: 'barrel stack', occupancy: 'floor', fixedTile: 'floor_western_plank', style: 'western', tags: ['walkable', 'propCandidate', 'propBarrelStack', 'propFacePZ'] },
    { id: 'prop-shelf', group: 'Props', label: 'Wall shelf', note: 'shelf prop', occupancy: 'floor', fixedTile: 'floor_western_plank', style: 'western', tags: ['walkable', 'propCandidate', 'propShelf', 'propFacePZ'] },
    { id: 'prop-bed', group: 'Props', label: 'Cot bed', note: 'lodging prop', occupancy: 'floor', fixedTile: 'floor_western_plank', style: 'western', tags: ['walkable', 'propCandidate', 'propBedCot', 'propFacePZ'] },
    { id: 'prop-piano', group: 'Props', label: 'Piano', note: 'saloon piano', occupancy: 'floor', fixedTile: 'floor_western_plank', style: 'western', tags: ['walkable', 'propCandidate', 'propPiano', 'propFacePZ'] },
    { id: 'prop-lantern', group: 'Props', label: 'Lantern', note: 'physical light', occupancy: 'floor', fixedTile: 'floor_western_plank', style: 'western', tags: ['walkable', 'propCandidate', 'propLanternStand', 'propFacePZ'] },
    { id: 'prop-crates', group: 'Props', label: 'Crates', note: 'crate stack', occupancy: 'floor', fixedTile: 'floor_western_plank', style: 'western', tags: ['walkable', 'propCandidate', 'propCrateStack', 'propFacePZ'] },
    { id: 'prop-gun-rack', group: 'Props', label: 'Gun rack', note: 'wall-mounted long guns', occupancy: 'floor', fixedTile: 'floor_western_plank', style: 'western', tags: ['walkable', 'propCandidate', 'propGunRack', 'propType:gunRack', 'propFacePZ'] },
    { id: 'empty-cell', group: 'Erase', label: 'Empty', note: 'clear generated cell', occupancy: 'empty', fixedTile: 'empty', style: 'western', tags: ['empty'] },
  ];
}

export function createInitialPropTypes() {
  return [...BUILTIN_PROP_TYPES];
}

export function createInitialPropDefinitions() {
  return new Map(BUILTIN_CUSTOM_PROP_DEFINITIONS.map((definition) => [definition.id, definition]));
}
