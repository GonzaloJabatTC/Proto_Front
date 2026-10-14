import type { ReactNode } from "react";

/**
 * "Sitemap" de la solucion, calcado del modelo de las model-driven apps de
 * Power Platform: la solucion tiene **areas** (las 3 iniciativas, se cambian
 * con el selector de area al pie de la barra lateral) y cada area tiene
 * **paginas** (subareas del sitemap). Cuando esto se lleve a una model-driven
 * app real, cada area es un Area del sitemap y cada pagina una Subarea.
 */
export interface AppPage {
  id: string;
  label: string;
}

export interface AppArea {
  id: string;
  label: string;
  description: string;
  pages: AppPage[];
}

export const AREAS: AppArea[] = [
  {
    id: "renove",
    label: "Priorización Renove",
    description:
      "Motor de scoring determinista y explicable. Configura los criterios, guarda versiones inmutables y revisa cada ejecución con el análisis posterior del agente.",
    pages: [
      { id: "catalog", label: "Catálogo" },
      { id: "config", label: "Configuración" },
      { id: "execution", label: "Ejecución" },
    ],
  },
  {
    id: "proactivas",
    label: "Acciones Proactivas",
    description: "Gestión proactiva de acciones sobre la base de clientes.",
    pages: [{ id: "home", label: "Inicio" }],
  },
  {
    id: "anomalias",
    label: "Detección de Anomalías",
    description: "Detección y seguimiento de anomalías en la red WiFi.",
    pages: [{ id: "home", label: "Inicio" }],
  },
];

export type AreaId = (typeof AREAS)[number]["id"];

export interface PageRenderProps {
  areaId: string;
  pageId: string;
}

export type PageRenderer = (props: PageRenderProps) => ReactNode;
