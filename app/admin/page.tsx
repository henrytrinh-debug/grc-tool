"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import {
  ErrorBanner,
  PageHeader,
  PageLoading,
  SchemaNotice,
  SectionCard,
} from "@/app/components/page-parts";
import {
  dangerButtonClassName,
  inputClassName,
  labelClassName,
  mutedTextClassName,
  pageClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/app/components/ui";
import {
  removeDemonstrationData,
  seedDemonstrationData,
} from "@/lib/admin/demo-data";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings/defaults";
import { useSettings } from "@/lib/settings/context";
import {
  BOARD_SECTION_OPTIONS,
  HOME_WIDGET_OPTIONS,
  OVERSIGHT_SECTION_OPTIONS,
  REGISTER_PRESET_MODULES,
  WORKSPACE_MODULE_OPTIONS,
  addRegisterPreset,
  createRegisterPreset,
  registerPresetHref,
  removeRegisterPreset,
  type RegisterPresetModule,
  type WorkspacePreferences,
} from "@/lib/settings/preferences";
import { LINE_OF_DEFENCE_OPTIONS, type LineOfDefence } from "@/lib/types/person";

const BANDS = ["Low", "Medium", "High", "Critical"] as const;

function PreferenceChecklist<T extends string>({
  options,
  checked,
  onToggle,
  disabled,
  lockedIds,
}: {
  options: { id: T; label: string }[];
  checked: (id: T) => boolean;
  onToggle: (id: T, next: boolean) => void;
  disabled?: boolean;
  lockedIds?: readonly string[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const locked = lockedIds?.includes(option.id);
        return (
          <label
            key={option.id}
            className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"
          >
            <input
              type="checkbox"
              className="mt-0.5"
              checked={checked(option.id)}
              disabled={disabled || locked}
              onChange={(event) => onToggle(option.id, event.target.checked)}
            />
            <span>
              {option.label}
              {locked ? " (always shown)" : ""}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function withPrefs(
  current: AppSettings,
  patch: Partial<WorkspacePreferences>,
): AppSettings {
  return {
    ...current,
    workspacePreferences: {
      ...current.workspacePreferences,
      ...patch,
    },
  };
}

export default function AdminPage() {
  const { user, authLoading } = useRequireAuth();
  const { loading } = useSettings();

  if (authLoading || loading || !user) {
    return <PageLoading />;
  }

  return <AdminSettings user={user} />;
}

function AdminSettings({ user }: { user: User }) {
  const {
    settings,
    categories,
    people,
    schemaReady,
    enterpriseReady,
    operatingReady,
    preferencesReady,
    governanceReady,
    obligationsReady,
    evidenceReady,
    evidenceStorageReady,
    demoIds,
    saveSettings,
    addCategory,
    updateCategory,
    deleteCategory,
    addPerson,
    updatePerson,
    deletePerson,
    setDemoIds,
    reload,
  } = useSettings();

  const [draft, setDraft] = useState<AppSettings>(settings);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [personName, setPersonName] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [personTitle, setPersonTitle] = useState("");
  const [personDepartment, setPersonDepartment] = useState("");
  const [personLod, setPersonLod] = useState<LineOfDefence>("first");
  const [presetName, setPresetName] = useState("");
  const [presetModule, setPresetModule] =
    useState<RegisterPresetModule>("risks");
  const [presetQuery, setPresetQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await saveSettings(draft);
      setMessage("Settings saved. Scoring, cadence, and labels now apply across the tool.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryName.trim()) {
      return;
    }

    setError(null);
    try {
      await addCategory(categoryName, categoryDescription);
      setCategoryName("");
      setCategoryDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add category");
    }
  }

  async function handleSeed() {
    if (!user?.email) {
      setError("User email not available");
      return;
    }

    if (demoIds) {
      setError(
        "Demonstration data is already loaded. Remove it first if you want a fresh set.",
      );
      return;
    }

    setSeeding(true);
    setError(null);
    setMessage(null);

    try {
      const ids = await seedDemonstrationData(
        {
          id: user.id,
          email: user.email,
        },
        {
          includeEnterprise: enterpriseReady,
          includeOperating: operatingReady,
          includeObligations: obligationsReady,
          includeEvidence: evidenceReady,
        },
      );
      await setDemoIds(ids);
      await reload();
      setMessage(
        "Demonstration data loaded. Open Home, Horizon, Board pack, Data quality, Obligations, and Evidence to walk the story.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load demonstration data",
      );
    } finally {
      setSeeding(false);
    }
  }

  async function handleRemoveDemo() {
    if (!demoIds || !user) {
      return;
    }

    const confirmed = window.confirm(
      "Remove the demonstration records? Your own data is left untouched.",
    );
    if (!confirmed) {
      return;
    }

    setSeeding(true);
    setError(null);
    setMessage(null);

    try {
      await removeDemonstrationData(user.id, demoIds);
      await setDemoIds(null);
      await reload();
      setMessage("Demonstration data removed.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to remove demonstration data",
      );
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className={pageClassName}>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <PageHeader
          title="Admin"
          description="Organisation identity, people, taxonomy, workspace layout, and demonstration data. Scoring and cadence live on each register’s Settings tab."
          breadcrumbs={[
            { href: "/", label: "Home" },
            { label: "Admin" },
          ]}
          actions={
            <Link href="/admin/import" className={secondaryButtonClassName}>
              Import CSV
            </Link>
          }
        />

        {!schemaReady && (
          <SchemaNotice>
            Run <code className="font-mono">supabase/schema/003_admin_settings.sql</code>{" "}
            in the Supabase SQL editor to enable saved settings, taxonomy, and
            demonstration data. Until then, built-in defaults are used.
          </SchemaNotice>
        )}

        {schemaReady && !enterpriseReady && (
          <SchemaNotice>
            Run <code className="font-mono">supabase/schema/004_enterprise.sql</code>{" "}
            after 003 to enable the people directory, assignees, risk status,
            control type, and category appetite.
          </SchemaNotice>
        )}

        {enterpriseReady && !operatingReady && (
          <SchemaNotice>
            Run <code className="font-mono">supabase/schema/005_operating.sql</code>{" "}
            after 004 to enable treatment target dates, incident lessons learned,
            and incident↔control links.
          </SchemaNotice>
        )}

        {schemaReady && !preferencesReady && (
          <SchemaNotice>
            Run <code className="font-mono">supabase/schema/006_workspace_preferences.sql</code>{" "}
            after 003 to save navigation, Home, Oversight, Board pack, and
            register-view preferences. Until then the current layout is used and
            workspace changes are not written.
          </SchemaNotice>
        )}

        {operatingReady && !governanceReady && (
          <SchemaNotice>
            Run <code className="font-mono">supabase/schema/007_governance.sql</code>{" "}
            after 005 to record immutable risk and incident change history and
            risk closure rationale.
          </SchemaNotice>
        )}

        {!obligationsReady && (
          <SchemaNotice>
            Run <code className="font-mono">supabase/schema/008_obligations.sql</code>{" "}
            to enable the obligations register and control coverage checks.
          </SchemaNotice>
        )}

        {!evidenceReady && (
          <SchemaNotice>
            Run <code className="font-mono">supabase/schema/009_evidence.sql</code>{" "}
            to enable evidence metadata. File uploads also need the private{" "}
            <code className="font-mono">grc-evidence</code> Storage bucket.
          </SchemaNotice>
        )}

        {evidenceReady && !evidenceStorageReady && (
          <SchemaNotice>
            Evidence metadata is available, but Storage is not. Create the
            private <code className="font-mono">grc-evidence</code> bucket with
            folder prefix <code className="font-mono">auth.uid()</code>. See{" "}
            <a
              className="underline"
              href="https://supabase.com/docs/guides/storage/security/access-control"
            >
              Storage Access Control
            </a>
            .
          </SchemaNotice>
        )}

        <ErrorBanner message={error} />
        {message && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            {message}
          </p>
        )}

        <form onSubmit={(event) => void handleSave(event)} className="flex flex-col gap-8">
          <SectionCard
            title="Organisation"
            description="Shown in the sidebar and used when you export or present the registers."
          >
            <label className="flex max-w-lg flex-col gap-1">
              <span className={labelClassName}>Organisation name</span>
              <input
                value={draft.organizationName}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    organizationName: event.target.value,
                  }))
                }
                className={inputClassName}
              />
            </label>
          </SectionCard>

          <SectionCard
            title="Register methodology"
            description="Scoring, review cadence, testing cadence, and issue due dates sit on each register’s Settings tab, next to the data they apply to."
          >
            <div className="flex flex-wrap gap-3 text-sm">
              <Link
                href="/risks?view=settings"
                className="font-medium text-teal-800 hover:underline dark:text-teal-300"
              >
                Risk scoring and review
              </Link>
              <Link
                href="/controls?view=settings"
                className="font-medium text-teal-800 hover:underline dark:text-teal-300"
              >
                Control testing cadence
              </Link>
              <Link
                href="/issues?view=settings"
                className="font-medium text-teal-800 hover:underline dark:text-teal-300"
              >
                Issue target dates
              </Link>
            </div>
          </SectionCard>

          <SectionCard
            title="Workspace"
            description="Hide overview modules and widgets you do not use. Direct URLs still work — this is presentation, not access control. Home and Settings stay visible. Register methodology is on each register’s Settings tab."
          >
            <fieldset
              disabled={!preferencesReady}
              className="flex flex-col gap-6 disabled:opacity-70"
            >
              <div>
                <p className={`mb-3 text-sm font-medium ${mutedTextClassName}`}>
                  Navigation modules
                </p>
                <PreferenceChecklist
                  options={WORKSPACE_MODULE_OPTIONS}
                  lockedIds={WORKSPACE_MODULE_OPTIONS.filter((option) => option.locked).map(
                    (option) => option.id,
                  )}
                  checked={(id) =>
                    !draft.workspacePreferences.hiddenModules.includes(id)
                  }
                  onToggle={(id, next) =>
                    setDraft((current) =>
                      withPrefs(current, {
                        hiddenModules: next
                          ? current.workspacePreferences.hiddenModules.filter(
                              (hidden) => hidden !== id,
                            )
                          : [
                              ...current.workspacePreferences.hiddenModules,
                              id,
                            ],
                      }),
                    )
                  }
                />
              </div>

              <div>
                <p className={`mb-3 text-sm font-medium ${mutedTextClassName}`}>
                  Home widgets
                </p>
                <PreferenceChecklist
                  options={HOME_WIDGET_OPTIONS}
                  checked={(id) =>
                    draft.workspacePreferences.homeWidgets.includes(id)
                  }
                  onToggle={(id, next) =>
                    setDraft((current) =>
                      withPrefs(current, {
                        homeWidgets: next
                          ? [...current.workspacePreferences.homeWidgets, id]
                          : current.workspacePreferences.homeWidgets.filter(
                              (widget) => widget !== id,
                            ),
                      }),
                    )
                  }
                />
              </div>

              <div>
                <p className={`mb-3 text-sm font-medium ${mutedTextClassName}`}>
                  Oversight sections
                </p>
                <PreferenceChecklist
                  options={OVERSIGHT_SECTION_OPTIONS}
                  checked={(id) =>
                    draft.workspacePreferences.oversightSections.includes(id)
                  }
                  onToggle={(id, next) =>
                    setDraft((current) =>
                      withPrefs(current, {
                        oversightSections: next
                          ? [
                              ...current.workspacePreferences.oversightSections,
                              id,
                            ]
                          : current.workspacePreferences.oversightSections.filter(
                              (section) => section !== id,
                            ),
                      }),
                    )
                  }
                />
              </div>

              <div>
                <p className={`mb-3 text-sm font-medium ${mutedTextClassName}`}>
                  Board pack sections
                </p>
                <PreferenceChecklist
                  options={BOARD_SECTION_OPTIONS}
                  checked={(id) =>
                    draft.workspacePreferences.boardSections.includes(id)
                  }
                  onToggle={(id, next) =>
                    setDraft((current) =>
                      withPrefs(current, {
                        boardSections: next
                          ? [...current.workspacePreferences.boardSections, id]
                          : current.workspacePreferences.boardSections.filter(
                              (section) => section !== id,
                            ),
                      }),
                    )
                  }
                />
              </div>

              <label className="flex max-w-lg flex-col gap-1">
                <span className={labelClassName}>Default Home taxonomy lens</span>
                <select
                  value={draft.workspacePreferences.defaultHomeCategoryId}
                  onChange={(event) =>
                    setDraft((current) =>
                      withPrefs(current, {
                        defaultHomeCategoryId: event.target.value,
                      }),
                    )
                  }
                  className={inputClassName}
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <p className={`mb-3 text-sm font-medium ${mutedTextClassName}`}>
                  Saved register views
                </p>
                <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_10rem_1fr_auto]">
                  <input
                    value={presetName}
                    onChange={(event) => setPresetName(event.target.value)}
                    placeholder="View name"
                    className={inputClassName}
                  />
                  <select
                    value={presetModule}
                    onChange={(event) =>
                      setPresetModule(event.target.value as RegisterPresetModule)
                    }
                    className={inputClassName}
                    aria-label="Register"
                  >
                    {REGISTER_PRESET_MODULES.map((register) => (
                      <option key={register} value={register}>
                        {register}
                      </option>
                    ))}
                  </select>
                  <input
                    value={presetQuery}
                    onChange={(event) => setPresetQuery(event.target.value)}
                    placeholder="severity=High,Critical"
                    className={inputClassName}
                  />
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    onClick={() => {
                      const preset = createRegisterPreset({
                        name: presetName,
                        module: presetModule,
                        query: presetQuery,
                      });
                      if (!preset) {
                        setError(
                          "A saved view needs a name and a query string such as severity=High,Critical.",
                        );
                        return;
                      }
                      setDraft((current) => {
                        const nextPrefs = addRegisterPreset(
                          current.workspacePreferences,
                          preset,
                        );
                        if (!nextPrefs) {
                          setError(
                            "You already have the maximum number of saved views.",
                          );
                          return current;
                        }
                        setPresetName("");
                        setPresetQuery("");
                        setError(null);
                        return withPrefs(current, {
                          registerPresets: nextPrefs.registerPresets,
                        });
                      });
                    }}
                  >
                    Add
                  </button>
                </div>
                {draft.workspacePreferences.registerPresets.length === 0 ? (
                  <p className={`text-sm ${mutedTextClassName}`}>
                    No saved views yet. Filter a register and choose Save view,
                    or add a query here.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                    {draft.workspacePreferences.registerPresets.map((preset) => (
                      <li
                        key={preset.id}
                        className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-950 dark:text-slate-50">
                            {preset.name}
                          </p>
                          <p className={`text-sm ${mutedTextClassName}`}>
                            {preset.module} · {preset.query}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={registerPresetHref(preset)}
                            className={secondaryButtonClassName}
                          >
                            Open
                          </Link>
                          <button
                            type="button"
                            className={dangerButtonClassName}
                            onClick={() =>
                              setDraft((current) =>
                                withPrefs(
                                  current,
                                  removeRegisterPreset(
                                    current.workspacePreferences,
                                    preset.id,
                                  ),
                                ),
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </fieldset>
          </SectionCard>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving || !schemaReady}
              className={primaryButtonClassName}
            >
              {saving ? "Saving..." : "Save settings"}
            </button>
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => setDraft(DEFAULT_SETTINGS)}
            >
              Reset form to defaults
            </button>
          </div>
        </form>

        <SectionCard
          title="Risk taxonomy"
          description="Categories used on the risk register. Unlinking a category from Admin leaves existing risks uncategorised."
        >
          <form
            onSubmit={(event) => void handleAddCategory(event)}
            className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
          >
            <input
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="Category name"
              className={inputClassName}
              disabled={!schemaReady}
            />
            <input
              value={categoryDescription}
              onChange={(event) => setCategoryDescription(event.target.value)}
              placeholder="Short description"
              className={inputClassName}
              disabled={!schemaReady}
            />
            <button
              type="submit"
              disabled={!schemaReady || !categoryName.trim()}
              className={secondaryButtonClassName}
            >
              Add
            </button>
          </form>

          {categories.length === 0 ? (
            <p className={`text-sm ${mutedTextClassName}`}>
              No categories yet. Add Cybersecurity, Operational, Financial, or
              load demonstration data.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {categories.map((category) => (
                <li
                  key={category.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-950 dark:text-slate-50">
                      {category.name}
                    </p>
                    {category.description && (
                      <p className={`text-sm ${mutedTextClassName}`}>
                        {category.description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {enterpriseReady && (
                      <select
                        value={category.appetite_band ?? "High"}
                        onChange={(event) => {
                          void updateCategory(category.id, {
                            name: category.name,
                            description: category.description,
                            appetite_band: event.target.value as
                              | "Low"
                              | "Medium"
                              | "High"
                              | "Critical",
                          }).catch((err: unknown) =>
                            setError(
                              err instanceof Error
                                ? err.message
                                : "Failed to update appetite",
                            ),
                          );
                        }}
                        className={`${inputClassName} max-w-44`}
                        aria-label={`${category.name} appetite`}
                      >
                        {BANDS.map((band) => (
                          <option key={band} value={band}>
                            Appetite {band}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      onClick={() => {
                        const name = window.prompt("Category name", category.name);
                        if (!name?.trim()) {
                          return;
                        }
                        const description = window.prompt(
                          "Description",
                          category.description,
                        );
                        void updateCategory(category.id, {
                          name,
                          description: description ?? category.description,
                          appetite_band: category.appetite_band,
                        }).catch((err: unknown) =>
                          setError(
                            err instanceof Error
                              ? err.message
                              : "Failed to update category",
                          ),
                        );
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className={dangerButtonClassName}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete “${category.name}”? Risks in this category become uncategorised.`,
                          )
                        ) {
                          void deleteCategory(category.id).catch(
                            (err: unknown) =>
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : "Failed to delete category",
                              ),
                          );
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="People directory"
          description="Accountable owners used on risks, controls, incidents, and issues. Add a person whose email matches your sign-in to use Assigned to me and My work."
        >
          {!enterpriseReady ? (
            <p className={`text-sm ${mutedTextClassName}`}>
              Available after running 004_enterprise.sql.
            </p>
          ) : (
            <>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!personName.trim() || !personEmail.trim()) {
                    return;
                  }
                  void addPerson({
                    name: personName,
                    email: personEmail,
                    title: personTitle,
                    department: personDepartment,
                    line_of_defence: personLod,
                  })
                    .then(() => {
                      setPersonName("");
                      setPersonEmail("");
                      setPersonTitle("");
                      setPersonDepartment("");
                      setPersonLod("first");
                    })
                    .catch((err: unknown) =>
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Failed to add person",
                      ),
                    );
                }}
                className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                <input
                  value={personName}
                  onChange={(event) => setPersonName(event.target.value)}
                  placeholder="Name"
                  className={inputClassName}
                />
                <input
                  value={personEmail}
                  onChange={(event) => setPersonEmail(event.target.value)}
                  placeholder="Email"
                  type="email"
                  className={inputClassName}
                />
                <input
                  value={personTitle}
                  onChange={(event) => setPersonTitle(event.target.value)}
                  placeholder="Title"
                  className={inputClassName}
                />
                <input
                  value={personDepartment}
                  onChange={(event) => setPersonDepartment(event.target.value)}
                  placeholder="Department"
                  className={inputClassName}
                />
                <select
                  value={personLod}
                  onChange={(event) =>
                    setPersonLod(event.target.value as LineOfDefence)
                  }
                  className={inputClassName}
                >
                  {LINE_OF_DEFENCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label.split(" — ")[0]}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!personName.trim() || !personEmail.trim()}
                  className={`${secondaryButtonClassName} self-end`}
                >
                  Add
                </button>
              </form>
              {people.length === 0 ? (
                <p className={`text-sm ${mutedTextClassName}`}>
                  No people yet. Load demonstration data or add the first owner.
                </p>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                  {people.map((person) => (
                    <li
                      key={person.id}
                      className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-950 dark:text-slate-50">
                          {person.name}
                        </p>
                        <p className={`text-sm ${mutedTextClassName}`}>
                          {person.email}
                          {person.title ? ` · ${person.title}` : ""}
                          {person.department ? ` · ${person.department}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={secondaryButtonClassName}
                          onClick={() => {
                            const name = window.prompt("Name", person.name);
                            if (!name?.trim()) {
                              return;
                            }
                            const email = window.prompt("Email", person.email);
                            if (!email?.trim()) {
                              return;
                            }
                            void updatePerson(person.id, {
                              name,
                              email,
                              title: person.title,
                              department: person.department,
                              line_of_defence: person.line_of_defence,
                            }).catch((err: unknown) =>
                              setError(
                                err instanceof Error
                                  ? err.message
                                  : "Failed to update person",
                              ),
                            );
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className={dangerButtonClassName}
                          onClick={() => {
                            if (window.confirm(`Remove ${person.name}?`)) {
                              void deletePerson(person.id).catch(
                                (err: unknown) =>
                                  setError(
                                    err instanceof Error
                                      ? err.message
                                      : "Failed to delete person",
                                  ),
                              );
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </SectionCard>

        <SectionCard
          title="Demonstration data"
          description="Load a sample environment — people, taxonomy with appetite, 70+ register records, mixed control tests, RCSA reviews, open incidents, findings in flight, treatment dates, and incident–control links — to walk the product."
        >
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!schemaReady || seeding}
              onClick={() => void handleSeed()}
              className={primaryButtonClassName}
            >
              {seeding ? "Working..." : "Load demonstration data"}
            </button>
            <button
              type="button"
              disabled={!schemaReady || seeding || !demoIds}
              onClick={() => void handleRemoveDemo()}
              className={dangerButtonClassName}
            >
              Remove demonstration data
            </button>
          </div>
          <p className={`mt-3 text-sm ${mutedTextClassName}`}>
            {demoIds
              ? "A demonstration set is currently loaded for this account."
              : "No demonstration set is recorded for this account."}
          </p>
        </SectionCard>
      </main>
    </div>
  );
}
