import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    makeStyles,
    shorthands,
    tokens,
    Text,
    Spinner,
    Badge,
    CounterBadge,
    Accordion,
    AccordionItem,
    AccordionHeader,
    AccordionPanel,
    Button,
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
    Field,
    Input,
    Textarea,
    Dropdown,
    Option,
    Switch,
} from '@fluentui/react-components';
import {
    AddRegular,
    CheckmarkCircleRegular,
    CircleRegular,
    DocumentTableRegular,
    EditRegular,
} from '@fluentui/react-icons';
import {
    getCatalogVariables,
    createCatalogVariable,
    updateCatalogVariable,
} from '../platform/renoveApi';
import type { CatalogRow } from '../platform/renoveApi';

// ---------------------------------------------------------------------------
// Catálogo de columnas — replicates CatalogView.
// Variables del catálogo (ren_variablecatalogo) agrupadas por ren_grupo en
// secciones de acordeón plegables, con chips de tipo, % de nulos e indicador
// de inclusión en scoring. Permite crear nuevas variables y editar existentes.
// ---------------------------------------------------------------------------

// ---------- Choice metadata ----------

const GROUP_ORDER: ReadonlyArray<{ value: number; label: string }> = [
    { value: 100000000, label: 'Identificación y geografía' },
    { value: 100000001, label: 'Equipo y router' },
    { value: 100000002, label: 'Señal y cobertura' },
    { value: 100000003, label: 'Degradación y problemas WiFi' },
    { value: 100000004, label: 'Uso y dispositivos' },
    { value: 100000005, label: 'Comercial y valor' },
    { value: 100000006, label: 'Vivienda' },
    { value: 100000007, label: 'Atención y tickets' },
    { value: 100000008, label: 'Satisfacción' },
    { value: 100000009, label: 'Metadatos y fechas' },
];

const UNGROUPED_KEY = -1;
const UNGROUPED_LABEL = 'Otros';

const TIPO_LABELS: Record<number, string> = {
    100000000: 'Numérica',
    100000001: 'Categórica',
    100000002: 'Fecha',
    100000003: 'Identificador',
};

type BadgeColor = 'brand' | 'informative' | 'success' | 'subtle' | 'warning' | 'severe' | 'important' | 'danger';

const TIPO_COLORS: Record<number, BadgeColor> = {
    100000000: 'brand',       // Numérica
    100000001: 'warning',     // Categórica
    100000002: 'success',     // Fecha
    100000003: 'informative', // Identificador
};

// ---------- Helpers ----------

const FORMATTED = '@OData.Community.Display.V1.FormattedValue';

