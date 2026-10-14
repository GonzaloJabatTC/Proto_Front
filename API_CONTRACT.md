# Contrato de API — Frontend Renove (Code Pages port)

Contrato REST que el backend (FastAPI) debe exponer para que el frontend de
`frontend/` funcione. El cliente está implementado en
`frontend/src/platform/renoveApi.ts`; si cambia este contrato, cambia ese
fichero en el mismo commit.

Convenciones generales:

- Base path: **`/api`** (el dev server de Vite hace proxy de `/api` a `:8000`).
- Formato: JSON UTF-8 (`Content-Type: application/json`), salvo la descarga CSV.
- Identificadores: `id` es un string opaco (UUID recomendado), minúsculas, sin llaves.
- Fechas: ISO-8601 con zona (`2026-08-27T08:03:00Z`). El frontend las formatea.
- Errores: código HTTP adecuado + cuerpo `{ "detail": "mensaje legible" }`.
  El frontend muestra `detail` tal cual al usuario.
- Códigos de éxito: `200` con cuerpo, `201` con cuerpo `{ "id": ... }` en
  creaciones, `204` sin cuerpo en mutaciones sin respuesta.
- Los arrays se devuelven **sin envoltorio** (bare array), ya ordenados como se
  indica en cada endpoint.

---

## 1. Catálogo de variables

Variables del MRD que alimentan el scoring (página **Catálogo**).

### 1.1 `GET /api/catalogo/variables`

Lista completa del catálogo. Orden: por `grupo` y después por `nombre`.

```json
[
  {
    "id": "7f3c...",
    "nombre": "wifi_desconexiones_30d",
    "tipo": "numerica",
    "grupo": "degradacion_wifi",
    "descripcion": "Nº de desconexiones WiFi en los últimos 30 días",
    "pct_nulos": 2.4,
    "en_scoring": true
  }
]
```

| Campo | Tipo | Notas |
| --- | --- | --- |
| `id` | string | Identificador estable de la variable. |
| `nombre` | string | Nombre técnico (único). |
| `tipo` | enum | `numerica` \| `categorica` \| `fecha` \| `identificador`. |
| `grupo` | enum \| null | Ver tabla de grupos más abajo. `null` ⇒ "Otros". |
| `descripcion` | string \| null | Texto libre. |
| `pct_nulos` | number \| null | Porcentaje de nulos 0–100 en el último snapshot. |
| `en_scoring` | boolean | Si la configuración champion la usa actualmente. |

Grupos admitidos (`grupo`):

`identificacion_geografia`, `equipo_router`, `senal_cobertura`,
`degradacion_wifi`, `uso_dispositivos`, `comercial_valor`, `vivienda`,
`atencion_tickets`, `satisfaccion`, `metadatos_fechas`.

### 1.2 `POST /api/catalogo/variables`

Alta de variable. Cuerpo:

```json
{ "nombre": "...", "tipo": "numerica", "grupo": "vivienda", "descripcion": "..." }
```

- `nombre` y `tipo` obligatorios; `grupo` y `descripcion` pueden ser `null`.
- Respuesta: `201` + `{ "id": "<nuevo-id>" }`.
- `409` si ya existe una variable con ese `nombre`.

### 1.3 `PATCH /api/catalogo/variables/{id}`

Edición parcial (solo llegan los campos modificados, mismas claves que el POST).
Respuesta: `204`. `404` si el id no existe.

> `pct_nulos` y `en_scoring` son **calculados por el backend** — el frontend
> nunca los envía.

---

## 2. Configuraciones de scoring

Librería inmutable y versionada (página **Configuración**). Un `linaje` agrupa
versiones con el mismo nombre; **exactamente una** versión de toda la librería
es la champion (`en_produccion = true`).

### 2.1 `GET /api/configuraciones`

Todas las versiones de todas las configuraciones. Orden: `created_on`
descendente.

```json
[
  {
    "id": "a1b2...",
    "nombre": "Adrian_v1",
    "linaje": "lin-9f27",
    "version": 4,
    "en_produccion": true,
    "hash_plan": "sha256:...",
    "num_terminos": 7,
    "origen": "manual",
    "descripcion": "Prioriza desconexiones y reinicios",
    "pesos": [
      { "variable": "wifi_desconexiones_30d", "peso": 2, "direction": "direct" }
    ],
    "created_on": "2026-08-27T08:03:00Z"
  }
]
```

| Campo | Tipo | Notas |
| --- | --- | --- |
| `nombre` | string | Común a todas las versiones del linaje. |
| `linaje` | string | Id de linaje (no se muestra al usuario). |
| `version` | int | Correlativa dentro del linaje (1, 2, 3…). |
| `en_produccion` | boolean | Champion. Solo una en toda la librería. |
| `hash_plan` | string \| null | Hash determinista del plan. |
| `num_terminos` | int | Nº de términos de `pesos`. |
| `origen` | enum | `manual` \| `ia` (propuesta del analista LLM aceptada). |
| `descripcion` | string \| null | Editable en cualquier momento (no versiona). |
| `pesos` | array | Términos: `variable` (nombre del catálogo), `peso` (number), `direction` (`direct` \| `inverse`). |

### 2.2 `POST /api/configuraciones`

Nueva configuración (linaje nuevo, versión 1). Cuerpo:

```json
{ "nombre": "...", "pesos": [ ... ], "descripcion": null, "origen": "manual" }
```

- Respuesta: `201` + `{ "id": "<nuevo-id>" }`.
- `409` si ya existe un linaje con ese `nombre`.
- La nueva versión **no** es champion.

