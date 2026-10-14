import { useEffect, useMemo, useState } from 'react';
import {
    makeStyles,
    mergeClasses,
    tokens,
    Text,
    Badge,
    Button,
    Input,
    Textarea,
    Spinner,
    MessageBar,
    MessageBarBody,
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHeaderCell,
    TableCell,
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
    Field,
    Dropdown,
    Option,
} from '@fluentui/react-components';
import {
    ChevronDownRegular,
    ChevronRightRegular,
    ArrowUpRegular,
    ArrowDownRegular,
    SaveRegular,
    AddRegular,
    DismissRegular,
    CheckmarkCircleRegular,
    SearchRegular,
} from '@fluentui/react-icons';
import {
    getConfigs,
    getRuns,
    getCatalogVariables,
    setChampion,
    updateConfigDescripcion,
    createConfig,
    createConfigVersion,
    QC_OK,
    QC_FAIL_CLOSED,
    ORIGEN_MANUAL,
} from '../platform/renoveApi';
import type { ConfigRow, EjecucionRow, WeightTerm } from '../platform/renoveApi';

// ---------------------------------------------------------------------------
// Página: Configuración de scoring (ConfigDetailView)
// Master-detail: configuraciones agrupadas por linaje, detalle de versión con
// fórmula de ponderación y "Guardar como nueva versión" (inmutable).
// ---------------------------------------------------------------------------

interface EditableWeight {
    variable: string;
    pesoText: string;
    direction: string;
}

// The API returns booleans as true/false; some hosts surface them as 1/0.
const isEnProduccion = (v: unknown): boolean => v === true || v === 1;

// ---------- Utilities ----------

function parseWeights(pesos: string | null | undefined): WeightTerm[] | null {
    if (!pesos) return null;
    try {
        const parsed = JSON.parse(pesos) as unknown;
        const items = Array.isArray(parsed)
            ? parsed
            : (parsed as { weights?: unknown })?.weights;
        if (!Array.isArray(items)) return null;
        const out: WeightTerm[] = [];
        for (const item of items) {
            const w = item as { variable?: unknown; peso?: unknown; direction?: unknown };
            if (typeof w.variable === 'string' && typeof w.peso === 'number' && Number.isFinite(w.peso)) {
                out.push({
                    variable: w.variable,
                    peso: w.peso,
                    direction: typeof w.direction === 'string' ? w.direction : '',
                });
            }
        }
        return out.length > 0 ? out : null;
    } catch {
        return null;
    }
}

function formatPercent(value: number | undefined | null, digits = 1): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    return `${(value * 100).toFixed(digits)} %`;
}

function formatFecha(row: EjecucionRow): string {
    const formatted = row['ren_fecha@OData.Community.Display.V1.FormattedValue'];
    if (formatted) return formatted;
    if (row.ren_fecha) {
        const d = new Date(row.ren_fecha);
        if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('es-ES');
    }
    return '—';
}

// ---------- Styles ----------