function getFormatted(row: CatalogRow, column: string): string | undefined {
    const value = (row as unknown as Record<string, unknown>)[`${column}${FORMATTED}`];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

const pctFormatter = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

function formatPctNulos(value: number | undefined | null): string {
    if (value === undefined || value === null || !Number.isFinite(value)) return '—';
    return `${pctFormatter.format(value)}%`;
}

function tipoLabel(row: CatalogRow): string {
    return getFormatted(row, 'ren_tipo')
        ?? (typeof row.ren_tipo === 'number' ? TIPO_LABELS[row.ren_tipo] : undefined)
        ?? 'Sin tipo';
}

function tipoColor(row: CatalogRow): BadgeColor {
    return (typeof row.ren_tipo === 'number' ? TIPO_COLORS[row.ren_tipo] : undefined) ?? 'subtle';
}

// ---------- Edit dialog form model ----------

type VariableForm = {
    nombre: string;
    grupo: number | undefined;
    tipo: number | undefined;
    descripcion: string;
    pctNulos: string;
    enScoring: boolean;
};

const EMPTY_FORM: VariableForm = {
    nombre: '',
    grupo: undefined,
    tipo: undefined,
    descripcion: '',
    pctNulos: '',
    enScoring: false,
};

function formFromRow(row: CatalogRow): VariableForm {
    return {
        nombre: row.ren_nombre ?? '',
        grupo: typeof row.ren_grupo === 'number' ? row.ren_grupo : undefined,
        tipo: typeof row.ren_tipo === 'number' ? row.ren_tipo : undefined,
        descripcion: row.ren_descripcion ?? '',
        pctNulos:
            typeof row.ren_pctnulos === 'number' && Number.isFinite(row.ren_pctnulos)
                ? String(row.ren_pctnulos)
                : '',
        enScoring: !!row.ren_enscoring,
    };
}

// ---------- Styles ----------

const useStyles = makeStyles({
    root: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalL,
        padding: tokens.spacingHorizontalXL,
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: '#f5f5f5',
        minHeight: '100%',
        fontFamily: "'Segoe UI', 'Segoe UI Web (West European)', -apple-system, sans-serif",
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: tokens.spacingHorizontalM,
    },
    headerText: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalXXS,
    },
    helperText: {
        color: tokens.colorNeutralForeground3,
    },
    sectionsColumn: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalM,
    },
    groupCard: {
        backgroundColor: '#ffffff',
        ...shorthands.border('1px', 'solid', '#e0e0e0'),
        borderRadius: '4px',
        overflow: 'hidden',
    },
    groupHeaderContent: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
    },
    panel: {
        display: 'flex',
        flexDirection: 'column',
        paddingLeft: tokens.spacingHorizontalM,
        paddingRight: tokens.spacingHorizontalM,
        paddingBottom: tokens.spacingVerticalM,
    },
    variableRow: {
        display: 'flex',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: tokens.spacingHorizontalL,
        paddingTop: tokens.spacingVerticalS,
        paddingBottom: tokens.spacingVerticalS,
        borderBottomWidth: '1px',
        borderBottomStyle: 'solid',
        borderBottomColor: tokens.colorNeutralStroke3,
        ':last-child': {
            borderBottomWidth: '0px',
        },
    },
    variableMain: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalXXS,
        flexGrow: 1,
        flexBasis: '240px',
        minWidth: '200px',
    },
    variableNameLine: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: tokens.spacingHorizontalS,
    },
    mono: {
        fontFamily: "ui-monospace, 'Cascadia Code', 'Consolas', 'Courier New', monospace",
        fontSize: tokens.fontSizeBase300,
        fontWeight: tokens.fontWeightSemibold,
        color: tokens.colorNeutralForeground1,
        wordBreak: 'break-all',
    },
    description: {
        color: tokens.colorNeutralForeground3,
        fontSize: tokens.fontSizeBase200,
    },
    variableMeta: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: tokens.spacingHorizontalM,
        flexShrink: 0,
    },
    pctNulos: {
        color: tokens.colorNeutralForeground2,
        fontSize: tokens.fontSizeBase200,
        whiteSpace: 'nowrap',
    },
    spinnerWrap: {
        display: 'flex',
        justifyContent: 'center',
        padding: tokens.spacingVerticalXXL,
    },
    errorBanner: {
        padding: tokens.spacingHorizontalM,
        backgroundColor: tokens.colorStatusDangerBackground2,
        color: tokens.colorStatusDangerForeground2,
        borderRadius: '4px',
    },
    emptyCard: {
        backgroundColor: '#ffffff',
        ...shorthands.border('1px', 'solid', '#e0e0e0'),
        borderRadius: '4px',
        padding: tokens.spacingVerticalXXL,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: tokens.spacingVerticalS,
        textAlign: 'center',
    },
    emptyIcon: {
        fontSize: '32px',
        color: tokens.colorNeutralForeground3,
    },
    dialogFields: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalM,
    },
    dialogError: {
        padding: tokens.spacingHorizontalS,
        backgroundColor: tokens.colorStatusDangerBackground2,
        color: tokens.colorStatusDangerForeground2,
        borderRadius: '4px',
        fontSize: tokens.fontSizeBase200,
    },
});

// ---------- Sub-components ----------

type VariableRowItemProps = {
    row: CatalogRow;
    styles: ReturnType<typeof useStyles>;
    onEdit: (row: CatalogRow) => void;
};

