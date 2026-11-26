import interior from '../public/models/eco-egana-interior.json';

export type ApartmentTheme = 'natural' | 'minimal' | 'warm';
export type ApartmentRoom = 'overview' | 'living' | 'kitchen' | 'bedroom' | 'bedroom2' | 'balcony';

/** All dimensions/positions are metres; rotation is degrees around Three's Y axis. */
export interface FurnitureTransform {
  x: number;
  z: number;
  rotation: number;
  width: number;
  depth: number;
  height: number;
}
export interface ApartmentState {
  theme: ApartmentTheme;
  room: ApartmentRoom;
  hour: number;
  date: string;
  northOffset: number;
  selectedFurniture: string | null;
  furniture: Record<string, FurnitureTransform>;
}
export interface FurnitureDefinition extends FurnitureTransform {
  id: string;
  label: string;
  objectName: string;
}
interface Point { x: number; z: number }
interface Rectangle extends Point { width: number; depth: number; rotation: number }
interface FixedObstacle extends Rectangle { base: number; height: number }

export const APARTMENT_STORAGE_KEY = 'fundamenta-apartment-v2';
export const APARTMENT_BOUNDS = { minX: -4.65, maxX: 4.65, minZ: -3.95, maxZ: 4.3 };

const labels: Record<string, string> = {
  sofa: 'Sofá', coffee_table: 'Mesa de centro', armchair: 'Sillón', dining_table: 'Mesa de comedor',
  dining_chair_1: 'Silla de comedor 1', dining_chair_2: 'Silla de comedor 2',
  dining_chair_3: 'Silla de comedor 3', dining_chair_4: 'Silla de comedor 4',
  bed_primary: 'Cama principal', bed_secondary: 'Cama dormitorio 2',
  nightstand_primary_1: 'Velador principal 1', nightstand_primary_2: 'Velador principal 2',
  nightstand_secondary_1: 'Velador dormitorio 2 — 1', nightstand_secondary_2: 'Velador dormitorio 2 — 2',
  terrace_chair_1: 'Silla de terraza 1', terrace_chair_2: 'Silla de terraza 2',
  terrace_table: 'Mesa de terraza', plant_1: 'Planta 1', plant_2: 'Planta 2',
};

export const FURNITURE: FurnitureDefinition[] = interior.furniture.map(item => ({
  id: item.id,
  label: labels[item.id] ?? item.id.replaceAll('_', ' '),
  objectName: item.objectName,
  x: item.position[0], z: item.position[2],
  width: item.dimensions[0], height: item.dimensions[1], depth: item.dimensions[2],
  rotation: item.rotationY * 180 / Math.PI,
}));
export const WALLS: FixedObstacle[] = interior.walls.map(item => ({
  x: item.x, z: item.z, width: item.width, depth: item.depth, rotation: item.rotation, base: item.base, height: item.height,
}));
const manifestObstacles = (interior as unknown as { obstacles?: Array<Rectangle & { base?: number; height?: number }> }).obstacles ?? [];
export const FIXED_OBSTACLES: FixedObstacle[] = manifestObstacles.map(item => ({ ...item, base: item.base ?? 0, height: item.height ?? 2.65 }));