const useStyles = makeStyles({
    root: {
        position: 'relative',
        contain: 'layout',
        display: 'flex',
        flexDirection: 'row',
        gap: tokens.spacingHorizontalL,
        height: '100%',
        width: '100%',
        boxSizing: 'border-box',
        padding: tokens.spacingHorizontalXL,
        backgroundColor: '#f5f5f5',
        color: tokens.colorNeutralForeground1,
        overflow: 'hidden',
        '@media (max-width: 768px)': {
            flexDirection: 'column',
            overflowY: 'auto',
        },
    },
    masterPanel: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalM,
        width: '640px',
        minWidth: '400px',
        flexShrink: 0,
        overflowY: 'auto',
        paddingRight: tokens.spacingHorizontalXS,
        '@media (max-width: 768px)': {
            width: '100%',
            maxHeight: '40%',
        },
    },
    masterFilters: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalXS,
    },
    rowClickable: {
        cursor: 'pointer',
    },
    descActions: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: tokens.spacingHorizontalS,
    },
    detailPanel: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalL,
        flexGrow: 1,
        minWidth: 0,
        overflowY: 'auto',
        paddingRight: tokens.spacingHorizontalXS,
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
        boxSizing: 'border-box',
    },
    pageTitle: {
        fontSize: tokens.fontSizeBase600,
        fontWeight: tokens.fontWeightSemibold,
        lineHeight: tokens.lineHeightBase600,
    },
    sectionTitle: {
        fontSize: tokens.fontSizeBase400,
        fontWeight: tokens.fontWeightSemibold,
        lineHeight: tokens.lineHeightBase400,
    },
    mutedText: {
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase200,
    },
    mono: {
        fontFamily: "ui-monospace, 'Cascadia Code', Consolas, monospace",
        fontSize: tokens.fontSizeBase200,
    },
    lineageHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
        width: '100%',
        backgroundColor: 'transparent',
        borderTopWidth: 0,
        borderRightWidth: 0,
        borderBottomWidth: 0,
        borderLeftWidth: 0,
        cursor: 'pointer',
        padding: tokens.spacingVerticalXS,
        textAlign: 'left',
        color: tokens.colorNeutralForeground1,
        fontFamily: tokens.fontFamilyBase,
        fontSize: tokens.fontSizeBase300,
        fontWeight: tokens.fontWeightSemibold,
        ':hover': { backgroundColor: tokens.colorNeutralBackground1Hover },
        ':focus-visible': {
            outlineWidth: '2px',
            outlineStyle: 'solid',
            outlineColor: tokens.colorBrandStroke1,
        },
    },
    lineageTitle: { flexGrow: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    versionItem: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
        width: '100%',
        backgroundColor: 'transparent',
        borderTopWidth: 0,
        borderRightWidth: 0,
        borderBottomWidth: 0,
        borderLeftWidth: 0,
        cursor: 'pointer',
        paddingTop: tokens.spacingVerticalS,
        paddingBottom: tokens.spacingVerticalS,
        paddingLeft: tokens.spacingHorizontalXL,
        paddingRight: tokens.spacingHorizontalS,
        textAlign: 'left',
        color: tokens.colorNeutralForeground1,
        fontFamily: tokens.fontFamilyBase,
        fontSize: tokens.fontSizeBase300,
        borderTopLeftRadius: '4px',
        borderTopRightRadius: '4px',
        borderBottomLeftRadius: '4px',
        borderBottomRightRadius: '4px',
        ':hover': { backgroundColor: tokens.colorNeutralBackground1Hover },
        ':focus-visible': {
            outlineWidth: '2px',
            outlineStyle: 'solid',
            outlineColor: tokens.colorBrandStroke1,
        },
    },
    versionItemSelected: {
        backgroundColor: tokens.colorBrandBackground2,
        ':hover': { backgroundColor: tokens.colorBrandBackground2 },
    },
    versionName: { flexGrow: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    summaryGrid: {
        display: 'grid',
        gridTemplateColumns: 'minmax(120px, max-content) 1fr',
        rowGap: tokens.spacingVerticalS,
        columnGap: tokens.spacingHorizontalL,
        marginTop: tokens.spacingVerticalM,
    },
    summaryLabel: {
        color: tokens.colorNeutralForeground2,
        fontWeight: tokens.fontWeightSemibold,
        fontSize: tokens.fontSizeBase200,
    },
    weightRow: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalM,
        paddingTop: tokens.spacingVerticalS,
        paddingBottom: tokens.spacingVerticalS,
        borderBottomWidth: '1px',
        borderBottomStyle: 'solid',
        borderBottomColor: '#f0f0f0',
        flexWrap: 'wrap',
    },
    weightPct: {
        width: '64px',
        flexShrink: 0,
        fontWeight: tokens.fontWeightSemibold,
        fontVariantNumeric: 'tabular-nums',
    },
    weightVariable: {
        width: '180px',
        minWidth: '120px',
        flexShrink: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    weightDirection: {
        width: '24px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        color: tokens.colorNeutralForeground2,
    },
    weightBarTrack: {
        flexGrow: 1,
        minWidth: '80px',
        height: '8px',
        backgroundColor: '#f0f0f0',
        borderTopLeftRadius: '4px',
        borderTopRightRadius: '4px',
        borderBottomLeftRadius: '4px',
        borderBottomRightRadius: '4px',
        overflow: 'hidden',
    },
    weightBarFill: {
        display: 'block',
        height: '100%',
        backgroundColor: tokens.colorBrandBackground,
        borderTopLeftRadius: '4px',
        borderTopRightRadius: '4px',
        borderBottomLeftRadius: '4px',
        borderBottomRightRadius: '4px',
    },
    weightInput: {
        width: '96px',
        flexShrink: 0,
    },
    cardHeaderRow: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalM,
        flexWrap: 'wrap',
    },
    headerSpacer: { flexGrow: 1 },
    spinnerWrap: {
        display: 'flex',
        justifyContent: 'center',
        padding: tokens.spacingVerticalXXL,
    },
    emptyState: {
        padding: tokens.spacingVerticalXL,
        textAlign: 'center',
        color: tokens.colorNeutralForeground3,
    },
    chipRow: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
        flexWrap: 'wrap',
    },
    tableWrap: {
        overflowX: 'auto',
        marginTop: tokens.spacingVerticalM,
    },
});

// ---------- Sub-components ----------

const QcBadge = (props: { estadoQc?: number; label?: string }) => {
    const { estadoQc, label } = props;
    if (estadoQc === QC_OK) {
        return <Badge appearance="tint" color="success">{label ?? 'OK'}</Badge>;
    }
    if (estadoQc === QC_FAIL_CLOSED) {
        return <Badge appearance="tint" color="danger">{label ?? 'Fail-closed'}</Badge>;
    }
    return <Badge appearance="tint" color="warning">{label ?? 'Advertencias'}</Badge>;
};