const VariableRowItem = (props: VariableRowItemProps) => {
    const { row, styles, onEdit } = props;
    // La capa de datos devuelve booleanos como true/false (no 1/0) — comparación por verdad.
    const enScoring = !!row.ren_enscoring;

    return (
        <div className={styles.variableRow} role="listitem">
            <div className={styles.variableMain}>
                <div className={styles.variableNameLine}>
                    <Text className={styles.mono}>{row.ren_nombre ?? '—'}</Text>
                    <Badge appearance="tint" color={tipoColor(row)} size="small" shape="rounded">
                        {tipoLabel(row)}
                    </Badge>
                </div>
                {row.ren_descripcion ? (
                    <Text className={styles.description}>{row.ren_descripcion}</Text>
                ) : null}
            </div>
            <div className={styles.variableMeta}>
                <Text className={styles.pctNulos} aria-label={`Porcentaje de nulos: ${formatPctNulos(row.ren_pctnulos)}`}>
                    Nulos: {formatPctNulos(row.ren_pctnulos)}
                </Text>
                {enScoring ? (
                    <Badge
                        appearance="tint"
                        color="success"
                        size="small"
                        shape="rounded"
                        icon={<CheckmarkCircleRegular />}
                    >
                        En scoring
                    </Badge>
                ) : (
                    <Badge
                        appearance="outline"
                        color="subtle"
                        size="small"
                        shape="rounded"
                        icon={<CircleRegular />}
                    >
                        No incluida
                    </Badge>
                )}
                <Button
                    appearance="subtle"
                    size="small"
                    icon={<EditRegular />}
                    aria-label={`Editar la variable ${row.ren_nombre ?? ''}`}
                    onClick={() => onEdit(row)}
                >
                    Editar
                </Button>
            </div>
        </div>
    );
};

// ---------- Component ----------

