import { randomBytes, timingSafeEqual } from 'node:crypto';

const MAX_BODY_BYTES = 16_384;
const VISIT_ID = /^[A-Za-z0-9_-]{32}$/;
const CLIENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class HttpError extends Error {
  constructor(status, message, code, retryAfter) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export function isAllowedOrigin(origin) {
  if (!origin) return true; // CLI/service checks have no browser Origin.
  try {
    const url = new URL(origin);
    if (url.origin !== origin) return false;
    return (url.protocol === 'https:' && (
      /^[a-z0-9][a-z0-9-]*\.vercel\.app$/.test(url.hostname) ||
      url.hostname === 'pablophdev.github.io'
    )) || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && url.port === '3000');
  } catch { return false; }
}

export function validateState(value) {
  let count = 0;
  function visit(item, depth) {
    if (++count > 1500 || depth > 12) throw new HttpError(400, 'La configuración es demasiado compleja.', 'INVALID_STATE');
    if (item === null || typeof item === 'boolean') return;
    if (typeof item === 'number' && Number.isFinite(item)) return;
    if (typeof item === 'string' && item.length <= 4096) return;
    if (Array.isArray(item) && item.length <= 256) { item.forEach(child => visit(child, depth + 1)); return; }
    if (item && Object.getPrototypeOf(item) === Object.prototype) {
      const keys = Object.keys(item);
      if (keys.length <= 128 && keys.every(key => key.length <= 100 && !['__proto__', 'prototype', 'constructor'].includes(key))) {
        keys.forEach(key => visit(item[key], depth + 1)); return;
      }
    }
    throw new HttpError(400, 'La configuración no tiene un formato válido.', 'INVALID_STATE');
  }
  visit(value, 0);
  return value;
}

async function parseBody(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) {
    throw new HttpError(415, 'Se requiere contenido JSON.', 'JSON_REQUIRED');
  }
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
    throw new HttpError(413, 'La configuración supera el límite permitido.', 'PAYLOAD_TOO_LARGE');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Falta el contenido de la solicitud.', 'INVALID_BODY');
  let length = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BODY_BYTES) { await reader.cancel(); throw new HttpError(413, 'La configuración supera el límite permitido.', 'PAYLOAD_TOO_LARGE'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let body;
  try { body = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new HttpError(400, 'El JSON no es válido.', 'INVALID_BODY'); }
  if (!body || Array.isArray(body) || typeof body !== 'object' || !CLIENT_ID.test(body.clientId ?? '')) {
    throw new HttpError(400, 'El identificador del participante no es válido.', 'INVALID_CLIENT');
  }
  return body;
}

/** One parameterized HTTP query. DATABASE_URL never leaves this server. */
async function databaseQuery(query, params) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new HttpError(503, 'La visita compartida no está configurada.', 'SERVICE_UNAVAILABLE', 5);
  const connection = new URL(connectionString);
  // Same endpoint derivation as @neondatabase/serverless's default fetchEndpoint.
  const endpoint = `https://${connection.hostname.replace(/^[^.]+\./, 'api.')}/sql`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Neon-Connection-String': connectionString,
      'Neon-Raw-Text-Output': 'true',
      'Neon-Array-Mode': 'true',
    },
    body: JSON.stringify({ query, params }),
    signal: AbortSignal.timeout(12_000),
  });
  const result = await response.json();
  if (!response.ok) {
    const messages = {
      VISIT_NOT_FOUND: [404, 'La visita no existe o ya caducó.'],
      VISIT_EXPIRED: [410, 'La visita compartida ha caducado.'],
      VISIT_FULL: [409, 'La visita alcanzó el máximo de seis participantes.'],
      VISIT_CAPACITY: [503, 'No se pueden crear más visitas por ahora.'],
      VISIT_RATE_LIMIT: [429, 'Espera un momento antes de crear otra visita.'],
    };
    const code = Object.keys(messages).find(key => String(result.message).includes(key));
    if (code) throw new HttpError(messages[code][0], messages[code][1], code, code === 'VISIT_RATE_LIMIT' ? 60 : undefined);
    throw new HttpError(503, 'La visita compartida no está disponible. Inténtalo de nuevo.', 'SERVICE_UNAVAILABLE', 5);
  }
  const cell = result.rows?.[0]?.[0];
  if (typeof cell === 'string') return JSON.parse(cell);
  if (cell !== null && typeof cell === 'object') return cell;
  throw new HttpError(503, 'La visita compartida devolvió una respuesta incompleta.', 'SERVICE_UNAVAILABLE', 5);
}

