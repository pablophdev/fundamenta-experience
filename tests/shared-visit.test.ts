// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getVisitIdFromUrl, serializeSharedState, SharedVisitClient, SHARED_VISIT_ENDPOINT } from '../src/shared-visit';
import type { SharedVisitSnapshot } from '../src/shared-visit';

vi.stubGlobal('navigator', { onLine: true });
vi.stubGlobal('window', { location: { href: 'https://example.com/' }, history: { replaceState: (_state: unknown, _unused: string, url: string) => { window.location.href = new URL(url, 'https://example.com').href; } } });

const roomId = 'nYMHrqKwoUGX4luVJxNcC5gBuQJx0F86';
const clients: SharedVisitClient<object>[] = [];
afterEach(() => { clients.splice(0).forEach(client => client.dispose()); vi.restoreAllMocks(); });

describe('Enlaces y datos de visita compartida', () => {
  it('acepta IDs de invitación completos sin confundirlos con otras query strings', () => {
    expect(getVisitIdFromUrl(`https://example.com/fundamenta/?visit=${roomId}#inicio`)).toBe(roomId);
    expect(getVisitIdFromUrl('https://example.com/?visit=123')).toBeNull();
    expect(getVisitIdFromUrl('https://example.com/?visit=<script>')).toBeNull();
    expect(getVisitIdFromUrl('https://example.com/?other=123')).toBeNull();
    expect(getVisitIdFromUrl('not a URL')).toBeNull();
    window.history.replaceState(null, '', `/?visit=${roomId}`);
    expect(getVisitIdFromUrl()).toBe(roomId);
    window.history.replaceState(null, '', '/');
  });

  it('serializa decoración, muebles, habitación y hora y rechaza datos no transportables', () => {
    const state = { decoration: 'natural', hour: 15.5, furniture: [{ id: 'sofa', position: [1, 0, 2] }], room: 'living', camera: null };
    expect(JSON.parse(serializeSharedState(state))).toEqual(state);
    expect(() => serializeSharedState({ hour: Infinity })).toThrow();
    expect(() => serializeSharedState({ room: undefined })).toThrow();
    expect(() => serializeSharedState({ date: new Date() })).toThrow();
    expect(() => serializeSharedState({ text: 'x'.repeat(17_000) })).toThrow();
    const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    expect(() => serializeSharedState(cycle)).toThrow();
    expect(() => serializeSharedState(JSON.parse('{"__proto__":{"admin":true}}'))).toThrow();
  });

  it('no anuncia una conexión ni genera invitación si falla el servidor', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Servidor no disponible'));
    const snapshots: SharedVisitSnapshot[] = [];
    const client = new SharedVisitClient({ endpoint: 'https://visits.invalid', initialState: { room: 'living' }, onRemoteState: vi.fn(), onChange: value => snapshots.push(value), inviteBaseUrl: 'https://example.com/' });
    clients.push(client as SharedVisitClient<object>);
    await client.createVisit();
    expect(snapshots[0].status).toBe('connecting');
    expect(snapshots.at(-1)?.status).toBe('error');
    expect(snapshots.at(-1)?.participantCount).toBe(0);
    expect(snapshots.at(-1)?.inviteUrl).toBeNull();
    expect(snapshots.some(value => value.status === 'connected' || value.status === 'waiting')).toBe(false);
    client.leaveVisit();
    expect(snapshots.at(-1)?.status).toBe('idle');
  });
});

// Explicit integration check against the deployed service, never a mocked connection.
// Run with RUN_SHARED_VISIT_LIVE=1 npm test -- tests/shared-visit.test.ts
describe.runIf(process.env.RUN_SHARED_VISIT_LIVE === '1')('Dos dispositivos contra Neon real', () => {
  it('comparte cambios en ambos sentidos, evita eco y confirma la salida del otro dispositivo', async () => {
    type State = { decoration: string; hour: number; room: string; furniture: number[] };
    let hostSnapshot: SharedVisitSnapshot | undefined;
    let guestSnapshot: SharedVisitSnapshot | undefined;
    let hostState: State = { decoration: 'natural', hour: 13, room: 'living', furniture: [1, 2] };
    let guestState: State = { decoration: 'minimal', hour: 8, room: 'bedroom', furniture: [] };
    let receivedHost = 0, receivedGuest = 0;
    const host = new SharedVisitClient<State>({ endpoint: SHARED_VISIT_ENDPOINT, initialState: hostState, inviteBaseUrl: 'https://example.com/fundamenta/', onChange: value => { hostSnapshot = value; }, onRemoteState: value => { receivedHost++; hostState = value; host.setState(value); } });
    const guest = new SharedVisitClient<State>({ endpoint: SHARED_VISIT_ENDPOINT, initialState: guestState, inviteBaseUrl: 'https://example.com/fundamenta/', onChange: value => { guestSnapshot = value; }, onRemoteState: value => { receivedGuest++; guestState = value; guest.setState(value); } });
    clients.push(host as SharedVisitClient<object>, guest as SharedVisitClient<object>);

    await host.createVisit();
    expect(hostSnapshot?.status, hostSnapshot?.error ?? '').toBe('waiting');
    expect(hostSnapshot?.participantCount).toBe(1);
    const id = getVisitIdFromUrl(hostSnapshot?.inviteUrl ?? '');
    expect(id).toBeTruthy();
    await guest.join(id!);
    await vi.waitFor(() => expect(hostSnapshot?.status).toBe('connected'), { timeout: 15_000 });
    expect(guestSnapshot?.status).toBe('connected');
    expect(guestState).toEqual(hostState);

    hostState = { ...hostState, decoration: 'warm', hour: 19, furniture: [3, 2, 4] };
    host.setState(hostState);
    await vi.waitFor(() => expect(guestState).toEqual(hostState), { timeout: 15_000 });
    guestState = { ...guestState, room: 'terrace', hour: 10 };
    guest.setState(guestState);
    await vi.waitFor(() => expect(hostState).toEqual(guestState), { timeout: 15_000 });
    expect(receivedHost).toBe(1);
    expect(receivedGuest).toBe(2);

    guest.leaveVisit();
    await vi.waitFor(() => expect(hostSnapshot?.status).toBe('waiting'), { timeout: 15_000 });
    expect(hostSnapshot?.participantCount).toBe(1);
    expect(guestSnapshot?.status).toBe('idle');
  }, 65_000);
});