const WeightEditorRow = (props: {
    weight: EditableWeight;
    maxPeso: number;
    onChange: (value: string) => void;
    onToggleDirection: () => void;
    onRemove: () => void;
}) => {
    const styles = useStyles();
    const { weight, maxPeso, onChange, onToggleDirection, onRemove } = props;
    const peso = Number.parseFloat(weight.pesoText);
    const valid = Number.isFinite(peso) && peso >= 0;
    const pct = valid ? peso * 100 : 0;
    const barPct = valid && maxPeso > 0 ? Math.min(100, (peso / maxPeso) * 100) : 0;
    const dirLabel =
        weight.direction === 'higher_is_better'
            ? 'mayor es mejor'
            : weight.direction === 'lower_is_better'
            ? 'menor es mejor'
            : 'sin dirección';
    return (
        <div className={styles.weightRow}>
            <Text className={styles.weightPct}>{valid ? `${pct.toFixed(1)} %` : '—'}</Text>
            <Text className={mergeClasses(styles.mono, styles.weightVariable)} title={weight.variable}>
                {weight.variable}
            </Text>
            <Button
                appearance="subtle"
                size="small"
                className={styles.weightDirection}
                icon={weight.direction === 'higher_is_better' ? <ArrowUpRegular /> : <ArrowDownRegular />}
                onClick={onToggleDirection}
                aria-label={`Dirección de ${weight.variable}: ${dirLabel}. Pulsar para cambiar.`}
                title={`${dirLabel} — pulsar para cambiar`}
            />
            <div
                className={styles.weightBarTrack}
                role="img"
                aria-label={`Peso de ${weight.variable}: ${valid ? pct.toFixed(1) : 0} por ciento`}
            >
                <span className={styles.weightBarFill} style={{ width: `${barPct}%` }} />
            </div>
            <Input
                className={styles.weightInput}
                type="number"
                size="small"
                step={0.01}
                min={0}
                max={1}
                value={weight.pesoText}
                onChange={(_, data) => onChange(data.value)}
                aria-label={`Peso de la variable ${weight.variable}`}
            />
            <Button
                appearance="subtle"
                size="small"
                icon={<DismissRegular />}
                onClick={onRemove}
                aria-label={`Quitar la variable ${weight.variable} de la fórmula`}
                title="Quitar de la fórmula"
            />
        </div>
    );
};

// ---------- Main component ----------

