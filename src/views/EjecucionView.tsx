import { useEffect, useState } from 'react';
import {
    makeStyles,
    tokens,
    Text,
    Badge,
    Spinner,
    ProgressBar,
    Table,
    TableHeader,
    TableHeaderCell,
    TableBody,
    TableRow as FluentTableRow,
    TableCell,
    MessageBar,
    MessageBarBody,
    Input,
    Button,
    Label,
} from '@fluentui/react-components';
import {
    PlayCircleRegular,
    DatabaseRegular,
    DocumentTextRegular,
    CheckmarkCircleRegular,
    DismissCircleRegular,
    ShieldErrorRegular,
    SearchRegular,
    ArrowDownloadRegular,
    DataHistogramRegular,
} from '@fluentui/react-icons';
import {
    getRuns,
    getRanking,
    getSnapshot,
    QC_OK,
    QC_FAIL_CLOSED,
} from '../platform/renoveApi';
import type { EjecucionRow, RankingRow, SnapshotRow } from '../platform/renoveApi';

// ---------------------------------------------------------------------------
// Panel de ejecución — replica ExecutionView: lista de ejecuciones con badges
// QC, tarjetas KPI, Informe IA, información de snapshot y tabla de ranking
// (con estado fail-closed). Solo lectura.
// ---------------------------------------------------------------------------

// ---------- Formatting helpers ----------

function getFormatted(row: object, column: string): string | undefined {
    const value = (row as Record<string, unknown>)[
        `${column}@OData.Community.Display.V1.FormattedValue`
    ];
    return typeof value === 'string' ? value : undefined;
}

function extractGuid(fkValue: string | undefined): string | undefined {
    if (!fkValue) return undefined;
    const match = /\(([0-9a-fA-F-]{36})\)/.exec(fkValue);
    if (match) return match[1];
    // Plain GUID fallback
    return /^[0-9a-fA-F-]{36}$/.test(fkValue) ? fkValue : undefined;
}

function formatDate(row: object, column: string): string {
    const formatted = getFormatted(row, column);
    if (formatted) return formatted;
    const raw = (row as Record<string, unknown>)[column];
    if (typeof raw === 'string' && raw) {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) {
            return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
        }
    }
    return '—';
}

function formatPercent(value: number | undefined): string {
    if (value === undefined || value === null || isNaN(value)) return '—';
    return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number | undefined): string {
    if (value === undefined || value === null || isNaN(value)) return '—';
    return new Intl.NumberFormat('es-ES').format(value);
}

function scoreColor(score: number): string {
    if (score >= 70) return '#107c10';
    if (score >= 40) return '#c19c00';
    return '#c42b1c';
}

// ---------- Styles ----------

