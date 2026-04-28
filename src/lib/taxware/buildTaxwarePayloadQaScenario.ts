// QA mapping UI → TaxWare — vérification complète de buildTaxwarePayload.
// Ce scénario sert uniquement de référence de contrôle visuel et de
// vérification manuelle. Il n'est pas utilisé comme source de calcul métier.
//
// Objectif : prouver que toutes les valeurs Personne 1 ET Personne 2 sont
// correctement transmises dans le payload, sans perte ni double comptage.
//
// Phase 8.1 — Inclut la séparation 3a / rachat LPP par personne avec
// fallback rétrocompatible vers les anciens champs ménage.

import { buildTaxwarePayload } from "./buildTaxwarePayload";

// ─── Utilitaire ───────────────────────────────────────────────────────────────

export function formatTaxwareQaAmount(value: number): string {
  return (
    new Intl.NumberFormat("fr-CH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value) + " CHF"
  );
}

// ─── Valeurs d'entrée — distinctes pour éviter toute confusion ───────────────
//
// Personne 1 :
//   salaire       : 150 000
//   AVS           :  11 000
//   LPP           :  12 000
//   3e pilier     :   7 000
//   rachat LPP    :  20 000
//
// Personne 2 :
//   salaire       :  50 000
//   AVS           :   9 000
//   LPP           :   8 000
//   3e pilier     :   4 000
//   rachat LPP    :  10 000
//
// Revenus complémentaires :
//   revenu de fortune   :  6 000
//   dividendes priv.    : 30 000   ← NB : non transmis par buildTaxwarePayload
//                                     (champ absent de la signature actuelle).
//
// Fortune :
//   liquidités                          :    50 000
//   fortune mobilière                   :   250 000
//   immobilier                          :   800 000
//   valeur entreprise FIPLA indicative  : 2 000 000   ← non injectée TaxWare
//   dettes                              :   300 000
//   intérêts hypothécaires              :    12 000
//   frais immobiliers                   :    15 000

export const buildTaxwarePayloadQaInputs = {
  // Localisation
  zip: "2000",
  city: "Neuchâtel",
  year: 2026 as const,
  partnership: "Marriage" as const,
  childrenCount: 0,

  // Personne 1
  netWages: 150_000,
  pensionIncome: 11_000 + 12_000, // AVS + LPP combinés (mapping actuel)
  hasOasiPensions: true,
  thirdPillar: 7_000,
  lppBuyback: 20_000,

  // Personne 2
  spouseNetWages: 50_000,
  spousePensionIncome: 9_000 + 8_000, // AVS + LPP conjoint combinés
  spouseHasOasiPensions: true,
  spouseThirdPillar: 4_000,
  spouseLppBuyback: 10_000,

  // Revenus de fortune / divers
  assetIncome: 6_000,
  miscIncome: 0,

  // Fortune & dettes (la valeur entreprise FIPLA indicative N'EST PAS incluse)
  // Assets attendus = liquidités + fortune mobilière + immobilier
  //                 = 50 000 + 250 000 + 800 000 = 1 100 000
  assets: 50_000 + 250_000 + 800_000,
  debts: 300_000,
  debtInterests: 12_000,

  // Charges déductibles (frais immobiliers vont dans EffectiveExpenses
  // du tableau RealEstates ci-dessous)
  miscExpenses: 0,

  realEstates: [
    {
      taxableValue: 800_000,
      rentalIncome: 0,
      effectiveExpenses: 15_000,
    },
  ],
};

// ─── Exécution du builder ─────────────────────────────────────────────────────

export const buildTaxwarePayloadQaResult = buildTaxwarePayload(
  buildTaxwarePayloadQaInputs
);

// ─── Valeurs attendues dans le payload ───────────────────────────────────────

export const buildTaxwarePayloadQaExpected = {
  // ── Localisation ──
  Zip: 2000,
  City: "Neuchâtel",
  Year: 2026,
  Partnership: "Marriage",
  NumChildren: 0,

  // ── Personne 1 ──
  PersonLeading: {
    NetWages: 150_000,
    PensionIncome: 23_000, // 11 000 + 12 000
    HasOasiPensions: true,
    OtherIncome: 0,
    ThirdPillarContribution: 7_000,
    HasLobContributions: true,
    LobContributions: 20_000,
  },

  // ── Personne 2 ── (CRITIQUE : doit être présent quand Marriage)
  PersonSecond: {
    NetWages: 50_000,
    PensionIncome: 17_000, // 9 000 + 8 000
    HasOasiPensions: true,
    OtherIncome: 0,
    ThirdPillarContribution: 4_000,
    HasLobContributions: true,
    LobContributions: 10_000,
  },

  // ── Revenus de fortune ──
  AssetIncome: 6_000,

  // ── Fortune & dettes ──
  Assets: 1_100_000, // 50 000 + 250 000 + 800 000 (sans valeur entreprise)
  Debts: 300_000,
  DebtInterests: 12_000,

  // ── Divers ──
  MiscIncome: 0,
  MiscExpenses: 0,

  // ── Immobilier ──
  RealEstates: [
    {
      TaxableValue: 800_000,
      RentalIncome: 0,
      EffectiveExpenses: 15_000,
    },
  ],

  // ── Total wages contrôle ──
  // PersonLeading.NetWages + PersonSecond.NetWages = 150 000 + 50 000 = 200 000
  totalNetWagesControl: 200_000,

  formatted: {
    leadingNetWages: "150'000 CHF",
    secondNetWages: "50'000 CHF",
    totalNetWages: "200'000 CHF",
    leadingThirdPillar: "7'000 CHF",
    secondThirdPillar: "4'000 CHF",
    leadingLpp: "20'000 CHF",
    secondLpp: "10'000 CHF",
    assets: "1'100'000 CHF",
    debts: "300'000 CHF",
    debtInterests: "12'000 CHF",
  },
} as const;

// ─── Champs volontairement NON transmis à TaxWare dans cette phase ───────────

export const buildTaxwarePayloadQaExclusions = [
  {
    field: "valeurFiscaleEntrepriseParticipation",
    rawValue: 2_000_000,
    reason:
      "Lecture FIPLA indicative cantonale uniquement. Phase actuelle : non injectée dans Assets ni dans aucun champ TaxWare.",
    consumedBy: "applyCantonalRules → fortune cantonale corrigée indicative",
  },
  {
    field: "dividendesPriviligies",
    rawValue: 30_000,
    reason:
      "Le builder buildTaxwarePayload n'expose pas actuellement de paramètre PrivilegedDividends. Le champ existe dans la référence TaxWare mais n'est pas câblé dans la signature de la fonction.",
    consumedBy: "(non câblé dans cette phase — à raccorder lors d'une phase dédiée)",
  },
] as const;

// ─── Checkpoints de vérification manuelle ────────────────────────────────────

export const buildTaxwarePayloadQaCheckpoints = [
  {
    step: 1,
    field: "Partnership",
    expected: '"Marriage"',
    visualCheck:
      "Quand dossier.famille.aConjoint = true, le payload doit contenir Partnership: 'Marriage' et un objet PersonSecond.",
  },
  {
    step: 2,
    field: "PersonLeading.NetWages",
    expected: "150'000",
    visualCheck:
      "PersonLeading.NetWages doit recevoir EXACTEMENT le salaire Personne 1 (dossier.revenus.salaire), jamais sommé avec Personne 2.",
  },
  {
    step: 3,
    field: "PersonSecond.NetWages",
    expected: "50'000",
    visualCheck:
      "CRITIQUE : PersonSecond.NetWages doit recevoir le salaire Personne 2 (dossier.revenus.salaireConjoint). Si manquant ou à 0, vérifier dossier.famille.aConjoint et le mapping spouseNetWages.",
  },
  {
    step: 4,
    field: "Total wages contrôle",
    expected: "PersonLeading.NetWages + PersonSecond.NetWages = 200'000",
    visualCheck:
      "La somme des deux NetWages doit être égale à la somme UI saisie. Si seule une valeur est présente, PersonSecond a été perdu.",
  },
  {
    step: 5,
    field: "PersonLeading.ThirdPillarContribution / PersonSecond.ThirdPillarContribution",
    expected: "7'000 / 4'000 (séparés)",
    visualCheck:
      "Les 3e piliers doivent être transmis séparément — jamais agrégés en un seul champ ménage.",
  },
  {
    step: 6,
    field: "PersonLeading.LobContributions / PersonSecond.LobContributions",
    expected: "20'000 / 10'000 (séparés)",
    visualCheck:
      "Les rachats LPP doivent être transmis par personne. HasLobContributions = true si NetWages > 0 OU LobContributions > 0 (salarié = LPP obligatoire, même sans rachat).",
  },
  {
    step: 7,
    field: "AssetIncome",
    expected: "6'000",
    visualCheck:
      "AssetIncome reçoit uniquement le revenu de fortune. Ne doit PAS être confondu avec Assets ni double-compté.",
  },
  {
    step: 8,
    field: "Assets",
    expected: "1'100'000 (50'000 + 250'000 + 800'000)",
    visualCheck:
      "Assets agrège uniquement liquidités + fortune mobilière + immobilier. La valeur fiscale entreprise FIPLA indicative (2'000'000) ne doit PAS être incluse.",
  },
  {
    step: 9,
    field: "Debts / DebtInterests",
    expected: "300'000 / 12'000",
    visualCheck:
      "Dettes dans Debts, intérêts passifs dans DebtInterests — jamais inversés ni dans MiscExpenses.",
  },
  {
    step: 10,
    field: "RealEstates[0]",
    expected: "{ TaxableValue: 800'000, RentalIncome: 0, EffectiveExpenses: 15'000 }",
    visualCheck:
      "Frais immobiliers vont dans EffectiveExpenses du tableau RealEstates, jamais dans MiscExpenses.",
  },
] as const;

// ─── Phase 8.1 — Tests 3a / rachat LPP par personne ──────────────────────────
//
// Logique de lecture (App.tsx) :
//   thirdPillarP1  = fiscalite.troisiemePilierPersonne1 ?? fiscalite.troisiemePilierSimule ?? 0
//   thirdPillarP2  = fiscalite.troisiemePilierPersonne2 ?? 0
//   lppBuybackP1   = fiscalite.rachatLppPersonne1       ?? fiscalite.rachatLpp           ?? 0
//   lppBuybackP2   = fiscalite.rachatLppPersonne2       ?? 0
//
// Protection : NaN, undefined, négatif → 0

// ── Test 1 : couple complet — 3a et LPP saisis séparément P1/P2 ─────────────

export const buildTaxwarePayloadQaP1P2CoupleInputs = {
  zip: "2000",
  city: "Neuchâtel",
  year: 2026 as const,
  partnership: "Marriage" as const,
  childrenCount: 0,

  // Personne 1
  netWages: 150_000,
  thirdPillar: 7_000,    // ← thirdPillarP1
  lppBuyback: 20_000,    // ← lppBuybackP1

  // Personne 2
  spouseNetWages: 50_000,
  spouseThirdPillar: 4_000,    // ← thirdPillarP2
  spouseLppBuyback: 10_000,    // ← lppBuybackP2

  assets: 0,
  debts: 0,
};

export const buildTaxwarePayloadQaP1P2CoupleResult = buildTaxwarePayload(
  buildTaxwarePayloadQaP1P2CoupleInputs
);

export const buildTaxwarePayloadQaP1P2CoupleExpected = {
  PersonLeading: {
    NetWages: 150_000,
    ThirdPillarContribution: 7_000,
    LobContributions: 20_000,
    HasLobContributions: true,
  },
  PersonSecond: {
    NetWages: 50_000,
    ThirdPillarContribution: 4_000,
    LobContributions: 10_000,
    HasLobContributions: true,
  },
  formatted: {
    leadingThirdPillar: "7'000 CHF",
    secondThirdPillar: "4'000 CHF",
    leadingLpp: "20'000 CHF",
    secondLpp: "10'000 CHF",
  },
} as const;

// ── Test 2 : ancien dossier — fallback vers troisiemePilierSimule / rachatLpp

// Simule le fallback côté App.tsx :
// fiscalite = { troisiemePilierSimule: 5000, rachatLpp: 20000 }
// (champs P1/P2 absents)
//
// Le helper App.tsx calcule :
//   thirdPillarP1 = undefined ?? 5000 ?? 0 = 5000
//   thirdPillarP2 = undefined ?? 0         = 0
//   lppBuybackP1  = undefined ?? 20000 ?? 0 = 20000
//   lppBuybackP2  = undefined ?? 0          = 0
//
// puis appelle buildTaxwarePayload avec ces valeurs.

export const buildTaxwarePayloadQaLegacyDossierInputs = {
  zip: "2000",
  city: "Neuchâtel",
  year: 2026 as const,
  partnership: "Marriage" as const,
  childrenCount: 0,

  netWages: 150_000,
  thirdPillar: 5_000,    // ← fallback troisiemePilierSimule
  lppBuyback: 20_000,    // ← fallback rachatLpp

  spouseNetWages: 50_000,
  spouseThirdPillar: 0,  // ← P2 absent, retombe à 0
  spouseLppBuyback: 0,   // ← P2 absent, retombe à 0

  assets: 0,
  debts: 0,
};

export const buildTaxwarePayloadQaLegacyDossierResult = buildTaxwarePayload(
  buildTaxwarePayloadQaLegacyDossierInputs
);

export const buildTaxwarePayloadQaLegacyDossierExpected = {
  PersonLeading: {
    ThirdPillarContribution: 5_000,
    LobContributions: 20_000,
    HasLobContributions: true,
  },
  PersonSecond: {
    ThirdPillarContribution: 0,
    LobContributions: 0,
    HasLobContributions: true,
  },
  description:
    "Anciens dossiers (sans champs P1/P2) restent compatibles : P1 reçoit la valeur, P2 reçoit 0 pour LobContributions. HasLobContributions = true car P2 a un salaire (spouseNetWages > 0).",
  formatted: {
    leadingThirdPillar: "5'000 CHF",
    leadingLpp: "20'000 CHF",
    secondThirdPillar: "0 CHF",
    secondLpp: "0 CHF",
  },
} as const;

// ── Checkpoints Phase 8.1 ───────────────────────────────────────────────────

export const buildTaxwarePayloadQaP1P2Checkpoints = [
  {
    step: 1,
    name: "Test couple complet — 3a P1/P2",
    expected:
      "PersonLeading.ThirdPillarContribution = 7'000 ET PersonSecond.ThirdPillarContribution = 4'000",
    visualCheck:
      "Les deux 3a sont transmis séparément sans agrégation. Saisie UI : P1 = 7'000, P2 = 4'000.",
  },
  {
    step: 2,
    name: "Test couple complet — Rachat LPP P1/P2",
    expected:
      "PersonLeading.LobContributions = 20'000 ET PersonSecond.LobContributions = 10'000",
    visualCheck:
      "Les deux rachats LPP sont transmis séparément. HasLobContributions = true des deux côtés.",
  },
  {
    step: 3,
    name: "Test fallback — ancien dossier (champs P1/P2 absents)",
    expected:
      "PersonLeading reçoit troisiemePilierSimule / rachatLpp ; PersonSecond reçoit 0 / 0",
    visualCheck:
      "Aucune perte de valeur P1, aucune erreur. Compatibilité retro 100 %.",
  },
  {
    step: 4,
    name: "Protection valeurs invalides",
    expected: "NaN / undefined / négatif → 0",
    visualCheck:
      "Le helper sanitizePositiveContribution garantit qu'aucune valeur invalide n'arrive dans le payload TaxWare.",
  },
] as const;
