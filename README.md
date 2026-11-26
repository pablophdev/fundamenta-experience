# Fundamenta Experience

Frontend en React, TypeScript y Vite que presenta Eco Egaña Norte con una experiencia arquitectónica interactiva. Combina los logos y renders oficiales de Fundamenta con un modelo 3D creado en Blender y mostrado en el navegador con Three.js.

El visor permite orbitar alrededor del edificio, acercar y alejar la cámara, seleccionar pisos y alternar entre iluminación de día y atardecer.

Desde el piloto destacado en el exterior o el botón **Entrar al departamento piloto en 3D** se abre el recorrido interior amoblado oficial de Eco Egaña Norte. La vista interior permite recorrer el piloto con Matterport; **Volver al edificio** recupera la selección del exterior. Con el foco en los controles del explorador, la tecla Escape vuelve primero al edificio y, desde el exterior, cierra el explorador.

Cuando WebGL no está disponible, el visor utiliza una vista 3D simplificada con SVGRenderer: conserva la geometría y los controles de cámara, con materiales, texturas y sombras simplificados. Si tampoco puede cargar esa vista, muestra el render de referencia y permite descargar el modelo GLB.

## Desarrollo local

Requisitos: Node.js 22 y npm.

```sh
npm ci
npm run dev
```

Abre `http://localhost:3000`. Para generar la versión de producción:

```sh
npm run build
npm run preview
```

```sh
npm test
```

Las pruebas de interacción cubren iluminación, espacios, galería, explorador, entrada y regreso del recorrido interior, teclado y foco, además de los estados de carga y reintento del visor. Comprueban la integración del iframe; la navegación dentro de Matterport requiere revisión en navegador con acceso al servicio. GitHub Actions ejecuta el build en los pushes a `main` y en las pull requests.

El resultado se genera en `dist/`. No se necesitan claves ni variables de entorno para usar el frontend.

## Modelo 3D con Blender

El modelo arquitectónico es conceptual y está basado en los renders oficiales de Eco Egaña Norte. Sus proporciones, detalles y pisos sirven para la experiencia interactiva; no constituyen un modelo BIM ni una reproducción de planos de obra.

Con Blender instalado y disponible como `blender` en la terminal, ejecuta este comando desde la raíz del proyecto para regenerar los archivos:

```sh
blender -b -t 2 -P blender/build_eco_egana.py
```

| Archivo | Uso |
| --- | --- |
| [`blender/build_eco_egana.py`](blender/build_eco_egana.py) | Script reproducible de construcción, exportación y vista previa |
| [`blender/eco-egana.blend`](blender/eco-egana.blend) | Escena editable en Blender |
| [`public/models/eco-egana.glb`](public/models/eco-egana.glb) | Modelo glTF binario que carga el visor Three.js |
| [`blender/preview.png`](blender/preview.png) | Vista previa del modelo generada en Blender |

Blender solo se necesita para editar o regenerar el modelo. Para ejecutar el frontend basta con los recursos exportados incluidos en el repositorio y los comandos de npm anteriores. Tras cambiar el GLB, vuelve a generar `dist/` con `npm run build`.

## Recorrido interior del piloto

El interior utiliza el [tour oficial de Eco Egaña Norte en Matterport](https://my.matterport.com/show/?m=yb7QwQrptqv), enlazado en la sección **Recorre Eco Egaña Norte en 360°** de la [ficha oficial del proyecto](https://www.fundamenta.cl/proyectos/eco-egana-norte/). Es un piloto amoblado de 2 dormitorios y 2 baños.

La posición del acceso en la fachada es referencial. El tour no corresponde a una unidad verificada en el piso elegido, ni demuestra disponibilidad de venta para ese piso. La selección de pisos pertenece al modelo exterior conceptual y se conserva al volver del recorrido.

Matterport es un servicio externo que necesita conexión a internet y un navegador compatible con su visor WebGL. El modo SVG simplificado del exterior no sustituye esos requisitos del interior. La pantalla ofrece instrucciones, reintento y un enlace para abrir el recorrido en otra pestaña si el visor no carga dentro de la página.

## Alcance y fuentes

Esta es una propuesta conceptual de frontend. No representa una plataforma oficial de venta ni un cotizador conectado al inventario de Fundamenta. La exploración de pisos es ilustrativa: no informa disponibilidad, precios, orientación ni unidades a la venta. Para cotizaciones y condiciones vigentes se debe consultar el sitio oficial.

- [Eco Egaña Norte — Fundamenta](https://www.fundamenta.cl/proyectos/eco-egana-norte/): Av. Irarrázaval 5651, Ñuñoa; conexión con Metro Plaza Egaña; departamentos de 1 y 2 dormitorios, desde 32 m².
- [Cotización oficial](https://www.fundamenta.cl/cotizar-proyecto/?proyecto=eco-egana-norte).
- [Agenda de visitas oficial](https://www.fundamenta.cl/agenda-tu-visita/?proyecto=eco-egana-norte).
- [Interior 3D amoblado del piloto — Matterport](https://my.matterport.com/show/?m=yb7QwQrptqv), publicado desde la ficha oficial de Eco Egaña Norte.
- [`public/assets/sources.json`](public/assets/sources.json) registra las URLs de origen de los recursos visuales descargados del sitio de Fundamenta. Las marcas e imágenes pertenecen a sus respectivos titulares; no se concede una licencia adicional sobre esos recursos.

Los datos del proyecto se verificaron el 25 de noviembre de 2026 y pueden cambiar. El frontend no recoge datos personales ni envía formularios a un backend propio.

## GitHub Pages

La rama `gh-pages` contiene la web compilada, incluyendo imágenes y el modelo GLB.
No requiere un workflow de despliegue propio. Configuración del repositorio:
**Settings → Pages → Source: Deploy from a branch → Branch: gh-pages → /(root) → Save**.

Para construir futuras versiones con la ruta de Pages:

```sh
GITHUB_PAGES=true npm run build
```

El contenido de `dist/` se publica en la raíz de `gh-pages`, incluyendo un archivo
`.nojekyll`. El desarrollo local conserva la ruta raíz `/`.