function authorize(request, roomId) {
  if (!VISIT_ID.test(roomId)) throw new HttpError(404, 'La visita no existe.', 'VISIT_NOT_FOUND');
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  const provided = Buffer.from(token), expected = Buffer.from(roomId);
  if (provided.byteLength !== expected.byteLength || !timingSafeEqual(provided, expected)) {
    throw new HttpError(401, 'Este enlace no permite entrar a la visita.', 'UNAUTHORIZED');
  }
}

export function createHandler(query = databaseQuery) {
  return {
    async fetch(request) {
      const origin = request.headers.get('origin');
      const headers = new Headers({
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Vary': 'Origin',
        'X-Content-Type-Options': 'nosniff',
      });
      const allowed = isAllowedOrigin(origin);
      if (origin && allowed) headers.set('Access-Control-Allow-Origin', origin);
      const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
      try {
        if (!allowed) throw new HttpError(403, 'Este origen no puede acceder a la visita.', 'ORIGIN_NOT_ALLOWED');
        const url = new URL(request.url);
        const path = url.pathname.replace(/\/+$/, '') || '/';
        if (request.method === 'OPTIONS') {
          headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          headers.set('Access-Control-Max-Age', '600');
          return new Response(null, { status: 204, headers });
        }
        if (request.method === 'GET' && (path === '/health' || path === '/')) return json({ ok: true, service: 'fundamenta-shared-visits', version: 1 });
        if (request.method !== 'POST') throw new HttpError(405, 'Método no permitido.', 'METHOD_NOT_ALLOWED');

        if (path === '/visits') {
          const body = await parseBody(request);
          if (!Object.hasOwn(body, 'state')) throw new HttpError(400, 'Falta la configuración inicial.', 'INVALID_STATE');
          validateState(body.state);
          const id = randomBytes(24).toString('base64url');
          const result = await query('SELECT create_shared_visit($1, $2, $3::jsonb)', [id, body.clientId, JSON.stringify(body.state)]);
          return json(result, 201);
        }

        const route = /^\/visits\/([^/]+)\/(sync|leave)$/.exec(path);
        if (!route) throw new HttpError(404, 'La ruta no existe.', 'NOT_FOUND');
        const [, roomId, action] = route;
        authorize(request, roomId);
        const body = await parseBody(request);
        if (action === 'leave') return json(await query('SELECT leave_shared_visit($1, $2)', [roomId, body.clientId]));

        if (body.knownVersion !== undefined && (!Number.isSafeInteger(body.knownVersion) || body.knownVersion < 0)) {
          throw new HttpError(400, 'La versión de la visita no es válida.', 'INVALID_VERSION');
        }
        const hasState = Object.hasOwn(body, 'state');
        if (hasState) validateState(body.state);
        return json(await query('SELECT sync_shared_visit($1, $2, $3::jsonb, $4::boolean)', [roomId, body.clientId, hasState ? JSON.stringify(body.state) : null, hasState]));
      } catch (error) {
        const known = error instanceof HttpError;
        const status = known ? error.status : 503;
        if (known && error.retryAfter) headers.set('Retry-After', String(error.retryAfter));
        return json({ error: known ? error.message : 'La visita compartida no está disponible. Reintenta la conexión.', code: known ? error.code : 'SERVICE_UNAVAILABLE' }, status);
      }
    },
  };
}

export default createHandler();
