import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, X, Menu, MapPin, Sun, Moon, ChevronDown, ChevronLeft, ChevronRight, MoveUpRight, Maximize2, Building2, TrainFront, Leaf, Check } from 'lucide-react';
import BuildingExplorer from './BuildingExplorer';
import { assetPath } from './asset-path';

type SceneMode = 'day' | 'dusk';
const ASSETS = assetPath('assets/');
const VISIT = 'https://www.fundamenta.cl/agenda-tu-visita/?proyecto=eco-egana-norte';
const QUOTE = 'https://www.fundamenta.cl/cotizar-proyecto/?proyecto=eco-egana-norte';
const spaces = [
  { name: 'Tu espacio', eyebrow: 'PUERTAS ADENTRO', title: 'El lugar donde\ntodo se siente tuyo.', text: 'Luz, diseño y espacio para darle tu propia forma a cada día. Descubre una nueva manera de habitar la ciudad.', image: 'living-kitchen.webp', alt: 'Render oficial de living y cocina de un departamento de Fundamenta' },
  { name: 'Terraza', eyebrow: 'AL AIRE LIBRE', title: 'Los mejores momentos,\nsin salir de casa.', text: 'Una conversación larga, una comida compartida y la ciudad como escenario. Un espacio para disfrutar a tu ritmo.', image: 'balcony-bbq.webp', alt: 'Render oficial de terraza y quincho de Fundamenta' },
  { name: 'Cowork', eyebrow: 'OTRA FORMA DE CONECTAR', title: 'Buenas ideas.\nUn nuevo lugar.', text: 'Cambia de ambiente, encuentra inspiración y dale espacio a tus proyectos en un entorno pensado para conectar.', image: 'coworking.webp', alt: 'Render oficial de espacio cowork de Fundamenta' },
  { name: 'Bienvenida', eyebrow: 'DESDE EL PRIMER MOMENTO', title: 'Llegar también\nes una experiencia.', text: 'Arquitectura y detalles que te reciben. Una primera impresión que se transforma en parte de tu día a día.', image: 'lobby.webp', alt: 'Render oficial del lobby de un proyecto Fundamenta' },
];

function useReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

function Gallery({ index, onClose }: { index: number; onClose: () => void }) {
  const [current, setCurrent] = useState(index);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setCurrent(c => (c + 1) % spaces.length);
      if (e.key === 'ArrowLeft') setCurrent(c => (c + spaces.length - 1) % spaces.length);
      if (e.key === 'Tab') {
        const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.gallery-modal button'));
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [onClose]);
  return <div className="gallery-modal" role="dialog" aria-modal="true" aria-label="Galería de espacios" onClick={onClose}>
    <button ref={closeRef} className="icon-button gallery-close" onClick={onClose} aria-label="Cerrar galería"><X /></button>
    <button className="icon-button gallery-prev" onClick={e => { e.stopPropagation(); setCurrent((current + spaces.length - 1) % spaces.length); }} aria-label="Imagen anterior"><ChevronLeft /></button>
    <figure onClick={e => e.stopPropagation()}><img src={ASSETS + spaces[current].image} alt={spaces[current].alt} /><figcaption aria-live="polite">{spaces[current].name} <span>Imágenes referenciales de Fundamenta</span></figcaption></figure>
    <button className="icon-button gallery-next" onClick={e => { e.stopPropagation(); setCurrent((current + 1) % spaces.length); }} aria-label="Imagen siguiente"><ChevronRight /></button>
  </div>;
}

