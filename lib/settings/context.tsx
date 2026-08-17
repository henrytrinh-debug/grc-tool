"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type DemoIds,
  type OrgSettingsRow,
  type RiskCategory,
} from "@/lib/settings/defaults";
import type { OrgPerson } from "@/lib/types/person";
import {
  hydrateSettings,
  isMissingRelationError,
  settingsFromRow,
  settingsToRow,
  validateSettings,
} from "@/lib/settings/store";

type SettingsContextValue = {
  settings: AppSettings;
  categories: RiskCategory[];
  people: OrgPerson[];
  schemaReady: boolean;
  enterpriseReady: boolean;
  demoIds: DemoIds | null;
  loading: boolean;
  reload: () => Promise<void>;
  saveSettings: (next: AppSettings) => Promise<void>;
  addCategory: (name: string, description: string) => Promise<void>;
  updateCategory: (
    id: string,
    updates: Pick<RiskCategory, "name" | "description"> & {
      appetite_band?: RiskCategory["appetite_band"];
    },
  ) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addPerson: (person: Omit<OrgPerson, "id" | "owner_id" | "owner_email">) => Promise<void>;
  updatePerson: (
    id: string,
    updates: Omit<OrgPerson, "id" | "owner_id" | "owner_email">,
  ) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
  setDemoIds: (ids: DemoIds | null) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState<RiskCategory[]>([]);
  const [people, setPeople] = useState<OrgPerson[]>([]);
  const [schemaReady, setSchemaReady] = useState(false);
  const [enterpriseReady, setEnterpriseReady] = useState(false);
  const [demoIds, setDemoIdsState] = useState<DemoIds | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      hydrateSettings(DEFAULT_SETTINGS);
      setSettings(DEFAULT_SETTINGS);
      setCategories([]);
      setPeople([]);
      setSchemaReady(false);
      setEnterpriseReady(false);
      setDemoIdsState(null);
      setLoading(false);
      return;
    }

    const [settingsResult, categoriesResult, peopleResult] = await Promise.all([
      supabase
        .from("org_settings")
        .select("*")
        .eq("owner_id", session.user.id)
        .maybeSingle(),
      supabase
        .from("risk_categories")
        .select("*")
        .eq("owner_id", session.user.id)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("org_people")
        .select("*")
        .eq("owner_id", session.user.id)
        .order("name", { ascending: true }),
    ]);

    if (
      (settingsResult.error && isMissingRelationError(settingsResult.error)) ||
      (categoriesResult.error && isMissingRelationError(categoriesResult.error))
    ) {
      setSchemaReady(false);
      setEnterpriseReady(false);
      hydrateSettings(DEFAULT_SETTINGS);
      setSettings(DEFAULT_SETTINGS);
      setCategories([]);
      setPeople([]);
      setDemoIdsState(null);
      setLoading(false);
      return;
    }

    if (settingsResult.error) {
      throw settingsResult.error;
    }

    if (categoriesResult.error) {
      throw categoriesResult.error;
    }

    const peopleMissing =
      Boolean(peopleResult.error) &&
      isMissingRelationError(peopleResult.error ?? {});

    if (peopleResult.error && !peopleMissing) {
      throw peopleResult.error;
    }

    setSchemaReady(true);
    setEnterpriseReady(!peopleMissing);
    const nextSettings = settingsResult.data
      ? settingsFromRow(settingsResult.data as OrgSettingsRow)
      : DEFAULT_SETTINGS;
    hydrateSettings(nextSettings);
    setSettings(nextSettings);
    setCategories((categoriesResult.data ?? []) as RiskCategory[]);
    setPeople(peopleMissing ? [] : ((peopleResult.data ?? []) as OrgPerson[]));
    setDemoIdsState(
      ((settingsResult.data as OrgSettingsRow | null)?.demo_ids ?? null) as
        | DemoIds
        | null,
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void reload().catch(() => {
        setSchemaReady(false);
        setEnterpriseReady(false);
        setLoading(false);
      });
    }, 0);

    const supabase = getSupabaseClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") {
        return;
      }

      void reload().catch(() => {
        setSchemaReady(false);
        setEnterpriseReady(false);
        setLoading(false);
      });
    });

    return () => {
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [reload]);

  const saveSettings = useCallback(
    async (next: AppSettings) => {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be signed in to save settings");
      }

      const invalid = validateSettings(next);
      if (invalid) {
        throw new Error(invalid);
      }

      const normalised: AppSettings = {
        ...next,
        organizationName: next.organizationName.trim(),
      };

      const { error } = await supabase.from("org_settings").upsert({
        owner_id: user.id,
        owner_email: user.email,
        ...settingsToRow(normalised),
        demo_ids: demoIds,
      });

      if (error) {
        throw error;
      }

      hydrateSettings(normalised);
      setSettings(normalised);
    },
    [demoIds],
  );

  const addCategory = useCallback(async (name: string, description: string) => {
    const supabase = getSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("You must be signed in to add a category");
    }

    const { error } = await supabase.from("risk_categories").insert({
      name: name.trim(),
      description: description.trim(),
      sort_order: categories.length,
      owner_id: user.id,
      owner_email: user.email,
    });

    if (error) {
      throw error;
    }

    await reload();
  }, [categories.length, reload]);

  const updateCategory = useCallback(
    async (
      id: string,
      updates: Pick<RiskCategory, "name" | "description"> & {
        appetite_band?: RiskCategory["appetite_band"];
      },
    ) => {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be signed in to update a category");
      }

      const { error } = await supabase
        .from("risk_categories")
        .update({
          name: updates.name.trim(),
          description: updates.description.trim(),
          ...(updates.appetite_band
            ? { appetite_band: updates.appetite_band }
            : {}),
        })
        .eq("id", id)
        .eq("owner_id", user.id);

      if (error) {
        throw error;
      }

      await reload();
    },
    [reload],
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be signed in to delete a category");
      }

      const { error } = await supabase
        .from("risk_categories")
        .delete()
        .eq("id", id)
        .eq("owner_id", user.id);

      if (error) {
        throw error;
      }

      await reload();
    },
    [reload],
  );

  const addPerson = useCallback(
    async (person: Omit<OrgPerson, "id" | "owner_id" | "owner_email">) => {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be signed in to add a person");
      }

      const { error } = await supabase.from("org_people").insert({
        name: person.name.trim(),
        email: person.email.trim().toLowerCase(),
        title: person.title.trim(),
        department: person.department.trim(),
        line_of_defence: person.line_of_defence,
        owner_id: user.id,
        owner_email: user.email,
      });

      if (error) {
        throw error;
      }

      await reload();
    },
    [reload],
  );

  const updatePerson = useCallback(
    async (
      id: string,
      updates: Omit<OrgPerson, "id" | "owner_id" | "owner_email">,
    ) => {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be signed in to update a person");
      }

      const { error } = await supabase
        .from("org_people")
        .update({
          name: updates.name.trim(),
          email: updates.email.trim().toLowerCase(),
          title: updates.title.trim(),
          department: updates.department.trim(),
          line_of_defence: updates.line_of_defence,
        })
        .eq("id", id)
        .eq("owner_id", user.id);

      if (error) {
        throw error;
      }

      await reload();
    },
    [reload],
  );

  const deletePerson = useCallback(
    async (id: string) => {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be signed in to delete a person");
      }

      const { error } = await supabase
        .from("org_people")
        .delete()
        .eq("id", id)
        .eq("owner_id", user.id);

      if (error) {
        throw error;
      }

      await reload();
    },
    [reload],
  );

  const setDemoIds = useCallback(
    async (ids: DemoIds | null) => {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be signed in to update demonstration data");
      }

      const { error } = await supabase.from("org_settings").upsert({
        owner_id: user.id,
        owner_email: user.email,
        ...settingsToRow(settings),
        demo_ids: ids,
      });

      if (error) {
        throw error;
      }

      setDemoIdsState(ids);
    },
    [settings],
  );

  const value = useMemo(
    () => ({
      settings,
      categories,
      people,
      schemaReady,
      enterpriseReady,
      demoIds,
      loading,
      reload,
      saveSettings,
      addCategory,
      updateCategory,
      deleteCategory,
      addPerson,
      updatePerson,
      deletePerson,
      setDemoIds,
    }),
    [
      addCategory,
      addPerson,
      categories,
      deleteCategory,
      deletePerson,
      demoIds,
      enterpriseReady,
      loading,
      people,
      reload,
      saveSettings,
      schemaReady,
      settings,
      setDemoIds,
      updateCategory,
      updatePerson,
    ],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  const value = useContext(SettingsContext);

  if (!value) {
    throw new Error("useSettings must be used within SettingsProvider");
  }

  return value;
}
