import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { X, Sun, Moon, Minus, Plus, MapPin, Layers3, Rotate3D } from 'lucide-react';
import BuildingScene from './BuildingScene';
import { assetPath } from './asset-path';
import './explorer.css';

type Mode = 'day' | 'dusk';
interface BuildingExplorerProps {
  onClose: () => void;
  initialMode?: Mode;
}

export default function BuildingExplorer({ onClose, initialMode = 'dusk' }: BuildingExplorerProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [floor, setFloor] = useState(18);
  const [hoverFloor, setHoverFloor] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const floorId = useId();
  const activeFloor = hoverFloor ?? floor;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const elements = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]',
      )).filter((element) => element.getBoundingClientRect().width > 0);
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', trapFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', trapFocus);
      previousFocus?.focus({ preventScroll: true });
    };
  }, [onClose]);

  const changeFloor = useCallback((value: number) => {
    setHoverFloor(null);
    setFloor(Math.max(3, Math.min(26, value)));
  }, []);

  return (
    <div className="explorer" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} ref={dialogRef}>
      <div className="explorer-scene">
        <BuildingScene
          mode={mode}
          selectedFloor={floor}
          hoveredFloor={hoverFloor}
          onFloorSelect={changeFloor}
          onFloorHover={setHoverFloor}
        />
      </div>
      <div className="explorer-shade" />
      <header className="explorer-header">
        <a className="explorer-brand" href="#inicio" onClick={(event) => { event.preventDefault(); onClose(); }} aria-label="Volver al inicio de Fundamenta">
          <img src={assetPath('assets/fundamenta-logo-white.svg')} alt="Fundamenta" />
        </a>
        <p className="explorer-header-label">Modelado en Blender · Explora en 3D</p>
        <button ref={closeRef} className="explorer-close" onClick={onClose} aria-label="Cerrar explorador"><X size={22} /></button>
      </header>
      <div className="explorer-caption">
        <span className="explorer-eyebrow"><MapPin size={14} /> Ñuñoa, Santiago</span>
        <h2 id={titleId}>Eco Egaña Norte</h2>
        <p>Descubre la ciudad desde tu próximo hogar.</p>
      </div>
      <div className="explorer-instruction"><Rotate3D size={17} /><span>Arrastra para girar · Toca un piso para explorarlo</span></div>
      <section className="explorer-panel" aria-label="Control de exploración">
        <div className="explorer-panel-top"><span><Layers3 size={15} /> EXPLORAR EDIFICIO</span><span className="explorer-small-label">MODELO 3D</span></div>
        <div className="explorer-floor-display" aria-live="polite" aria-atomic="true"><span>Piso</span><strong>{activeFloor.toString().padStart(2, '0')}</strong></div>
        <p className="explorer-floor-intro">Una nueva perspectiva<br />de Ñuñoa.</p>
        <div className="explorer-range-label"><label htmlFor={floorId}>Selecciona un piso</label><span>03 — 26</span></div>
        <div className="explorer-range-control">
          <button className="explorer-step" onClick={() => changeFloor(floor - 1)} disabled={floor === 3} aria-label="Bajar un piso"><Minus size={17} /></button>
          <input id={floorId} type="range" min="3" max="26" value={floor} onChange={(event) => changeFloor(Number(event.target.value))} aria-valuetext={`Piso ${floor}`} />
          <button className="explorer-step" onClick={() => changeFloor(floor + 1)} disabled={floor === 26} aria-label="Subir un piso"><Plus size={17} /></button>
        </div>
        <div className="explorer-features"><span><strong>1 y 2</strong> dormitorios</span><span><strong>Desde 32 m²</strong> en el proyecto</span></div>
        <a className="explorer-cta" href="https://www.fundamenta.cl/cotizar-proyecto/?proyecto=eco-egana-norte" target="_blank" rel="noreferrer">Ver departamentos</a>
        <p id={descriptionId} className="explorer-note">Modelo 3D conceptual · Sin disponibilidad en tiempo real. Los pisos son ilustrativos.</p>
      </section>
      <div className="explorer-mode" role="group" aria-label="Iluminación del edificio">
        <button className={mode === 'day' ? 'explorer-mode-active' : ''} onClick={() => setMode('day')} aria-pressed={mode === 'day'}><Sun size={17} />Día</button>
        <button className={mode === 'dusk' ? 'explorer-mode-active' : ''} onClick={() => setMode('dusk')} aria-pressed={mode === 'dusk'}><Moon size={17} />Atardecer</button>
      </div>
      <p className="explorer-render-note">Arquitectura reinterpretada en Blender</p>
    </div>
  );
}
