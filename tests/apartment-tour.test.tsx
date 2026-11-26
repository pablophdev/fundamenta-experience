import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import ApartmentTour from '../src/ApartmentTour';

const tourTitle = 'Recorrido 3D amoblado del piloto de Eco Egaña Norte';
const tourUrl = 'https://my.matterport.com/show/?m=yb7QwQrptqv';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Recorrido interior oficial', () => {
  it('abre el piloto oficial y ofrece instrucciones sin atribuirlo a una unidad del edificio', () => {
    const onBack = vi.fn();
    render(<ApartmentTour onBack={onBack} onClose={vi.fn()} />);

    const frame = screen.getByTitle(tourTitle);
    expect(frame.getAttribute('src')).toBe(tourUrl);
    expect(screen.getByText('Piloto · 2 dormitorios · 2 baños')).toBeTruthy();
    expect(screen.getByText(/Ubicación en la fachada referencial/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Abrir recorrido en otra pestaña' }).getAttribute('href')).toBe(tourUrl);

    const help = screen.getByRole('button', { name: 'Cómo recorrerlo' });
    fireEvent.click(help);
    expect(help.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('region', { name: 'Instrucciones del recorrido' }).textContent).toContain('Toca los círculos del suelo');
    fireEvent.click(help);
    expect(screen.queryByRole('region', { name: 'Instrucciones del recorrido' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Volver al edificio' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('ofrece recuperación al demorarse el visor y vuelve al estado de carga al reintentar', () => {
    vi.useFakeTimers();
    render(<ApartmentTour onBack={vi.fn()} onClose={vi.fn()} />);
    const firstFrame = screen.getByTitle(tourTitle);
    expect(screen.getByText('Cargando el recorrido del piloto')).toBeTruthy();

    act(() => { vi.advanceTimersByTime(15_000); });
    expect(screen.getByText(/El visor está tardando en cargar/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    const secondFrame = screen.getByTitle(tourTitle);
    expect(secondFrame).not.toBe(firstFrame);
    expect(secondFrame.getAttribute('src')).toBe(tourUrl);
    expect(screen.getByText('Cargando el recorrido del piloto')).toBeTruthy();

    act(() => { vi.advanceTimersByTime(15_000); });
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    fireEvent.load(screen.getByTitle(tourTitle));
    expect(screen.queryByText('Cargando el recorrido del piloto')).toBeNull();
    expect(screen.getByRole('button', { name: 'Recargar recorrido' })).toBeTruthy();

    act(() => { vi.advanceTimersByTime(15_000); });
    expect(screen.queryByText(/El visor está tardando en cargar/)).toBeNull();
  });
});
