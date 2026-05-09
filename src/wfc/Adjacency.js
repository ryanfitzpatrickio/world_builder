import { OPPOSITE } from './directions.js';

export function areCompatible(a, b, dir) {
  if (!a || !b) return true;
  if (a.category !== b.category) return true;

  const aSock = a?.sockets?.[dir] || 'any';
  const bSock = b?.sockets?.[OPPOSITE[dir]] || 'any';

  if (aSock === 'any' || bSock === 'any') return true;
  return aSock === bSock;
}
