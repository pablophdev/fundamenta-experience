import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, Armchair, BedDouble, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleCheck, Compass, CookingPot, Copy, DoorOpen, ExternalLink, LayoutGrid, LoaderCircle, Move, Palette, Play, RotateCcw, RotateCw, Ruler, Sofa, Sprout, Square, Sun, Users, X, AlertTriangle } from 'lucide-react';
import ApartmentScene from './ApartmentScene';
import ApartmentTour from './ApartmentTour';
import { APARTMENT_STORAGE_KEY, createInitialState, FURNITURE, inspectFurniture, sanitizeApartmentState } from './apartment-state';
import type { ApartmentState, FurnitureTransform } from './apartment-state';
import { useSharedVisit } from './shared-visit';
import { assetPath } from './asset-path';
import './apartment-experience.css';

interface ApartmentExperienceProps { onBack: () => void; onClose: () => void }
type WorkspaceTab = 'ambient' | 'furniture' | 'visit';
const ROOMS: { id: ApartmentState['room']; label: string; icon: typeof Sofa }[] = [
  { id: 'overview', label: 'Vista general', icon: LayoutGrid },
  { id: 'living', label: 'Living', icon: Sofa },
  { id: 'kitchen', label: 'Cocina', icon: CookingPot },
  { id: 'bedroom', label: 'Dormitorio', icon: BedDouble },
  { id: 'bedroom2', label: 'Segundo dormitorio', icon: Armchair },
  { id: 'balcony', label: 'Terraza', icon: Sprout },
];
const THEMES: { id: ApartmentState['theme']; label: string; description: string }[] = [
  { id: 'natural', label: 'Natural', description: 'Madera y calma' },
  { id: 'minimal', label: 'Minimal', description: 'Simple y luminoso' },
  { id: 'warm', label: 'Cálido', description: 'Tonos que abrazan' },
];
const DAY_STEPS: { room: ApartmentState['room']; hour: number; title: string }[] = [
  { room: 'living', hour: 8, title: 'Un nuevo comienzo' },
  { room: 'kitchen', hour: 9, title: 'Un café sin prisa' },
  { room: 'bedroom2', hour: 13, title: 'Tiempo para crear' },
  { room: 'balcony', hour: 18, title: 'La ciudad en pausa' },
  { room: 'living', hour: 21, title: 'Tu momento de desconexión' },
];
const TABS: { id: WorkspaceTab; label: string; icon: typeof Palette }[] = [
  { id: 'ambient', label: 'Ambiente', icon: Palette },
  { id: 'furniture', label: 'Muebles', icon: Armchair },
  { id: 'visit', label: 'Visita', icon: Users },
];

