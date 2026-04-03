import { useEffect, useState } from "react";
import {
  ACTIVE_CLIENT_DOSSIER_STORAGE_KEY,
  emptyActiveClientDossier,
  normalizeActiveClientDossier,
  type MobileActiveClientDossier,
} from "./activeClientDossier";

export default function useActiveClientDossier() {
  const [activeClientDossier, setActiveClientDossier] = useState<MobileActiveClientDossier>(() => {
    if (typeof window === "undefined") {
      return emptyActiveClientDossier;
    }

    try {
      const storedValue = window.localStorage.getItem(ACTIVE_CLIENT_DOSSIER_STORAGE_KEY);
      if (!storedValue) {
        return emptyActiveClientDossier;
      }

      return normalizeActiveClientDossier(JSON.parse(storedValue) as MobileActiveClientDossier);
    } catch (_error) {
      return emptyActiveClientDossier;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      ACTIVE_CLIENT_DOSSIER_STORAGE_KEY,
      JSON.stringify(activeClientDossier)
    );
  }, [activeClientDossier]);

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
