import { useEffect, useState } from "react";
import {
  ACTIVE_CLIENT_DOSSIER_STORAGE_KEY,
  MOBILE_WORKSPACE_STORAGE_PREFIX,
  emptyActiveClientDossier,
  normalizeActiveClientDossier,
  type MobileActiveClientDossier,
} from "./activeClientDossier";

function readStoredActiveClientDossier(storageKey: string | null) {
  if (typeof window === "undefined" || !storageKey) {
    return emptyActiveClientDossier;
  }

  try {
    const storedValue = window.localStorage.getItem(storageKey);
    if (!storedValue) {
      return emptyActiveClientDossier;
    }

    return normalizeActiveClientDossier(JSON.parse(storedValue) as MobileActiveClientDossier);
  } catch {
    return emptyActiveClientDossier;
  }
}

export default function useActiveClientDossier(userId: string | null) {
  const storageKey = userId ? `${MOBILE_WORKSPACE_STORAGE_PREFIX}:${userId}` : null;
  const [activeClientDossier, setActiveClientDossier] = useState<MobileActiveClientDossier>(() => {
    return readStoredActiveClientDossier(storageKey);
  });

  useEffect(() => {
    if (typeof window === "undefined" || !storageKey) {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(activeClientDossier));
  }, [activeClientDossier, storageKey]);

  useEffect(() => {
    setActiveClientDossier(readStoredActiveClientDossier(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !storageKey) {
      return;
    }

    const legacyValue = window.localStorage.getItem(ACTIVE_CLIENT_DOSSIER_STORAGE_KEY);

    if (!legacyValue || window.localStorage.getItem(storageKey)) {
      window.localStorage.removeItem(ACTIVE_CLIENT_DOSSIER_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(storageKey, legacyValue);
    window.localStorage.removeItem(ACTIVE_CLIENT_DOSSIER_STORAGE_KEY);
    setActiveClientDossier(readStoredActiveClientDossier(storageKey));
  }, [storageKey]);

  const updateActiveClientDossier = (partial: Partial<MobileActiveClientDossier>) => {
    setActiveClientDossier((current) =>
      normalizeActiveClientDossier({
        ...current,
        ...partial,
      })
    );
  };

  const replaceActiveClientDossier = (nextValue: Partial<MobileActiveClientDossier>) => {
    setActiveClientDossier(normalizeActiveClientDossier(nextValue));
  };

  const clearActiveClientDossier = () => {
    setActiveClientDossier(emptyActiveClientDossier);
  };

  return {
    activeClientDossier,
    updateActiveClientDossier,
    replaceActiveClientDossier,
    clearActiveClientDossier,
  };
}