export function CatalogoView(): JSX.Element {
    const styles = useStyles();

    const [data, setData] = useState<{ records: CatalogRow[]; loading: boolean; error: string | null }>(
        { records: [], loading: true, error: null },
    );

    const dataReady = true;

    useEffect(() => {
        let cancelled = false;
        getCatalogVariables()
            .then((rows) => { if (!cancelled) setData({ records: rows, loading: false, error: null }); })
            .catch(() => {
                if (!cancelled) {
                    setData({ records: [], loading: false, error: 'No se pudo cargar el catálogo de columnas. Inténtalo de nuevo más tarde.' });
                }
            });
        return () => { cancelled = true; };
    }, []);

    // Group rows by ren_grupo (choice order), with a fallback "Otros" bucket for
    // rows without a recognised group. All hooks sit above the early returns.
    const groups = useMemo(() => {
        const byGroup = new Map<number, CatalogRow[]>();
        for (const row of data.records) {
            const known = typeof row.ren_grupo === 'number'
                && GROUP_ORDER.some((g) => g.value === row.ren_grupo);
            const key = known ? (row.ren_grupo as number) : UNGROUPED_KEY;
            const bucket = byGroup.get(key);
            if (bucket) bucket.push(row);
            else byGroup.set(key, [row]);
        }
        const ordered: { key: number; label: string; rows: CatalogRow[] }[] = [];
        for (const g of GROUP_ORDER) {
            const rows = byGroup.get(g.value);
            if (rows && rows.length > 0) {
                // Prefer the server's formatted (display) value for the choice label.
                const label = getFormatted(rows[0], 'ren_grupo') ?? g.label;
                ordered.push({ key: g.value, label, rows });
            }
        }
        const ungrouped = byGroup.get(UNGROUPED_KEY);
        if (ungrouped && ungrouped.length > 0) {
            ordered.push({ key: UNGROUPED_KEY, label: UNGROUPED_LABEL, rows: ungrouped });
        }
        return ordered;
    }, [data.records]);

    const defaultOpenItems = useMemo(
        () => (groups.length > 0 ? [String(groups[0].key)] : []),
        [groups],
    );

    const totalCount = data.records.length;

    // ---------- Crear / editar variable ----------
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<VariableForm>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const openCreate = useCallback(() => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setSaveError(null);
        setDialogOpen(true);
    }, []);

    const openEdit = useCallback((row: CatalogRow) => {
        setEditingId(row.ren_variablecatalogoid ?? null);
        setForm(formFromRow(row));
        setSaveError(null);
        setDialogOpen(true);
    }, []);

    const closeDialog = useCallback(() => {
        if (!saving) setDialogOpen(false);
    }, [saving]);

    const handleSave = useCallback(async () => {
        const nombre = form.nombre.trim();
        if (!nombre) {
            setSaveError('El nombre de la variable es obligatorio.');
            return;
        }
        const pctText = form.pctNulos.trim().replace(',', '.');
        let pctNulos: number | undefined;
        if (pctText !== '') {
            const parsed = Number(pctText);
            if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
                setSaveError('El % de nulos debe ser un número entre 0 y 100.');
                return;
            }
            pctNulos = parsed;
        }
        setSaving(true);
        setSaveError(null);
        const payload: Partial<CatalogRow> = {
            ren_nombre: nombre,
            ren_grupo: form.grupo,
            ren_tipo: form.tipo,
            ren_descripcion: form.descripcion.trim() || undefined,
            ren_pctnulos: pctNulos,
            ren_enscoring: form.enScoring,
        };
        try {
            if (editingId) {
                await updateCatalogVariable(editingId, payload);
            } else {
                await createCatalogVariable(payload);
            }
            // Recarga la lista completa tras guardar.
            const rows = await getCatalogVariables();
            setData({ records: rows, loading: false, error: null });
            setDialogOpen(false);
        } catch {
            setSaveError(
                editingId
                    ? 'No se pudo guardar la variable. Comprueba tus permisos e inténtalo de nuevo.'
                    : 'No se pudo crear la variable. Comprueba tus permisos e inténtalo de nuevo.',
            );
        } finally {
            setSaving(false);
        }
    }, [editingId, form]);

    if (data.loading) {
        return (
            <div className={styles.root}>
                <div className={styles.spinnerWrap}>
                    <Spinner labelPosition="below" label="Cargando catálogo de columnas…" />
                </div>
            </div>
        );
    }

    return (
        <div className={styles.root}>
            <header className={styles.header}>
                <div className={styles.headerText}>
                    <div className={styles.header}>
                        <Text as="h1" size={600} weight="semibold">
                            Catálogo de columnas
                        </Text>
                        <CounterBadge
                            count={totalCount}
                            overflowCount={9999}
                            appearance="filled"
                            color="brand"
                            aria-label={`${totalCount} variables en el catálogo`}
                        />
                    </div>
                    <Text className={styles.helperText} size={200}>
                        Variables disponibles en el conjunto de datos, agrupadas por categoría.
                    </Text>
                </div>
                <Button
                    appearance="primary"
                    icon={<AddRegular />}
                    onClick={openCreate}
                    disabled={!dataReady}
                >
                    Nueva variable
                </Button>
            </header>

            {data.error && (
                <div role="alert" className={styles.errorBanner}>
                    {data.error}
                </div>
            )}

            {!data.error && totalCount === 0 && (
                <div className={styles.emptyCard}>
                    <DocumentTableRegular className={styles.emptyIcon} aria-hidden="true" />
                    <Text weight="semibold">El catálogo está vacío</Text>
                    <Text className={styles.helperText} size={200}>
                        Todavía no hay variables registradas en el catálogo de columnas.
                    </Text>
                </div>
            )}

            {totalCount > 0 && (
                <div className={styles.sectionsColumn} role="list" aria-label="Grupos de variables del catálogo">
                    <Accordion multiple collapsible defaultOpenItems={defaultOpenItems}>
                        {groups.map((group) => (
                            <AccordionItem key={group.key} value={String(group.key)} className={styles.groupCard}>
                                <AccordionHeader expandIconPosition="start" size="large">
                                    <span className={styles.groupHeaderContent}>
                                        <Text weight="semibold">{group.label}</Text>
                                        <CounterBadge
                                            count={group.rows.length}
                                            overflowCount={9999}
                                            appearance="filled"
                                            color="informative"
                                            size="small"
                                            aria-label={`${group.rows.length} variables en ${group.label}`}
                                        />
                                    </span>
                                </AccordionHeader>
                                <AccordionPanel>
                                    <div className={styles.panel} role="list" aria-label={`Variables de ${group.label}`}>
                                        {group.rows.map((row) => (
                                            <VariableRowItem
                                                key={row.ren_variablecatalogoid}
                                                row={row}
                                                styles={styles}
                                                onEdit={openEdit}
                                            />
                                        ))}
                                    </div>
                                </AccordionPanel>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>
            )}

            <Dialog open={dialogOpen} onOpenChange={(_, d) => { if (!d.open) closeDialog(); }}>
                <DialogSurface aria-describedby={undefined}>
                    <DialogBody>
                        <DialogTitle>
                            {editingId ? 'Editar variable' : 'Nueva variable'}
                        </DialogTitle>
                        <DialogContent>
                            <div className={styles.dialogFields}>
                                {saveError && (
                                    <div role="alert" className={styles.dialogError}>
                                        {saveError}
                                    </div>
                                )}
                                <Field label="Nombre" required>
                                    <Input
                                        value={form.nombre}
                                        onChange={(_, d) => setForm((f) => ({ ...f, nombre: d.value }))}
                                        placeholder="p. ej. RSSI_promedio_min"
                                    />
                                </Field>
                                <Field label="Grupo">
                                    <Dropdown
                                        placeholder="Selecciona un grupo"
                                        selectedOptions={form.grupo !== undefined ? [String(form.grupo)] : []}
                                        value={
                                            form.grupo !== undefined
                                                ? GROUP_ORDER.find((g) => g.value === form.grupo)?.label ?? ''
                                                : ''
                                        }
                                        onOptionSelect={(_, d) =>
                                            setForm((f) => ({
                                                ...f,
                                                grupo: d.optionValue !== undefined ? Number(d.optionValue) : undefined,
                                            }))
                                        }
                                    >
                                        {GROUP_ORDER.map((g) => (
                                            <Option key={g.value} value={String(g.value)} text={g.label}>
                                                {g.label}
                                            </Option>
                                        ))}
                                    </Dropdown>
                                </Field>
                                <Field label="Tipo">
                                    <Dropdown
                                        placeholder="Selecciona un tipo"
                                        selectedOptions={form.tipo !== undefined ? [String(form.tipo)] : []}
                                        value={form.tipo !== undefined ? TIPO_LABELS[form.tipo] ?? '' : ''}
                                        onOptionSelect={(_, d) =>
                                            setForm((f) => ({
                                                ...f,
                                                tipo: d.optionValue !== undefined ? Number(d.optionValue) : undefined,
                                            }))
                                        }
                                    >
                                        {Object.entries(TIPO_LABELS).map(([value, label]) => (
                                            <Option key={value} value={value} text={label}>
                                                {label}
                                            </Option>
                                        ))}
                                    </Dropdown>
                                </Field>
                                <Field label="Descripción">
                                    <Textarea
                                        value={form.descripcion}
                                        onChange={(_, d) => setForm((f) => ({ ...f, descripcion: d.value }))}
                                        resize="vertical"
                                    />
                                </Field>
                                <Field label="% de nulos" hint="Entre 0 y 100. Déjalo vacío si no aplica.">
                                    <Input
                                        type="text"
                                        inputMode="decimal"
                                        value={form.pctNulos}
                                        onChange={(_, d) => setForm((f) => ({ ...f, pctNulos: d.value }))}
                                        placeholder="p. ej. 2.5"
                                    />
                                </Field>
                                <Switch
                                    label="Usada en scoring"
                                    checked={form.enScoring}
                                    onChange={(_, d) => setForm((f) => ({ ...f, enScoring: d.checked }))}
                                />
                            </div>
                        </DialogContent>
                        <DialogActions>
                            <Button appearance="secondary" onClick={closeDialog} disabled={saving}>
                                Cancelar
                            </Button>
                            <Button appearance="primary" onClick={handleSave} disabled={saving}>
                                {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Crear variable'}
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
}