const useStyles = makeStyles({
    root: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'row',
        gap: tokens.spacingHorizontalL,
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: tokens.spacingHorizontalL,
        backgroundColor: '#f5f5f5',
        fontFamily: "'Segoe UI', sans-serif",
        overflow: 'hidden',
        '@media (max-width: 768px)': {
            flexDirection: 'column',
            overflow: 'auto',
            height: 'auto',
        },
    },
    runListPanel: {
        display: 'flex',
        flexDirection: 'column',
        width: '640px',
        flexShrink: 0,
        backgroundColor: '#ffffff',
        borderTopWidth: '1px',
        borderRightWidth: '1px',
        borderBottomWidth: '1px',
        borderLeftWidth: '1px',
        borderTopStyle: 'solid',
        borderRightStyle: 'solid',
        borderBottomStyle: 'solid',
        borderLeftStyle: 'solid',
        borderTopColor: '#e0e0e0',
        borderRightColor: '#e0e0e0',
        borderBottomColor: '#e0e0e0',
        borderLeftColor: '#e0e0e0',
        borderTopLeftRadius: '4px',
        borderTopRightRadius: '4px',
        borderBottomLeftRadius: '4px',
        borderBottomRightRadius: '4px',
        overflow: 'hidden',
        '@media (max-width: 768px)': {
            width: '100%',
            maxHeight: '320px',
        },
    },
    runListHeader: {
        padding: tokens.spacingHorizontalM,
        borderBottomWidth: '1px',
        borderBottomStyle: 'solid',
        borderBottomColor: '#e0e0e0',
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
    },
    runListScroll: {
        overflowY: 'auto',
        flexGrow: 1,
    },
    runListFilters: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalS,
        padding: tokens.spacingHorizontalM,
        borderBottomWidth: '1px',
        borderBottomStyle: 'solid',
        borderBottomColor: '#e0e0e0',
        backgroundColor: '#fafafa',
    },
    runListDateRow: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
        flexWrap: 'wrap',
    },
    dateField: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalXS,
    },
    runItem: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalXS,
        width: '100%',
        boxSizing: 'border-box',
        padding: tokens.spacingHorizontalM,
        textAlign: 'left',
        backgroundColor: 'transparent',
        borderTopWidth: 0,
        borderRightWidth: 0,
        borderLeftWidth: 0,
        borderBottomWidth: '1px',
        borderBottomStyle: 'solid',
        borderBottomColor: '#f0f0f0',
        cursor: 'pointer',
        fontFamily: 'inherit',
        ':hover': { backgroundColor: '#f7f7f7' },
        ':focus-visible': {
            outlineWidth: '2px',
            outlineStyle: 'solid',
            outlineColor: tokens.colorBrandStroke1,
            outlineOffset: '-2px',
        },
    },
    runItemSelected: {
        backgroundColor: '#eff6fc',
        ':hover': { backgroundColor: '#eff6fc' },
    },
    runItemTopRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: tokens.spacingHorizontalS,
    },
    runNumero: {
        fontWeight: tokens.fontWeightSemibold,
        fontSize: tokens.fontSizeBase300,
        color: '#242424',
    },
    runMeta: {
        fontSize: tokens.fontSizeBase200,
        color: '#616161',
    },
    detailColumn: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalL,
        flexGrow: 1,
        minWidth: 0,
        overflowY: 'auto',
        paddingRight: tokens.spacingHorizontalXS,
    },
    detailHeader: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: tokens.spacingHorizontalS,
    },
    card: {
        backgroundColor: '#ffffff',
        borderTopWidth: '1px',
        borderRightWidth: '1px',
        borderBottomWidth: '1px',
        borderLeftWidth: '1px',
        borderTopStyle: 'solid',
        borderRightStyle: 'solid',
        borderBottomStyle: 'solid',
        borderLeftStyle: 'solid',
        borderTopColor: '#e0e0e0',
        borderRightColor: '#e0e0e0',
        borderBottomColor: '#e0e0e0',
        borderLeftColor: '#e0e0e0',
        borderTopLeftRadius: '4px',
        borderTopRightRadius: '4px',
        borderBottomLeftRadius: '4px',
        borderBottomRightRadius: '4px',
        padding: tokens.spacingHorizontalL,
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalS,
        boxSizing: 'border-box',
    },
    cardTitle: {
        fontSize: tokens.fontSizeBase300,
        fontWeight: tokens.fontWeightSemibold,
        color: '#242424',
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
    },
    kpiRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: tokens.spacingHorizontalM,
    },
    kpiCard: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: '160px',
        backgroundColor: '#ffffff',
        borderTopWidth: '1px',
        borderRightWidth: '1px',
        borderBottomWidth: '1px',
        borderLeftWidth: '1px',
        borderTopStyle: 'solid',
        borderRightStyle: 'solid',
        borderBottomStyle: 'solid',
        borderLeftStyle: 'solid',
        borderTopColor: '#e0e0e0',
        borderRightColor: '#e0e0e0',
        borderBottomColor: '#e0e0e0',
        borderLeftColor: '#e0e0e0',
        borderTopLeftRadius: '4px',
        borderTopRightRadius: '4px',
        borderBottomLeftRadius: '4px',
        borderBottomRightRadius: '4px',
        padding: tokens.spacingHorizontalM,
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalXS,
        boxSizing: 'border-box',
    },
    kpiLabel: {
        fontSize: tokens.fontSizeBase200,
        color: '#616161',
    },
    kpiValue: {
        fontSize: tokens.fontSizeHero700,
        fontWeight: tokens.fontWeightSemibold,
        color: '#242424',
    },
    mono: {
        fontFamily: "ui-monospace, 'Cascadia Code', Consolas, monospace",
        fontSize: tokens.fontSizeBase200,
    },
    helperText: {
        fontSize: tokens.fontSizeBase200,
        color: '#616161',
    },
    informeTexto: {
        fontSize: tokens.fontSizeBase300,
        color: '#242424',
        whiteSpace: 'pre-wrap',
        lineHeight: tokens.lineHeightBase300,
    },
    snapshotGrid: {
        display: 'flex',
        flexWrap: 'wrap',
        columnGap: tokens.spacingHorizontalXXL,
        rowGap: tokens.spacingVerticalS,
    },
    snapshotField: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        minWidth: '140px',
    },
    failClosedCard: {
        backgroundColor: '#fdf3f4',
        borderTopWidth: '1px',
        borderRightWidth: '1px',
        borderBottomWidth: '1px',
        borderLeftWidth: '1px',
        borderTopStyle: 'solid',
        borderRightStyle: 'solid',
        borderBottomStyle: 'solid',
        borderLeftStyle: 'solid',
        borderTopColor: '#eeacb2',
        borderRightColor: '#eeacb2',
        borderBottomColor: '#eeacb2',
        borderLeftColor: '#eeacb2',
        borderTopLeftRadius: '4px',
        borderTopRightRadius: '4px',
        borderBottomLeftRadius: '4px',
        borderBottomRightRadius: '4px',
        padding: tokens.spacingHorizontalXL,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: tokens.spacingVerticalS,
        textAlign: 'center',
    },
    failClosedTitle: {
        fontSize: tokens.fontSizeBase400,
        fontWeight: tokens.fontWeightSemibold,
        color: '#b10e1c',
    },
    failClosedIcon: {
        fontSize: '32px',
        color: '#b10e1c',
    },
    scoreCell: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
    },
    tableWrap: {
        overflowX: 'auto',
    },
    centered: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: tokens.spacingVerticalM,
        padding: tokens.spacingVerticalXXL,
        flexGrow: 1,
    },
    progressRow: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalXS,
    },
    informeMdBody: {
        backgroundColor: '#fafafa',
        borderTopWidth: '1px',
        borderRightWidth: '1px',
        borderBottomWidth: '1px',
        borderLeftWidth: '1px',
        borderTopStyle: 'solid',
        borderRightStyle: 'solid',
        borderBottomStyle: 'solid',
        borderLeftStyle: 'solid',
        borderTopColor: '#e0e0e0',
        borderRightColor: '#e0e0e0',
        borderBottomColor: '#e0e0e0',
        borderLeftColor: '#e0e0e0',
        borderTopLeftRadius: '4px',
        borderTopRightRadius: '4px',
        borderBottomLeftRadius: '4px',
        borderBottomRightRadius: '4px',
        padding: tokens.spacingHorizontalM,
        fontSize: tokens.fontSizeBase300,
        color: '#242424',
        lineHeight: tokens.lineHeightBase300,
        whiteSpace: 'pre-wrap',
        fontFamily: "'Segoe UI', sans-serif",
    },
    informeActions: {
        display: 'flex',
        gap: tokens.spacingHorizontalS,
        flexWrap: 'wrap',
    },
    informeChartWrap: {
        display: 'flex',
        justifyContent: 'center',
        overflowX: 'auto',
    },
});

