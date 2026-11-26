import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from '../src/App';

afterEach(cleanup);

describe('Entrada al interior desde el edificio', () => {
  it('abre el piloto oficial y recupera el piso, la iluminación y el foco al volver', () => {
    render(<App />);
    const trigger = screen.getByRole('button', { name: 'Explorar el edificio Eco Egaña Norte' });
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.change(screen.getByRole('slider'), { target: { value: '25' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Día', exact: true }));
    const enter = screen.getByRole('button', { name: 'Entrar al departamento piloto en 3D' });
    enter.focus();
    fireEvent.click(enter);

    const frame = screen.getByTitle('Recorrido 3D amoblado del piloto de Eco Egaña Norte');
    expect(frame.getAttribute('src')).toBe('https://my.matterport.com/show/?m=yb7QwQrptqv');
    expect(screen.getByText(/Ubicación en la fachada referencial/)).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Volver al edificio' }));

    fireEvent.click(screen.getByRole('button', { name: 'Volver al edificio' }));
    expect(screen.queryByTitle('Recorrido 3D amoblado del piloto de Eco Egaña Norte')).toBeNull();
    expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('25');
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Día', exact: true }).getAttribute('aria-pressed')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Entrar al departamento piloto en 3D' }));
  });

  it('Escape vuelve del interior al exterior antes de cerrar el explorador', () => {
    render(<App />);
    const trigger = screen.getByRole('button', { name: 'Explorar el edificio Eco Egaña Norte' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar al departamento piloto en 3D' }));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTitle('Recorrido 3D amoblado del piloto de Eco Egaña Norte')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Eco Egaña Norte' })).toBeTruthy();
    expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('7');
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(trigger);
  });
});
