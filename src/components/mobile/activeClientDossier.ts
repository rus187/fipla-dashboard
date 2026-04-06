export type MobileActiveClientDossier = {
  prenom: string;
  nom: string;
  zip: string;
  locality: string;
  etatCivil: string;
  enfants: number;
  revenuImposableIfd: number;
  revenuImposableIcc: number;
  fortuneImposable: number;
  troisiemePilier: number;
  rachatLpp: number;
};

export const ACTIVE_CLIENT_DOSSIER_STORAGE_KEY = "fipla-mobile-active-client-dossier";
export const MOBILE_WORKSPACE_STORAGE_PREFIX = "fipla-mobile-workspace";

export const emptyActiveClientDossier: MobileActiveClientDossier = {
  prenom: "",
  nom: "",
  zip: "",
  locality: "",
  etatCivil: "",
  enfants: 0,
  revenuImposableIfd: 0,
  revenuImposableIcc: 0,
  fortuneImposable: 0,
  troisiemePilier: 0,
  rachatLpp: 0,
};

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function normalizeActiveClientDossier(
  value: Partial<MobileActiveClientDossier> | null | undefined
): MobileActiveClientDossier {
  return {
    prenom: typeof value?.prenom === "string" ? value.prenom : "",
    nom: typeof value?.nom === "string" ? value.nom : "",
    zip: typeof value?.zip === "string" ? value.zip : "",
    locality: typeof value?.locality === "string" ? value.locality : "",
    etatCivil: typeof value?.etatCivil === "string" ? value.etatCivil : "",
    enfants: Math.max(0, Math.round(normalizeNumber(value?.enfants))),
    revenuImposableIfd: Math.max(0, Math.round(normalizeNumber(value?.revenuImposableIfd))),
    revenuImposableIcc: Math.max(0, Math.round(normalizeNumber(value?.revenuImposableIcc))),
    fortuneImposable: Math.max(0, Math.round(normalizeNumber(value?.fortuneImposable))),
    troisiemePilier: Math.max(0, Math.round(normalizeNumber(value?.troisiemePilier))),
    rachatLpp: Math.max(0, Math.round(normalizeNumber(value?.rachatLpp))),
  };
}

export function getActiveClientDossierLabel(dossier: MobileActiveClientDossier) {
  const displayName = `${dossier.prenom} ${dossier.nom}`.trim();
  return displayName.length > 0 ? displayName : "Dossier actif en cours";
}

export function hasActiveClientDossier(dossier: MobileActiveClientDossier) {
  return Object.entries(dossier).some(([, value]) => {
    if (typeof value === "number") {
      return value !== 0;
    }

    if (typeof value === "string") {
      return value.trim().length > 0;
    }

    return false;
  });
}