// ---------- QC badge ----------

interface QcBadgeProps {
    estadoQc: number | undefined;
    label: string | undefined;
}

const QcBadge = (props: QcBadgeProps) => {
    const { estadoQc, label } = props;
    if (estadoQc === QC_OK) {
        return (
            <Badge appearance="tint" color="success" shape="rounded">
                {label ?? 'OK'}
            </Badge>
        );
    }
    if (estadoQc === QC_FAIL_CLOSED) {
        return (
            <Badge appearance="tint" color="danger" shape="rounded">
                {label ?? 'Fail-closed'}
            </Badge>
        );
    }
    return (
        <Badge appearance="tint" color="warning" shape="rounded">
            {label ?? 'Advertencias'}
        </Badge>
    );
};

// ---------- Circular score indicator ----------

interface ScoreGaugeProps {
    score: number;
}

const ScoreGauge = (props: ScoreGaugeProps) => {
    const { score } = props;
    const clamped = Math.max(0, Math.min(100, score));
    const radius = 12;
    const circumference = 2 * Math.PI * radius;
    const dash = (clamped / 100) * circumference;
    const color = scoreColor(clamped);
    return (
        <svg
            width="30"
            height="30"
            viewBox="0 0 30 30"
            role="img"
            aria-label={`Score ${clamped.toFixed(0)} de 100`}
        >
            <circle cx="15" cy="15" r={radius} fill="none" stroke="#e0e0e0" strokeWidth="3" />
            <circle
                cx="15"
                cy="15"
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference - dash}`}
                transform="rotate(-90 15 15)"
            />
        </svg>
    );
};

// ---------- Informe de ejecución (ejemplo generado por el motor Python) ----------

const HIST_BINS = ['0-10', '10-20', '20-30', '30-40', '40-50', '50-60', '60-70', '70-80', '80+'];
const HIST_VALUES = [2, 5, 10, 17, 21, 18, 12, 6, 3];

interface InformeChartProps {
    runLabel: string;
}

const InformeChart = (props: InformeChartProps) => {
    const { runLabel } = props;
    const width = 620;
    const height = 300;
    const baseY = 260;
    const maxVal = Math.max(...HIST_VALUES);
    const barW = 52;
    const gap = 10;
    const left = 40;
    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`Distribución de scores de ${runLabel}`}
            style={{ maxWidth: '100%', height: 'auto' }}
        >
            <text x={width / 2} y={22} textAnchor="middle" fontSize={14} fontWeight={600} fill="#242424">
                Distribución de scores — {runLabel}
            </text>
            {HIST_VALUES.map((v, i) => {
                const h = (v / maxVal) * 190;
                const x = left + i * (barW + gap);
                return (
                    <g key={HIST_BINS[i]}>
                        <rect x={x} y={baseY - h} width={barW} height={h} fill="#0f6cbd" rx={2} />
                        <text
                            x={x + barW / 2}
                            y={baseY + 16}
                            textAnchor="middle"
                            fontSize={11}
                            fill="#616161"
                        >
                            {HIST_BINS[i]}
                        </text>
                    </g>
                );
            })}
            <line x1={left - 8} y1={baseY} x2={width - 10} y2={baseY} stroke="#616161" strokeWidth={1} />
            <line
                x1={left + 4 * (barW + gap) + barW / 2}
                y1={40}
                x2={left + 4 * (barW + gap) + barW / 2}
                y2={baseY}
                stroke="#c50f1f"
                strokeDasharray="4 3"
            />
            <text x={left + 4 * (barW + gap) + barW / 2 + 6} y={52} fontSize={11} fill="#c50f1f">
                corte top-K
            </text>
        </svg>
    );
};

function buildInformeMd(
    run: EjecucionRow,
    configName: string,
    snapshotName: string | undefined,
): string {
    const pct = (v: number | undefined) => (v !== undefined && v !== null ? `${(v * 100).toFixed(0)} %` : '—');
    return [
        `# Informe post-ejecución — ${run.ren_numero ?? 'ejecución'}`,
        '',
        `**Configuración:** ${configName} · **Snapshot:** ${snapshotName ?? '—'} · **Top-K:** ${run.ren_topk ?? '—'}`,
        '',
        '## KPIs',
        '',
        '| KPI | Valor |',
        '|---|---|',
        `| Eficiencia | ${pct(run.ren_eficiencia)} |`,
        `| Cobertura | ${pct(run.ren_cobertura)} |`,
        `| Lift | ${run.ren_lift !== undefined && run.ren_lift !== null ? `${run.ren_lift.toFixed(2)}×` : '—'} |`,
        `| Clientes evaluados | ${run.ren_clientesevaluados ?? '—'} |`,
        '',
        '## Lectura del analista',
        '',
        run.ren_informeia ??
            'El corte del top-K cae en el tramo central de la distribución: la lista publicada captura toda la cola alta de scores.',
        '',
        '## Distribución de scores',
        '',
        '![Distribución de scores](./distribucion_scores.svg)',
        '',
        '_Informe generado automáticamente por el motor de scoring (Python)._',
    ].join('\n');
}