function formatHour(hour: number) {
  const minutes = Math.round(hour * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
function dayOfYear(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  return Math.floor((parsed.getTime() - Date.UTC(parsed.getUTCFullYear(), 0, 1, 12)) / 86400000) + 1;
}
function daysInYear(date: string) {
  const year = Number(date.slice(0, 4));
  return new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
}
function dateFromDay(date: string, day: number) {
  return new Date(Date.UTC(Number(date.slice(0, 4)), 0, day, 12)).toISOString().slice(0, 10);
}
function dateLabel(date: string) {
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}

function initialPersonalState(): ApartmentState {
  try {
    if (new URLSearchParams(window.location.search).has('visit')) return createInitialState();
    const saved = window.localStorage.getItem(APARTMENT_STORAGE_KEY);
    if (saved) return sanitizeApartmentState(JSON.parse(saved));
  } catch { /* Storage may be unavailable or contain an older configuration. */ }
  return createInitialState();
}

export default function ApartmentExperience({ onBack, onClose }: ApartmentExperienceProps) {
  const [state, setState] = useState<ApartmentState>(initialPersonalState);
  const [tab, setTab] = useState<WorkspaceTab>('ambient');
  const [officialOpen, setOfficialOpen] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [tourIndex, setTourIndex] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'manual' | 'error'>('idle');
  const [visitActionError, setVisitActionError] = useState('');
  const [visitBusy, setVisitBusy] = useState(false);
  const backRef = useRef<HTMLButtonElement>(null);
  const officialRef = useRef<HTMLButtonElement>(null);
  const inviteInputRef = useRef<HTMLInputElement>(null);
  const officialReturnRef = useRef(false);
  const controlsId = useId();
  const tourActive = tourIndex !== null;
  const currentStep = tourIndex === null ? null : DAY_STEPS[tourIndex];
  const currentRoom = ROOMS.find(room => room.id === state.room) ?? ROOMS[0];
  const selectedMeta = FURNITURE.find(item => item.id === state.selectedFurniture);
  const selectedTransform = state.selectedFurniture ? state.furniture[state.selectedFurniture] : null;
  const inspection = state.selectedFurniture ? inspectFurniture(state, state.selectedFurniture) : null;

  const stopTour = useCallback(() => setTourIndex(null), []);
  const onRemoteState = useCallback((remote: ApartmentState) => { setTourIndex(null); setState(sanitizeApartmentState(remote)); }, []);
  const shared = useSharedVisit({ state, onRemoteState });
  const visitConnecting = shared.status === 'connecting' || visitBusy;
  const visitJoined = shared.status === 'waiting' || shared.status === 'connected';
  useEffect(() => {
    if (shared.status !== 'idle' || new URLSearchParams(window.location.search).has('visit')) return;
    try { window.localStorage.setItem(APARTMENT_STORAGE_KEY, JSON.stringify(state)); } catch { /* Exploration still works when storage is unavailable. */ }
  }, [state, shared.status]);
  const visitStatusLabel = shared.status === 'connected' ? 'Visita conectada'
    : shared.status === 'waiting' ? 'Esperando compañía'
    : visitConnecting ? 'Conectando visita'
    : shared.status === 'error' ? 'No se pudo conectar'
    : 'Exploración personal';

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    backRef.current?.focus({ preventScroll: true });
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!officialOpen && officialReturnRef.current) {
      officialRef.current?.focus({ preventScroll: true });
      officialReturnRef.current = false;
    }
  }, [officialOpen]);
  useEffect(() => {
    if (copyStatus !== 'copied') return;
    const timeout = window.setTimeout(() => setCopyStatus('idle'), 3000);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  const updateState = useCallback((patch: Partial<ApartmentState>) => {
    setTourIndex(null);
    setState(current => sanitizeApartmentState({ ...current, ...patch }));
  }, []);
  const applyTourStep = useCallback((index: number) => {
    if (index >= DAY_STEPS.length) { setTourIndex(null); return; }
    const step = DAY_STEPS[index];
    setTourIndex(index);
    setState(current => ({ ...current, room: step.room, hour: step.hour, selectedFurniture: null }));
  }, []);
  useEffect(() => {
    if (tourIndex === null || reducedMotion || officialOpen) return;
    const timeout = window.setTimeout(() => applyTourStep(tourIndex + 1), 6500);
    return () => window.clearTimeout(timeout);
  }, [tourIndex, reducedMotion, officialOpen, applyTourStep]);

  const selectFurniture = useCallback((id: string | null) => {
    setTourIndex(null);
    if (id) setTab('furniture');
    setState(current => ({ ...current, selectedFurniture: id }));
  }, []);
  const updateFurniture = useCallback((id: string, patch: Partial<FurnitureTransform>) => {
    setTourIndex(null);
    setState(current => {
      const item = current.furniture[id];
      if (!item) return current;
      return sanitizeApartmentState({ ...current, selectedFurniture: id, furniture: { ...current.furniture, [id]: { ...item, ...patch } } });
    });
  }, []);
  const moveFurniture = useCallback((id: string, x: number, z: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    updateFurniture(id, { x: Math.max(-4.65, Math.min(4.65, x)), z: Math.max(-3.95, Math.min(4.3, z)) });
  }, [updateFurniture]);
  const onSceneReady = useCallback(() => setSceneReady(true), []);
  function resizeFurniture(key: 'width' | 'depth' | 'height', value: string) {
    if (!state.selectedFurniture || !value || !Number.isFinite(Number(value))) return;
    const min = key === 'height' ? .1 : .2;
    const max = key === 'height' ? 3 : 5;
    updateFurniture(state.selectedFurniture, { [key]: Math.max(min, Math.min(max, Number(value))) });
  }
  function nudgeFurniture(dx: number, dz: number) {
    if (!state.selectedFurniture || !selectedTransform) return;
    moveFurniture(state.selectedFurniture, Math.round((selectedTransform.x + dx) * 100) / 100, Math.round((selectedTransform.z + dz) * 100) / 100);
  }
  function rotateFurniture(direction: number) {
    if (state.selectedFurniture && selectedTransform) updateFurniture(state.selectedFurniture, { rotation: (selectedTransform.rotation + direction * 15 + 360) % 360 });
  }
  function restoreFurniture() {
    if (!selectedMeta) return;
    const { x, z, rotation, width, depth, height } = selectedMeta;
    updateFurniture(selectedMeta.id, { x, z, rotation, width, depth, height });
  }
  function openOfficial() {
    stopTour(); officialReturnRef.current = true; setOfficialOpen(true);
  }
  async function createVisit() {
    setVisitActionError(''); setVisitBusy(true); setCopyStatus('idle');
    try { await shared.createVisit(); }
    catch { setVisitActionError('No pudimos crear la visita. Inténtalo de nuevo.'); }
    finally { setVisitBusy(false); }
  }
  async function leaveVisit() {
    setVisitActionError('');
    try { await shared.leaveVisit(); setCopyStatus('idle'); }
    catch { setVisitActionError('No pudimos cerrar la conexión. Inténtalo de nuevo.'); }
  }
  async function copyInvite() {
    if (!shared.inviteUrl) return;
    try {
      if (!navigator.clipboard?.writeText) {
        inviteInputRef.current?.focus(); inviteInputRef.current?.select(); setCopyStatus('manual'); return;
      }
      await navigator.clipboard.writeText(shared.inviteUrl); setCopyStatus('copied');
    } catch { inviteInputRef.current?.focus(); inviteInputRef.current?.select(); setCopyStatus('error'); }
  }

  return <section className="apartment-experience" aria-label="Interior editable de Eco Egaña Norte">
    {officialOpen ? <ApartmentTour onBack={() => setOfficialOpen(false)} onClose={onClose} backLabel="Volver al interior editable" /> : <div className="ae-shell">
      <header className="ae-header">
        <div className="ae-brand"><img src={assetPath('assets/fundamenta-logo-white.svg')} alt="Fundamenta" width="148" height="33" /><div><strong>Tu espacio, a tu manera.</strong><span>Eco Egaña Norte · Interior editable</span></div></div>
        <div className="ae-header-actions">
          <button ref={officialRef} className="ae-official" onClick={openOfficial}>Ver piloto oficial<ExternalLink size={15} /></button>
          <button ref={backRef} className="ae-back" onClick={onBack}><ArrowLeft size={16} />Volver al edificio</button>
          <button className="ae-close" onClick={onClose} aria-label="Cerrar explorador"><X size={20} /></button>
        </div>
      </header>

      <div className="ae-layout">
        <div className="ae-stage">
          <ApartmentScene state={state} onFurnitureSelect={selectFurniture} onFurnitureMove={moveFurniture} cinematic={tourActive && !reducedMotion} onCinematicEnd={stopTour} onSceneReady={onSceneReady} />
          <div className="ae-stage-caption"><span className="ae-kicker">TU PRÓXIMA HISTORIA</span><h3>{currentRoom.label}</h3><p>{sceneReady ? 'Explora, imagina y hazlo tuyo.' : 'Preparando tu espacio en 3D.'}</p></div>
          <div className="ae-stage-light"><Sun size={15} /><span>{formatHour(state.hour)}</span><small>{dateLabel(state.date)}</small></div>
          <div className="ae-stage-bottom">
            {currentStep && <div className="ae-tour-progress" role="status" aria-live="polite"><div><span>MI DÍA AQUÍ · {(tourIndex ?? 0) + 1}/{DAY_STEPS.length}</span><strong>{currentStep.title}</strong><p>{formatHour(currentStep.hour)} · {ROOMS.find(room => room.id === currentStep.room)?.label}{reducedMotion ? ' · A tu ritmo, sin movimiento automático' : ''}</p></div><button onClick={() => applyTourStep((tourIndex ?? 0) + 1)} aria-label="Siguiente momento del recorrido"><ChevronRight size={18} /></button><button onClick={stopTour} aria-label="Detener Mi día aquí"><Square size={15} /></button></div>}
            <div className="ae-room-nav" role="group" aria-label="Elegir espacio del departamento">{ROOMS.map(room => { const Icon = room.icon; return <button key={room.id} aria-pressed={state.room === room.id} onClick={() => updateState({ room: room.id, selectedFurniture: null })}><Icon size={16} /><span>{room.label}</span></button>; })}</div>
          </div>
        </div>

        <aside className="ae-controls" aria-label="Personalizar departamento">
          <div className="ae-controls-heading"><span className="ae-kicker">IMAGINA TU VIDA AQUÍ</span><h3>Elige cómo vivirlo.</h3><button className={`ae-day-tour ${tourActive ? 'ae-day-tour-active' : ''}`} aria-pressed={tourActive} onClick={() => tourActive ? stopTour() : applyTourStep(0)}>{tourActive ? <Square size={15} /> : <Play size={15} />}<span>{tourActive ? 'Detener recorrido' : 'Mi día aquí'}</span><small>{tourActive ? 'EN RECORRIDO' : '5 MOMENTOS'}</small></button></div>
          <div className="ae-tabs" role="tablist" aria-label="Herramientas del interior">{TABS.map(item => { const Icon = item.icon; return <button key={item.id} id={`${controlsId}-${item.id}-tab`} role="tab" aria-selected={tab === item.id} aria-controls={`${controlsId}-${item.id}-panel`} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)} onKeyDown={event => {
            const index = TABS.findIndex(candidate => candidate.id === item.id);
            let next = index;
            if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
            else if (event.key === 'ArrowLeft') next = (index + TABS.length - 1) % TABS.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = TABS.length - 1;
            else return;
            event.preventDefault(); setTab(TABS[next].id); document.getElementById(`${controlsId}-${TABS[next].id}-tab`)?.focus();
          }}><Icon size={16} />{item.label}</button>; })}</div>
          <div className="ae-panel" id={`${controlsId}-${tab}-panel`} role="tabpanel" aria-labelledby={`${controlsId}-${tab}-tab`}>
            {tab === 'ambient' && <>
              <section className="ae-control-section"><div className="ae-section-title"><Palette size={16} /><h4>Una atmósfera para ti</h4></div><div className="ae-themes" role="group" aria-label="Estilo de decoración">{THEMES.map(theme => <button key={theme.id} className={`ae-theme ae-theme-${theme.id}`} aria-pressed={state.theme === theme.id} onClick={() => updateState({ theme: theme.id })}><span className="ae-theme-swatches"><i /><i /><i />{state.theme === theme.id && <Check size={14} />}</span><strong>{theme.label}</strong><small>{theme.description}</small></button>)}</div></section>
              <section className="ae-control-section"><div className="ae-section-title"><Sun size={16} /><h4>La luz cambia tu día</h4><output>{formatHour(state.hour)}</output></div><label className="ae-range-label" htmlFor={`${controlsId}-hour`}>Hora de la simulación</label><input id={`${controlsId}-hour`} className="ae-range" type="range" min="0" max="23.75" step=".25" value={state.hour} aria-valuetext={formatHour(state.hour)} onChange={event => updateState({ hour: Number(event.target.value) })} /><div className="ae-range-ends"><span>00:00</span><span>12:00</span><span>23:45</span></div><div className="ae-date-label"><label htmlFor={`${controlsId}-date`}><CalendarDays size={15} />Fecha</label><input id={`${controlsId}-date`} type="date" min="2000-01-01" max="2100-12-31" value={state.date} onChange={event => { if (/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)) updateState({ date: event.target.value }); }} /></div><input className="ae-range" type="range" min="1" max={daysInYear(state.date)} step="1" value={dayOfYear(state.date)} aria-label="Día del año" aria-valuetext={dateLabel(state.date)} onChange={event => updateState({ date: dateFromDay(state.date, Number(event.target.value)) })} /><div className="ae-range-ends"><span>Enero</span><span>Diciembre</span></div></section>
              <section className="ae-control-section"><div className="ae-section-title"><Compass size={16} /><h4>Ajusta el norte</h4><output>{state.northOffset > 0 ? '+' : ''}{state.northOffset}°</output></div><input className="ae-range" type="range" min="-180" max="180" value={state.northOffset} aria-label="Orientación del norte" aria-valuetext={`${state.northOffset} grados`} onChange={event => updateState({ northOffset: Number(event.target.value) })} /><div className="ae-range-ends"><span>−180°</span><span>0°</span><span>180°</span></div><p className="ae-hint">Gira el norte para explorar la luz. La orientación del modelo es referencial.</p><button className="ae-text-button" onClick={() => updateState({ northOffset: 0 })}><RotateCcw size={13} />Restablecer norte</button></section>
              <p className="ae-panel-note">Estudio de luz orientativo. La iluminación, las sombras y los acabados son una simulación.</p>
            </>}

            {tab === 'furniture' && <>
              <section className="ae-control-section"><div className="ae-section-title"><Armchair size={17} /><h4>Haz lugar a tus ideas</h4></div><p className="ae-hint">Toca un mueble en el modelo o elígelo aquí. Puedes moverlo y probar otras medidas.</p><label className="ae-select-label" htmlFor={`${controlsId}-furniture`}>Mueble seleccionado</label><div className="ae-select-wrap"><select id={`${controlsId}-furniture`} value={state.selectedFurniture ?? ''} onChange={event => selectFurniture(event.target.value || null)}><option value="">Selecciona un mueble</option>{FURNITURE.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><ChevronDown size={16} /></div></section>
              {selectedMeta && selectedTransform ? <>
                <section className="ae-control-section"><div className="ae-section-title"><Ruler size={16} /><h4>Medidas de {selectedMeta.label.toLowerCase()}</h4></div><div className="ae-dimensions">{([{ key: 'width', label: 'Ancho' }, { key: 'depth', label: 'Fondo' }, { key: 'height', label: 'Alto' }] as const).map(field => <label key={field.key}><span>{field.label}</span><div><input type="number" min={field.key === 'height' ? '.1' : '.2'} max={field.key === 'height' ? '3' : '5'} step=".05" value={selectedTransform[field.key]} onChange={event => resizeFurniture(field.key, event.target.value)} aria-label={`${field.label} del mueble en metros`} /><span>m</span></div></label>)}</div></section>
                <section className="ae-control-section"><div className="ae-section-title"><Move size={16} /><h4>Encuentra su lugar</h4><output>{Math.round(selectedTransform.rotation)}°</output></div><div className="ae-placement"><div className="ae-move-pad"><button className="ae-move-up" aria-label="Mover mueble hacia el fondo" onClick={() => nudgeFurniture(0, -.1)}><ChevronUp size={20} /></button><button className="ae-move-left" aria-label="Mover mueble a la izquierda" onClick={() => nudgeFurniture(-.1, 0)}><ChevronLeft size={20} /></button><span><Move size={17} /></span><button className="ae-move-right" aria-label="Mover mueble a la derecha" onClick={() => nudgeFurniture(.1, 0)}><ChevronRight size={20} /></button><button className="ae-move-down" aria-label="Mover mueble hacia delante" onClick={() => nudgeFurniture(0, .1)}><ChevronDown size={20} /></button></div><div className="ae-rotation"><div><button onClick={() => rotateFurniture(-1)} aria-label="Girar mueble 15 grados a la izquierda"><RotateCcw size={18} /></button><button onClick={() => rotateFurniture(1)} aria-label="Girar mueble 15 grados a la derecha"><RotateCw size={18} /></button></div><span>Giros de 15°<br />Pasos de 10 cm</span></div></div><button className="ae-text-button" onClick={restoreFurniture}><RotateCcw size={13} />Restaurar este mueble</button></section>
                {inspection && <div className={`ae-clearance ${inspection.blocked ? 'ae-clearance-blocked' : ''}`} role="status"><div>{inspection.blocked ? <AlertTriangle size={18} /> : <CircleCheck size={18} />}<strong>{inspection.blocked ? 'Revisa esta posición' : 'Espacio libre'}</strong></div><p>{inspection.message}</p><span>Espacio frontal estimado<strong>{Math.max(0, inspection.clearance).toFixed(2)} m</strong></span></div>}
              </> : <div className="ae-empty-furniture"><Armchair size={32} /><strong>Ese sofá, ¿cabe aquí?</strong><p>Selecciona un mueble para ver sus medidas y el espacio que deja a su alrededor.</p></div>}
              <button className="ae-secondary-button ae-reset-layout" onClick={() => { stopTour(); setState(current => ({ ...current, furniture: createInitialState().furniture, selectedFurniture: null })); }}><RotateCcw size={15} />Restaurar distribución</button><p className="ae-panel-note">Muebles sugeridos y dimensiones editables. El espacio frontal no representa una ruta completa de circulación.</p>
            </>}

            {tab === 'visit' && <>
              <section className="ae-control-section"><div className="ae-visit-illustration"><Users size={31} /><span><Sofa size={22} /></span></div><div className="ae-section-title"><h4>Recórrelo en compañía.</h4></div><p className="ae-hint">Invita a otra persona y comparte los cambios de luz, la decoración y la distribución en una visita sincronizada.</p><div className={`ae-visit-status ae-visit-status-${shared.status}`} role="status"><Users size={16} /><div><strong>{visitStatusLabel}</strong><span>{visitJoined ? `${shared.participantCount} ${shared.participantCount === 1 ? 'persona conectada' : 'personas conectadas'}` : 'Tu espacio sigue disponible para explorar.'}</span></div>{visitConnecting && <LoaderCircle size={17} className="ae-spin" />}</div>
                {!visitJoined && <button className="ae-primary-button" onClick={() => void createVisit()} disabled={visitConnecting}>{visitConnecting ? <LoaderCircle size={16} className="ae-spin" /> : <Users size={16} />}{visitConnecting ? 'Conectando visita…' : 'Crear visita compartida'}</button>}
                {visitJoined && shared.inviteUrl && <div className="ae-invite"><label htmlFor={`${controlsId}-invite`}>Comparte este enlace</label><input id={`${controlsId}-invite`} ref={inviteInputRef} readOnly value={shared.inviteUrl} aria-label="Enlace de invitación a la visita" onFocus={event => event.target.select()} /><button className="ae-primary-button" onClick={() => void copyInvite()}>{copyStatus === 'copied' ? <Check size={16} /> : <Copy size={16} />}{copyStatus === 'copied' ? 'Enlace copiado' : 'Copiar enlace de invitación'}</button><p className="ae-copy-status" role="status">{copyStatus === 'manual' ? 'Selecciona y copia el enlace para compartirlo.' : copyStatus === 'error' ? 'No se pudo copiar automáticamente. Puedes copiar el enlace seleccionado.' : copyStatus === 'copied' ? 'Listo para enviarlo a quien quieras invitar.' : 'Quien tenga el enlace podrá entrar en esta visita.'}</p></div>}
                {(shared.error || visitActionError) && <p className="ae-visit-error" role="alert">{visitActionError || String(shared.error)}</p>}
                {visitJoined && <button className="ae-text-button ae-leave-visit" onClick={() => void leaveVisit()}><DoorOpen size={14} />Salir de la visita compartida</button>}
              </section><p className="ae-panel-note">La conexión y el número de participantes reflejan el estado real de la visita. Los cambios se comparten mientras estés conectado.</p>
            </>}
          </div>
        </aside>
      </div>
      <footer className="ae-footer"><span>Una posibilidad, a tu manera.</span><p>Distribución y decoración referenciales basadas en el plano oficial. Muebles sugeridos.</p></footer>
    </div>}
  </section>;
}
