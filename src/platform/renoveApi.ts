/**
 * Capa de datos del frontend contra la FastAPI del agente.
 *
 * Expone los datos con las MISMAS formas (`ren_*`) que usan las páginas
 * portadas de la Power App Code Pages, de modo que las vistas son idénticas
 * a las páginas genux y solo cambia esta capa. El contrato REST que consume
 * está documentado en `frontend/API_CONTRACT.md` — es lo que el backend debe
 * implementar.
 */

// ---------- Valores de choice (idénticos a los enums de Dataverse) ----------

export const QC_OK = 100000000;
export const QC_FAIL_CLOSED = 100000001;
export const ORIGEN_MANUAL = 100000000;
export const ORIGEN_IA = 100000001;

export const TIPO_NUMERICA = 100000000;
export const TIPO_CATEGORICA = 100000001;
export const TIPO_FECHA = 100000002;
export const TIPO_IDENTIFICADOR = 100000003;

const TIPO_FROM_API: Record<string, number> = {
  numerica: TIPO_NUMERICA,
  categorica: TIPO_CATEGORICA,
  fecha: TIPO_FECHA,
  identificador: TIPO_IDENTIFICADOR,
};
const TIPO_TO_API: Record<number, string> = {
  [TIPO_NUMERICA]: "numerica",
  [TIPO_CATEGORICA]: "categorica",
  [TIPO_FECHA]: "fecha",
  [TIPO_IDENTIFICADOR]: "identificador",
};

export const GRUPO_BASE = 100000000;
const GRUPO_KEYS = [
  "identificacion_geografia",
  "equipo_router",
  "senal_cobertura",
  "degradacion_wifi",
  "uso_dispositivos",
  "comercial_valor",
  "vivienda",
  "atencion_tickets",
  "satisfaccion",
  "metadatos_fechas",
] as const;
const GRUPO_FROM_API: Record<string, number> = Object.fromEntries(
  GRUPO_KEYS.map((k, i) => [k, GRUPO_BASE + i]),
);
const GRUPO_TO_API: Record<number, string> = Object.fromEntries(
  GRUPO_KEYS.map((k, i) => [GRUPO_BASE + i, k]),
);

// ---------- Formas de fila (idénticas a las páginas genux) ----------

export interface CatalogRow {
  ren_variablecatalogoid: string;
  ren_nombre?: string;
  ren_tipo?: number;
  ren_grupo?: number;
  ren_descripcion?: string;
  ren_pctnulos?: number;
  ren_enscoring?: boolean;
}

export interface WeightTerm {
  variable: string;
  peso: number;
  direction: string;
}

export interface ConfigRow {
  ren_configuracionscoringid: string;
  ren_nombre?: string;
  ren_linaje?: string;
  ren_version?: number;
  ren_enproduccion?: boolean;
  "ren_enproduccion@OData.Community.Display.V1.FormattedValue"?: string;
  ren_hashplan?: string;
  ren_numterminos?: number;
  ren_origen?: number;
  "ren_origen@OData.Community.Display.V1.FormattedValue"?: string;
  ren_descripcion?: string;
  ren_pesos?: string;
  createdon?: string;
}

export interface EjecucionRow {
  ren_ejecucionid: string;
  ren_numero?: string;
  ren_fecha?: string;
  "ren_fecha@OData.Community.Display.V1.FormattedValue"?: string;
  ren_estadoqc?: number;
  "ren_estadoqc@OData.Community.Display.V1.FormattedValue"?: string;
  ren_clientesevaluados?: number;
  ren_topk?: number;
  ren_eficiencia?: number;
  ren_cobertura?: number;
  ren_lift?: number;
  ren_informeia?: string;
  ren_propuestaaceptada?: boolean;
  _ren_configuracionid_value?: string;
  _ren_snapshotid_value?: string;
}

export interface RankingRow {
  ren_entradarankingid: string;
  ren_posicion?: number;
  ren_cliente?: string;
  ren_score?: number;
  ren_motivo?: string;
  ren_segmento?: string;
}

export interface SnapshotRow {
  ren_snapshotmrdid: string;
  ren_nombrearchivo?: string;
  ren_fecha?: string;
  ren_filas?: number;
  ren_estado?: number;
}

