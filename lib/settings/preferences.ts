import {
  NAVIGATION_SECTIONS,
  STATIC_COMMANDS,
  type NavigationSection,
  type StaticCommand,
  type WorkspaceModuleId,
} from "@/lib/navigation";

export const LOCKED_WORKSPACE_MODULES: readonly WorkspaceModuleId[] = [
  "home",
  "admin",
];

export const HOME_WIDGET_IDS = [
  "stats",
  "attention",
  "activity",
  "trend",
  "followUps",
] as const;

export type HomeWidgetId = (typeof HOME_WIDGET_IDS)[number];

export const HOME_WIDGET_OPTIONS: { id: HomeWidgetId; label: string }[] = [
  { id: "stats", label: "Headline stats" },
  { id: "attention", label: "Needs attention" },
  { id: "activity", label: "Recent activity" },
    { id: "trend", label: "Incident and issue flows" },
  { id: "followUps", label: "Open follow-ups" },
];

export const OVERSIGHT_SECTION_IDS = [
  "health",
  "flow",
  "movement",
] as const;

export type OversightSectionId = (typeof OVERSIGHT_SECTION_IDS)[number];

export const OVERSIGHT_SECTION_OPTIONS: {
  id: OversightSectionId;
  label: string;
}[] = [
  { id: "health", label: "Cross-register health" },
  { id: "flow", label: "Flow and aging" },
  { id: "movement", label: "Rating movement" },
];

export const BOARD_SECTION_IDS = [
  "headlines",
  "matters",
  "decisions",
  "controlFailures",
  "severeIncidents",
  "appetite",
] as const;

export type BoardSectionId = (typeof BOARD_SECTION_IDS)[number];

export const BOARD_SECTION_OPTIONS: { id: BoardSectionId; label: string }[] = [
  { id: "headlines", label: "Headline stats" },
  { id: "matters", label: "Matters for attention" },
  { id: "decisions", label: "Decisions required" },
  { id: "controlFailures", label: "Control failures" },
  { id: "severeIncidents", label: "Severe open incidents" },
  { id: "appetite", label: "Above appetite" },
];

export const REGISTER_PRESET_MODULES = [
  "risks",
  "controls",
  "incidents",
  "issues",
  "obligations",
] as const;

export type RegisterPresetModule = (typeof REGISTER_PRESET_MODULES)[number];

export const REGISTER_PRESET_PATHS: Record<RegisterPresetModule, string> = {
  risks: "/risks",
  controls: "/controls",
  incidents: "/incidents",
  issues: "/issues",
  obligations: "/obligations",
};

export type SavedRegisterPreset = {
  id: string;
  name: string;
  module: RegisterPresetModule;
  query: string;
};

export const APPEARANCE_MODES = ["system", "light", "dark"] as const;
export type AppearanceMode = (typeof APPEARANCE_MODES)[number];

export const APPEARANCE_PALETTES = ["teal", "navy", "stone"] as const;
export type AppearancePalette = (typeof APPEARANCE_PALETTES)[number];

export const APPEARANCE_MODE_OPTIONS: { id: AppearanceMode; label: string }[] = [
  { id: "system", label: "Match device" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

export const APPEARANCE_PALETTE_OPTIONS: {
  id: AppearancePalette;
  label: string;
}[] = [
  { id: "teal", label: "Teal" },
  { id: "navy", label: "Navy" },
  { id: "stone", label: "Stone" },
];

export type AppearancePreferences = {
  mode: AppearanceMode;
  palette: AppearancePalette;
};

export type WorkspacePreferences = {
  hiddenModules: WorkspaceModuleId[];
  homeWidgets: HomeWidgetId[];
  oversightSections: OversightSectionId[];
  boardSections: BoardSectionId[];
  defaultHomeCategoryId: string;
  registerPresets: SavedRegisterPreset[];
  appearance: AppearancePreferences;
};

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  hiddenModules: [],
  homeWidgets: [...HOME_WIDGET_IDS],
  oversightSections: [...OVERSIGHT_SECTION_IDS],
  boardSections: [...BOARD_SECTION_IDS],
  defaultHomeCategoryId: "",
  registerPresets: [],
  appearance: { mode: "system", palette: "teal" },
};

const HIDABLE_MODULES = new Set<WorkspaceModuleId>([
  "work",
  "horizon",
  "lines",
  "board",
  "oversight",
  "risks",
  "controls",
  "incidents",
  "issues",
  "obligations",
  "evidence",
  "quality",
  "feedback",
  "rcsa",
]);

const HOME_WIDGET_SET = new Set<string>(HOME_WIDGET_IDS);
const LEGACY_HOME_WIDGETS = new Set([
  "heatMap",
  "taxonomy",
  "treatment",
  "issuesStatus",
  "remediation",
  "controlsEffectiveness",
  "incidentsStatus",
]);
const OVERSIGHT_SET = new Set<string>(OVERSIGHT_SECTION_IDS);
const LEGACY_OVERSIGHT = new Set(["controls", "risks", "issues", "incidents"]);
const BOARD_SET = new Set<string>(BOARD_SECTION_IDS);
const LEGACY_BOARD = new Set([
  "criticalRisks",
  "overdueKeyControls",
  "overdueIssues",
]);
const APPEARANCE_MODE_SET = new Set<string>(APPEARANCE_MODES);
const APPEARANCE_PALETTE_SET = new Set<string>(APPEARANCE_PALETTES);
const PRESET_MODULE_SET = new Set<string>(REGISTER_PRESET_MODULES);

const MAX_PRESETS = 20;
const MAX_PRESET_NAME = 80;
const MAX_PRESET_QUERY = 500;

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((item): item is string => typeof item === "string");
}