// Union of the main plan, the rear service annex and the terrace. Coordinates are
// an interpretation of the published type C drawing, not a surveyed apartment.
const footprint: Point[] = [
  { x: -4.5, z: -3 }, { x: -1.65, z: -3 }, { x: -1.65, z: -3.7 },
  { x: 2.4, z: -3.7 }, { x: 2.4, z: -3 }, { x: 4.5, z: -3 },
  { x: 4.5, z: 4.25 }, { x: -4.5, z: 4.25 },
];
const degree = Math.PI / 180;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const modulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;
const localFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function localParts(date: Date) {
  return Object.fromEntries(localFormatter.formatToParts(date).filter(part => part.type !== 'literal')
    .map(part => [part.type, Number(part.value)]));
}
function todayInSantiago(): string {
  const parts = localParts(new Date());
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}
export function createInitialState(): ApartmentState {
  return {
    theme: 'natural', room: 'overview', hour: 12, date: todayInSantiago(), northOffset: 0,
    selectedFurniture: null,
    furniture: Object.fromEntries(FURNITURE.map(({ id, x, z, rotation, width, depth, height }) =>
      [id, { x, z, rotation, width, depth, height }])),
  };
}
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function bounded(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;
}
function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    && value >= '2000-01-01' && value <= '2100-12-31';
}
/** Discards unknown mesh IDs, unsafe values and invalid dates from storage/peers. */
export function sanitizeApartmentState(input: unknown): ApartmentState {
  const base = createInitialState();
  const value = record(input);
  const furniture = record(value.furniture);
  for (const item of FURNITURE) {
    const transform = record(furniture[item.id]);
    base.furniture[item.id] = {
      x: bounded(transform.x, item.x, APARTMENT_BOUNDS.minX, APARTMENT_BOUNDS.maxX),
      z: bounded(transform.z, item.z, APARTMENT_BOUNDS.minZ, APARTMENT_BOUNDS.maxZ),
      rotation: modulo(bounded(transform.rotation, item.rotation, -36000, 36000), 360),
      width: bounded(transform.width, item.width, 0.2, 5),
      depth: bounded(transform.depth, item.depth, 0.2, 5),
      height: bounded(transform.height, item.height, 0.1, 3),
    };
  }
  if (value.theme === 'natural' || value.theme === 'minimal' || value.theme === 'warm') base.theme = value.theme;
  if (['overview', 'living', 'kitchen', 'bedroom', 'bedroom2', 'balcony'].includes(String(value.room))) {
    base.room = value.room as ApartmentRoom;
  }
  base.hour = bounded(value.hour, base.hour, 0, 24);
  base.date = isDate(value.date) ? value.date : base.date;
  base.northOffset = modulo(bounded(value.northOffset, 0, -36000, 36000) + 180, 360) - 180;
  base.selectedFurniture = typeof value.selectedFurniture === 'string'
    && FURNITURE.some(item => item.id === value.selectedFurniture) ? value.selectedFurniture : null;
  return base;
}

