"use client";

import { useEffect } from "react";

/**
 * Warns on tab close/refresh when a form is dirty. Call `confirmLeave`
 * before in-app Cancel / Back navigation.
 */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) {
      return;
    }

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function confirmLeave() {
    if (!dirty) {
      return true;
    }

    return window.confirm("You have unsaved changes. Leave this page?");
  }

  return { confirmLeave };
}
