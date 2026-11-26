import { describe, expect, it } from 'vitest';
import {
  FURNITURE, WALLS, FIXED_OBSTACLES, createInitialState, inspectFurniture, rectanglesOverlap,
  sanitizeApartmentState, santiagoDateTime, solarPosition,
} from '../src/apartment-state';

function isolatedState() {
  const state = createInitialState();
  for (const furniture of Object.values(state.furniture)) {
    furniture.x = 1000;
    furniture.z = 1000;
  }
  return state;
}

describe('Solar position in Chilean local time', () => {
  it('uses the IANA winter/summer offsets and supports the end of the day', () => {
    expect(santiagoDateTime('2026-01-15', 12).toISOString()).toBe('2026-01-15T15:00:00.000Z');
    expect(santiagoDateTime('2026-06-15', 12).toISOString()).toBe('2026-06-15T16:00:00.000Z');
    expect(santiagoDateTime('2026-06-15', 24).toISOString()).toBe('2026-06-16T04:00:00.000Z');
    expect(Number.isNaN(santiagoDateTime('2026-02-30', 12).getTime())).toBe(true);
  });

  it('agrees with the NREL SPA reference case within the geometric-model tolerance', () => {
    // NREL example: Boulder, 2003-10-17 19:30:30 UTC, zenith 50.1116°,
    // azimuth 194.3402°. Santiago was UTC−3 on that date. Our altitude excludes refraction.
    const sun = solarPosition('2003-10-17', 16 + 30 / 60 + 30 / 3600, 39.742476, -105.1786);
    expect(Math.abs(sun.altitude - 39.8884)).toBeLessThan(0.12);
    expect(Math.abs(sun.azimuth - 194.3402)).toBeLessThan(0.2);
  });

  it('models seasons and night and preserves the compass bearing when the model rotates', () => {
    const summer = solarPosition('2026-12-21', 13.7);
    const winter = solarPosition('2026-06-21', 12.75);
    expect(summer.altitude).toBeGreaterThan(79);
    expect(winter.altitude).toBeGreaterThan(32);
    expect(winter.altitude).toBeLessThan(35);
    expect(solarPosition('2026-06-21', 0).altitude).toBeLessThan(0);
    expect(solarPosition('2026-06-21', 9).direction.x).toBeGreaterThan(0);
    expect(solarPosition('2026-06-21', 16).direction.x).toBeLessThan(0);
    const rotated = solarPosition('2026-12-21', 13.7, undefined, undefined, 90);
    expect(rotated.azimuth).toBe(summer.azimuth);
    expect(rotated.direction.x).toBeCloseTo(summer.direction.z, 8);
    expect(rotated.direction.z).toBeCloseTo(-summer.direction.x, 8);
    expect(Math.hypot(rotated.direction.x, rotated.direction.y, rotated.direction.z)).toBeCloseTo(1, 10);
  });
});

describe('Editable furniture and received state', () => {
  it('creates independent defaults from the Blender manifest and sanitizes untrusted state', () => {
    const first = createInitialState(), second = createInitialState();
    first.furniture.sofa.width = 4;
    expect(second.furniture.sofa.width).toBe(FURNITURE.find(item => item.id === 'sofa')?.width);
    const safe = sanitizeApartmentState({
      room: 'javascript:alert(1)', theme: 'pink', date: '2026-02-30', hour: Infinity,
      selectedFurniture: 'unknown', northOffset: -90,
      furniture: { sofa: { width: 1e9, height: -2, depth: NaN, x: 999, z: -999, rotation: -15 }, unknown: { x: 0 } },
    });
    expect(safe.theme).toBe('natural');
    expect(safe.room).toBe('overview');
    expect(safe.date).not.toBe('2026-02-30');
    expect(safe.hour).toBe(12);
    expect(safe.northOffset).toBe(-90);
    expect(safe.selectedFurniture).toBeNull();
    expect(safe.furniture.sofa).toMatchObject({ width: 5, height: 0.1, x: 4.65, z: -3.95, rotation: 345 });
    expect(safe.furniture.sofa.depth).toBe(FURNITURE.find(item => item.id === 'sofa')?.depth);
    expect(safe.furniture).not.toHaveProperty('unknown');
  });

  it('checks rotated footprints rather than only their centres or axis-aligned bounds', () => {
    const base = { x: 0, z: 0, width: 2, depth: 0.4, rotation: 0 };
    expect(rectanglesOverlap(base, { ...base, z: 0.7 })).toBe(false);
    expect(rectanglesOverlap(base, { ...base, z: 0.7, rotation: 90 })).toBe(true);
    expect(rectanglesOverlap(base, { ...base, z: 0.4 })).toBe(false);
  });

  it('reports furniture overlap and objects outside the actual concave floor plan', () => {
    const state = isolatedState();
    state.furniture.sofa = { x: 0, z: 0, width: 0.3, depth: 0.3, height: 1, rotation: 0 };
    state.furniture.coffee_table = { ...state.furniture.sofa };
    const overlap = inspectFurniture(state, 'sofa');
    expect(overlap.blocked).toBe(true);
    expect(overlap.clearance).toBe(0);
    expect(overlap.message).toMatch(/cruza/);
    state.furniture.sofa.x = -4;
    state.furniture.sofa.z = -3.5; // inside the bounding rectangle, outside the rear annex.
    expect(inspectFurniture(state, 'sofa').message).toMatch(/fuera/);
  });

  it('keeps the furnished layout free of collisions and includes fixed installations', () => {
    const initial = createInitialState();
    for (const item of FURNITURE) expect(inspectFurniture(initial, item.id).blocked, item.id).toBe(false);
    const state = isolatedState();
    const counter = FIXED_OBSTACLES[0];
    expect(counter).toBeDefined();
    state.furniture.sofa = { x: counter.x, z: counter.z, width: 0.2, depth: 0.2, height: 0.8, rotation: 0 };
    expect(inspectFurniture(state, 'sofa').message).toMatch(/instalación fija/);
    // A short object can pass below an open doorway's overhead lintel.
    state.furniture.sofa = { x: -1.55, z: 2.67, width: 0.2, depth: 0.2, height: 0.8, rotation: 0 };
    expect(inspectFurniture(state, 'sofa').blocked).toBe(false);
    state.furniture.sofa.height = 2.6;
    expect(inspectFurniture(state, 'sofa').message).toMatch(/muro/);
  });

  it('finds actual wall collisions and a finite front clearance for a free object', () => {
    const state = isolatedState();
    const interiorWall = WALLS.find(wall => Math.abs(wall.x) < 4 && Math.abs(wall.z) < 2.7);
    expect(interiorWall).toBeDefined();
    state.furniture.sofa = { ...interiorWall!, height: 0.8, width: 0.2, depth: 0.2 };
    expect(inspectFurniture(state, 'sofa').message).toMatch(/muro/);
    // Search the terrace for an unoccupied 20cm footprint, independent of decorative furniture.
    let free = null;
    for (let x = -3.8; x <= 3.8 && !free; x += 0.4) {
      state.furniture.sofa = { x, z: 3.65, width: 0.2, depth: 0.2, height: 0.8, rotation: 0 };
      const result = inspectFurniture(state, 'sofa');
      if (!result.blocked) free = result;
    }
    expect(free).not.toBeNull();
    expect(free!.clearance).toBeGreaterThan(0);
    expect(free!.clearance).toBeLessThan(1);
    expect(free!.message).toMatch(/aproximado/);
  });
});