function corners(rect: Rectangle): Point[] {
  const angle = rect.rotation * degree;
  const cosine = Math.cos(angle), sine = Math.sin(angle);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => {
    const x = sx * rect.width / 2, z = sz * rect.depth / 2;
    return { x: rect.x + x * cosine + z * sine, z: rect.z - x * sine + z * cosine };
  });
}
function projection(points: Point[], axis: Point) {
  const values = points.map(point => point.x * axis.x + point.z * axis.z);
  return { min: Math.min(...values), max: Math.max(...values) };
}
/** Separating-axis test. A touching edge is allowed; penetration >1cm is blocked. */
export function rectanglesOverlap(a: Rectangle, b: Rectangle): boolean {
  const aPoints = corners(a), bPoints = corners(b);
  const axes = [a.rotation, a.rotation + 90, b.rotation, b.rotation + 90]
    .map(angle => ({ x: Math.cos(angle * degree), z: -Math.sin(angle * degree) }));
  return axes.every(axis => {
    const left = projection(aPoints, axis), right = projection(bPoints, axis);
    return Math.min(left.max, right.max) - Math.max(left.min, right.min) > 0.01;
  });
}
function cross(a: Point, b: Point) { return a.x * b.z - a.z * b.x; }
function onSegment(point: Point, a: Point, b: Point): boolean {
  const ap = { x: point.x - a.x, z: point.z - a.z }, ab = { x: b.x - a.x, z: b.z - a.z };
  return Math.abs(cross(ap, ab)) < 0.0001 && ap.x * ab.x + ap.z * ab.z >= -0.0001
    && ap.x * ab.x + ap.z * ab.z <= ab.x ** 2 + ab.z ** 2 + 0.0001;
}
function insideFootprint(point: Point): boolean {
  let inside = false;
  for (let i = 0, j = footprint.length - 1; i < footprint.length; j = i++) {
    const a = footprint[i], b = footprint[j];
    if (onSegment(point, a, b)) return true;
    if ((a.z > point.z) !== (b.z > point.z)
      && point.x < (b.x - a.x) * (point.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
function insidePlan(rect: Rectangle): boolean {
  const points = corners(rect);
  // Sample the edges too: corner-only checks miss a rotated object over a concave notch.
  return points.every((point, index) => {
    const end = points[(index + 1) % points.length];
    const steps = Math.max(1, Math.ceil(Math.hypot(end.x - point.x, end.z - point.z) / 0.1));
    for (let step = 0; step <= steps; step++) {
      const ratio = step / steps;
      if (!insideFootprint({ x: point.x + (end.x - point.x) * ratio, z: point.z + (end.z - point.z) * ratio })) return false;
    }
    return true;
  });
}
function rayDistance(origin: Point, direction: Point, polygons: Point[][]): number {
  let nearest = 10;
  for (const polygon of polygons) for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const segment = { x: b.x - a.x, z: b.z - a.z };
    const denominator = cross(direction, segment);
    if (Math.abs(denominator) < 1e-8) continue;
    const difference = { x: a.x - origin.x, z: a.z - origin.z };
    const distance = cross(difference, segment) / denominator;
    const along = cross(difference, direction) / denominator;
    if (distance >= 0 && along >= 0 && along <= 1) nearest = Math.min(nearest, distance);
  }
  return nearest;
}
export interface FurnitureInspection { blocked: boolean; message: string; clearance: number }
/** A local geometric check, not a building-code or complete accessible-route assessment. */
export function inspectFurniture(state: ApartmentState, id: string): FurnitureInspection {
  const item = state.furniture[id];
  if (!item || !FURNITURE.some(definition => definition.id === id)) {
    return { blocked: true, message: 'Selecciona un mueble para revisar sus medidas.', clearance: 0 };
  }
  if (![item.x, item.z, item.rotation, item.width, item.depth, item.height].every(Number.isFinite)
    || item.width <= 0 || item.depth <= 0 || item.height <= 0) {
    return { blocked: true, message: 'Las medidas del mueble no son válidas.', clearance: 0 };
  }
  if (!insidePlan(item)) return { blocked: true, message: 'El mueble queda fuera de la superficie del plano.', clearance: 0 };
  if (WALLS.some(wall => item.height > wall.base + 0.01 && rectanglesOverlap(item, wall))) {
    return { blocked: true, message: 'El mueble se cruza con un muro. Muévelo o reduce sus medidas.', clearance: 0 };
  }
  if (FIXED_OBSTACLES.some(obstacle => item.height > obstacle.base + 0.01 && rectanglesOverlap(item, obstacle))) {
    return { blocked: true, message: 'El mueble se cruza con una instalación fija. Prueba otra posición.', clearance: 0 };
  }
  const others = FURNITURE.filter(definition => definition.id !== id).map(definition => ({
    id: definition.id, label: definition.label, transform: state.furniture[definition.id],
  })).filter(other => other.transform);
  const collision = others.find(other => rectanglesOverlap(item, other.transform));
  if (collision) return { blocked: true, message: `El mueble se cruza con ${collision.label.toLocaleLowerCase('es')}.`, clearance: 0 };
  const angle = item.rotation * degree;
  const direction = { x: Math.sin(angle), z: Math.cos(angle) };
  const side = { x: Math.cos(angle), z: -Math.sin(angle) };
  const polygons = [footprint, ...[...WALLS, ...FIXED_OBSTACLES].filter(obstacle => obstacle.base < 1.8).map(corners),
    ...others.map(other => corners(other.transform))];
  const clearance = Math.max(0, Math.min(...[-0.3, 0, 0.3].map(offset => rayDistance({
    x: item.x + direction.x * (item.depth / 2 + 0.001) + side.x * item.width * offset,
    z: item.z + direction.z * (item.depth / 2 + 0.001) + side.z * item.width * offset,
  }, direction, polygons))));
  return {
    blocked: false, clearance,
    message: clearance < 0.6
      ? `Frente libre aproximado: ${clearance.toFixed(2)} m. Prueba otra posición para ganar espacio.`
      : `Frente libre aproximado: ${clearance.toFixed(2)} m. Estimación geométrica del plano referencial.`,
  };
}

/** Converts a Chilean local date/time to UTC using the IANA Santiago DST rules. */
export function santiagoDateTime(date: string, hour: number): Date {
  if (!isDate(date) || !Number.isFinite(hour)) return new Date(Number.NaN);
  const [year, month, day] = date.split('-').map(Number);
  const wanted = Date.UTC(year, month - 1, day) + clamp(hour, 0, 24) * 3600000;
  let utc = wanted;
  for (let i = 0; i < 3; i++) {
    const parts = localParts(new Date(utc));
    const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const adjustment = wanted - wall;
    if (Math.abs(adjustment) < 1000) break;
    utc += adjustment;
  }
  return new Date(utc);
}
export interface SolarPosition {
  /** Degrees above the horizon. Negative values mean the Sun is below it. */
  altitude: number;
  /** True compass bearing, clockwise from north, before the model offset. */
  azimuth: number;
  /** Unit direction toward the Sun: +X east, +Y up, +Z north at zero offset. */
  direction: { x: number; y: number; z: number };
}
/** NOAA solar-coordinate equations; geometric altitude, without atmospheric refraction.
 * The location is approximate Eco Egaña. Model north is adjustable, not verified.
 */
export function solarPosition(date: string, hour: number, latitude = -33.456, longitude = -70.57, northOffset = 0): SolarPosition {
  const instant = santiagoDateTime(date, hour);
  if (!Number.isFinite(instant.getTime())) return { altitude: -90, azimuth: 0, direction: { x: 0, y: -1, z: 0 } };
  const centuries = (instant.getTime() / 86400000 + 2440587.5 - 2451545) / 36525;
  const meanLongitude = modulo(280.46646 + centuries * (36000.76983 + centuries * 0.0003032), 360);
  const meanAnomaly = 357.52911 + centuries * (35999.05029 - 0.0001537 * centuries);
  const eccentricity = 0.016708634 - centuries * (0.000042037 + 0.0000001267 * centuries);
  const anomaly = meanAnomaly * degree;
  const centre = Math.sin(anomaly) * (1.914602 - centuries * (0.004817 + 0.000014 * centuries))
    + Math.sin(2 * anomaly) * (0.019993 - 0.000101 * centuries) + Math.sin(3 * anomaly) * 0.000289;
  const apparentLongitude = (meanLongitude + centre - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * centuries) * degree)) * degree;
  const obliquity = (23 + (26 + (21.448 - centuries * (46.815 + centuries * (0.00059 - centuries * 0.001813))) / 60) / 60
    + 0.00256 * Math.cos((125.04 - 1934.136 * centuries) * degree)) * degree;
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(apparentLongitude));
  const y = Math.tan(obliquity / 2) ** 2;
  const long = meanLongitude * degree;
  const equationOfTime = 4 / degree * (y * Math.sin(2 * long) - 2 * eccentricity * Math.sin(anomaly)
    + 4 * eccentricity * y * Math.sin(anomaly) * Math.cos(2 * long)
    - 0.5 * y * y * Math.sin(4 * long) - 1.25 * eccentricity * eccentricity * Math.sin(2 * anomaly));
  const utcMinutes = instant.getUTCHours() * 60 + instant.getUTCMinutes() + instant.getUTCSeconds() / 60;
  const solarMinutes = modulo(utcMinutes + equationOfTime + 4 * clamp(longitude, -180, 180), 1440);
  const hourAngle = (solarMinutes / 4 - 180) * degree;
  const lat = clamp(latitude, -89.999, 89.999) * degree;
  const altitude = Math.asin(clamp(Math.sin(lat) * Math.sin(declination)
    + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle), -1, 1));
  const azimuth = modulo(Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(lat)
    - Math.tan(declination) * Math.cos(lat)) / degree + 180, 360);
  const modelAzimuth = (azimuth + northOffset) * degree;
  return {
    altitude: altitude / degree, azimuth,
    direction: { x: Math.sin(modelAzimuth) * Math.cos(altitude), y: Math.sin(altitude), z: Math.cos(modelAzimuth) * Math.cos(altitude) },
  };
}
