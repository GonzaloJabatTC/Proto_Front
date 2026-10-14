# Proto_Front

Prototipo de frontend de **Priorizacion Renove** (fase 1, offline).

React 18 + TypeScript + Vite + Fluent UI v9. Replica la Power App de Code Pages.

## Desarrollo

```
npm install
npm run dev     # http://localhost:5173 (proxy /api -> http://localhost:8000)
npm run build   # tsc -b && vite build
```

El backend FastAPI vive en el repo [TEF-b2c-IN1-Proto_Back](https://github.com/GonzaloJabatTC/TEF-b2c-IN1-Proto_Back). El contrato de datos que consume este front esta en `API_CONTRACT.md` (descripcion legible) y en `contracts/openapi.json` (contrato formal OpenAPI).

`mock.html` es una demo autocontenida con datos estaticos (no necesita backend).

## Para desarrolladores: tipos desde el contrato de API

La fuente de verdad de la API es **`contracts/openapi.json`**, exportado por el
backend (`uv run python scripts/export_openapi.py` en Proto_Back). De el se
generan los tipos TypeScript — **no escribas tipos de la API a mano**:

```
npm run api:types        # regenera src/platform/apiTypes.ts desde contracts/openapi.json
npm run api:types:live   # idem, pero desde el backend corriendo en :8000
```

**Flujo cuando el back cambia la API:**

1. El equipo de back regenera y commitea `contracts/openapi.json` en su repo
   (su PR muestra el diff del contrato — ese es el aviso).
2. Copia aqui el contrato actualizado (`contracts/openapi.json`) o usa
   `npm run api:types:live` con el backend nuevo arrancado.
3. Ejecuta `npm run api:types` y despues `npm run build`: si el cambio fue
   destructivo (campo renombrado/eliminado), `tsc` falla en cada uso roto y
   ahi esta la lista exacta de lo que hay que adaptar.
4. Commitea juntos `contracts/openapi.json`, `src/platform/apiTypes.ts` y las
   adaptaciones de codigo.

Reglas: los cambios **aditivos** (campos/endpoints nuevos) no requieren tocar
nada aqui; los **destructivos** deben coordinarse con el back antes de mergear.
El cliente HTTP vive en `src/platform/renoveApi.ts`; al adaptar un cambio,
importa los tipos generados de `src/platform/apiTypes.ts` en lugar de
duplicarlos.
