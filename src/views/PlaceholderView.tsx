import type { AppArea } from "../appMap";

interface Props {
  area: AppArea;
}

/** Area aun sin contenido: mantiene la estructura mientras llega su alcance. */
export function PlaceholderView({ area }: Props) {
  return (
    <div className="work-main">
      <section className="panel empty">
        <h2>{area.label}</h2>
        <p className="muted">
          Esta área forma parte de la solución de Gestión Proactiva WiFi. Su contenido se definirá
          próximamente.
        </p>
      </section>
    </div>
  );
}
