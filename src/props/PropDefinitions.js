export const BUILTIN_PROP_TYPES = [
  'barCounter',
  'pokerTable',
  'barrelStack',
  'shelf',
  'bedCot',
  'piano',
  'wantedPoster',
  'lanternStand',
  'rug',
  'stoolPair',
  'crateStack',
  'gunRack',
];

export const BUILTIN_PROP_TAGS = {
  barCounter: 'propBarCounter',
  pokerTable: 'propPokerTable',
  barrelStack: 'propBarrelStack',
  shelf: 'propShelf',
  bedCot: 'propBedCot',
  piano: 'propPiano',
  wantedPoster: 'propWantedPoster',
  lanternStand: 'propLanternStand',
  rug: 'propRug',
  stoolPair: 'propStoolPair',
  crateStack: 'propCrateStack',
  gunRack: 'propGunRack',
};

export const BUILTIN_CUSTOM_PROP_DEFINITIONS = [
  {
    id: 'gunRack',
    label: 'Gun rack',
    placement: 'wall',
    description: 'One-tile wall-mounted rack with long guns.',
    boxes: [
      { material: 'furniture', scale: [0.78, 0.52, 0.08], position: [0, 0.74, -0.38] },
      { material: 'trim', scale: [0.86, 0.08, 0.12], position: [0, 1.02, -0.34] },
      { material: 'trim', scale: [0.86, 0.08, 0.12], position: [0, 0.48, -0.34] },
      { material: 'metal', scale: [0.055, 0.68, 0.055], position: [-0.26, 0.75, -0.28] },
      { material: 'metal', scale: [0.055, 0.68, 0.055], position: [0, 0.75, -0.28] },
      { material: 'metal', scale: [0.055, 0.68, 0.055], position: [0.26, 0.75, -0.28] },
      { material: 'door', scale: [0.12, 0.16, 0.07], position: [-0.26, 0.42, -0.25] },
      { material: 'door', scale: [0.12, 0.16, 0.07], position: [0, 0.42, -0.25] },
      { material: 'door', scale: [0.12, 0.16, 0.07], position: [0.26, 0.42, -0.25] },
    ],
  },
];

export function normalizePropId(value) {
  const raw = String(value || '').trim();
  const cleaned = raw
    .replace(/[^a-zA-Z0-9 _-]+/g, '')
    .replace(/(?:^|[\s_-]+)([a-zA-Z0-9])/g, (_match, char, offset) => (offset === 0 ? char.toLowerCase() : char.toUpperCase()));
  return cleaned || 'crateStack';
}

export function propTypeTag(propId) {
  return `propType:${normalizePropId(propId)}`;
}
