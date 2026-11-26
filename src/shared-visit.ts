import { useCallback, useEffect, useRef, useState } from 'react';

export type SharedVisitValue = null | boolean | number | string | SharedVisitValue[] | { [key: string]: SharedVisitValue };
export type SharedVisitState = Record<string, SharedVisitValue>;
export type SharedVisitStatus = 'idle' | 'connecting' | 'waiting' | 'connected' | 'error';
export interface SharedVisitSnapshot {
  status: SharedVisitStatus;
  inviteUrl: string | null;
  participantCount: number;
  error: string | null;
}

// Public invocation URL; room access is authorized by its unguessable invitation ID.
export const SHARED_VISIT_ENDPOINT = import.meta.env.VITE_SHARED_VISIT_URL || 'https://br-muddy-sky-bc24a3of-sharedvisits.compute.c-16.us-east-1.aws.neon.tech/';
const VISIT_ID = /^[A-Za-z0-9_-]{32}$/;
const MAX_STATE_BYTES = 16_384;
const WRITE_THROTTLE_MS = 250;
const POLL_MS = 1_200;
const initialSnapshot: SharedVisitSnapshot = { status: 'idle', inviteUrl: null, participantCount: 0, error: null };

export function getVisitIdFromUrl(url?: string | URL): string | null {
  try {
    const parsed = new URL(url?.toString() ?? (typeof window === 'undefined' ? '' : window.location.href));
    const id = parsed.searchParams.get('visit');
    return id && VISIT_ID.test(id) ? id : null;
  } catch { return null; }
}

export function serializeSharedState(state: object): string {
  let nodes = 0;
  const seen = new Set<object>();
  function validate(value: unknown, depth: number): void {
    if (++nodes > 3_000 || depth > 12) throw new Error('La configuración compartida es demasiado grande.');
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (typeof value !== 'object' || seen.has(value)) throw new Error('La configuración compartida no es válida.');
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) throw new Error('La configuración compartida no es válida.');
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new Error('La configuración compartida no es válida.');
      validate(child, depth + 1);
    }
    seen.delete(value);
  }
  if (!state || Array.isArray(state)) throw new Error('La configuración compartida no es válida.');
  validate(state, 0);
  function normalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize((value as Record<string, unknown>)[key])]));
    return value;
  }
  // Postgres JSONB reorders keys. Canonical serialization prevents false local edits.
  const result = JSON.stringify(normalize(state));
  if (new TextEncoder().encode(result).byteLength > MAX_STATE_BYTES) throw new Error('La configuración compartida es demasiado grande.');
  return result;
}

interface ServerSnapshot<T> { visitId?: string; version: number; state: T; author: string; participantCount: number }
interface ClientOptions<T extends object> {
  endpoint: string;
  initialState: T;
  onRemoteState: (state: T) => void;
  onChange: (snapshot: SharedVisitSnapshot) => void;
  inviteBaseUrl: string;
}

/** Polls durable snapshots; “connected” requires presence confirmed by the server. */
export class SharedVisitClient<T extends object> {
  private snapshot: SharedVisitSnapshot = { ...initialSnapshot };
  private roomId: string | null = null;
  private readonly clientId = crypto.randomUUID();
  private state: T;
  private serialized: string;
  private lastServerState = '';
  private blockedPreviousState: string | null = null;
  private version = 0;
  private generation = 0;
  private disposed = false;
  private inFlight = false;
  private abort: AbortController | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private writeTimer: ReturnType<typeof setTimeout> | null = null;
  private lastWriteAt = 0;
  private createPromise: Promise<void> | null = null;

  constructor(private options: ClientOptions<T>) {
    this.state = options.initialState;
    this.serialized = serializeSharedState(this.state);
  }

  private publish(patch: Partial<SharedVisitSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    if (!this.disposed) this.options.onChange({ ...this.snapshot });
  }

  private inviteUrl(id: string): string {
    const url = new URL(this.options.inviteBaseUrl);
    url.search = '';
    url.searchParams.set('visit', id);
    url.hash = '';
    return url.href;
  }

