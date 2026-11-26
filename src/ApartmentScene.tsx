import { useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import type { SVGRenderer as SVGRendererType } from 'three/addons/renderers/SVGRenderer.js';
import { ChevronLeft, ChevronRight, LoaderCircle, Move, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import type { ApartmentState } from './apartment-state';
import { FURNITURE, solarPosition } from './apartment-state';
import { assetPath } from './asset-path';
import './apartment-scene.css';

export interface ApartmentSceneProps {
  state: ApartmentState;
  onFurnitureSelect: (id: string | null) => void;
  onFurnitureMove?: (id: string, x: number, z: number) => void;
  cinematic: boolean;
  onCinematicEnd?: () => void;
  onSceneReady?: () => void;
}
interface SceneAPI { update: () => void; rotate: (direction: number) => void; zoom: (factor: number) => void; reset: () => void }
interface RoomAnchor { id: string; camera: number[]; target: number[] }
interface InteriorManifest { rooms?: RoomAnchor[]; overviewCamera?: number[]; overviewTarget?: number[] }
interface FurnitureObject { object: THREE.Object3D; baseScale: THREE.Vector3; width: number; depth: number; height: number }
type Surface = THREE.MeshStandardMaterial;

/** Editable Blender geometry. The software renderer keeps the same picking and camera controls. */
export default function ApartmentScene(props: ApartmentSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const apiRef = useRef<SceneAPI | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [progress, setProgress] = useState(0);
  const [software, setSoftware] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    const abort = new AbortController();
    setLoadState('loading'); setProgress(0);
    if (typeof ResizeObserver === 'undefined') { setLoadState('error'); return; }

    async function initialize() {
      const [T, { OrbitControls }, { GLTFLoader }] = await Promise.all([
        import('three'), import('three/addons/controls/OrbitControls.js'), import('three/addons/loaders/GLTFLoader.js'),
      ]);
      if (disposed || !host) return;
      let gpu: THREE.WebGLRenderer | null = null;
      let renderer: THREE.WebGLRenderer | SVGRendererType;
      try { gpu = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch { /* SVG is also a real 3D projection. */ }
      if (gpu) {
        renderer = gpu;
        gpu.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
        gpu.setClearColor(0x000000, 0);
        gpu.toneMapping = T.ACESFilmicToneMapping;
        gpu.shadowMap.enabled = true;
        gpu.shadowMap.type = T.PCFSoftShadowMap;
        setSoftware(false);
      } else {
        const { SVGRenderer } = await import('three/addons/renderers/SVGRenderer.js');
        if (disposed) return;
        const svg = new SVGRenderer();
        svg.setPrecision(2); svg.setQuality('high');
        svg.setClearColor(new T.Color(0x152c32), 1);
        renderer = svg;
        setSoftware(true);
      }
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.domElement.setAttribute('role', 'img');
      renderer.domElement.setAttribute('aria-label', 'Departamento amoblado en 3D editable, basado en un plano de Eco Egaña Norte');
      host.appendChild(renderer.domElement);
      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(54, 1, .035, 150);
      const controls = new OrbitControls(camera, host);
      controls.enableDamping = Boolean(gpu); controls.dampingFactor = .09;
      controls.enablePan = true; controls.minDistance = .45; controls.maxDistance = 28;
      controls.minPolarAngle = .08; controls.maxPolarAngle = Math.PI * .495;
      controls.rotateSpeed = .55; controls.zoomSpeed = .7; controls.panSpeed = .65;
      const ambient = new T.HemisphereLight(0xe9f5ff, 0x9d856a, 1.5);
      const fill = new T.AmbientLight(0xd4e6e3, .5);
      const sun = new T.DirectionalLight(0xffe5bb, 3);
      sun.castShadow = true; sun.shadow.mapSize.set(1536, 1536);
      sun.shadow.camera.left = -9; sun.shadow.camera.right = 9;
      sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9;
      sun.shadow.camera.near = .1; sun.shadow.camera.far = 100;
      sun.shadow.bias = -.00015; sun.shadow.normalBias = .018;
      sun.target.position.set(0, .6, 0);
      const lamp = new T.PointLight(0xffcf8f, 0, 17, 1.5);
      lamp.position.set(-2.4, 2.35, 1.3);
      const lamp2 = new T.PointLight(0xffddaa, 0, 12, 1.5);
      lamp2.position.set(2.5, 2.3, -.9);
      scene.add(ambient, fill, sun, sun.target, lamp, lamp2);
      const materials: Surface[] = [];
      const allMaterials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      const geometries = new Set<THREE.BufferGeometry>();
      const furniture = new Map<string, FurnitureObject>();
      const walls: THREE.Object3D[] = [];
      const selectionGeometry = new T.EdgesGeometry(new T.BoxGeometry(1, 1, 1));
      const selectionMaterial = new T.LineBasicMaterial({ color: 0xd3ff8c, depthTest: false });
      const selection = new T.LineSegments(selectionGeometry, selectionMaterial);
      selection.renderOrder = 20; selection.visible = false;
      scene.add(selection); geometries.add(selectionGeometry); allMaterials.add(selectionMaterial);
      const raycaster = new T.Raycaster();
      const pointer = new T.Vector2();
      const ground = new T.Plane(new T.Vector3(0, 1, 0), 0);
      const intersection = new T.Vector3();
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let model: THREE.Group | null = null;
      let manifest: InteriorManifest = {};
      let frame = 0, dirty = true, previousRoom = '';
      let downX = 0, downY = 0, downId: string | null = null;
      let drag: { pointer: number; id: string; offsetX: number; offsetZ: number; moved: boolean; last: number } | null = null;
      let tween: { start: number; duration: number; from: THREE.Vector3; to: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3 } | null = null;
      const pointers = new Set<number>();
      const initialCamera = new T.Vector3(10, 11.8, 12.5);
      const initialTarget = new T.Vector3(0, .15, .15);
      camera.position.copy(initialCamera); controls.target.copy(initialTarget); controls.update();
      const invalidate = () => { dirty = true; };
      const chooseAnchor = (room: ApartmentState['room']) => {
        const aliases: Record<string, string> = { bedroom: 'bedroom_primary', bedroom2: 'bedroom_secondary', balcony: 'terrace' };
        const anchor = manifest.rooms?.find(item => item.id === (aliases[room] ?? room));
        if (room === 'overview' && manifest.overviewCamera && manifest.overviewTarget) return { camera: manifest.overviewCamera, target: manifest.overviewTarget };
        const fallback: Record<ApartmentState['room'], { camera: number[]; target: number[] }> = {
          overview: { camera: [10, 11.8, 12.5], target: [0, .15, .15] },
          living: { camera: [-3.8, 1.65, 3.15], target: [-1.3, 1.05, 1.1] },
          kitchen: { camera: [-.7, 1.7, -.5], target: [-2.8, 1.15, -2.4] },
          bedroom: { camera: [.3, 1.65, .1], target: [2.4, .9, -.9] },
          bedroom2: { camera: [.5, 1.65, -2], target: [2.6, .8, -2.7] },
          balcony: { camera: [-3.2, 1.65, 4.9], target: [.3, 1.25, 3.1] },
        };
        return anchor ?? fallback[room];
      };
      const moveCamera = (room: ApartmentState['room'], immediate = false) => {
        const anchor = chooseAnchor(room);
        const to = new T.Vector3().fromArray(anchor.camera);
        const toTarget = new T.Vector3().fromArray(anchor.target);
        if (immediate || reduceMotion) { tween = null; camera.position.copy(to); controls.target.copy(toTarget); controls.update(); }
        else tween = { start: performance.now(), duration: propsRef.current.cinematic ? 1900 : 1100, from: camera.position.clone(), to, fromTarget: controls.target.clone(), toTarget };
        invalidate();
      };
      const findFurnitureId = (object: THREE.Object3D | null): string | null => {
        for (let item = object; item; item = item.parent) {
          const id = String(item.userData.furniture_id ?? item.userData.furnitureId ?? item.name.replace(/^Furniture_/, ''));
          if (furniture.has(id)) return id;
        }
        return null;
      };
      const isVisible = (object: THREE.Object3D) => {
        for (let item: THREE.Object3D | null = object; item; item = item.parent) if (!item.visible) return false;
        return true;
      };
      const setRay = (event: PointerEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
      };
      const pick = (event: PointerEvent) => {
        if (!model) return null;
        setRay(event);
        const hit = raycaster.intersectObjects([...furniture.values()].map(item => item.object), true).find(item => isVisible(item.object));
        return hit ? findFurnitureId(hit.object) : null;
      };
      const stopCamera = () => { tween = null; propsRef.current.onCinematicEnd?.(); };
      const onControlStart = () => { stopCamera(); };
      controls.addEventListener('change', invalidate);
      controls.addEventListener('start', onControlStart);
      const pointerDown = (event: PointerEvent) => {
        pointers.add(event.pointerId);
        downX = event.clientX; downY = event.clientY;
        downId = pointers.size === 1 ? pick(event) : null;
        if (pointers.size > 1 && drag) { drag = null; controls.enabled = true; }
        if (event.button !== 0 || !downId || !propsRef.current.onFurnitureMove) return;
        propsRef.current.onFurnitureSelect(downId);
        // On touch, select once before dragging, leaving unselected pieces easy to orbit around.
        if (event.pointerType === 'touch' && propsRef.current.state.selectedFurniture !== downId) return;
        setRay(event);
        if (!raycaster.ray.intersectPlane(ground, intersection)) return;
        const object = furniture.get(downId)!.object;
        drag = { pointer: event.pointerId, id: downId, offsetX: object.position.x - intersection.x, offsetZ: object.position.z - intersection.z, moved: false, last: 0 };
        controls.enabled = false;
        stopCamera();
        host.setPointerCapture(event.pointerId);
      };
      const pointerMove = (event: PointerEvent) => {
        if (!drag || drag.pointer !== event.pointerId) {
          if (!pointers.size && event.pointerType !== 'touch') renderer.domElement.style.cursor = pick(event) ? 'pointer' : 'grab';
          return;
        }
        if (Math.hypot(event.clientX - downX, event.clientY - downY) < 5 && !drag.moved) return;
        setRay(event);
        if (!raycaster.ray.intersectPlane(ground, intersection)) return;
        drag.moved = true;
        if (performance.now() - drag.last < 35) return;
        drag.last = performance.now();
        const x = T.MathUtils.clamp(intersection.x + drag.offsetX, -4.65, 4.65);
        const z = T.MathUtils.clamp(intersection.z + drag.offsetZ, -3.95, 4.3);
        propsRef.current.onFurnitureMove?.(drag.id, Math.round(x * 100) / 100, Math.round(z * 100) / 100);
      };
      const pointerUp = (event: PointerEvent) => {
        const moved = drag?.moved;
        if (pointers.size === 1 && !moved && Math.hypot(event.clientX - downX, event.clientY - downY) < 6) propsRef.current.onFurnitureSelect(downId);
        pointers.delete(event.pointerId);
        if (drag?.pointer === event.pointerId) { drag = null; controls.enabled = true; if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId); }
        downId = null;
      };
      const pointerCancel = (event: PointerEvent) => { pointers.delete(event.pointerId); drag = null; downId = null; controls.enabled = true; };
      host.addEventListener('pointerdown', pointerDown, true);
      host.addEventListener('pointermove', pointerMove);
      host.addEventListener('pointerup', pointerUp);
      host.addEventListener('pointercancel', pointerCancel);
      const size = () => {
        const width = host.clientWidth, height = host.clientHeight;
        if (!width || !height) return;
        renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); invalidate();
      };
      const observer = new ResizeObserver(size); observer.observe(host); size();
      const updateSelection = () => {
        const selected = propsRef.current.state.selectedFurniture;
        const object = selected ? furniture.get(selected)?.object : null;
        selection.visible = Boolean(object);
        if (object) {
          object.updateWorldMatrix(true, true);
          const box = new T.Box3().setFromObject(object);
          selection.position.copy(box.getCenter(new T.Vector3()));
          selection.scale.copy(box.getSize(new T.Vector3())).addScalar(.035);
        }
      };
      const update = () => {
        const state = propsRef.current.state;
        const solar = solarPosition(state.date, state.hour, undefined, undefined, state.northOffset);
        const daylight = T.MathUtils.smoothstep(solar.altitude, -5, 16);
        const warmth = 1 - T.MathUtils.smoothstep(solar.altitude, 0, 30);
        sun.position.set(solar.direction.x, solar.direction.y, solar.direction.z).multiplyScalar(45);
        sun.intensity = Math.max(0, Math.sin(T.MathUtils.degToRad(solar.altitude))) * (gpu ? 3.4 : 1.4);
        sun.color.set(0xfff0dc).lerp(new T.Color(0xffac67), warmth * .65);
        ambient.intensity = .48 + daylight * (gpu ? 1.5 : 1);
        ambient.color.set(0x9db2dc).lerp(new T.Color(0xecf6ff), daylight);
        fill.intensity = gpu ? .18 : .55;
        lamp.intensity = (1 - daylight) * 8; lamp2.intensity = (1 - daylight) * 5;
        if (gpu) gpu.toneMappingExposure = .95 + (1 - daylight) * .2;
        if (!gpu) renderer.setClearColor(new T.Color(0x101c30).lerp(new T.Color(0x1c353c), daylight), 1);
        materials.forEach(material => {
          material.color.copy(material.userData.baseColor as THREE.Color);
          material.emissive.copy(material.userData.baseEmissive as THREE.Color);
          const name = material.name.toLowerCase();
          if (/fabric|upholstery|sofa|cushion|curtain|bedspread|linen|editable (armchair|dining_chair|terrace_chair|bed_)/.test(name)) {
            const tint = state.theme === 'warm' ? 0xc38e70 : state.theme === 'minimal' ? 0xd1d7d5 : 0x9caf91;
            material.color.lerp(new T.Color(tint), .68);
          }
          if (/wood|oak|timber/.test(name)) material.color.lerp(new T.Color(state.theme === 'warm' ? 0xb77a45 : state.theme === 'minimal' ? 0xd0c2ad : 0xc0a47e), .28);
        });
        furniture.forEach((item, id) => {
          const transform = state.furniture[id];
          if (!transform) return;
          item.object.position.x = transform.x; item.object.position.z = transform.z;
          item.object.rotation.y = T.MathUtils.degToRad(transform.rotation);
          item.object.scale.copy(item.baseScale).multiply(new T.Vector3(transform.width / item.width, transform.height / item.height, transform.depth / item.depth));
        });
        updateSelection();
        if (state.room !== previousRoom) { moveCamera(state.room); previousRoom = state.room; }
        invalidate();
      };
      apiRef.current = {
        update,
        rotate(direction) { stopCamera(); const offset = camera.position.clone().sub(controls.target).applyAxisAngle(new T.Vector3(0, 1, 0), direction * .2); camera.position.copy(controls.target).add(offset); controls.update(); invalidate(); },
        zoom(factor) { stopCamera(); const offset = camera.position.clone().sub(controls.target).multiplyScalar(factor).clampLength(controls.minDistance, controls.maxDistance); camera.position.copy(controls.target).add(offset); controls.update(); invalidate(); },
        reset() { stopCamera(); moveCamera(propsRef.current.state.room); },
      };
      const hideFrontWalls = () => {
        // Exterior walls nearest the camera fade out of the dollhouse, revealing the actual rooms.
        const overview = propsRef.current.state.room === 'overview';
        walls.forEach(wall => {
          if (!overview) { wall.visible = !/ceiling/i.test(wall.name); return; }
          const kind = String(wall.userData.wall_kind ?? wall.userData.category ?? wall.name).toLowerCase();
          if (!/external|exterior|header/.test(kind)) { wall.visible = true; return; }
          const center = new T.Box3().setFromObject(wall).getCenter(new T.Vector3());
          const fromCenter = new T.Vector2(center.x, center.z);
          const cameraSide = new T.Vector2(camera.position.x, camera.position.z);
          wall.visible = fromCenter.dot(cameraSide) <= 2;
        });
      };
      const visibility = () => { if (document.visibilityState === 'visible') invalidate(); };
      document.addEventListener('visibilitychange', visibility);
      const draw = () => {
        if (disposed) return;
        frame = requestAnimationFrame(draw);
        if (document.visibilityState === 'hidden' || !host.clientWidth || !host.clientHeight) return;
        if (tween) {
          const t = Math.min(1, (performance.now() - tween.start) / tween.duration);
          const eased = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          camera.position.lerpVectors(tween.from, tween.to, eased);
          controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
          invalidate();
          if (t >= 1) tween = null;
        }
        controls.update();
        if (dirty) { hideFrontWalls(); renderer.render(scene, camera); dirty = false; }
      };
      const contextLost = (event: Event) => { event.preventDefault(); if (!disposed) { cleanup?.(); setLoadState('error'); } };
      renderer.domElement.addEventListener('webglcontextlost', contextLost);
      let cleaned = false;
      cleanup = () => {
        if (cleaned) return; cleaned = true;
        cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
        host.removeEventListener('pointerdown', pointerDown, true); host.removeEventListener('pointermove', pointerMove);
        host.removeEventListener('pointerup', pointerUp); host.removeEventListener('pointercancel', pointerCancel);
        document.removeEventListener('visibilitychange', visibility);
        renderer.domElement.removeEventListener('webglcontextlost', contextLost);
        geometries.forEach(geometry => geometry.dispose()); allMaterials.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose());
        sun.dispose(); lamp.dispose(); lamp2.dispose();
        gpu?.dispose(); gpu?.forceContextLoss(); renderer.domElement.remove(); apiRef.current = null;
      };
      const [gltf, manifestResult] = await Promise.all([
        new GLTFLoader().loadAsync(assetPath('models/eco-egana-interior.glb'), event => { if (!disposed && event.total) setProgress(Math.min(100, Math.round(event.loaded / event.total * 100))); }),
        fetch(assetPath('models/eco-egana-interior.json'), { signal: abort.signal }).then(response => response.ok ? response.json() as Promise<InteriorManifest> : {}).catch(() => ({})),
      ]);
      if (disposed) {
        gltf.scene.traverse(object => { if (object instanceof T.Mesh) { object.geometry.dispose(); const list = Array.isArray(object.material) ? object.material : [object.material]; list.forEach(material => { Object.values(material).forEach(value => { if (value instanceof T.Texture) value.dispose(); }); material.dispose(); }); } });
        return;
      }
      model = gltf.scene; manifest = manifestResult;
      model.traverse(object => {
        const furnitureId = String(object.userData.furniture_id ?? object.userData.furnitureId ?? object.name.replace(/^Furniture_/, ''));
        const base = FURNITURE.find(item => item.id === furnitureId);
        if (base && (object.name.startsWith('Furniture_') || object.userData.furniture_id)) furniture.set(base.id, { object, baseScale: object.scale.clone(), width: base.width, depth: base.depth, height: base.height });
        if (/^Wall_/i.test(object.name) || object.userData.wall_kind) walls.push(object);
        if (/ceiling/i.test(object.name)) object.visible = false;
        if (!(object instanceof T.Mesh)) return;
        geometries.add(object.geometry); object.castShadow = true; object.receiveShadow = true;
        const list = Array.isArray(object.material) ? object.material : [object.material];
        const cloned = list.map(original => {
          const material = original.clone() as Surface;
          allMaterials.add(original); allMaterials.add(material);
          Object.values(material).forEach(value => { if (value instanceof T.Texture) textures.add(value); });
          if (material.isMeshStandardMaterial) {
            material.userData.baseColor = material.color.clone(); material.userData.baseEmissive = material.emissive.clone();
            materials.push(material);
            // Avoid order-dependent transparent glass in the SVG fallback.
            if (!gpu && /glass|window/i.test(material.name)) { material.transparent = true; material.opacity = .12; }
          }
          return material;
        });
        object.material = Array.isArray(object.material) ? cloned : cloned[0];
      });
      scene.add(model);
      // The balcony becomes the opening shot before the first chosen room.
      if (!reduceMotion) {
        const entry = chooseAnchor('balcony'); camera.position.fromArray(entry.camera); controls.target.fromArray(entry.target); controls.update();
      }
      update(); setLoadState('ready'); draw(); propsRef.current.onSceneReady?.();
    }
    initialize().catch(error => {
      if (!disposed) { console.warn('No se pudo cargar el interior editable.', error); cleanup?.(); setLoadState('error'); }
    });
    return () => { disposed = true; abort.abort(); cleanup?.(); };
  }, [attempt]);

  useEffect(() => { apiRef.current?.update(); }, [props.state, props.cinematic]);

  return <div className="apartment-scene" data-state={loadState} data-renderer={software ? 'software' : 'webgl'}>
    <div ref={hostRef} className="apartment-scene-canvas" tabIndex={0} role="group" aria-label="Interior 3D. Flechas izquierda y derecha para girar. Más y menos para zoom. Cero para restaurar la cámara." onKeyDown={event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); apiRef.current?.rotate(event.key === 'ArrowLeft' ? -1 : 1); }
      if (event.key === '+' || event.key === '=') { event.preventDefault(); apiRef.current?.zoom(.87); }
      if (event.key === '-') { event.preventDefault(); apiRef.current?.zoom(1.15); }
      if (event.key === '0') { event.preventDefault(); apiRef.current?.reset(); }
    }} />
    {loadState === 'loading' && <div className="apartment-scene-loading" role="status"><LoaderCircle size={27} /><strong>Preparando tu departamento</strong><span>{progress ? `${progress}% · Modelo editable de Blender` : 'Cargando espacios y mobiliario'}</span></div>}
    {loadState === 'error' && <div className="apartment-scene-error" role="status"><strong>No se pudo abrir el modelo</strong><p>Puedes reintentar o descargar el interior para verlo en un visor 3D.</p><button onClick={() => setAttempt(value => value + 1)}>Volver a cargar</button><a href={assetPath('models/eco-egana-interior.glb')} download>Descargar interior (.glb)</a></div>}
    {loadState === 'ready' && <>
      <div className="apartment-scene-tip"><Move size={13} /><span>{props.state.selectedFurniture ? 'Arrastra el mueble seleccionado o usa sus controles' : 'Gira la vista · Toca un mueble para personalizar'}</span></div>
      {software && <div className="apartment-scene-software">Vista simplificada · Texturas y sombras requieren WebGL</div>}
      <div className="apartment-scene-controls" role="group" aria-label="Cámara del interior">
        <button onClick={() => apiRef.current?.rotate(-1)} aria-label="Girar interior a la izquierda"><ChevronLeft size={17} /></button>
        <button onClick={() => apiRef.current?.rotate(1)} aria-label="Girar interior a la derecha"><ChevronRight size={17} /></button>
        <span />
        <button onClick={() => apiRef.current?.zoom(.85)} aria-label="Acercar interior"><ZoomIn size={17} /></button>
        <button onClick={() => apiRef.current?.zoom(1.18)} aria-label="Alejar interior"><ZoomOut size={17} /></button>
        <span />
        <button onClick={() => apiRef.current?.reset()} aria-label="Restaurar cámara del interior"><RotateCcw size={16} /></button>
      </div>
    </>}
  </div>;
}
