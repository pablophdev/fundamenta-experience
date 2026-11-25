# Eco Egaña — estudio arquitectónico en Blender

Modelo artístico realizado para la experiencia web de Fundamenta. Interpreta las
fachadas, balcones y volúmenes de los renders públicos del proyecto Eco Egaña.
No representa planos técnicos, disponibilidad comercial ni mediciones oficiales.

## Archivos

- `eco-egana.blend`: escena editable, materiales PBR, cámara e iluminación.
- `build_eco_egana.py`: generador reproducible sin dependencias Python externas.
- `preview.png`: vista arquitectónica del modelo, fondo transparente.
- `model-stats.json`: dimensiones, geometría y nombres interactivos.
- `../public/models/eco-egana.glb`: exportación autónoma para React/Three.js.

## Regenerar

Desde la raíz del proyecto:

```sh
blender -b --python blender/build_eco_egana.py
```

Para regenerar únicamente el `.blend` y el GLB sin repetir el render:

```sh
blender -b --python blender/build_eco_egana.py -- --skip-render
```

Requiere Blender 4.3 o posterior y el logo de marca en
`public/assets/fundamenta-logo.webp`. El render usa Cycles CPU para funcionar sin
una GPU. El exportador glTF incluido en Blender empaqueta los mapas PNG en el GLB.

## Integración

- Blender: metros, Z vertical, fachada principal hacia −Y.
- GLB: metros, Y vertical, fachada principal hacia +Z.
- La cámara web puede situarse en el octante +X, +Y, +Z.
- Los objetos `Floor_03` a `Floor_26` son los 24 niveles seleccionables.
- Cada piso puede tener varias primitivas de material: busca el nombre en sus
  ancestros para identificarlo tras cargarlo con `GLTFLoader`.
- Cada nivel incluye `userData.floor_number` y `userData.interactive`.
- No se exportan luces ni cámaras: el visor debe proporcionar su iluminación.
- Los cristales son PBR opacos con baja metalicidad para evitar depender de un
  mapa de entorno o de costosa transmisión física.
- El logo oficial se conserva como textura. El objeto
  `Fundamenta_Tower_Emblem` también contiene un círculo y una F de geometría real.
  Un visor sin soporte para mapas puede ocultar los planos
  `Fundamenta_Tower_Logo` y `Fundamenta_Podium_Logo` y mantener el emblema.

## Referencias

- [Proyecto Eco Egaña Norte](https://www.fundamenta.cl/proyectos/eco-egana-norte/).
- [Fachada diurna oficial](https://www.fundamenta.cl/content/uploads/2026/09/eco-egana-facade-day.webp).
- [Fachada nocturna oficial](https://www.fundamenta.cl/content/uploads/2026/09/eco-egana-facade-dusk.webp).
- [Logo oficial](https://www.fundamenta.cl/content/uploads/2026/09/fundamenta-logo.webp).