  private async request(path: string, body: object, roomId?: string, keepalive = false): Promise<unknown> {
    if (!this.options.endpoint) throw new Error('La visita compartida no está configurada.');
    const controller = new AbortController();
    if (!keepalive) this.abort = controller;
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`${this.options.endpoint.replace(/\/$/, '')}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(roomId ? { Authorization: `Bearer ${roomId}` } : {}) },
        body: JSON.stringify(body), signal: controller.signal, cache: 'no-store', keepalive,
      });
      const value = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        if (response.status === 404 || response.status === 410) throw new Error('La visita no existe o ya caducó. Crea una nueva.');
        if (response.status === 429) throw new Error('La visita está ocupada. Espera un momento e inténtalo de nuevo.');
        throw new Error(value?.error || 'No se pudo conectar con la visita compartida.');
      }
      return value;
    } finally {
      clearTimeout(timeout);
      if (this.abort === controller) this.abort = null;
    }
  }

  private validateSnapshot(value: unknown): ServerSnapshot<T> {
    const data = value as ServerSnapshot<T> | null;
    if (!data || !Number.isInteger(data.version) || data.version < 1 || !Number.isInteger(data.participantCount) || data.participantCount < 1 || data.participantCount > 6 || typeof data.author !== 'string') throw new Error('La respuesta de la visita no es válida.');
    serializeSharedState(data.state);
    return data;
  }

  private accept(data: ServerSnapshot<T>, stateAtRequest: string): void {
    if (data.version > this.version) {
      this.version = data.version;
      const serverState = serializeSharedState(data.state);
      this.lastServerState = serverState;
      // A local edit made during the request takes precedence at the next write.
      if (data.author !== this.clientId && this.serialized === stateAtRequest && this.serialized !== serverState) {
        this.blockedPreviousState = this.serialized;
        this.options.onRemoteState(data.state);
      }
    }
    this.publish({ status: data.participantCount >= 2 ? 'connected' : 'waiting', participantCount: data.participantCount, error: null });
  }

  private startPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => { void this.sync(); }, POLL_MS);
  }

  private stop(): void {
    ++this.generation;
    this.abort?.abort(); this.abort = null;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.writeTimer) clearTimeout(this.writeTimer);
    this.pollTimer = null; this.writeTimer = null;
    this.roomId = null; this.version = 0; this.lastServerState = ''; this.blockedPreviousState = null; this.inFlight = false;
  }

  private failure(error: unknown): void {
    const message = typeof navigator !== 'undefined' && !navigator.onLine ? 'Sin conexión. Reconectaremos cuando vuelva internet.' : error instanceof Error && error.name !== 'AbortError' ? error.message : 'Se perdió la conexión con la visita. Reintentando…';
    this.publish({ status: 'error', error: message, participantCount: 0 });
  }

  async join(id: string): Promise<void> {
    if (!VISIT_ID.test(id) || this.disposed) return;
    this.stop();
    this.roomId = id;
    // Joining reads before publishing, so the visitor's defaults cannot overwrite the host.
    this.lastServerState = this.serialized;
    this.publish({ status: 'connecting', inviteUrl: this.inviteUrl(id), participantCount: 0, error: null });
    this.startPolling();
    await this.sync(false);
  }

  createVisit(): Promise<void> {
    if (this.createPromise) return this.createPromise;
    this.createPromise = this.create().finally(() => { this.createPromise = null; });
    return this.createPromise;
  }

  private async create(): Promise<void> {
    if (this.disposed) return;
    this.stop();
    const generation = this.generation;
    const stateAtRequest = this.serialized;
    this.publish({ status: 'connecting', inviteUrl: null, participantCount: 0, error: null });
    try {
      const value = await this.request('/visits', { clientId: this.clientId, state: this.state });
      if (this.disposed || generation !== this.generation) return;
      const data = this.validateSnapshot(value);
      if (!data.visitId || !VISIT_ID.test(data.visitId)) throw new Error('El enlace de la visita no es válido.');
      this.roomId = data.visitId;
      this.accept(data, stateAtRequest);
      this.publish({ inviteUrl: this.inviteUrl(data.visitId) });
      this.startPolling();
      if (this.serialized !== stateAtRequest) this.scheduleWrite();
    } catch (error) { if (!this.disposed && generation === this.generation) this.failure(error); }
  }

  private async sync(allowWrite = true): Promise<void> {
    if (!this.roomId || this.disposed || this.inFlight) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) { this.failure(new Error('Sin conexión.')); return; }
    const generation = this.generation;
    const id = this.roomId;
    const stateAtRequest = this.serialized;
    const dirty = allowWrite && this.version > 0 && stateAtRequest !== this.lastServerState && stateAtRequest !== this.blockedPreviousState && Date.now() - this.lastWriteAt >= WRITE_THROTTLE_MS;
    this.inFlight = true;
    if (dirty) this.lastWriteAt = Date.now();
    try {
      const value = await this.request(`/visits/${id}/sync`, { clientId: this.clientId, knownVersion: this.version, ...(dirty ? { state: this.state } : {}) }, id);
      if (this.disposed || generation !== this.generation) return;
      this.accept(this.validateSnapshot(value), stateAtRequest);
    } catch (error) { if (!this.disposed && generation === this.generation) this.failure(error); }
    finally { if (generation === this.generation) this.inFlight = false; }
  }

  private scheduleWrite(): void {
    if (!this.roomId || this.writeTimer || this.disposed) return;
    const delay = Math.max(WRITE_THROTTLE_MS - (Date.now() - this.lastWriteAt), 0);
    this.writeTimer = setTimeout(() => { this.writeTimer = null; void this.sync(); }, delay);
  }

  setState(state: T): void {
    let serialized: string;
    try { serialized = serializeSharedState(state); }
    catch (error) { this.failure(error); return; }
    this.state = state;
    this.serialized = serialized;
    if (serialized === this.lastServerState) this.blockedPreviousState = null;
    if (serialized !== this.lastServerState && serialized !== this.blockedPreviousState) this.scheduleWrite();
  }

  connectionChanged(online: boolean): void {
    if (!this.roomId) return;
    if (!online) { this.abort?.abort(); this.failure(new Error('Sin conexión.')); }
    else { this.publish({ status: 'connecting', error: null, participantCount: 0 }); void this.sync(false); }
  }

  leaveVisit(): void {
    const id = this.roomId;
    this.stop();
    this.publish({ ...initialSnapshot });
    if (id) void this.request(`/visits/${id}/leave`, { clientId: this.clientId }, id, true).catch(() => {});
  }

  dispose(): void {
    this.leaveVisit();
    this.disposed = true;
  }
}

export function useSharedVisit<T extends object>({ state, onRemoteState }: { state: T; onRemoteState: (state: T) => void }) {
  const [snapshot, setSnapshot] = useState<SharedVisitSnapshot>({ ...initialSnapshot });
  const callbackRef = useRef(onRemoteState);
  callbackRef.current = onRemoteState;
  const stateRef = useRef(state);
  stateRef.current = state;
  const clientRef = useRef<SharedVisitClient<T> | null>(null);

  useEffect(() => {
    const client = new SharedVisitClient<T>({ endpoint: SHARED_VISIT_ENDPOINT, initialState: stateRef.current, onRemoteState: value => callbackRef.current(value), onChange: setSnapshot, inviteBaseUrl: window.location.href });
    clientRef.current = client;
    const id = getVisitIdFromUrl();
    if (id) void client.join(id);
    const offline = () => client.connectionChanged(false);
    const online = () => client.connectionChanged(true);
    const pagehide = () => client.leaveVisit();
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    window.addEventListener('pagehide', pagehide);
    return () => {
      client.dispose(); clientRef.current = null;
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
      window.removeEventListener('pagehide', pagehide);
    };
  }, []);

  useEffect(() => { clientRef.current?.setState(state); }, [state]);
  const createVisit = useCallback(async () => { await clientRef.current?.createVisit(); }, []);
  const leaveVisit = useCallback(() => {
    clientRef.current?.leaveVisit();
    const url = new URL(window.location.href);
    url.searchParams.delete('visit');
    window.history.replaceState(window.history.state, '', url);
  }, []);
  return { ...snapshot, createVisit, leaveVisit };
}
