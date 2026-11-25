import { useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import type { SVGRenderer as SVGRendererType } from 'three/addons/renderers/SVGRenderer.js';
import { LoaderCircle, RotateCcw, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Box } from 'lucide-react';
import { assetPath } from './asset-path';
import './scene.css';

interface BuildingSceneProps {
  mode: 'day' | 'dusk';
  selectedFloor: number;
  hoveredFloor?: number | null;
  onFloorSelect: (floor: number) => void;
  onFloorHover?: (floor: number | null) => void;
}
interface SceneAPI {
  update: () => void;
  rotate: (direction: number) => void;
  zoom: (factor: number) => void;
  reset: () => void;
}
type Surface = THREE.MeshStandardMaterial;

export default function BuildingScene(props: BuildingSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const apiRef = useRef<SceneAPI | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [progress, setProgress] = useState(0);
  const [software, setSoftware] = useState(false);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    if (typeof ResizeObserver === 'undefined') { setState('fallback'); return; }

    async function initialize() {
      const [T, { OrbitControls }, { GLTFLoader }] = await Promise.all([
        import('three'), import('three/addons/controls/OrbitControls.js'), import('three/addons/loaders/GLTFLoader.js'),
      ]);
      if (disposed || !host) return;
      let renderer: THREE.WebGLRenderer | SVGRendererType;
      let gpu: THREE.WebGLRenderer | null = null;
      try {
        gpu = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      } catch {
        // Use the same Blender geometry and camera on devices without a GPU context.
        // SVG renders on demand; textures and shadows are simplified, interaction stays 3D.
      }
      if (gpu) {
        renderer = gpu;
        gpu.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
        gpu.setClearColor(0x000000, 0);
        gpu.toneMapping = T.ACESFilmicToneMapping;
        gpu.shadowMap.enabled = true;
        gpu.shadowMap.type = T.PCFSoftShadowMap;
      } else {
        const { SVGRenderer } = await import('three/addons/renderers/SVGRenderer.js');
        if (disposed) return;
        const svg = new SVGRenderer();
        svg.setPrecision(2);
        svg.setQuality('high');
        svg.setClearColor(new T.Color(0x10242b), 1);
        renderer = svg;
        setSoftware(true);
      }
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.domElement.setAttribute('aria-label', 'Modelo 3D de Eco Egaña Norte creado en Blender');
      renderer.domElement.setAttribute('role', 'img');
      host.appendChild(renderer.domElement);
      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(36, 1, .1, 1500);
      const controls = new OrbitControls(camera, host);
      controls.enableDamping = Boolean(gpu);
      controls.dampingFactor = .08;
      controls.enablePan = false;
      controls.minPolarAngle = .3;
      controls.maxPolarAngle = Math.PI * .49;
      controls.rotateSpeed = .55;
      controls.zoomSpeed = .6;
      const ambient = new T.HemisphereLight(0xe2efff, 0x5c6652, 2.4);
      const sun = new T.DirectionalLight(0xffeccb, 3);
      sun.position.set(-70, 130, 90);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -100; sun.shadow.camera.right = 100;
      sun.shadow.camera.top = 120; sun.shadow.camera.bottom = -100;
      sun.shadow.camera.far = 400;
      sun.shadow.normalBias = .1;
      const rim = new T.DirectionalLight(0x91bbed, 2.1);
      rim.position.set(60, 90, -90);
      const softwareAmbient = new T.AmbientLight(0xa2bdd0, gpu ? 0 : .6);
      scene.add(ambient, sun, rim, softwareAmbient);
      const materials: Surface[] = [];
      const allMaterials = new Set<THREE.Material>();
      const textures = new Set<THREE.Texture>();
      const geometries = new Set<THREE.BufferGeometry>();
      const floorMaterials = new Map<number, Surface[]>();
      let frame = 0;
      let model: THREE.Group | null = null;
      let canDraw = true;
      let startX = 0, startY = 0;
      let down = false;
      let sceneScale = 90;
      const initialCamera = new T.Vector3();
      const initialTarget = new T.Vector3();
      const raycaster = new T.Raycaster();
      const pointer = new T.Vector2();
      const invalidate = () => { canDraw = true; };
      controls.addEventListener('change', invalidate);
      const size = () => {
        const width = Math.max(host.clientWidth, 1), height = Math.max(host.clientHeight, 1);
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        invalidate();
      };
      const observer = new ResizeObserver(size);
      observer.observe(host);
      size();
      const surfaceFloor = (object: THREE.Object3D | null): number | null => {
        for (let item = object; item; item = item.parent) {
          const match = /^Floor_(\d{2})(?:$|_)/.exec(item.name);
          if (match) return Number(match[1]);
        }
        return null;
      };
      const pick = (event: PointerEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        const intersection = model ? raycaster.intersectObject(model, true)[0] : undefined;
        return intersection ? surfaceFloor(intersection.object) : null;
      };
      const pointerDown = (event: PointerEvent) => { down = true; startX = event.clientX; startY = event.clientY; propsRef.current.onFloorHover?.(null); };
      const pointerUp = (event: PointerEvent) => {
        if (down && Math.hypot(event.clientX - startX, event.clientY - startY) < 6) {
          const selected = pick(event);
          if (selected !== null) propsRef.current.onFloorSelect(selected);
        }
        down = false;
      };
      const pointerMove = (event: PointerEvent) => {
        if (down || event.pointerType === 'touch') return;
        const selected = pick(event);
        renderer.domElement.style.cursor = selected === null ? 'grab' : 'pointer';
        propsRef.current.onFloorHover?.(selected);
      };
      const pointerLeave = () => { down = false; propsRef.current.onFloorHover?.(null); };
      const contextLost = (event: Event) => { event.preventDefault(); if (!disposed) { disposed = true; cleanup?.(); setState('fallback'); } };
      host.addEventListener('pointerdown', pointerDown);
      host.addEventListener('pointerup', pointerUp);
      host.addEventListener('pointermove', pointerMove);
      host.addEventListener('pointerleave', pointerLeave);
      renderer.domElement.addEventListener('webglcontextlost', contextLost);
      const update = () => {
        const { mode, selectedFloor, hoveredFloor } = propsRef.current;
        const isDay = mode === 'day';
        ambient.intensity = isDay ? 2.8 : 1.4;
        ambient.color.set(isDay ? 0xe8f3ff : 0x7999d5);
        sun.intensity = gpu ? (isDay ? 3.6 : 1.6) : (isDay ? 1.3 : .6);
        sun.color.set(isDay ? 0xffedce : 0xffb87b);
        rim.intensity = gpu ? (isDay ? 1.7 : 2.7) : (isDay ? .4 : .6);
        softwareAmbient.intensity = gpu ? 0 : (isDay ? .8 : .45);
        if (gpu) gpu.toneMappingExposure = isDay ? 1 : 1.15;
        materials.forEach(material => {
          material.color.copy(material.userData.baseColor as THREE.Color);
          material.emissive.copy(material.userData.baseEmissive as THREE.Color);
          material.emissiveIntensity = (material.userData.baseEmissiveIntensity as number) * (isDay ? .15 : 1.2);
        });
        floorMaterials.get(hoveredFloor ?? selectedFloor)?.forEach(material => {
          material.color.lerp(new T.Color(0xc8ef88), .4);
          material.emissive.set(0x8ab54f);
          material.emissiveIntensity = .42;
        });
        invalidate();
      };
      apiRef.current = {
        update,
        rotate(direction) {
          const offset = camera.position.clone().sub(controls.target);
          offset.applyAxisAngle(new T.Vector3(0, 1, 0), direction * .22);
          camera.position.copy(controls.target).add(offset); controls.update(); invalidate();
        },
        zoom(factor) {
          const offset = camera.position.clone().sub(controls.target);
          offset.multiplyScalar(factor).clampLength(controls.minDistance, controls.maxDistance);
          camera.position.copy(controls.target).add(offset); controls.update(); invalidate();
        },
        reset() { camera.position.copy(initialCamera); controls.target.copy(initialTarget); controls.update(); invalidate(); },
      };
      const visibility = () => { if (document.visibilityState === 'visible') invalidate(); };
      document.addEventListener('visibilitychange', visibility);
      const draw = () => {
        if (disposed) return;
        frame = requestAnimationFrame(draw);
        controls.update();
        if (canDraw && document.visibilityState !== 'hidden') { renderer.render(scene, camera); canDraw = false; }
      };
      let cleaned = false;
      cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        cancelAnimationFrame(frame);
        observer.disconnect();
        controls.dispose();
        document.removeEventListener('visibilitychange', visibility);
        host.removeEventListener('pointerdown', pointerDown);
        host.removeEventListener('pointerup', pointerUp);
        host.removeEventListener('pointermove', pointerMove);
        host.removeEventListener('pointerleave', pointerLeave);
        renderer.domElement.removeEventListener('webglcontextlost', contextLost);
        geometries.forEach(geometry => geometry.dispose());
        allMaterials.forEach(material => material.dispose());
        textures.forEach(texture => texture.dispose());
        sun.dispose();
        gpu?.dispose();
        gpu?.forceContextLoss();
        renderer.domElement.remove();
        apiRef.current = null;
      };
      const gltf = await new GLTFLoader().loadAsync(assetPath('models/eco-egana.glb'), event => {
        if (!disposed && event.total) setProgress(Math.round(event.loaded / event.total * 100));
      });
      if (disposed) {
        gltf.scene.traverse(object => {
          if (object instanceof T.Mesh) {
            object.geometry.dispose();
            const items = Array.isArray(object.material) ? object.material : [object.material];
            items.forEach(material => {
              for (const value of Object.values(material)) if (value instanceof T.Texture) value.dispose();
              material.dispose();
            });
          }
        });
        return;
      }
      model = gltf.scene;
      model.traverse(object => {
        if (!gpu && ['Fundamenta_Tower_Logo', 'Fundamenta_Podium_Logo'].includes(object.name)) object.visible = false;
        if (!(object instanceof T.Mesh)) return;
        const floor = surfaceFloor(object);
        object.castShadow = !object.name.toLowerCase().includes('ground');
        object.receiveShadow = true;
        geometries.add(object.geometry);
        const original = Array.isArray(object.material) ? object.material : [object.material];
        const cloned = original.map(material => {
          // Floor materials must be independent so highlighting never tints another storey.
          const surface = material.clone() as Surface;
          allMaterials.add(material); allMaterials.add(surface);
          for (const value of Object.values(surface)) if (value instanceof T.Texture) textures.add(value);
          if (surface.isMeshStandardMaterial) {
            surface.userData.baseColor = surface.color.clone();
            surface.userData.baseEmissive = surface.emissive.clone();
            surface.userData.baseEmissiveIntensity = surface.emissiveIntensity;
            materials.push(surface);
            if (floor !== null) floorMaterials.set(floor, [...(floorMaterials.get(floor) ?? []), surface]);
          }
          return surface;
        });
        object.material = Array.isArray(object.material) ? cloned : cloned[0];
      });
      scene.add(model);
      const box = new T.Box3().setFromObject(model);
      const extent = box.getSize(new T.Vector3());
      const center = box.getCenter(new T.Vector3());
      sceneScale = Math.max(extent.y, extent.x * .68);
      initialTarget.set(center.x, box.min.y + extent.y * .44, center.z);
      const distance = sceneScale * (camera.aspect < .9 ? 2.7 : 2.1);
      initialCamera.copy(initialTarget).add(new T.Vector3(.6, .4, 1).normalize().multiplyScalar(distance));
      controls.minDistance = sceneScale * .65; controls.maxDistance = sceneScale * 4.8;
      apiRef.current.reset();
      update();
      setState('ready');
      draw();
    }
    initialize().catch(error => {
      if (!disposed) { console.warn('El visor 3D no está disponible; se muestra la referencia.', error); cleanup?.(); setState('fallback'); }
    });
    return () => { disposed = true; cleanup?.(); };
  }, []);

  useEffect(() => { apiRef.current?.update(); }, [props.mode, props.selectedFloor, props.hoveredFloor]);

  return <div className={`building-scene building-scene-${props.mode}`} data-state={state}>
    {state === 'fallback' ? <div className="scene-fallback"><img src={assetPath(`assets/eco-egana-${props.mode === 'day' ? 'day' : 'dusk'}.webp`)} alt="Render de referencia de Eco Egaña Norte" /><p>La vista 3D no está disponible en este dispositivo. Puedes seguir explorando con el selector de pisos.</p><a href={assetPath('models/eco-egana.glb')} download>Descargar modelo 3D (.glb)</a></div> : <>
      <div ref={containerRef} className="scene-canvas" role="group" tabIndex={0} aria-label="Edificio en 3D. Flechas izquierda y derecha para girar, arriba y abajo para cambiar piso, más y menos para zoom, cero para reiniciar." onKeyDown={event => {
        if (!apiRef.current) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); apiRef.current.rotate(event.key === 'ArrowLeft' ? -.7 : .7); }
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); props.onFloorSelect(Math.max(3, Math.min(26, props.selectedFloor + (event.key === 'ArrowUp' ? 1 : -1)))); }
        if (event.key === '+' || event.key === '=') { event.preventDefault(); apiRef.current.zoom(.88); }
        if (event.key === '-') { event.preventDefault(); apiRef.current.zoom(1.12); }
        if (event.key === '0') { event.preventDefault(); apiRef.current.reset(); }
      }} />
      {state === 'loading' && <div className="scene-loading" role="status"><LoaderCircle className="scene-spinner" size={26} /><span>Construyendo tu perspectiva</span><small>{progress > 0 ? `${progress}%` : 'Cargando modelo de Blender'}</small></div>}
      {state === 'ready' && <><div className="scene-model-badge"><Box size={14} /> {software ? 'VISTA 3D SIMPLIFICADA' : 'MODELO 3D · BLENDER'}</div><div className="scene-camera-controls" role="group" aria-label="Cámara del modelo 3D">
        <button onClick={() => apiRef.current?.rotate(-1)} aria-label="Girar a la izquierda"><ChevronLeft size={18} /></button><button onClick={() => apiRef.current?.rotate(1)} aria-label="Girar a la derecha"><ChevronRight size={18} /></button><span />
        <button onClick={() => apiRef.current?.zoom(.84)} aria-label="Acercar modelo"><ZoomIn size={18} /></button><button onClick={() => apiRef.current?.zoom(1.18)} aria-label="Alejar modelo"><ZoomOut size={18} /></button><span />
        <button onClick={() => apiRef.current?.reset()} aria-label="Reiniciar vista"><RotateCcw size={17} /></button>
      </div></>}
    </>}
  </div>;
}