export function ConfiguracionView(props: { onOpenRun: (runId: string) => void }): JSX.Element {
    const { onOpenRun } = props;
    const styles = useStyles();

    const dataReady = true;

    // ----- State (all hooks above any early return) -----

    const [reloadKey, setReloadKey] = useState(0);
    const [{ configs, loadingConfigs, configError }, setConfigData] = useState<{
        configs: ConfigRow[];
        loadingConfigs: boolean;
        configError: string | null;
    }>({ configs: [], loadingConfigs: true, configError: null });

    const [expandedLineages, setExpandedLineages] = useState<Set<string>>(() => new Set());
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [searchText, setSearchText] = useState('');
    const [descText, setDescText] = useState('');
    const [descState, setDescState] = useState<{ saving: boolean; success: string | null; error: string | null }>({
        saving: false,
        success: null,
        error: null,
    });
    const [editedWeights, setEditedWeights] = useState<EditableWeight[]>([]);
    const [saveState, setSaveState] = useState<{ saving: boolean; success: string | null; error: string | null }>({
        saving: false,
        success: null,
        error: null,
    });
    const [{ ejecuciones, loadingEjec, ejecError }, setEjecData] = useState<{
        ejecuciones: EjecucionRow[];
        loadingEjec: boolean;
        ejecError: string | null;
    }>({ ejecuciones: [], loadingEjec: false, ejecError: null });
    const [catalogNames, setCatalogNames] = useState<string[]>([]);
    const [addVariable, setAddVariable] = useState<string | null>(null);
    const [championState, setChampionState] = useState<{ saving: boolean; error: string | null }>({
        saving: false,
        error: null,
    });
    const [newConfigOpen, setNewConfigOpen] = useState(false);
    const [newConfigName, setNewConfigName] = useState('');
    const [newConfigSaving, setNewConfigSaving] = useState(false);
    const [newConfigError, setNewConfigError] = useState<string | null>(null);

    // ----- Fetch configuraciones -----

    useEffect(() => {
        let cancelled = false;
        getConfigs()
            .then((rows) => {
                if (!cancelled) setConfigData({ configs: rows, loadingConfigs: false, configError: null });
            })
            .catch(() => {
                if (!cancelled)
                    setConfigData({
                        configs: [],
                        loadingConfigs: false,
                        configError: 'No se pudieron cargar las configuraciones.',
                    });
            });
        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    // ----- Group by nombre (nombre visual común; la versión diferencia) -----

    const lineageGroups = useMemo(() => {
        const map = new Map<string, ConfigRow[]>();
        for (const row of configs) {
            const name = (row.ren_nombre ?? '(sin nombre)').replace(/\s+v\d+$/i, '');
            const list = map.get(name);
            if (list) list.push(row);
            else map.set(name, [row]);
        }
        const groups = Array.from(map.entries()).map(([lineage, rows]) => ({
            lineage,
            rows: [...rows].sort((a, b) => (b.ren_version ?? 0) - (a.ren_version ?? 0)),
        }));
        groups.sort((a, b) => a.lineage.localeCompare(b.lineage, 'es'));
        return groups;
    }, [configs]);

    // ----- Filtro del panel maestro (texto por nombre/versión) -----

    const filteredGroups = useMemo(() => {
        const needle = searchText.trim().toLowerCase();
        if (!needle) return lineageGroups;
        return lineageGroups
            .map((group) => {
                const nameMatch = group.lineage.toLowerCase().includes(needle);
                const rows = group.rows.filter((row) => {
                    if (nameMatch) return true;
                    const haystack = `${row.ren_nombre ?? ''} v${row.ren_version ?? ''} ${
                        isEnProduccion(row.ren_enproduccion) ? 'producción' : ''
                    }`.toLowerCase();
                    return haystack.includes(needle);
                });
                return { ...group, rows };
            })
            .filter((group) => group.rows.length > 0);
    }, [lineageGroups, searchText]);

    const selectedConfig = useMemo(
        () => configs.find((c) => c.ren_configuracionscoringid === selectedId) ?? null,
        [configs, selectedId],
    );

    // ----- Auto-select a version when configs load (producción preferred) -----

    useEffect(() => {
        if (configs.length === 0) return;
        if (selectedId && configs.some((c) => c.ren_configuracionscoringid === selectedId)) return;
        const prod = configs.find((c) => isEnProduccion(c.ren_enproduccion));
        const fallback = lineageGroups[0]?.rows[0];
        const target = prod ?? fallback;
        if (target) {
            setSelectedId(target.ren_configuracionscoringid);
            setExpandedLineages((prev) => {
                const next = new Set(prev);
                next.add((target.ren_nombre ?? '(sin nombre)').replace(/\s+v\d+$/i, ''));
                return next;
            });
        }
    }, [configs, lineageGroups, selectedId]);

    // ----- Parse pesos into editable weights when selection changes -----

    useEffect(() => {
        setDescText(selectedConfig?.ren_descripcion ?? '');
        setDescState({ saving: false, success: null, error: null });
        if (!selectedConfig) {
            setEditedWeights([]);
            return;
        }
        const parsed = parseWeights(selectedConfig.ren_pesos);
        setEditedWeights(
            parsed
                ? parsed.map((w) => ({ variable: w.variable, pesoText: String(w.peso), direction: w.direction }))
                : [],
        );
        setSaveState({ saving: false, success: null, error: null });
    }, [selectedConfig]);

    // ----- Fetch ejecuciones for the selected config -----

    useEffect(() => {
        if (!selectedId) {
            setEjecData({ ejecuciones: [], loadingEjec: false, ejecError: null });
            return;
        }
        let cancelled = false;
        setEjecData({ ejecuciones: [], loadingEjec: true, ejecError: null });
        getRuns(selectedId)
            .then((rows) => {
                if (!cancelled) setEjecData({ ejecuciones: rows, loadingEjec: false, ejecError: null });
            })
            .catch(() => {
                if (!cancelled)
                    setEjecData({
                        ejecuciones: [],
                        loadingEjec: false,
                        ejecError: 'No se pudieron cargar las ejecuciones.',
                    });
            });
        return () => {
            cancelled = true;
        };
    }, [selectedId]);

    // ----- Fetch catálogo de variables (para añadir términos a la fórmula) -----

    useEffect(() => {
        let cancelled = false;
        getCatalogVariables()
            .then((rows) => {
                if (cancelled) return;
                const names = rows
                    .map((r) => r.ren_nombre)
                    .filter((n): n is string => typeof n === 'string' && n.length > 0)
                    .sort((a, b) => a.localeCompare(b, 'es'));
                setCatalogNames(names);
            })
            .catch(() => {
                /* el catálogo es opcional: sin él solo se desactiva "añadir variable" */
            });
        return () => {
            cancelled = true;
        };
    }, []);

    // ----- Derived values for the weight editor -----

    const parsedOk = editedWeights.length > 0;
    const maxPeso = useMemo(() => {
        let max = 0;
        for (const w of editedWeights) {
            const p = Number.parseFloat(w.pesoText);
            if (Number.isFinite(p) && p > max) max = p;
        }
        return max;
    }, [editedWeights]);

    const allWeightsValid = useMemo(
        () =>
            editedWeights.every((w) => {
                const p = Number.parseFloat(w.pesoText);
                return Number.isFinite(p) && p >= 0;
            }),
        [editedWeights],
    );

    // ----- Handlers -----

    const toggleLineage = (lineage: string) => {
        setExpandedLineages((prev) => {
            const next = new Set(prev);
            if (next.has(lineage)) next.delete(lineage);
            else next.add(lineage);
            return next;
        });
    };

    const handleWeightChange = (index: number, value: string) => {
        setEditedWeights((prev) => prev.map((w, i) => (i === index ? { ...w, pesoText: value } : w)));
    };

    const handleRemoveWeight = (index: number) => {
        setEditedWeights((prev) => prev.filter((_, i) => i !== index));
    };

    const availableVariables = useMemo(() => {
        const used = new Set(editedWeights.map((w) => w.variable));
        return catalogNames.filter((n) => !used.has(n));
    }, [catalogNames, editedWeights]);

    const handleAddVariable = () => {
        if (!addVariable) return;
        setEditedWeights((prev) => [
            ...prev,
            { variable: addVariable, pesoText: '0.1', direction: 'lower_is_better' },
        ]);
        setAddVariable(null);
    };

    const toggleDirection = (index: number) => {
        setEditedWeights((prev) =>
            prev.map((w, i) =>
                i === index
                    ? {
                          ...w,
                          direction:
                              w.direction === 'higher_is_better' ? 'lower_is_better' : 'higher_is_better',
                      }
                    : w,
            ),
        );
    };

    // Regla "exactamente una en producción": solo se puede PONER una versión en
    // producción (nunca quitar la actual sin sustituirla). Al poner una nueva,
    // las demás se desmarcan en la misma operación (el backend lo garantiza).
    const handleSetChampion = async () => {
        if (!selectedConfig || championState.saving) return;
        if (isEnProduccion(selectedConfig.ren_enproduccion)) return;
        setChampionState({ saving: true, error: null });
        try {
            await setChampion(selectedConfig.ren_configuracionscoringid);
            setChampionState({ saving: false, error: null });
            setReloadKey((k) => k + 1);
        } catch {
            setChampionState({ saving: false, error: 'No se pudo poner esta versión en producción.' });
        }
    };

    const handleSaveDescripcion = async () => {
        if (!selectedConfig || descState.saving) return;
        setDescState({ saving: true, success: null, error: null });
        try {
            await updateConfigDescripcion(selectedConfig.ren_configuracionscoringid, descText);
            const updated = configs.map((c) =>
                c.ren_configuracionscoringid === selectedConfig.ren_configuracionscoringid
                    ? { ...c, ren_descripcion: descText }
                    : c,
            );
            setConfigData({ configs: updated, loadingConfigs: false, configError: null });
            setDescState({ saving: false, success: 'Descripción guardada.', error: null });
        } catch {
            setDescState({ saving: false, success: null, error: 'No se pudo guardar la descripción.' });
        }
    };

    const openRun = (runId: string) => {
        onOpenRun(runId);
    };

    const handleCreateNewConfig = async () => {
        const name = newConfigName.trim();
        if (newConfigSaving || name.length === 0) return;
        setNewConfigSaving(true);
        setNewConfigError(null);
        try {
            const newId = await createConfig({ nombre: name, pesos: [] });
            setSelectedId(newId.replace(/[{}]/g, '').toLowerCase());
            setExpandedLineages((prev) => {
                const next = new Set(prev);
                next.add(name);
                return next;
            });
            setNewConfigOpen(false);
            setNewConfigName('');
            setNewConfigSaving(false);
            setReloadKey((k) => k + 1);
        } catch {
            setNewConfigSaving(false);
            setNewConfigError('No se pudo crear la configuración.');
        }
    };

    const handleSaveAsNewVersion = async () => {
        if (!selectedConfig || saveState.saving || !parsedOk || !allWeightsValid) return;
        setSaveState({ saving: true, success: null, error: null });
        try {
            const baseName = (selectedConfig.ren_nombre ?? '(sin nombre)').replace(/\s+v\d+$/i, '');
            const siblings = configs.filter(
                (c) => (c.ren_nombre ?? '(sin nombre)').replace(/\s+v\d+$/i, '') === baseName,
            );
            const maxVersion = siblings.reduce((max, c) => Math.max(max, c.ren_version ?? 0), 0);
            const weights: WeightTerm[] = editedWeights.map((w) => ({
                variable: w.variable,
                peso: Number.parseFloat(w.pesoText),
                direction: w.direction,
            }));
            // Las configuraciones son inmutables: SIEMPRE se crea un registro
            // nuevo; nunca se actualiza una versión existente. El nombre es
            // común a todas las versiones; solo cambia ren_version.
            const newId = await createConfigVersion(selectedConfig.ren_configuracionscoringid, {
                pesos: weights,
            });
            setSelectedId(newId.replace(/[{}]/g, '').toLowerCase());
            setExpandedLineages((prev) => {
                const next = new Set(prev);
                next.add(baseName);
                return next;
            });
            setSaveState({
                saving: false,
                success: `Nueva versión v${maxVersion + 1} guardada correctamente.`,
                error: null,
            });
            setReloadKey((k) => k + 1);
        } catch {
            setSaveState({
                saving: false,
                success: null,
                error: 'No se pudo guardar la nueva versión. Inténtalo de nuevo.',
            });
        }
    };

    // ----- Render -----

    return (
        <div className={styles.root}>
            {/* Panel maestro: linajes y versiones */}
            <nav className={styles.masterPanel} aria-label="Configuraciones de scoring">
                <Text as="h2" className={styles.pageTitle}>
                    Configuración de scoring
                </Text>
                <Text className={styles.mutedText}>
                    Versiones inmutables agrupadas por configuración. Selecciona una versión para ver su
                    detalle.
                </Text>
                <Button
                    appearance="primary"
                    icon={<AddRegular />}
                    onClick={() => {
                        setNewConfigError(null);
                        setNewConfigOpen(true);
                    }}
                    disabled={!dataReady}
                >
                    Nueva configuración
                </Button>
                <div className={styles.masterFilters}>
                    <Input
                        contentBefore={<SearchRegular aria-hidden="true" />}
                        placeholder="Buscar configuración o versión…"
                        value={searchText}
                        onChange={(_, data) => setSearchText(data.value)}
                        aria-label="Buscar configuraciones"
                    />
                    {searchText && (
                        <Button appearance="subtle" size="small" onClick={() => setSearchText('')}>
                            Limpiar
                        </Button>
                    )}
                </div>
                {loadingConfigs && (
                    <div className={styles.spinnerWrap}>
                        <Spinner label="Cargando configuraciones…" />
                    </div>
                )}
                {!loadingConfigs && configError && (
                    <MessageBar intent="error">
                        <MessageBarBody>{configError}</MessageBarBody>
                    </MessageBar>
                )}
                {!loadingConfigs && !configError && lineageGroups.length === 0 && (
                    <div className={mergeClasses(styles.card, styles.emptyState)}>
                        <Text>No hay configuraciones de scoring todavía.</Text>
                    </div>
                )}
                {!loadingConfigs &&
                    !configError &&
                    lineageGroups.length > 0 &&
                    filteredGroups.length === 0 && (
                        <div className={mergeClasses(styles.card, styles.emptyState)}>
                            <Text>Ninguna configuración coincide con los filtros.</Text>
                        </div>
                    )}
                {!loadingConfigs &&
                    filteredGroups.map((group) => {
                        const expanded = expandedLineages.has(group.lineage);
                        return (
                            <div key={group.lineage} className={styles.card}>
                                <button
                                    type="button"
                                    className={styles.lineageHeader}
                                    onClick={() => toggleLineage(group.lineage)}
                                    aria-expanded={expanded}
                                >
                                    {expanded ? <ChevronDownRegular /> : <ChevronRightRegular />}
                                    <span className={styles.lineageTitle} title={group.lineage}>
                                        {group.lineage}
                                    </span>
                                    <Badge appearance="tint" color="informative">
                                        {group.rows.length} {group.rows.length === 1 ? 'versión' : 'versiones'}
                                    </Badge>
                                </button>
                                {expanded &&
                                    group.rows.map((row) => {
                                        const isSelected = row.ren_configuracionscoringid === selectedId;
                                        return (
                                            <button
                                                type="button"
                                                key={row.ren_configuracionscoringid}
                                                className={mergeClasses(
                                                    styles.versionItem,
                                                    isSelected && styles.versionItemSelected,
                                                )}
                                                onClick={() => setSelectedId(row.ren_configuracionscoringid)}
                                                aria-pressed={isSelected}
                                            >
                                                <span className={styles.versionName}>
                                                    Versión {row.ren_version ?? '—'}
                                                </span>
                                                {isEnProduccion(row.ren_enproduccion) && (
                                                    <Badge appearance="tint" color="success">
                                                        en producción
                                                    </Badge>
                                                )}
                                            </button>
                                        );
                                    })}
                            </div>
                        );
                    })}
            </nav>

            {/* Panel de detalle */}
            <main className={styles.detailPanel} aria-label="Detalle de la configuración seleccionada">
                {!selectedConfig && !loadingConfigs && (
                    <div className={mergeClasses(styles.card, styles.emptyState)}>
                        <Text>Selecciona una versión en el panel izquierdo para ver su detalle.</Text>
                    </div>
                )}

                {selectedConfig && (
                    <>
                        {/* Por qué este scoring */}
                        <section className={styles.card} aria-labelledby="summary-title">
                            <div className={styles.cardHeaderRow}>
                                <Text as="h2" id="summary-title" className={styles.sectionTitle}>
                                    Por qué este scoring
                                </Text>
                                <div className={styles.headerSpacer} />
                                <div className={styles.chipRow}>
                                    {isEnProduccion(selectedConfig.ren_enproduccion) ? (
                                        <Badge appearance="tint" color="success" icon={<CheckmarkCircleRegular />}>
                                            en producción
                                        </Badge>
                                    ) : (
                                        <Button
                                            appearance="primary"
                                            icon={<CheckmarkCircleRegular />}
                                            disabled={!dataReady || championState.saving}
                                            onClick={handleSetChampion}
                                        >
                                            {championState.saving ? 'Aplicando…' : 'Poner en producción'}
                                        </Button>
                                    )}
                                </div>
                            </div>
                            {championState.error && (
                                <MessageBar intent="error">
                                    <MessageBarBody>{championState.error}</MessageBarBody>
                                </MessageBar>
                            )}
                            <Text className={styles.mutedText}>
                                Siempre hay exactamente una versión en producción: al poner esta, la actual se
                                desmarca automáticamente. La versión en producción no se puede desmarcar sin
                                elegir otra.
                            </Text>
                            <div className={styles.summaryGrid}>
                                <Text className={styles.summaryLabel}>Nombre</Text>
                                <Text>
                                    {(selectedConfig.ren_nombre ?? '—').replace(/\s+v\d+$/i, '')}
                                </Text>
                                <Text className={styles.summaryLabel}>Versión</Text>
                                <Text>{selectedConfig.ren_version ?? '—'}</Text>
                                <Text className={styles.summaryLabel}>Nº de términos</Text>
                                <Text>{selectedConfig.ren_numterminos ?? '—'}</Text>
                                <Text className={styles.summaryLabel}>Origen</Text>
                                <Text>
                                    {selectedConfig['ren_origen@OData.Community.Display.V1.FormattedValue'] ??
                                        (selectedConfig.ren_origen === ORIGEN_MANUAL ? 'Manual' : 'Propuesta IA')}
                                </Text>
                            </div>
                            <Field label="Descripción del scoring" hint="Explica el objetivo de esta configuración; se puede editar en cualquier momento.">
                                <Textarea
                                    resize="vertical"
                                    rows={3}
                                    value={descText}
                                    onChange={(_, data) => setDescText(data.value)}
                                    placeholder="p. ej. Prioriza antigüedad del equipo y señal débil para el plan Renove…"
                                    disabled={!dataReady || descState.saving}
                                />
                            </Field>
                            {descState.success && (
                                <MessageBar intent="success">
                                    <MessageBarBody>{descState.success}</MessageBarBody>
                                </MessageBar>
                            )}
                            {descState.error && (
                                <MessageBar intent="error">
                                    <MessageBarBody>{descState.error}</MessageBarBody>
                                </MessageBar>
                            )}
                            <div className={styles.descActions}>
                                <Button
                                    appearance="secondary"
                                    icon={<SaveRegular />}
                                    disabled={
                                        !dataReady ||
                                        descState.saving ||
                                        descText === (selectedConfig.ren_descripcion ?? '')
                                    }
                                    onClick={handleSaveDescripcion}
                                >
                                    {descState.saving ? 'Guardando…' : 'Guardar descripción'}
                                </Button>
                            </div>
                        </section>
                        <section className={styles.card} aria-labelledby="formula-title">
                            <div className={styles.cardHeaderRow}>
                                <Text as="h2" id="formula-title" className={styles.sectionTitle}>
                                    Fórmula de ponderación
                                </Text>
                                <div className={styles.headerSpacer} />
                                <Button
                                    appearance="primary"
                                    icon={<SaveRegular />}
                                    disabled={!parsedOk || !allWeightsValid || saveState.saving || !dataReady}
                                    onClick={handleSaveAsNewVersion}
                                >
                                    {saveState.saving ? 'Guardando…' : 'Guardar como nueva versión'}
                                </Button>
                            </div>
                            <Text className={styles.mutedText}>
                                Σ de términos ponderados. Edita los pesos y guarda como una nueva versión — las
                                versiones existentes nunca se modifican.
                            </Text>
                            {saveState.success && (
                                <MessageBar intent="success">
                                    <MessageBarBody>{saveState.success}</MessageBarBody>
                                </MessageBar>
                            )}
                            {saveState.error && (
                                <MessageBar intent="error">
                                    <MessageBarBody>{saveState.error}</MessageBarBody>
                                </MessageBar>
                            )}
                            {!parsedOk && (
                                <div className={styles.emptyState}>
                                    <Text>
                                        Esta versión no tiene todavía ninguna variable en la fórmula. Añade una
                                        con el selector de abajo.
                                    </Text>
                                </div>
                            )}
                            {parsedOk &&
                                editedWeights.map((w, index) => (
                                    <WeightEditorRow
                                        key={`${w.variable}-${index}`}
                                        weight={w}
                                        maxPeso={maxPeso}
                                        onChange={(value) => handleWeightChange(index, value)}
                                        onToggleDirection={() => toggleDirection(index)}
                                        onRemove={() => handleRemoveWeight(index)}
                                    />
                                ))}
                            <div className={styles.cardHeaderRow}>
                                <Dropdown
                                    placeholder={
                                        availableVariables.length > 0
                                            ? 'Añadir variable del catálogo…'
                                            : 'No hay variables disponibles'
                                    }
                                    value={addVariable ?? ''}
                                    selectedOptions={addVariable ? [addVariable] : []}
                                    onOptionSelect={(_, data) => setAddVariable(data.optionValue ?? null)}
                                    disabled={availableVariables.length === 0}
                                    aria-label="Variable del catálogo para añadir a la fórmula"
                                >
                                    {availableVariables.map((name) => (
                                        <Option key={name} value={name}>
                                            {name}
                                        </Option>
                                    ))}
                                </Dropdown>
                                <Button
                                    appearance="secondary"
                                    icon={<AddRegular />}
                                    disabled={!addVariable}
                                    onClick={handleAddVariable}
                                >
                                    Añadir a la fórmula
                                </Button>
                            </div>
                        </section>

                        {/* Ejecuciones relacionadas */}
                        <section className={styles.card} aria-labelledby="ejecuciones-title">
                            <Text as="h2" id="ejecuciones-title" className={styles.sectionTitle}>
                                Ejecuciones con esta configuración
                            </Text>
                            {loadingEjec && (
                                <div className={styles.spinnerWrap}>
                                    <Spinner label="Cargando ejecuciones…" />
                                </div>
                            )}
                            {!loadingEjec && ejecError && (
                                <MessageBar intent="error">
                                    <MessageBarBody>{ejecError}</MessageBarBody>
                                </MessageBar>
                            )}
                            {!loadingEjec && !ejecError && ejecuciones.length === 0 && (
                                <div className={styles.emptyState}>
                                    <Text>No hay ejecuciones registradas con esta versión.</Text>
                                </div>
                            )}
                            {!loadingEjec && !ejecError && ejecuciones.length > 0 && (
                                <div className={styles.tableWrap}>
                                    <Table aria-label="Ejecuciones de la configuración seleccionada" size="small">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHeaderCell>Nº</TableHeaderCell>
                                                <TableHeaderCell>Fecha</TableHeaderCell>
                                                <TableHeaderCell>QC</TableHeaderCell>
                                                <TableHeaderCell>Clientes</TableHeaderCell>
                                                <TableHeaderCell>Top-K</TableHeaderCell>
                                                <TableHeaderCell>Eficiencia</TableHeaderCell>
                                                <TableHeaderCell>Cobertura</TableHeaderCell>
                                                <TableHeaderCell>Lift</TableHeaderCell>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {ejecuciones.map((e) => (
                                                <TableRow
                                                    key={e.ren_ejecucionid}
                                                    className={styles.rowClickable}
                                                    onClick={() => openRun(e.ren_ejecucionid)}
                                                    title="Abrir esta ejecución en el panel de ejecución"
                                                >
                                                    <TableCell>
                                                        <Text className={styles.mono}>{e.ren_numero ?? '—'}</Text>
                                                    </TableCell>
                                                    <TableCell>{formatFecha(e)}</TableCell>
                                                    <TableCell>
                                                        <QcBadge
                                                            estadoQc={e.ren_estadoqc}
                                                            label={
                                                                e[
                                                                    'ren_estadoqc@OData.Community.Display.V1.FormattedValue'
                                                                ]
                                                            }
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        {typeof e.ren_clientesevaluados === 'number'
                                                            ? e.ren_clientesevaluados.toLocaleString('es-ES')
                                                            : '—'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {typeof e.ren_topk === 'number'
                                                            ? e.ren_topk.toLocaleString('es-ES')
                                                            : '—'}
                                                    </TableCell>
                                                    <TableCell>{formatPercent(e.ren_eficiencia)}</TableCell>
                                                    <TableCell>{formatPercent(e.ren_cobertura)}</TableCell>
                                                    <TableCell>
                                                        {typeof e.ren_lift === 'number' ? e.ren_lift.toFixed(2) : '—'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </section>
                    </>
                )}
            </main>

            {/* Diálogo: nueva configuración desde cero */}
            <Dialog open={newConfigOpen} onOpenChange={(_, data) => setNewConfigOpen(data.open)}>
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle>Nueva configuración</DialogTitle>
                        <DialogContent>
                            <Field label="Nombre de la configuración" required>
                                <Input
                                    value={newConfigName}
                                    onChange={(_, data) => setNewConfigName(data.value)}
                                    placeholder="p. ej. Prioridad señal débil"
                                />
                            </Field>
                            <Text className={styles.mutedText}>
                                Se crea en blanco como versión 1. Después añade variables del catálogo a la
                                fórmula y guarda.
                            </Text>
                            {newConfigError && (
                                <MessageBar intent="error">
                                    <MessageBarBody>{newConfigError}</MessageBarBody>
                                </MessageBar>
                            )}
                        </DialogContent>
                        <DialogActions>
                            <Button appearance="secondary" onClick={() => setNewConfigOpen(false)}>
                                Cancelar
                            </Button>
                            <Button
                                appearance="primary"
                                disabled={newConfigName.trim().length === 0 || newConfigSaving}
                                onClick={handleCreateNewConfig}
                            >
                                {newConfigSaving ? 'Creando…' : 'Crear'}
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
}