### 2.3 `POST /api/configuraciones/{id}/versiones`

Nueva versión dentro del linaje de la configuración `{id}` (cualquier versión
del linaje sirve como base). Cuerpo:

```json
{ "pesos": [ ... ], "descripcion": null, "origen": "manual" }
```

- Respuesta: `201` + `{ "id": "<id-de-la-nueva-versión>" }`.
- `version` la asigna el backend (máx. del linaje + 1). No es champion.

### 2.4 `POST /api/configuraciones/{id}/produccion`

Promociona `{id}` a champion. **Atómico en el backend**: marca `{id}` y
desmarca el resto, garantizando que siempre hay exactamente una champion.
Respuesta: `204`. `404` si no existe.

> No hay endpoint para "quitar de producción" sin promover otra: la regla de
> negocio es que siempre exista una champion.

### 2.5 `PATCH /api/configuraciones/{id}`

Único campo mutable de una versión (la librería es inmutable en todo lo demás):

```json
{ "descripcion": "texto libre" }
```

Respuesta: `204`.

---

## 3. Ejecuciones

Historial de pases del motor de scoring (página **Ejecución**).

### 3.1 `GET /api/ejecuciones`

Query params opcionales:

- `configuracion_id`: filtra las ejecuciones puntuadas por esa versión
  (lo usa la página Configuración para su tabla de "Ejecuciones recientes").

Orden: `fecha` descendente.

```json
[
  {
    "id": "64ec...",
    "numero": "RUN-00003",
    "fecha": "2026-08-27T08:03:00Z",
    "estado_qc": "ok",
    "clientes_evaluados": 41310,
    "top_k": 500,
    "eficiencia": 0.76,
    "cobertura": 0.47,
    "lift": 7.4,
    "informe_ia": "La eficiencia sube 5 puntos tras...",
    "propuesta_aceptada": false,
    "configuracion_id": "a1b2...",
    "snapshot_id": "c3d4..."
  }
]
```

| Campo | Tipo | Notas |
| --- | --- | --- |
| `numero` | string | Código visible `RUN-00001`, `RUN-00002`… |
| `estado_qc` | enum | `ok` \| `fail_closed`. Las fail-closed se devuelven también (sin ranking). |
| `eficiencia`, `cobertura` | number | 0–1. |
| `lift` | number | ≥ 0. |
| `informe_ia` | string \| null | Comentario del analista LLM post-ejecución. |
| `propuesta_aceptada` | boolean | Si la propuesta del informe IA se guardó como versión. |
| `configuracion_id` | string \| null | Versión de configuración que puntuó. |
| `snapshot_id` | string \| null | Snapshot MRD leído. |

### 3.2 `GET /api/ejecuciones/{id}/ranking`

Top-K publicado de la ejecución. Orden: `posicion` ascendente. Para una
ejecución fail-closed: `200` + `[]`.

```json
[
  {
    "id": "e5f6...",
    "posicion": 1,
    "cliente": "CL-004812",
    "score": 93.4,
    "motivo": "Desconexiones WiFi recurrentes + router antiguo",
    "segmento": "Residencial fibra"
  }
]
```

---

## 4. Snapshots MRD

### 4.1 `GET /api/snapshots/{id}`

Metadatos del snapshot de una ejecución.

```json
{
  "id": "c3d4...",
  "nombre_archivo": "mrd_2026-08-27.csv",
  "fecha": "2026-08-27T00:00:00Z",
  "filas": 41310,
  "estado": "procesado"
}
```

`estado`: `procesado` \| `error` (cualquier otro valor se trata como no
procesado).

### 4.2 `GET /api/snapshots/{id}/csv`

Descarga directa del CSV original.

- Respuesta: `200`, `Content-Type: text/csv; charset=utf-8`,
  `Content-Disposition: attachment; filename="<nombre_archivo>"`.
- El frontend lo enlaza directamente (`<a href>`), sin fetch intermedio.

---

## 5. Resumen de endpoints

| Método | Ruta | Uso en el frontend |
| --- | --- | --- |
| GET | `/api/catalogo/variables` | Página Catálogo (listado) |
| POST | `/api/catalogo/variables` | Catálogo — añadir variable |
| PATCH | `/api/catalogo/variables/{id}` | Catálogo — editar variable |
| GET | `/api/configuraciones` | Configuración — listado maestro |
| POST | `/api/configuraciones` | Configuración — "Nueva configuración" |
| POST | `/api/configuraciones/{id}/versiones` | Configuración — "Guardar como nueva versión" |
| POST | `/api/configuraciones/{id}/produccion` | Configuración — "Poner en producción" |
| PATCH | `/api/configuraciones/{id}` | Configuración — guardar descripción |
| GET | `/api/ejecuciones` | Ejecución — listado; Configuración — runs por versión |
| GET | `/api/ejecuciones/{id}/ranking` | Ejecución — detalle del run |
| GET | `/api/snapshots/{id}` | Ejecución — metadatos del snapshot |
| GET | `/api/snapshots/{id}/csv` | Ejecución — descarga del CSV |

Correspondencia orientativa con la API actual del servicio (para reutilizar
lógica existente): `/api/catalog` (catálogo), `/api/scorings` +
`/api/scorings/champion` (configuraciones y champion), `/api/runs` +
`/api/runs/{id}` + `/api/runs/{id}/export` (ejecuciones y ranking),
`data/runs/` (snapshots). Los endpoints de este contrato pueden implementarse
como adaptadores finos sobre esos componentes; lo que el frontend requiere es
exactamente lo descrito arriba.
