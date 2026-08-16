"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type EntityLinksConfig<TRow, TLinked> = {
  /** Join table name, e.g. "risk_controls". */
  table: string;
  /** Select string for the join query, including the embedded relation. */
  select: string;
  /** Join column holding the id of the record being edited, e.g. "risk_id". */
  parentColumn: string;
  parentId: string;
  /** Join column holding the linked entity's id, e.g. "control_id". */
  childColumn: string;
  /** Turns raw join rows into the shape the page renders. */
  parse: (rows: TRow[]) => TLinked[];
  /** Lowercase singular used in error messages, e.g. "control". */
  label: string;
  onError: (message: string | null) => void;
};

/**
 * Owns the link/unlink lifecycle for one join table: the linked rows, the
 * search and select state that `LinkedEntitiesPanel` renders, and the insert /
 * delete calls.
 *
 * `refresh` is stable and records the owner id it is called with, so pages only
 * need to pass the owner id once during their initial load.
 */
export function useEntityLinks<TRow, TLinked>(
  config: EntityLinksConfig<TRow, TLinked>,
) {
  const configRef = useRef(config);
  const ownerIdRef = useRef<string | null>(null);

  const [linked, setLinked] = useState<TLinked[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [linking, setLinking] = useState(false);
  const [unlinkingLinkId, setUnlinkingLinkId] = useState<string | null>(null);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const refresh = useCallback(async (ownerId: string) => {
    const { table, select, parentColumn, parentId, parse } = configRef.current;
    ownerIdRef.current = ownerId;

    const { data, error } = await getSupabaseClient()
      .from(table)
      .select(select)
      .eq("owner_id", ownerId)
      .eq(parentColumn, parentId);

    if (error) {
      throw error;
    }

    setLinked(parse((data ?? []) as TRow[]));
  }, []);

  const link = useCallback(async () => {
    const { table, parentColumn, parentId, childColumn, label, onError } =
      configRef.current;
    const ownerId = ownerIdRef.current;

    if (!selectedId || !ownerId) {
      return;
    }

    setLinking(true);
    onError(null);

    try {
      const { error } = await getSupabaseClient()
        .from(table)
        .insert({
          [parentColumn]: parentId,
          [childColumn]: selectedId,
          owner_id: ownerId,
        });

      if (error) {
        throw error;
      }

      setSelectedId("");
      setSearch("");
      await refresh(ownerId);
    } catch (err) {
      onError(
        err instanceof Error ? err.message : `Failed to link ${label}`,
      );
    } finally {
      setLinking(false);
    }
  }, [refresh, selectedId]);

  const unlink = useCallback(
    async (linkId: string) => {
      const { table, label, onError } = configRef.current;
      const ownerId = ownerIdRef.current;

      if (!ownerId) {
        return;
      }

      setUnlinkingLinkId(linkId);
      onError(null);

      try {
        const { error } = await getSupabaseClient()
          .from(table)
          .delete()
          .eq("id", linkId)
          .eq("owner_id", ownerId);

        if (error) {
          throw error;
        }

        await refresh(ownerId);
      } catch (err) {
        onError(
          err instanceof Error ? err.message : `Failed to unlink ${label}`,
        );
      } finally {
        setUnlinkingLinkId(null);
      }
    },
    [refresh],
  );

  return {
    linked,
    refresh,
    /** Spread into `LinkedEntitiesPanel` alongside its presentational props. */
    panelProps: {
      search,
      selectedId,
      linking,
      unlinkingLinkId,
      onSearchChange: setSearch,
      onSelectedChange: setSelectedId,
      onLink: () => void link(),
      onUnlink: (linkId: string) => void unlink(linkId),
    },
  };
}
