import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../src/App';
import BuildingExplorer from '../src/BuildingExplorer';

afterEach(cleanup);

describe('Recorrido de Fundamenta', () => {
  it('permite cambiar la iluminación y navegar por los espacios con teclado', () => {
    render(<App />);
    const day = screen.getByRole('button', { name: 'Día', exact: true });
    fireEvent.click(day);
    expect(day.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Atardecer' }).getAttribute('aria-pressed')).toBe('false');
    const room = screen.getByRole('tab', { name: 'Tu espacio' });
    fireEvent.keyDown(room, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Terraza' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').textContent).toContain('Los mejores momentos');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Terraza' }), { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Bienvenida' }).getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Bienvenida' }));
  });

  it('abre y cierra el explorador, bloquea el scroll y devuelve el foco', () => {
    render(<App />);
    const trigger = screen.getByRole('button', { name: 'Explorar el edificio Eco Egaña Norte' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Eco Egaña Norte' })).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerrar explorador' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(trigger);
  });

  it('la galería avanza y se cierra con el teclado', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Ampliar imagen del espacio' }));
    const dialog = screen.getByRole('dialog', { name: 'Galería de espacios' });
    expect(dialog.querySelector('img')?.getAttribute('src')).toContain('living-kitchen');
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(dialog.querySelector('img')?.getAttribute('src')).toContain('balcony-bbq');
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(dialog.querySelector('img')?.getAttribute('src')).toContain('living-kitchen');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('mantiene el selector de pisos disponible cuando el visor no puede iniciarse', () => {
    render(<BuildingExplorer onClose={vi.fn()} />);
    const slider = screen.getByRole('slider') as HTMLInputElement;
    expect(screen.getByText(/La vista 3D no está disponible/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Descargar modelo 3D (.glb)' }).getAttribute('href')).toBe('/models/eco-egana.glb');
    fireEvent.change(slider, { target: { value: '25' } });
    expect(slider.value).toBe('25');
    fireEvent.click(screen.getByRole('button', { name: 'Subir un piso' }));
    expect(slider.value).toBe('26');
    expect((screen.getByRole('button', { name: 'Subir un piso' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Bajar un piso' }));
    expect(slider.value).toBe('25');
    fireEvent.change(slider, { target: { value: '3' } });
    expect((screen.getByRole('button', { name: 'Bajar un piso' }) as HTMLButtonElement).disabled).toBe(true);
    const day = screen.getByRole('button', { name: 'Día', exact: true });
    fireEvent.click(day);
    expect(screen.getByRole('img', { name: 'Render de referencia de Eco Egaña Norte' }).getAttribute('src')).toContain('-day.webp');
  });
});
