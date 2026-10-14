import { useState } from "react";
import {
  Avatar,
  Button,
  Input,
  Menu,
  MenuButton,
  MenuItemRadio,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Tooltip,
} from "@fluentui/react-components";
import type { MenuProps } from "@fluentui/react-components";
import {
  DatabaseRegular,
  GridDotsRegular,
  HistoryRegular,
  HomeRegular,
  NavigationRegular,
  OptionsRegular,
  PlayCircleRegular,
  QuestionCircleRegular,
  SearchRegular,
} from "@fluentui/react-icons";
import type { JSX } from "react";
import { AREAS } from "./appMap";
import { CatalogoView } from "./views/CatalogoView";
import { ConfiguracionView } from "./views/ConfiguracionView";
import { EjecucionView } from "./views/EjecucionView";
import { PlaceholderView } from "./views/PlaceholderView";
import { logoMark } from "./components/Brand";

/** Icono de cada pagina del sitemap (subarea en la model-driven app). */
const PAGE_ICONS: Record<string, JSX.Element> = {
  config: <OptionsRegular />,
  catalog: <DatabaseRegular />,
  execution: <HistoryRegular />,
  home: <HomeRegular />,
};

export default function App() {
  const [areaId, setAreaId] = useState<string>("renove");
  const [pageByArea, setPageByArea] = useState<Record<string, string>>({});
  const [navOpen, setNavOpen] = useState(true);
  // Run solicitado desde Configuración (click en una ejecución del historial).
  const [requestedRunId, setRequestedRunId] = useState<string | null>(null);

  const area = AREAS.find((a) => a.id === areaId) ?? AREAS[0];
  const pageId = pageByArea[area.id] ?? area.pages[0].id;
  const page = area.pages.find((p) => p.id === pageId) ?? area.pages[0];

  const openPage = (nextPageId: string) => {
    // Navegación manual: olvida el run solicitado desde Configuración.
    if (nextPageId !== "execution") setRequestedRunId(null);
    setPageByArea((prev) => ({ ...prev, [area.id]: nextPageId }));
  };

  const openRun = (runId: string) => {
    setRequestedRunId(runId);
    setPageByArea((prev) => ({ ...prev, renove: "execution" }));
    setAreaId("renove");
  };

  const onAreaChange: MenuProps["onCheckedValueChange"] = (_e, { checkedItems }) => {
    const next = checkedItems[0];
    if (next) setAreaId(next);
  };

  const content =
    area.id === "renove" ? (
      page.id === "config" ? (
        <ConfiguracionView onOpenRun={openRun} />
      ) : page.id === "catalog" ? (
        <CatalogoView />
      ) : (
        <EjecucionView requestedRunId={requestedRunId} />
      )
    ) : (
      <PlaceholderView area={area} />
    );

  return (
    <div className="md-shell">
      {/* Barra superior de la app (cabecera de la model-driven app). */}
      <header className="md-topbar">
        <div className="md-topbar-left">
          <Tooltip content="Aplicaciones" relationship="label">
            <Button
              appearance="transparent"
              icon={<GridDotsRegular />}
              className="md-topbar-btn"
              aria-label="Aplicaciones"
            />
          </Tooltip>
          <img className="md-topbar-logo" src={logoMark} alt="" />
          <span className="md-topbar-title">Gestión Proactiva WiFi</span>
          <span className="md-topbar-area">{area.label}</span>
        </div>
        <div className="md-topbar-search">
          <Input
            appearance="filled-lighter"
            contentBefore={<SearchRegular />}
            placeholder="Buscar"
            aria-label="Buscar"
            disabled
          />
        </div>
        <div className="md-topbar-right">
          <Tooltip content="Ayuda" relationship="label">
            <Button
              appearance="transparent"
              icon={<QuestionCircleRegular />}
              className="md-topbar-btn"
              aria-label="Ayuda"
            />
          </Tooltip>
          <Avatar name="Negocio Renove" size={28} color="colorful" />
        </div>
      </header>

      <div className="md-body">
        {/* Sitemap: paginas del area activa + selector de area al pie. */}
        <nav className={navOpen ? "md-sitemap" : "md-sitemap collapsed"}>
          <div className="md-sitemap-top">
            <Tooltip content={navOpen ? "Contraer" : "Expandir"} relationship="label">
              <Button
                appearance="subtle"
                icon={<NavigationRegular />}
                aria-label={navOpen ? "Contraer navegación" : "Expandir navegación"}
                onClick={() => setNavOpen((v) => !v)}
              />
            </Tooltip>
          </div>
          <div className="md-sitemap-pages">
            {navOpen && <div className="md-sitemap-group">{area.label}</div>}
            {area.pages.map((p) => {
              const item = (
                <button
                  key={p.id}
                  type="button"
                  className={p.id === page.id ? "md-nav-item selected" : "md-nav-item"}
                  onClick={() => openPage(p.id)}
                >
                  <span className="md-nav-icon">{PAGE_ICONS[p.id] ?? <PlayCircleRegular />}</span>
                  {navOpen && <span className="md-nav-label">{p.label}</span>}
                </button>
              );
              return navOpen ? (
                item
              ) : (
                <Tooltip key={p.id} content={p.label} relationship="label" positioning="after">
                  {item}
                </Tooltip>
              );
            })}
          </div>
          <div className="md-sitemap-footer">
            <Menu
              checkedValues={{ area: [area.id] }}
              onCheckedValueChange={(e, data) =>
                data.name === "area" ? onAreaChange(e, data) : undefined
              }
            >
              <MenuTrigger disableButtonEnhancement>
                <MenuButton appearance="subtle" className="md-area-switcher">
                  {navOpen ? area.label : area.label.charAt(0)}
                </MenuButton>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  {AREAS.map((a) => (
                    <MenuItemRadio key={a.id} name="area" value={a.id}>
                      {a.label}
                    </MenuItemRadio>
                  ))}
                </MenuList>
              </MenuPopover>
            </Menu>
          </div>
        </nav>

        <main className="md-content">
          <div className="md-page-header">
            <h1>{page.label}</h1>
            <p className="muted">{area.description}</p>
          </div>
          {content}
        </main>
      </div>
    </div>
  );
}