export default function App() {
  const [mode, setMode] = useState<SceneMode>('dusk');
  const [menuOpen, setMenuOpen] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [space, setSpace] = useState(0);
  const [gallery, setGallery] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const closeExplorer = useCallback(() => setExplorerOpen(false), []);
  const closeGallery = useCallback(() => setGallery(null), []);
  const heroRef = useRef<HTMLElement>(null);
  useReveal();
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);
  const selectSpace = (n: number) => setSpace((n + spaces.length) % spaces.length);
  return <>
    <a href="#main" className="skip-link">Saltar al contenido</a>
    <header className={`site-header ${scrolled || menuOpen ? 'header-solid' : ''}`}>
      <a href="#inicio" className="brand" aria-label="Fundamenta, inicio"><img src={ASSETS + 'fundamenta-logo-white.svg'} alt="Fundamenta" width="190" height="42" /></a>
      <nav id="mobile-nav" className={menuOpen ? 'navigation navigation-open' : 'navigation'} aria-label="Navegación principal">
        {[['#proyecto', 'El proyecto'], ['#espacios', 'Espacios'], ['#ubicacion', 'Ubicación']].map(([href, label]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}</a>)}
        <a className="nav-mobile-visit" href={VISIT} target="_blank" rel="noreferrer">Agenda tu visita</a>
      </nav>
      <a className="button button-outline header-visit" href={VISIT} target="_blank" rel="noreferrer">Agenda tu visita <span className="button-dot" /></a>
      <button className="menu-toggle icon-button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="mobile-nav" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}>{menuOpen ? <X /> : <Menu />}</button>
    </header>

    <main id="main">
      <section id="inicio" className={`hero scene-${mode}`} ref={heroRef} onPointerMove={e => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || e.pointerType !== 'mouse') return;
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--pointer-x', `${(e.clientX / rect.width - .5) * -10}px`);
        e.currentTarget.style.setProperty('--pointer-y', `${((e.clientY - rect.top) / rect.height - .5) * -6}px`);
      }} onPointerLeave={() => { heroRef.current?.style.setProperty('--pointer-x', '0px'); heroRef.current?.style.setProperty('--pointer-y', '0px'); }}>
        <div className="hero-visual" aria-hidden="true">
          <img className={`hero-image ${mode === 'dusk' ? 'image-active' : ''}`} src={ASSETS + 'eco-egana-dusk.webp'} alt="" fetchPriority="high" />
          <img className={`hero-image ${mode === 'day' ? 'image-active' : ''}`} src={ASSETS + 'eco-egana-day.webp'} alt="" />
        </div>
        <div className="hero-shade" />
        <div className="hero-topline"><span className="micro-label">UNA NUEVA FORMA DE HABITAR</span><span className="hero-location"><MapPin size={14} /> Ñuñoa, Santiago</span></div>
        <div className="hero-copy">
          <div className="hero-eyebrow"><span /> ECO EGAÑA NORTE</div>
          <h1>La ciudad,<br />desde otra<br /><span>perspectiva.</span></h1>
          <p>Tu vida, conectada con lo que importa.<br />Descubre tu próximo lugar en Ñuñoa.</p>
          <a className="button button-lime" href="#proyecto">Conoce el proyecto <Plus size={17} /></a>
        </div>
        <button className="building-hotspot" onClick={() => setExplorerOpen(true)} aria-label="Explorar el edificio Eco Egaña Norte">
          <span className="hotspot-cross"><Plus size={21} /></span><span className="hotspot-label">EXPLORA EN 3D<span>Gira, acerca y descubre</span></span>
        </button>
        <div className="hero-bottom">
          <a className="scroll-cue" href="#proyecto"><span className="scroll-circle"><ChevronDown size={17} /></span><span>Hay mucho por descubrir</span></a>
          <div className="scene-controls"><span className="scene-caption">CADA MOMENTO, UNA VISTA</span><div className="scene-toggle" role="group" aria-label="Iluminación del edificio">
            <button onClick={() => setMode('day')} aria-pressed={mode === 'day'}><Sun size={16} /><span>Día</span></button>
            <button onClick={() => setMode('dusk')} aria-pressed={mode === 'dusk'}><Moon size={15} /><span>Atardecer</span></button>
          </div></div>
        </div>
        <div className="hero-image-note">Render referencial · Eco Egaña Norte</div>
      </section>

      <div className="project-ribbon"><span><Building2 size={19} /> Arquitectura que conecta</span><span><TrainFront size={19} /> Metro Plaza Egaña · L3 y L4</span><span><Leaf size={19} /> Otra perspectiva de vivir</span></div>

      <section className="project-section section-wrap" id="proyecto">
        <div className="project-intro reveal"><div><span className="eyebrow"><span className="short-line" /> EL PROYECTO</span><h2>Un lugar a la altura<br />de <span className="text-muted">tu próxima historia.</span></h2></div><p>El movimiento de la ciudad y la tranquilidad de estar en casa. Eco Egaña Norte reúne arquitectura y conexión en un nuevo punto de encuentro en Ñuñoa.</p></div>
        <div className="project-feature reveal">
          <div className="project-photo"><img src={ASSETS + 'eco-egana-day.webp'} alt="Fachada de Eco Egaña Norte y Plaza Egaña, render oficial de Fundamenta" loading="lazy" /><button onClick={() => setExplorerOpen(true)} className="photo-explore"><Maximize2 size={17} /> Explorar en 3D</button><span className="photo-caption">ECO EGAÑA NORTE · ÑUÑOA</span></div>
          <div className="project-details"><img className="project-logo" src={ASSETS + 'eco-egana-logo.webp'} alt="Eco Egaña Norte" loading="lazy" /><span className="tag">ENTREGA FUTURA</span><h3>Tu nuevo comienzo,<br />bien conectado.</h3><p className="address"><MapPin size={17} /> Av. Irarrázaval 5651, Ñuñoa</p><div className="specs"><div><strong>1 y 2</strong><span>Dormitorios</span></div><div><strong>32 <small>m²</small></strong><span>Superficies desde</span></div></div><a href={QUOTE} className="button button-dark" target="_blank" rel="noreferrer">Ver departamentos <Plus size={17} /></a><p className="details-note">Consulta tipologías y disponibilidad en Fundamenta.</p></div>
        </div>
      </section>

      <section className="spaces-section" id="espacios">
        <div className="spaces-heading section-wrap reveal"><span className="eyebrow"><span className="short-line" /> ESPACIOS PARA TU DÍA A DÍA</span><div><h2>Más espacio para<br /><span className="text-muted">lo que te hace bien.</span></h2><p>Dentro y fuera de tu departamento,<br />la vida encuentra su lugar.</p></div></div>
        <div className="space-tabs section-wrap" role="tablist" aria-label="Explorar espacios">{spaces.map((item, index) => <button key={item.name} id={`space-tab-${index}`} role="tab" aria-selected={space === index} aria-controls="space-panel" onClick={() => selectSpace(index)} onKeyDown={e => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const next = (space + (e.key === 'ArrowRight' ? 1 : -1) + spaces.length) % spaces.length; selectSpace(next); document.getElementById(`space-tab-${next}`)?.focus(); }
          if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); const next = e.key === 'Home' ? 0 : spaces.length - 1; selectSpace(next); document.getElementById(`space-tab-${next}`)?.focus(); }
        }} tabIndex={space === index ? 0 : -1}>{item.name}{space === index && <span className="tab-dot" />}</button>)}</div>
        <div id="space-panel" className="space-content" role="tabpanel" aria-labelledby={`space-tab-${space}`}>
          <div className="space-image"><img key={spaces[space].image} src={ASSETS + spaces[space].image} alt={spaces[space].alt} loading="lazy" /><button className="icon-button expand-image" aria-label="Ampliar imagen del espacio" onClick={() => setGallery(space)}><Maximize2 size={19} /></button><span className="render-note">Imágenes referenciales de Fundamenta</span></div>
          <div className="space-description" key={spaces[space].name}><span className="eyebrow">{spaces[space].eyebrow}</span><h3>{spaces[space].title}</h3><p>{spaces[space].text}</p><div className="gallery-controls"><span>{String(space + 1).padStart(2, '0')} <span className="counter-divider" /> 04</span><div><button className="icon-button" aria-label="Espacio anterior" onClick={() => selectSpace(space - 1)}><ChevronLeft size={19} /></button><button className="icon-button" aria-label="Espacio siguiente" onClick={() => selectSpace(space + 1)}><ChevronRight size={19} /></button></div></div></div>
        </div>
      </section>

      <section className="location-section section-wrap" id="ubicacion">
        <div className="location-copy reveal"><span className="eyebrow"><span className="short-line" /> EL BARRIO ES PARTE DE TU CASA</span><h2>Cerca de todo.<br /><span className="text-muted">Conectado contigo.</span></h2><p>Vive Ñuñoa desde un punto que te conecta con Santiago. Tu próxima parada empieza en Plaza Egaña.</p><div className="location-list"><div><TrainFront size={22} /><div><h3>Metro Plaza Egaña</h3><p>Conexión con las líneas 3 y 4</p></div><div className="metro-lines"><span>L3</span><span>L4</span></div></div><div><MapPin size={22} /><div><h3>En el corazón del barrio</h3><p>Av. Irarrázaval 5651, Ñuñoa</p></div></div><div><Check size={22} /><div><h3>El día a día, a tu alcance</h3><p>Comercio, servicios y vida de ciudad</p></div></div></div><a className="text-link" href="https://www.google.com/maps/search/?api=1&query=Av.+Irarr%C3%A1zaval+5651+%C3%91u%C3%B1oa+Chile" target="_blank" rel="noreferrer">Explorar la ubicación <MapPin size={16} /></a></div>
        <div className="location-visual reveal"><img src={ASSETS + 'eco-egana-dusk.webp'} alt="Eco Egaña Norte al atardecer junto a Metro Plaza Egaña" loading="lazy" /><div className="location-pin"><span className="location-pin-icon"><MapPin size={22} /></span><div><strong>Aquí empieza tu nueva historia.</strong><span>Eco Egaña Norte, Ñuñoa</span></div></div></div>
      </section>

      <section className="visit-section"><div className="visit-glow" /><div className="section-wrap reveal"><span className="eyebrow">EL SIGUIENTE PASO ES TUYO</span><h2>Imagina tu vida aquí.<br /><span>Ven a conocerla.</span></h2><a href={VISIT} target="_blank" rel="noreferrer" className="button button-lime">Agenda tu visita <Plus size={18} /></a><p>Conoce el proyecto con el equipo de Fundamenta.</p></div><span className="visit-watermark" aria-hidden="true">F</span></section>
    </main>
    <footer className="site-footer section-wrap"><div className="footer-top"><a href="#inicio" aria-label="Volver al inicio"><img src={ASSETS + 'fundamenta-logo-white.svg'} width="185" height="42" alt="Fundamenta" /></a><span>Arquitectura para tu próxima historia.</span><a href="https://www.fundamenta.cl/proyectos/eco-egana-norte/" target="_blank" rel="noreferrer">Visita Fundamenta <MoveUpRight size={15} /></a></div><div className="footer-bottom"><span>Concepto digital independiente · React + Blender</span><p>Imágenes y marcas de Fundamenta. Renders referenciales. El modelo 3D y la exploración de pisos son conceptuales.</p><a href="#inicio">Volver arriba</a></div></footer>
    <a className="floating-visit" href={VISIT} target="_blank" rel="noreferrer">Agenda tu visita <Plus size={17} /></a>
    {explorerOpen && <BuildingExplorer onClose={closeExplorer} initialMode={mode} />}
    {gallery !== null && <Gallery index={gallery} onClose={closeGallery} />}
  </>;
}
