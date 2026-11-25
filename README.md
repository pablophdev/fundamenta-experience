# Fundamenta Experience

Frontend en React, TypeScript y Vite que presenta Eco Egaña Norte con una experiencia arquitectónica interactiva inspirada en [el reel de referencia](https://www.instagram.com/reel/DgJoF00t0N8/). Usa los logos y renders oficiales de Fundamenta, incluyendo vistas diurna y al atardecer.

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

Pruebas de interacción: `npm test` (iluminación, espacios, galería, explorador, teclado y foco).

El resultado se genera en `dist/`. No se necesitan claves ni variables de entorno para usar el frontend.

## Despliegue en Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/pablophdev/fundamenta-experience)

El repositorio incluye un Blueprint en [`render.yaml`](render.yaml). El botón abre la configuración de Render; el sitio se publica cuando se autoriza y completa ese despliegue en la cuenta de Render.

También puedes crear un **Static Site** en Render, conectar este repositorio y configurar:

| Campo | Valor |
| --- | --- |
| Build command | `npm ci && npm run build` |
| Publish directory | `dist` |
| Node.js | `22` |
| Rewrite | `/*` → `/index.html` |

El Blueprint habilita el despliegue automático al recibir commits. GitHub Actions comprueba que el frontend se construya en los pushes a `main` y en las pull requests.

Documentación oficial: [Static Sites](https://render.com/docs/static-sites) y [Blueprint YAML Reference](https://render.com/docs/blueprint-spec).

## Alcance y fuentes

Esta es una propuesta conceptual de frontend. No representa una plataforma oficial de venta ni un cotizador conectado al inventario de Fundamenta. La exploración de pisos es ilustrativa: no informa disponibilidad, precios, orientación ni unidades a la venta. Para cotizaciones y condiciones vigentes se debe consultar el sitio oficial.

- [Eco Egaña Norte — Fundamenta](https://www.fundamenta.cl/proyectos/eco-egana-norte/): Av. Irarrázaval 5651, Ñuñoa; conexión con Metro Plaza Egaña; departamentos de 1 y 2 dormitorios, desde 32 m².
- [Cotización oficial](https://www.fundamenta.cl/cotizar-proyecto/?proyecto=eco-egana-norte).
- [Agenda de visitas oficial](https://www.fundamenta.cl/agenda-tu-visita/?proyecto=eco-egana-norte).
- [`public/assets/sources.json`](public/assets/sources.json) registra las URLs de origen de los recursos visuales descargados del sitio de Fundamenta. Las marcas e imágenes pertenecen a sus respectivos titulares; no se concede una licencia adicional sobre esos recursos.

Los datos del proyecto se verificaron el 25 de noviembre de 2026 y pueden cambiar. El frontend no recoge datos personales ni envía formularios a un backend propio.