function pickKnown<T extends string>(
  values: string[] | undefined,
  allowed: ReadonlySet<string>,
  fallback: T[],
): T[] {
  if (values === undefined) {
    return [...fallback];
  }

  return [...new Set(values.filter((value): value is T => allowed.has(value)))];
}

function sanitizeQuery(value: string) {
  const trimmed = value.trim().replace(/^\?/, "");
  if (
    !trimmed ||
    trimmed.length > MAX_PRESET_QUERY ||
    trimmed.includes("/") ||
    trimmed.includes("#") ||
    trimmed.includes("\n") ||
    trimmed.includes("://")
  ) {
    return "";
  }

  return trimmed;
}

function parsePresets(value: unknown): SavedRegisterPreset[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const presets: SavedRegisterPreset[] = [];

  for (const item of value) {
    if (presets.length >= MAX_PRESETS) {
      break;
    }

    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const name =
      typeof record.name === "string" ? record.name.trim().slice(0, MAX_PRESET_NAME) : "";
    const registerModule =
      typeof record.module === "string" && PRESET_MODULE_SET.has(record.module)
        ? (record.module as RegisterPresetModule)
        : null;
    const query =
      typeof record.query === "string" ? sanitizeQuery(record.query) : "";

    if (!id || !name || !registerModule || !query) {
      continue;
    }

    presets.push({ id, name, module: registerModule, query });
  }

  return presets;
}

export function parseWorkspacePreferences(value: unknown): WorkspacePreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_WORKSPACE_PREFERENCES };
  }

  const record = value as Record<string, unknown>;
  const hidden = pickKnown<WorkspaceModuleId>(
    asStringArray(record.hiddenModules),
    HIDABLE_MODULES,
    DEFAULT_WORKSPACE_PREFERENCES.hiddenModules,
  );
  const defaultHomeCategoryId =
    typeof record.defaultHomeCategoryId === "string"
      ? record.defaultHomeCategoryId.trim()
      : "";

  const homeWidgets = pickKnown<HomeWidgetId>(
    asStringArray(record.homeWidgets),
    HOME_WIDGET_SET,
    DEFAULT_WORKSPACE_PREFERENCES.homeWidgets,
  );
  const rawHome = asStringArray(record.homeWidgets);
  const migratedHome =
    homeWidgets.length === 0 &&
    rawHome !== undefined &&
    rawHome.some((id) => LEGACY_HOME_WIDGETS.has(id))
      ? [...DEFAULT_WORKSPACE_PREFERENCES.homeWidgets]
      : homeWidgets;
  const withFollowUps =
    rawHome !== undefined &&
    migratedHome.length > 0 &&
    !migratedHome.includes("followUps") &&
    ["stats", "attention", "activity", "trend"].every((id) =>
      migratedHome.includes(id as HomeWidgetId),
    )
      ? ([...migratedHome, "followUps"] as HomeWidgetId[])
      : migratedHome;

  const oversightSections = pickKnown<OversightSectionId>(
    asStringArray(record.oversightSections),
    OVERSIGHT_SET,
    DEFAULT_WORKSPACE_PREFERENCES.oversightSections,
  );
  const rawOversight = asStringArray(record.oversightSections);
  const migratedOversight =
    oversightSections.length === 0 &&
    rawOversight !== undefined &&
    rawOversight.some((id) => LEGACY_OVERSIGHT.has(id))
      ? [...DEFAULT_WORKSPACE_PREFERENCES.oversightSections]
      : oversightSections;

  const rawBoard = asStringArray(record.boardSections);
  const boardSections = pickKnown<BoardSectionId>(
    rawBoard,
    BOARD_SET,
    DEFAULT_WORKSPACE_PREFERENCES.boardSections,
  );
  const migratedBoard =
    rawBoard !== undefined && rawBoard.some((id) => LEGACY_BOARD.has(id))
      ? [...DEFAULT_WORKSPACE_PREFERENCES.boardSections]
      : boardSections;

  const appearanceRecord =
    record.appearance &&
    typeof record.appearance === "object" &&
    !Array.isArray(record.appearance)
      ? (record.appearance as Record<string, unknown>)
      : {};
  const appearanceMode =
    typeof appearanceRecord.mode === "string" &&
    APPEARANCE_MODE_SET.has(appearanceRecord.mode)
      ? (appearanceRecord.mode as AppearanceMode)
      : DEFAULT_WORKSPACE_PREFERENCES.appearance.mode;
  const appearancePalette =
    typeof appearanceRecord.palette === "string" &&
    APPEARANCE_PALETTE_SET.has(appearanceRecord.palette)
      ? (appearanceRecord.palette as AppearancePalette)
      : DEFAULT_WORKSPACE_PREFERENCES.appearance.palette;

  return {
    hiddenModules: [...new Set(hidden)],
    homeWidgets: withFollowUps,
    oversightSections: migratedOversight,
    boardSections: migratedBoard,
    defaultHomeCategoryId,
    registerPresets: parsePresets(record.registerPresets),
    appearance: { mode: appearanceMode, palette: appearancePalette },
  };
}

