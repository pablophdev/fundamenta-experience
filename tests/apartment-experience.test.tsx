import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import ApartmentExperience from '../src/ApartmentExperience';
import { APARTMENT_STORAGE_KEY, FURNITURE, sanitizeApartmentState } from '../src/apartment-state';
import type { ApartmentState } from '../src/apartment-state';

const shared = vi.hoisted(() => ({
  status: 'idle', inviteUrl: null as string | null, participantCount: 0, error: null as string | null,
  createVisit: vi.fn(async () => {}), leaveVisit: vi.fn(),
}));
vi.mock('../src/shared-visit', () => ({ useSharedVisit: () => shared }));
vi.mock('../src/ApartmentScene', () => ({
  default: ({ state, onFurnitureSelect }: { state: ApartmentState; onFurnitureSelect: (id: string) => void }) =>
    <div><output data-testid="scene-state">{JSON.stringify(state)}</output><button onClick={() => onFurnitureSelect('sofa')}>Seleccionar sofá en el modelo</button></div>,
}));
const readState = (): ApartmentState => JSON.parse(screen.getByTestId('scene-state').textContent!);

beforeEach(() => {
  localStorage.clear();
  shared.status = 'idle'; shared.inviteUrl = null; shared.participantCount = 0; shared.error = null;
  vi.clearAllMocks();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Interior personalizable', () => {
  it('cambia decoración, hora y espacio manteniendo la distribución', () => {
    render(<ApartmentExperience onBack={vi.fn()} onClose={vi.fn()} />);
    const initial = readState();
    fireEvent.click(screen.getByRole('button', { name: /Cálido/ }));
    fireEvent.change(screen.getByLabelText('Hora de la simulación'), { target: { value: '21.5' } });
    fireEvent.change(screen.getByLabelText('Fecha', { exact: true }), { target: { value: '2026-06-21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Terraza', exact: true }));
    const state = readState();
    expect(state.theme).toBe('warm'); expect(state.hour).toBe(21.5);
    expect(state.date).toBe('2026-06-21'); expect(state.room).toBe('balcony');
    expect(state.furniture).toEqual(sanitizeApartmentState(initial).furniture);
  });

  it('edita dimensiones reales, detecta una superposición y restaura el mueble', () => {
    render(<ApartmentExperience onBack={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar sofá en el modelo' }));
    const sofa = FURNITURE.find(item => item.id === 'sofa')!;
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Ancho del mueble en metros' }), { target: { value: '5' } });
    expect(readState().furniture.sofa.width).toBe(5);
    expect(screen.getByText('Revisa esta posición')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mover mueble a la derecha' }));
    expect(readState().furniture.sofa.x).toBeCloseTo(sofa.x + .1);
    fireEvent.click(screen.getByRole('button', { name: 'Girar mueble 15 grados a la derecha' }));
    expect(readState().furniture.sofa.rotation).toBe((sofa.rotation + 15) % 360);
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar este mueble' }));
    expect(readState().furniture.sofa.width).toBe(sofa.width);
    expect(readState().furniture.sofa.x).toBe(sofa.x);
  });

  it('recorre los momentos del día y permite detener el avance', () => {
    vi.useFakeTimers();
    render(<ApartmentExperience onBack={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Mi día aquí/ }));
    expect(readState().hour).toBe(8); expect(readState().room).toBe('living');
    act(() => vi.advanceTimersByTime(6500));
    expect(readState().hour).toBe(9); expect(readState().room).toBe('kitchen');
    fireEvent.click(screen.getByRole('button', { name: /Detener recorrido/ }));
    act(() => vi.advanceTimersByTime(20000));
    expect(readState().hour).toBe(9);
  });

  it('muestra espera y confirma compañía solamente cuando el servicio la informa', () => {
    const view = render(<ApartmentExperience onBack={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Visita' }));
    expect(screen.getByText('Exploración personal')).toBeTruthy();
    shared.status = 'waiting'; shared.participantCount = 1;
    shared.inviteUrl = 'https://example.org/?visit=123';
    view.rerender(<ApartmentExperience onBack={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Esperando compañía')).toBeTruthy();
    expect(screen.queryByText('Visita conectada')).toBeNull();
    shared.status = 'connected'; shared.participantCount = 2;
    view.rerender(<ApartmentExperience onBack={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Visita conectada')).toBeTruthy();
    expect(screen.getByText('2 personas conectadas')).toBeTruthy();
    shared.status = 'error'; shared.participantCount = 0; shared.error = 'Sin conexión.';
    view.rerender(<ApartmentExperience onBack={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toBe('Sin conexión.');
    expect(screen.queryByText('Visita conectada')).toBeNull();
  });

  it('conserva la personalización local al volver al departamento', () => {
    const first = render(<ApartmentExperience onBack={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Minimal/ }));
    expect(JSON.parse(localStorage.getItem(APARTMENT_STORAGE_KEY)!).theme).toBe('minimal');
    first.unmount();
    render(<ApartmentExperience onBack={vi.fn()} onClose={vi.fn()} />);
    expect(readState().theme).toBe('minimal');
  });
});