// ---------- Transporte ----------

const BASE = "/api";

async function http<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const data = (await res.json()) as { detail?: string };
      if (data?.detail) detail = String(data.detail);
    } catch {
      /* cuerpo no JSON */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------- DTOs del contrato REST ----------

interface ApiVariable {
  id: string;
  nombre: string;
  tipo: string;
  grupo: string | null;
  descripcion: string | null;
  pct_nulos: number | null;
  en_scoring: boolean;
}

interface ApiConfig {
  id: string;
  nombre: string;
  linaje: string;
  version: number;
  en_produccion: boolean;
  hash_plan: string | null;
  num_terminos: number;
  origen: string;
  descripcion: string | null;
  pesos: WeightTerm[];
  created_on: string;
}

interface ApiRun {
  id: string;
  numero: string;
  fecha: string;
  estado_qc: string;
  clientes_evaluados: number;
  top_k: number;
  eficiencia: number;
  cobertura: number;
  lift: number;
  informe_ia: string | null;
  propuesta_aceptada: boolean;
  configuracion_id: string | null;
  snapshot_id: string | null;
}

interface ApiRankingEntry {
  id: string;
  posicion: number;
  cliente: string;
  score: number;
  motivo: string | null;
  segmento: string | null;
}

interface ApiSnapshot {
  id: string;
  nombre_archivo: string;
  fecha: string;
  filas: number;
  estado: string;
}

// ---------- Mapeos ----------

const fmtFecha = (iso: string | undefined): string | undefined => {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function toCatalogRow(v: ApiVariable): CatalogRow {
  return {
    ren_variablecatalogoid: v.id,
    ren_nombre: v.nombre,
    ren_tipo: TIPO_FROM_API[v.tipo],
    ren_grupo: v.grupo != null ? GRUPO_FROM_API[v.grupo] : undefined,
    ren_descripcion: v.descripcion ?? undefined,
    ren_pctnulos: v.pct_nulos ?? undefined,
    ren_enscoring: v.en_scoring,
  };
}

function toConfigRow(c: ApiConfig): ConfigRow {
  return {
    ren_configuracionscoringid: c.id,
    ren_nombre: c.nombre,
    ren_linaje: c.linaje,
    ren_version: c.version,
    ren_enproduccion: c.en_produccion,
    "ren_enproduccion@OData.Community.Display.V1.FormattedValue": c.en_produccion ? "Sí" : "No",
    ren_hashplan: c.hash_plan ?? undefined,
    ren_numterminos: c.num_terminos,
    ren_origen: c.origen === "ia" ? ORIGEN_IA : ORIGEN_MANUAL,
    "ren_origen@OData.Community.Display.V1.FormattedValue": c.origen === "ia" ? "Propuesta IA" : "Manual",
    ren_descripcion: c.descripcion ?? undefined,
    ren_pesos: JSON.stringify(c.pesos ?? []),
    createdon: c.created_on,
  };
}

function toEjecucionRow(r: ApiRun): EjecucionRow {
  const qc = r.estado_qc === "fail_closed" ? QC_FAIL_CLOSED : QC_OK;
  return {
    ren_ejecucionid: r.id,
    ren_numero: r.numero,
    ren_fecha: r.fecha,
    "ren_fecha@OData.Community.Display.V1.FormattedValue": fmtFecha(r.fecha),
    ren_estadoqc: qc,
    "ren_estadoqc@OData.Community.Display.V1.FormattedValue":
      qc === QC_FAIL_CLOSED ? "Fail-closed" : "OK",
    ren_clientesevaluados: r.clientes_evaluados,
    ren_topk: r.top_k,
    ren_eficiencia: r.eficiencia,
    ren_cobertura: r.cobertura,
    ren_lift: r.lift,
    ren_informeia: r.informe_ia ?? undefined,
    ren_propuestaaceptada: r.propuesta_aceptada,
    _ren_configuracionid_value: r.configuracion_id ?? undefined,
    _ren_snapshotid_value: r.snapshot_id ?? undefined,
  };
}

function toRankingRow(e: ApiRankingEntry): RankingRow {
  return {
    ren_entradarankingid: e.id,
    ren_posicion: e.posicion,
    ren_cliente: e.cliente,
    ren_score: e.score,
    ren_motivo: e.motivo ?? undefined,
    ren_segmento: e.segmento ?? undefined,
  };
}

function toSnapshotRow(s: ApiSnapshot): SnapshotRow {
  return {
    ren_snapshotmrdid: s.id,
    ren_nombrearchivo: s.nombre_archivo,
    ren_fecha: s.fecha,
    ren_filas: s.filas,
    ren_estado: s.estado === "procesado" ? 100000000 : 100000001,
  };
}

// ---------- API pública (lo que consumen las vistas) ----------

export async function getCatalogVariables(): Promise<CatalogRow[]> {
  const rows = await http<ApiVariable[]>("GET", "/catalogo/variables");
  return rows.map(toCatalogRow);
}

export async function createCatalogVariable(row: Partial<CatalogRow>): Promise<string> {
  const res = await http<{ id: string }>("POST", "/catalogo/variables", {
    nombre: row.ren_nombre,
    tipo: row.ren_tipo != null ? TIPO_TO_API[row.ren_tipo] : null,
    grupo: row.ren_grupo != null ? GRUPO_TO_API[row.ren_grupo] : null,
    descripcion: row.ren_descripcion ?? null,
  });
  return res.id;
}

export async function updateCatalogVariable(id: string, row: Partial<CatalogRow>): Promise<void> {
  const body: Record<string, unknown> = {};
  if ("ren_nombre" in row) body.nombre = row.ren_nombre;
  if ("ren_tipo" in row && row.ren_tipo != null) body.tipo = TIPO_TO_API[row.ren_tipo];
  if ("ren_grupo" in row) body.grupo = row.ren_grupo != null ? GRUPO_TO_API[row.ren_grupo] : null;
  if ("ren_descripcion" in row) body.descripcion = row.ren_descripcion ?? null;
  await http<void>("PATCH", `/catalogo/variables/${id}`, body);
}

export async function getConfigs(): Promise<ConfigRow[]> {
  const rows = await http<ApiConfig[]>("GET", "/configuraciones");
  return rows.map(toConfigRow);
}

/** Nueva configuración (linaje nuevo, versión 1). Devuelve el id creado. */
export async function createConfig(input: {
  nombre: string;
  pesos: WeightTerm[];
  descripcion?: string;
}): Promise<string> {
  const res = await http<{ id: string }>("POST", "/configuraciones", {
    nombre: input.nombre,
    pesos: input.pesos,
    descripcion: input.descripcion ?? null,
    origen: "manual",
  });
  return res.id;
}

/** Nueva versión dentro del linaje de la configuración {baseId}. */
export async function createConfigVersion(
  baseId: string,
  input: { pesos: WeightTerm[]; descripcion?: string },
): Promise<string> {
  const res = await http<{ id: string }>("POST", `/configuraciones/${baseId}/versiones`, {
    pesos: input.pesos,
    descripcion: input.descripcion ?? null,
    origen: "manual",
  });
  return res.id;
}

/** Marca la versión como champion (producción). El backend desmarca el resto. */
export async function setChampion(id: string): Promise<void> {
  await http<void>("POST", `/configuraciones/${id}/produccion`);
}

export async function updateConfigDescripcion(id: string, descripcion: string): Promise<void> {
  await http<void>("PATCH", `/configuraciones/${id}`, { descripcion });
}

export async function getRuns(configId?: string): Promise<EjecucionRow[]> {
  const qs = configId ? `?configuracion_id=${encodeURIComponent(configId)}` : "";
  const rows = await http<ApiRun[]>("GET", `/ejecuciones${qs}`);
  return rows.map(toEjecucionRow);
}

export async function getRanking(runId: string): Promise<RankingRow[]> {
  const rows = await http<ApiRankingEntry[]>("GET", `/ejecuciones/${runId}/ranking`);
  return rows.map(toRankingRow);
}

export async function getSnapshot(id: string): Promise<SnapshotRow> {
  const row = await http<ApiSnapshot>("GET", `/snapshots/${id}`);
  return toSnapshotRow(row);
}

/** URL de descarga directa del CSV de un snapshot (enlace <a href>). */
export function snapshotCsvUrl(id: string): string {
  return `${BASE}/snapshots/${id}/csv`;
}