function downloadFile(filename: string, content: string, mime: string): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildChartSvgMarkup(runLabel: string): string {
    const maxVal = Math.max(...HIST_VALUES);
    const bars = HIST_VALUES.map((v, i) => {
        const h = (v / maxVal) * 190;
        const x = 40 + i * 62;
        return (
            `<rect x="${x}" y="${260 - h}" width="52" height="${h}" fill="#0f6cbd" rx="2"/>` +
            `<text x="${x + 26}" y="276" text-anchor="middle" font-size="11" fill="#616161">${HIST_BINS[i]}</text>`
        );
    }).join('');
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" width="620" height="300" font-family="Segoe UI, sans-serif" style="background:white">` +
        `<text x="310" y="22" text-anchor="middle" font-size="14" font-weight="600" fill="#242424">Distribución de scores — ${runLabel}</text>` +
        bars +
        `<line x1="32" y1="260" x2="610" y2="260" stroke="#616161" stroke-width="1"/>` +
        `</svg>`
    );
}

// ---------- Main component ----------

interface RunsState {
    runs: EjecucionRow[];
    loading: boolean;
    error: string | null;
}

interface DetailState {
    runId: string | null;
    ranking: RankingRow[];
    snapshot: SnapshotRow | null;
    loading: boolean;
    error: string | null;
}

