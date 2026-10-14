# Proto_Front

Prototipo de frontend de **Priorizacion Renove** (fase 1, offline).

React 18 + TypeScript + Vite + Fluent UI v9. Replica la Power App de Code Pages.

## Desarrollo

```
npm install
npm run dev     # http://localhost:5173 (proxy /api -> http://localhost:8000)
npm run build   # tsc -b && vite build
```

El backend FastAPI vive en el repo [1.1-Priorizacion_Renove](https://github.com/GonzaloJabatTC/1.1-Priorizacion_Renove). El contrato de datos que consume este front esta en `API_CONTRACT.md`.

`mock.html` es una demo autocontenida con datos estaticos (no necesita backend).