export function workspacePreferencesToJson(prefs: WorkspacePreferences) {
  const parsed = parseWorkspacePreferences(prefs);
  return {
    hiddenModules: parsed.hiddenModules,
    homeWidgets: parsed.homeWidgets,
    oversightSections: parsed.oversightSections,
    boardSections: parsed.boardSections,
    defaultHomeCategoryId: parsed.defaultHomeCategoryId,
    registerPresets: parsed.registerPresets,
    appearance: parsed.appearance,
  };
}

export function isLockedWorkspaceModule(module: WorkspaceModuleId) {
  return LOCKED_WORKSPACE_MODULES.includes(module);
}

export const WORKSPACE_MODULE_OPTIONS = NAVIGATION_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({
    id: item.module,
    label: item.label,
    locked: isLockedWorkspaceModule(item.module),
  })),
);

export function isHomeWidgetVisible(
  prefs: WorkspacePreferences,
  id: HomeWidgetId,
) {
  return prefs.homeWidgets.includes(id);
}

export function isOversightSectionVisible(
  prefs: WorkspacePreferences,
  id: OversightSectionId,
) {
  return prefs.oversightSections.includes(id);
}

export function isBoardSectionVisible(
  prefs: WorkspacePreferences,
  id: BoardSectionId,
) {
  return prefs.boardSections.includes(id);
}

export function isModuleHidden(
  prefs: WorkspacePreferences,
  module: WorkspaceModuleId,
) {
  return prefs.hiddenModules.includes(module);
}

export function visibleNavigationSections(
  prefs: WorkspacePreferences,
  sections: NavigationSection[] = NAVIGATION_SECTIONS,
): NavigationSection[] {
  const hidden = new Set(prefs.hiddenModules);

  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !hidden.has(item.module)),
    }))
    .filter((section) => section.items.length > 0);
}

export function visibleStaticCommands(
  prefs: WorkspacePreferences,
  commands: StaticCommand[] = STATIC_COMMANDS,
) {
  const hidden = new Set(prefs.hiddenModules);
  return commands.filter((command) => !hidden.has(command.module));
}

export function resolvedDefaultHomeCategoryId(
  defaultId: string,
  categories: Array<{ id: string }>,
) {
  if (!defaultId) {
    return "";
  }

  return categories.some((category) => category.id === defaultId)
    ? defaultId
    : "";
}

export function resolveHomeCategoryId(
  urlCategory: string,
  defaultCategoryId: string,
) {
  if (urlCategory === "all") {
    return "";
  }

  if (urlCategory) {
    return urlCategory;
  }

  return defaultCategoryId;
}

export function homeCategorySelectValue(
  urlCategory: string,
  defaultCategoryId: string,
) {
  if (urlCategory === "all") {
    return "";
  }

  return urlCategory || defaultCategoryId;
}

export function homeCategoryFilterUpdate(
  nextValue: string,
  defaultCategoryId: string,
) {
  if (!nextValue && defaultCategoryId) {
    return "all";
  }

  return nextValue;
}

export function registerPresetHref(preset: SavedRegisterPreset) {
  const path = REGISTER_PRESET_PATHS[preset.module];
  return `${path}?${preset.query}`;
}

export function createRegisterPreset(input: {
  name: string;
  module: RegisterPresetModule;
  query: string;
}): SavedRegisterPreset | null {
  const name = input.name.trim().slice(0, MAX_PRESET_NAME);
  const query = sanitizeQuery(input.query);

  if (!name || !query || !PRESET_MODULE_SET.has(input.module)) {
    return null;
  }

  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `preset-${Date.now()}`,
    name,
    module: input.module,
    query,
  };
}

export function addRegisterPreset(
  prefs: WorkspacePreferences,
  preset: SavedRegisterPreset,
): WorkspacePreferences | null {
  if (prefs.registerPresets.length >= MAX_PRESETS) {
    return null;
  }

  return {
    ...prefs,
    registerPresets: [...prefs.registerPresets, preset],
  };
}

export function removeRegisterPreset(
  prefs: WorkspacePreferences,
  id: string,
): WorkspacePreferences {
  return {
    ...prefs,
    registerPresets: prefs.registerPresets.filter((preset) => preset.id !== id),
  };
}
