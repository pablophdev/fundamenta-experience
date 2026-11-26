# Backend de visitas compartidas

Función HTTP de Neon con estado durable en Lakebase Postgres. No necesita registro de visitantes: el enlace incluye una capacidad aleatoria de 192 bits para entrar a la sala. Cualquier persona con el enlace puede ver y modificar su configuración. Se comparten únicamente ajustes del interior y otros estados de la experiencia; no se solicitan nombres ni datos personales.

## Infraestructura

- Proyecto dedicado: `fundamenta-shared-visits` (`steep-resonance-42894516`).
- Región: `aws-us-east-1`, cuenta Free existente.
- Runtime: Node.js 24 en Neon Functions.
- Función: `sharedvisits`.
- `DATABASE_URL`: variable inyectada por Neon, solo en el servidor. No se añade al frontend ni al repositorio.

Aplicar [`schema.sql`](schema.sql) en este proyecto antes del primer despliegue. No modifica las tablas de otros proyectos. Empaquetar `index.mjs` en la raíz de un ZIP y desplegarlo con Neon Functions; no necesita dependencias ni compilación. La URL pública devuelve `/health` y las rutas siguientes.

El backend usa el protocolo HTTP del [driver oficial de Neon](https://github.com/neondatabase/serverless/blob/main/index.mjs) y SQL con parámetros, sin concatenar datos del usuario. Referencias: [driver HTTP](https://neon.com/docs/serverless/serverless-driver), [deploy de Functions](https://neon.com/docs/compute/functions/deploy).

## Contrato

Todas las solicitudes POST usan `Content-Type: application/json`. `clientId` es un UUID aleatorio propio de cada pestaña/dispositivo. Las salas duran 24 horas.

| Método y ruta | JSON de entrada | Resultado |
| --- | --- | --- |
| `GET /health` | — | `{ok, service, version}` |
| `POST /visits` | `{clientId, state}` | Snapshot de sala nueva, HTTP 201 |
| `POST /visits/:id/sync` | `{clientId, knownVersion, state?}` | Snapshot y presencia; omitir `state` para solo consultar/heartbeat |
| `POST /visits/:id/leave` | `{clientId}` | `{ok: true}` |

Las rutas de una sala requieren `Authorization: Bearer :id`. El snapshot contiene `{visitId, version, state, author, participantCount, expiresAt}`. El estado solo cambia si se envía `state` y difiere del almacenado; gana la última edición confirmada por la base de datos. `knownVersion` es informativa para el cliente, no una comparación condicional de escritura.

La presencia cuenta heartbeats de los últimos 20 segundos. Una salida explícita elimina el participante; si se interrumpe la conexión, deja de contar al expirar ese intervalo. Las solicitudes simultáneas de una sala se serializan con un bloqueo de fila para asegurar estados y límites consistentes. No hay un estado de conexión exitoso basado únicamente en abrir el enlace.

## Límites

- Máximo 6 participantes activos por sala, 500 salas vigentes y 30 creaciones de sala por minuto en total.
- Cuerpo JSON máximo 16 KiB y validación de profundidad, cantidad de claves y tipos serializables.
- Las salas caducadas se purgan al crear la siguiente sala; sus participantes se borran en cascada.
- CORS permite orígenes HTTPS `*.vercel.app`, `pablophdev.github.io` y desarrollo HTTP en `localhost:3000`/`127.0.0.1:3000`. Devuelve el origen exacto, nunca `*`.
- HTTP 404 para sala inexistente, 410 para caducada todavía presente, 409 para sala llena, 429 para límite de creación y 503 para fallos de servicio. Las respuestas no contienen SQL ni credenciales.

La autorización de una sala reside en el enlace y debe reservarse para ajustes no sensibles. CORS limita el acceso desde páginas en navegadores; no sustituye la autorización ni una protección de volumen en el borde. El límite global de salas y payloads evita crecimiento ilimitado de esta demostración.
