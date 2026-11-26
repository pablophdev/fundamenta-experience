# Fundamenta Experience

Experiencia de Eco Egaña Norte construida con React, TypeScript, Three.js y modelos editables en Blender.

**Web:** https://pablophdev.github.io/fundamenta-experience/

Desde el edificio se puede tocar el departamento destacado: la cámara se acerca a su terraza y abre un interior amoblado editable. Al volver se conserva el piso y la cámara exterior.

- Interior 2D + 2B basado en el plano oficial Tipo C, con vistas de living, cocina, dormitorios y terraza.
- Tres estilos de decoración, muebles seleccionables y controles para moverlos, girarlos y ajustar sus dimensiones en metros.
- Comprobación geométrica de superposiciones y separación entre muebles y muros. Es una ayuda de distribución; no certifica accesibilidad ni cumplimiento normativo.
- Simulación solar por fecha, hora local de Santiago y norte ajustable. La posición astronómica usa la ubicación del proyecto; la orientación del departamento es referencial y puede ajustarse.
- **Mi día aquí:** recorrido guiado desde la mañana hasta la noche por el interior personalizado. Se puede detener en cualquier momento y respeta la preferencia de movimiento reducido.
- **Visita compartida:** un enlace permite entrar desde otro dispositivo y sincronizar habitación, decoración, hora y posición de los muebles. La interfaz muestra el estado real de conexión.
- Acceso al recorrido amoblado oficial de Matterport como referencia independiente del modelo editable.

## Desarrollo

Node.js 22 o superior:

```sh
npm ci
npm run dev
npm test
npm run build
```

La aplicación local se abre en `http://localhost:3000/`. La compilación se genera en `dist/`. Los modelos e imágenes se sirven con el frontend; Blender solo es necesario para editar o regenerar las escenas.

## Modelos de Blender

| Archivo | Uso |
| --- | --- |
| `blender/build_eco_egana.py` | Generador reproducible del exterior |
| `blender/eco-egana.blend` | Exterior editable |
| `public/models/eco-egana.glb` | Exterior para el navegador |
| `blender/build_eco_egana_interior.py` | Generador del interior |
| `blender/eco-egana-interior.blend` | Interior amoblado editable |
| `public/models/eco-egana-interior.glb` | Interior para el navegador |
| `public/models/eco-egana-interior.json` | Coordenadas, muebles, cámaras y fuentes del interior |

El exterior es una reinterpretación conceptual de los renders oficiales. El interior utiliza como referencia el **plano Tipo C: 56,02 m² útiles y 10,88 m² de terraza, 66,9 m² totales**. Las superficies están publicadas por Fundamenta; las longitudes de la reconstrucción se estiman a partir del plano. La decoración es sugerida y no forma parte de una oferta de venta.

El acceso en la fachada y los pisos son referenciales. Este modelo no identifica una unidad real disponible, no es un modelo BIM ni un levantamiento de obra. Tampoco reproduce el escaneo del piloto oficial. La orientación ajustable y el entorno simplificado limitan la precisión de las sombras; no debe usarse como estudio de asoleamiento de una unidad verificada.

Sin WebGL, ambos modelos ofrecen una representación geométrica simplificada con SVGRenderer. Se conservan las interacciones, con materiales e iluminación simplificados. El tour externo de Matterport requiere su propio navegador compatible con WebGL.

## Visita compartida

El frontend usa un servicio aislado en Neon para salas temporales. No necesita cuentas de visitantes ni recoge nombres, correos o datos de contacto. El enlace de invitación permite acceder a la distribución compartida: compártelo únicamente con quienes quieras invitar. Los cambios guardados en el dispositivo permiten retomar la decoración local.

El código del servicio y las instrucciones de configuración se incluyen en `backend/`. Las credenciales de base de datos permanecen en el servicio; no se incorporan al bundle del navegador ni al repositorio.

## Fuentes

- [Ficha oficial de Eco Egaña Norte](https://www.fundamenta.cl/proyectos/eco-egana-norte/): Av. Irarrázaval 5651, Ñuñoa; Metro Plaza Egaña L3/L4; 1 y 2 dormitorios, superficies desde 32 m².
- [Plano oficial Tipo C](https://www.fundamenta.cl/content/uploads/2026/11/eco-egana-norte-planta-c.webp).
- [Brochure oficial](https://www.fundamenta.cl/content/uploads/2026/11/brochure-eco-egana-norte.pdf).
- [Piloto amoblado oficial en Matterport](https://my.matterport.com/show/?m=yb7QwQrptqv), enlazado desde la ficha del proyecto. No se verificó su correspondencia con el Tipo C ni con un piso o número de unidad.
- [Cotización oficial](https://www.fundamenta.cl/cotizar-proyecto/?proyecto=eco-egana-norte).
- `public/assets/sources.json` y el manifiesto del interior documentan la procedencia de los recursos.

Propuesta digital independiente. Las marcas e imágenes pertenecen a Fundamenta y sus respectivos titulares. No hay conexión al inventario ni al cotizador de Fundamenta. Datos consultados en noviembre de 2026; confirma las condiciones vigentes en el sitio oficial.

## Publicación en GitHub Pages

La rama `gh-pages` contiene los archivos compilados y `.nojekyll`. La configuración usa **Deploy from a branch → gh-pages → /(root)**; no hay un workflow de despliegue propio.

```sh
GITHUB_PAGES=true npm run build
```

Publica el contenido de `dist/` en la raíz de `gh-pages`. El desarrollo local conserva la ruta `/`. El workflow de CI de `main` ejecuta las pruebas y la compilación.
