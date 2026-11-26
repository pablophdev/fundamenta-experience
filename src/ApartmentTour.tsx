import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, CircleHelp, ExternalLink, LoaderCircle, RotateCcw, X } from 'lucide-react';
import { assetPath } from './asset-path';
import './apartment-tour.css';

interface ApartmentTourProps {
  onBack: () => void;
  onClose: () => void;
  backLabel?: string;
}

const TOUR_URL = 'https://my.matterport.com/show/?m=yb7QwQrptqv';

type FrameStatus = 'loading' | 'loaded' | 'slow';

export default function ApartmentTour({ onBack, onClose, backLabel = 'Volver al edificio' }: ApartmentTourProps) {
  const [frameKey, setFrameKey] = useState(0);
  const [status, setStatus] = useState<FrameStatus>('loading');
  const [helpOpen, setHelpOpen] = useState(false);
  const backRef = useRef<HTMLButtonElement>(null);
  const helpId = useId();

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    backRef.current?.focus({ preventScroll: true });
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setStatus(current => current === 'loading' ? 'slow' : current);
    }, 15_000);
    return () => window.clearTimeout(timeout);
  }, [frameKey]);

  function retry() {
    setStatus('loading');
    setFrameKey(current => current + 1);
  }

  return (
    <section className="apartment-tour" aria-label="Recorrido interior amoblado">
      <header className="apartment-tour-header">
        <div className="apartment-tour-brand">
          <img src={assetPath('assets/fundamenta-logo-white.svg')} alt="Fundamenta" width="154" height="34" />
          <div><strong>Eco Egaña Norte</strong><span>Interior amoblado</span></div>
        </div>
        <div className="apartment-tour-actions">
          <button ref={backRef} className="apartment-tour-back" onClick={onBack}><ArrowLeft size={17} />{backLabel}</button>
          <button className="apartment-tour-close" onClick={onClose} aria-label="Cerrar explorador"><X size={21} /></button>
        </div>
      </header>

      <div className="apartment-tour-toolbar">
        <span className="apartment-tour-badge">Piloto · 2 dormitorios · 2 baños</span>
        <div className="apartment-tour-help">
          <button className="apartment-tour-help-toggle" onClick={() => setHelpOpen(current => !current)} aria-expanded={helpOpen} aria-controls={helpId}>
            <CircleHelp size={16} />Cómo recorrerlo<ChevronDown size={15} className={helpOpen ? 'apartment-tour-chevron-open' : ''} />
          </button>
          {helpOpen && <div id={helpId} className="apartment-tour-help-panel" role="region" aria-label="Instrucciones del recorrido">
            <strong>Explora a tu ritmo</strong>
            <ul>
              <li>Toca los círculos del suelo para avanzar.</li>
              <li>Arrastra para mirar a tu alrededor.</li>
              <li>En móvil, pellizca para ajustar el zoom.</li>
            </ul>
          </div>}
        </div>
      </div>

      <div className="apartment-tour-viewer" aria-busy={status === 'loading'}>
        <iframe
          key={frameKey}
          src={TOUR_URL}
          title="Recorrido 3D amoblado del piloto de Eco Egaña Norte"
          allow="fullscreen; xr-spatial-tracking"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          loading="eager"
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('slow')}
        />
        {status === 'loading' && <div className="apartment-tour-loading" role="status">
          <LoaderCircle size={30} className="apartment-tour-spinner" />
          <strong>Cargando el recorrido del piloto</strong>
          <span>El visor oficial se abrirá aquí.</span>
        </div>}
        {status === 'slow' && <div className="apartment-tour-load-help" role="status">
          <p>El visor está tardando en cargar. Puedes reintentarlo o abrir el recorrido en otra pestaña.</p>
          <button onClick={retry}><RotateCcw size={16} />Reintentar</button>
        </div>}
      </div>

      <footer className="apartment-tour-footer">
        <p>Recorrido oficial del piloto.<br className="apartment-tour-mobile-break" /> Ubicación en la fachada referencial.</p>
        <div className="apartment-tour-footer-actions">
          {status === 'loaded' && <button className="apartment-tour-retry" onClick={retry} aria-label="Recargar recorrido"><RotateCcw size={15} /><span>Recargar</span></button>}
          <a href={TOUR_URL} target="_blank" rel="noreferrer">Abrir recorrido en otra pestaña<ExternalLink size={16} /></a>
        </div>
      </footer>
    </section>
  );
}