export function EjecucionView(props: { requestedRunId?: string | null }): JSX.Element {
    const requestedRunId = props.requestedRunId ?? null;
    const styles = useStyles();

    const [selectedRunId, setSelectedRunId] = useState<string | null>(requestedRunId);
    const [searchText, setSearchText] = useState('');
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');

    const [{ runs, loading, error }, setRunsState] = useState<RunsState>({
        runs: [],
        loading: true,
        error: null,
    });

    const [detail, setDetail] = useState<DetailState>({
        runId: null,
        ranking: [],
        snapshot: null,
        loading: false,
        error: null,
    });

    // ----- Fetch run list on mount -----
    useEffect(() => {
        let cancelled = false;
        getRuns()
            .then((rows) => {
                if (!cancelled) setRunsState({ runs: rows, loading: false, error: null });
            })
            .catch(() => {
                if (!cancelled)
                    setRunsState({
                        runs: [],
                        loading: false,
                        error: 'No se pudieron cargar las ejecuciones. Inténtalo de nuevo.',
                    });
            });
        return () => {
            cancelled = true;
        };
    }, []);

    // ----- React al deep-link si requestedRunId cambia tras el montaje -----
    useEffect(() => {
        if (requestedRunId) setSelectedRunId(requestedRunId);
    }, [requestedRunId]);

    // ----- Auto-select: run pedido por navegación o el más reciente -----
    useEffect(() => {
        if (runs.length === 0) return;
        if (selectedRunId && runs.some((r) => r.ren_ejecucionid === selectedRunId)) return;
        setSelectedRunId(runs[0].ren_ejecucionid);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [runs, selectedRunId]);

    const selectedRun = runs.find((r) => r.ren_ejecucionid === selectedRunId) ?? null;
    const isFailClosed = selectedRun?.ren_estadoqc === QC_FAIL_CLOSED;
    const snapshotId = extractGuid(selectedRun?._ren_snapshotid_value);

    // ----- Fetch ranking + snapshot for the selected run -----
    useEffect(() => {
        if (!selectedRunId || !selectedRun) return;
        const runId = selectedRunId;
        const failClosed = selectedRun.ren_estadoqc === QC_FAIL_CLOSED;
        const snapId = extractGuid(selectedRun._ren_snapshotid_value);
        let cancelled = false;

        setDetail({ runId, ranking: [], snapshot: null, loading: true, error: null });

        // Ranking fetch (skipped for fail-closed runs — ranking not published)
        const rankingPromise: Promise<RankingRow[]> = failClosed
            ? Promise.resolve([])
            : getRanking(runId);

        // Snapshot fetch via lookup
        const snapshotPromise: Promise<SnapshotRow | null> = snapId
            ? getSnapshot(snapId)
            : Promise.resolve(null);

        Promise.allSettled([rankingPromise, snapshotPromise]).then(([rankingResult, snapshotResult]) => {
            if (cancelled) return;
            const ranking = rankingResult.status === 'fulfilled' ? rankingResult.value : [];
            const snapshot = snapshotResult.status === 'fulfilled' ? snapshotResult.value : null;
            const anyFailed =
                rankingResult.status === 'rejected' || snapshotResult.status === 'rejected';
            setDetail({
                runId,
                ranking,
                snapshot,
                loading: false,
                error: anyFailed ? 'No se pudo cargar parte del detalle de la ejecución.' : null,
            });
        });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedRunId, selectedRun]);

    // ----- Early returns (all hooks are above this point) -----

    if (loading) {
        return (
            <div className={styles.root}>
                <div className={styles.centered} role="status" aria-live="polite">
                    <Spinner label="Cargando ejecuciones…" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.root}>
                <div className={styles.centered}>
                    <MessageBar intent="error">
                        <MessageBarBody>{error}</MessageBarBody>
                    </MessageBar>
                </div>
            </div>
        );
    }

    if (runs.length === 0) {
        return (
            <div className={styles.root}>
                <div className={styles.centered}>
                    <PlayCircleRegular style={{ fontSize: '32px', color: '#616161' }} />
                    <Text className={styles.helperText}>
                        Todavía no hay ejecuciones de scoring registradas.
                    </Text>
                </div>
            </div>
        );
    }

    const detailForSelected = detail.runId === selectedRunId ? detail : null;
    const propuestaAceptada = selectedRun?.ren_propuestaaceptada === true;

    // ----- Lista filtrada (texto + rango de fechas) -----
    const search = searchText.trim().toLowerCase();
    const filteredRuns = runs.filter((run) => {
        if (search) {
            const haystack = [
                run.ren_numero,
                getFormatted(run, '_ren_configuracionid_value'),
                getFormatted(run, 'ren_estadoqc'),
                formatDate(run, 'ren_fecha'),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        if ((fechaDesde || fechaHasta) && typeof run.ren_fecha === 'string' && run.ren_fecha) {
            const iso = run.ren_fecha.slice(0, 10);
            if (fechaDesde && iso < fechaDesde) return false;
            if (fechaHasta && iso > fechaHasta) return false;
        } else if (fechaDesde || fechaHasta) {
            return false;
        }
        return true;
    });

    const selectedConfigName =
        (selectedRun ? getFormatted(selectedRun, '_ren_configuracionid_value') : undefined) ??
        'Configuración desconocida';
    const informeMd = selectedRun
        ? buildInformeMd(
              selectedRun,
              selectedConfigName,
              detailForSelected?.snapshot?.ren_nombrearchivo,
          )
        : '';

    return (
        <div className={styles.root}>
            {/* ----- Left: run list ----- */}
            <nav className={styles.runListPanel} aria-label="Lista de ejecuciones">
                <div className={styles.runListHeader}>
                    <PlayCircleRegular aria-hidden="true" />
                    <Text weight="semibold">Ejecuciones</Text>
                    <Badge appearance="tint" color="informative" shape="rounded">
                        {filteredRuns.length}
                    </Badge>
                </div>
                <div className={styles.runListFilters}>
                    <Input
                        contentBefore={<SearchRegular aria-hidden="true" />}
                        placeholder="Buscar por nº de run, configuración o estado…"
                        value={searchText}
                        onChange={(_, data) => setSearchText(data.value)}
                        aria-label="Buscar ejecuciones"
                    />
                    <div className={styles.runListDateRow}>
                        <div className={styles.dateField}>
                            <Label size="small" htmlFor="run-fecha-desde">
                                Desde
                            </Label>
                            <Input
                                id="run-fecha-desde"
                                type="date"
                                size="small"
                                value={fechaDesde}
                                onChange={(_, data) => setFechaDesde(data.value)}
                                aria-label="Filtrar desde fecha"
                            />
                        </div>
                        <div className={styles.dateField}>
                            <Label size="small" htmlFor="run-fecha-hasta">
                                Hasta
                            </Label>
                            <Input
                                id="run-fecha-hasta"
                                type="date"
                                size="small"
                                value={fechaHasta}
                                onChange={(_, data) => setFechaHasta(data.value)}
                                aria-label="Filtrar hasta fecha"
                            />
                        </div>
                        {(searchText || fechaDesde || fechaHasta) && (
                            <Button
                                appearance="subtle"
                                size="small"
                                onClick={() => {
                                    setSearchText('');
                                    setFechaDesde('');
                                    setFechaHasta('');
                                }}
                            >
                                Limpiar
                            </Button>
                        )}
                    </div>
                </div>
                <div className={styles.runListScroll} role="listbox" aria-label="Seleccionar ejecución">
                    {filteredRuns.length === 0 && (
                        <Text
                            className={styles.helperText}
                            style={{ display: 'block', padding: '16px' }}
                        >
                            Ninguna ejecución coincide con los filtros.
                        </Text>
                    )}
                    {filteredRuns.map((run) => {
                        const isSelected = run.ren_ejecucionid === selectedRunId;
                        const configName =
                            getFormatted(run, '_ren_configuracionid_value') ?? 'Configuración desconocida';
                        return (
                            <button
                                key={run.ren_ejecucionid}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                className={`${styles.runItem} ${isSelected ? styles.runItemSelected : ''}`}
                                onClick={() => setSelectedRunId(run.ren_ejecucionid)}
                            >
                                <span className={styles.runItemTopRow}>
                                    <span className={styles.runNumero}>{run.ren_numero ?? '—'}</span>
                                    <QcBadge
                                        estadoQc={run.ren_estadoqc}
                                        label={getFormatted(run, 'ren_estadoqc')}
                                    />
                                </span>
                                <span className={styles.runMeta}>{formatDate(run, 'ren_fecha')}</span>
                                <span className={styles.runMeta}>{configName}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>

            {/* ----- Right: selected run detail ----- */}
            <main className={styles.detailColumn} aria-label="Detalle de la ejecución seleccionada">
                {!selectedRun ? (
                    <div className={styles.centered}>
                        <Text className={styles.helperText}>
                            Selecciona una ejecución para ver su detalle.
                        </Text>
                    </div>
                ) : (
                    <>
                        <div className={styles.detailHeader}>
                            <Text size={500} weight="semibold">
                                {selectedRun.ren_numero ?? 'Ejecución'}
                            </Text>
                            <QcBadge
                                estadoQc={selectedRun.ren_estadoqc}
                                label={getFormatted(selectedRun, 'ren_estadoqc')}
                            />
                            <Text className={styles.helperText}>
                                {formatDate(selectedRun, 'ren_fecha')} ·{' '}
                                {getFormatted(selectedRun, '_ren_configuracionid_value') ??
                                    'Configuración desconocida'}
                            </Text>
                        </div>

                        {/* KPI cards */}
                        <section className={styles.kpiRow} aria-label="Indicadores clave de la ejecución">
                            <div className={styles.kpiCard}>
                                <Text className={styles.kpiLabel}>Clientes evaluados</Text>
                                <Text className={styles.kpiValue}>
                                    {formatNumber(selectedRun.ren_clientesevaluados)}
                                </Text>
                            </div>
                            <div className={styles.kpiCard}>
                                <Text className={styles.kpiLabel}>Top-K</Text>
                                <Text className={styles.kpiValue}>
                                    {formatNumber(selectedRun.ren_topk)}
                                </Text>
                            </div>
                            <div className={styles.kpiCard}>
                                <Text className={styles.kpiLabel}>Eficiencia</Text>
                                <Text className={styles.kpiValue}>
                                    {formatPercent(selectedRun.ren_eficiencia)}
                                </Text>
                                <div className={styles.progressRow}>
                                    <ProgressBar
                                        value={Math.max(0, Math.min(1, selectedRun.ren_eficiencia ?? 0))}
                                        aria-label={`Eficiencia ${formatPercent(selectedRun.ren_eficiencia)}`}
                                    />
                                </div>
                            </div>
                            <div className={styles.kpiCard}>
                                <Text className={styles.kpiLabel}>Cobertura</Text>
                                <Text className={styles.kpiValue}>
                                    {formatPercent(selectedRun.ren_cobertura)}
                                </Text>
                                <div className={styles.progressRow}>
                                    <ProgressBar
                                        value={Math.max(0, Math.min(1, selectedRun.ren_cobertura ?? 0))}
                                        aria-label={`Cobertura ${formatPercent(selectedRun.ren_cobertura)}`}
                                    />
                                </div>
                            </div>
                            <div className={styles.kpiCard}>
                                <Text className={styles.kpiLabel}>Lift</Text>
                                <Text className={styles.kpiValue}>
                                    {selectedRun.ren_lift !== undefined && selectedRun.ren_lift !== null
                                        ? `${selectedRun.ren_lift.toFixed(2)}×`
                                        : '—'}
                                </Text>
                            </div>
                        </section>

                        {/* Informe IA */}
                        <section className={styles.card} aria-label="Informe IA post-ejecución">
                            <div className={styles.cardTitle}>
                                <DocumentTextRegular aria-hidden="true" />
                                <span>Informe IA (post-ejecución)</span>
                                {propuestaAceptada ? (
                                    <Badge
                                        appearance="tint"
                                        color="success"
                                        shape="rounded"
                                        icon={<CheckmarkCircleRegular />}
                                    >
                                        Propuesta aceptada
                                    </Badge>
                                ) : (
                                    <Badge
                                        appearance="tint"
                                        color="subtle"
                                        shape="rounded"
                                        icon={<DismissCircleRegular />}
                                    >
                                        Propuesta no aceptada
                                    </Badge>
                                )}
                            </div>
                            {selectedRun.ren_informeia ? (
                                <Text className={styles.informeTexto}>{selectedRun.ren_informeia}</Text>
                            ) : (
                                <Text className={styles.helperText}>
                                    No hay informe IA disponible para esta ejecución.
                                </Text>
                            )}
                        </section>

                        {/* Informe del motor Python (ejemplo) */}
                        <section
                            className={styles.card}
                            aria-label="Informe de la ejecución generado por el motor de scoring"
                        >
                            <div className={styles.cardTitle}>
                                <DataHistogramRegular aria-hidden="true" />
                                <span>Informe de la ejecución (motor Python)</span>
                                <Badge appearance="tint" color="brand" shape="rounded">
                                    ejemplo
                                </Badge>
                            </div>
                            <Text className={styles.helperText}>
                                Resumen, gráfica y descargas del informe que genera el pipeline de
                                scoring para cada ejecución.
                            </Text>
                            <div className={styles.informeMdBody}>{informeMd}</div>
                            <div className={styles.informeChartWrap}>
                                <InformeChart runLabel={selectedRun.ren_numero ?? 'ejecución'} />
                            </div>
                            <div className={styles.informeActions}>
                                <Button
                                    appearance="secondary"
                                    icon={<ArrowDownloadRegular />}
                                    onClick={() =>
                                        downloadFile(
                                            `informe_${(selectedRun.ren_numero ?? 'run').toLowerCase()}.md`,
                                            informeMd,
                                            'text/markdown',
                                        )
                                    }
                                >
                                    Descargar informe (.md)
                                </Button>
                                <Button
                                    appearance="secondary"
                                    icon={<ArrowDownloadRegular />}
                                    onClick={() =>
                                        downloadFile(
                                            `distribucion_scores_${(selectedRun.ren_numero ?? 'run').toLowerCase()}.svg`,
                                            buildChartSvgMarkup(selectedRun.ren_numero ?? 'ejecución'),
                                            'image/svg+xml',
                                        )
                                    }
                                >
                                    Descargar gráfica (.svg)
                                </Button>
                            </div>
                        </section>

                        {/* Snapshot info */}
                        <section className={styles.card} aria-label="Información del snapshot MRD">
                            <div className={styles.cardTitle}>
                                <DatabaseRegular aria-hidden="true" />
                                <span>Snapshot MRD</span>
                            </div>
                            {detailForSelected?.loading ? (
                                <Spinner size="tiny" label="Cargando snapshot…" />
                            ) : detailForSelected?.snapshot ? (
                                <div className={styles.snapshotGrid}>
                                    <div className={styles.snapshotField}>
                                        <Text className={styles.helperText}>Nombre</Text>
                                        <Text className={styles.mono}>
                                            {detailForSelected.snapshot.ren_nombrearchivo ?? '—'}
                                        </Text>
                                    </div>
                                    <div className={styles.snapshotField}>
                                        <Text className={styles.helperText}>Fecha</Text>
                                        <Text>{formatDate(detailForSelected.snapshot, 'ren_fecha')}</Text>
                                    </div>
                                    <div className={styles.snapshotField}>
                                        <Text className={styles.helperText}>Filas</Text>
                                        <Text>{formatNumber(detailForSelected.snapshot.ren_filas)}</Text>
                                    </div>
                                    <div className={styles.snapshotField}>
                                        <Text className={styles.helperText}>Estado</Text>
                                        <Text>
                                            {getFormatted(detailForSelected.snapshot, 'ren_estado') ?? '—'}
                                        </Text>
                                    </div>
                                </div>
                            ) : (
                                <Text className={styles.helperText}>
                                    {snapshotId
                                        ? 'No se pudo cargar la información del snapshot.'
                                        : 'Esta ejecución no tiene snapshot asociado.'}
                                </Text>
                            )}
                        </section>

                        {/* Ranking / fail-closed */}
                        {isFailClosed ? (
                            <section
                                className={styles.failClosedCard}
                                role="alert"
                                aria-label="Ranking no publicado por fail-closed"
                            >
                                <ShieldErrorRegular className={styles.failClosedIcon} aria-hidden="true" />
                                <Text className={styles.failClosedTitle}>
                                    No se publicó ranking — fail-closed
                                </Text>
                                <Text className={styles.helperText}>
                                    Los controles de calidad bloquearon la publicación del ranking de esta
                                    ejecución. Revisa el estado QC y el informe IA para más detalle.
                                </Text>
                            </section>
                        ) : (
                            <section className={styles.card} aria-label="Ranking de clientes publicado">
                                <div className={styles.cardTitle}>
                                    <span>Ranking publicado</span>
                                    {detailForSelected && !detailForSelected.loading && (
                                        <Badge appearance="tint" color="informative" shape="rounded">
                                            {detailForSelected.ranking.length}
                                        </Badge>
                                    )}
                                </div>
                                {detailForSelected?.error && (
                                    <MessageBar intent="warning">
                                        <MessageBarBody>{detailForSelected.error}</MessageBarBody>
                                    </MessageBar>
                                )}
                                {detailForSelected?.loading ? (
                                    <Spinner label="Cargando ranking…" />
                                ) : detailForSelected && detailForSelected.ranking.length === 0 ? (
                                    <Text className={styles.helperText}>
                                        No hay entradas de ranking para esta ejecución.
                                    </Text>
                                ) : (
                                    <div className={styles.tableWrap}>
                                        <Table
                                            size="small"
                                            aria-label="Tabla de ranking de clientes"
                                        >
                                            <TableHeader>
                                                <FluentTableRow>
                                                    <TableHeaderCell style={{ width: '70px' }}>
                                                        Posición
                                                    </TableHeaderCell>
                                                    <TableHeaderCell style={{ width: '160px' }}>
                                                        Cliente
                                                    </TableHeaderCell>
                                                    <TableHeaderCell style={{ width: '120px' }}>
                                                        Score
                                                    </TableHeaderCell>
                                                    <TableHeaderCell>Motivo</TableHeaderCell>
                                                    <TableHeaderCell style={{ width: '130px' }}>
                                                        Segmento
                                                    </TableHeaderCell>
                                                </FluentTableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {(detailForSelected?.ranking ?? []).map((entry) => (
                                                    <FluentTableRow key={entry.ren_entradarankingid}>
                                                        <TableCell>
                                                            {entry.ren_posicion ?? '—'}
                                                        </TableCell>
                                                        <TableCell>
                                                            <span
                                                                className={styles.mono}
                                                                title={entry.ren_cliente}
                                                            >
                                                                {entry.ren_cliente ?? '—'}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className={styles.scoreCell}>
                                                                <ScoreGauge
                                                                    score={entry.ren_score ?? 0}
                                                                />
                                                                <span
                                                                    style={{
                                                                        color: scoreColor(
                                                                            entry.ren_score ?? 0,
                                                                        ),
                                                                        fontWeight: 600,
                                                                    }}
                                                                >
                                                                    {entry.ren_score !== undefined &&
                                                                    entry.ren_score !== null
                                                                        ? entry.ren_score.toFixed(1)
                                                                        : '—'}
                                                                </span>
                                                            </span>
                                                        </TableCell>
                                                        <TableCell>
                                                            <span
                                                                title={entry.ren_motivo}
                                                                style={{
                                                                    display: 'block',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap',
                                                                }}
                                                            >
                                                                {entry.ren_motivo ?? '—'}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell>
                                                            {entry.ren_segmento ? (
                                                                <Badge
                                                                    appearance="tint"
                                                                    color="informative"
                                                                    shape="rounded"
                                                                >
                                                                    {entry.ren_segmento}
                                                                </Badge>
                                                            ) : (
                                                                '—'
                                                            )}
                                                        </TableCell>
                                                    </FluentTableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </section>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
