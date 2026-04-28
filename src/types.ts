export type ClientIdentite = {
  prenom: string;
  nom: string;
  age: number;
  etatCivil: string;
  lieuVie: "domicile" | "ems";

  npa: string;

  commune: string; // commune affichée / postale
  canton: string; // canton affiché / fiscal si connu

  communeFiscale: string; // ex. Le Locle
  cantonFiscal: string; // ex. NE

  taxwareZip: string; // ex. 2416 au départ
  taxwareCity: string; // ex. Le Locle
};

export type ClientFamille = {
  aConjoint: boolean;
  ageConjoint: number | null;
  nombreEnfants: number;
  situationConjoint: "domicile" | "ems";
};

export type ClientRevenus = {
  revenuPersonne1: number;
  revenuPersonne2: number;
  salaire: number;
  avs: number;
  lpp: number;
  salaireConjoint: number;
  avsConjoint: number;
  lppConjoint: number;
  autresRevenusConjoint: number;
  revenuFortune: number;
  dividendesPriviligies: number;
  participationsPriviligiees: number;
  autresRevenus: number;
  totalRevenus: number;
};

export type ClientImmobilier = {
  regimeFiscal: "actuel" | "reforme";
  proprietaireOccupant: boolean;
  valeurLocativeHabitationPropre: number;
  interetsHypothecairesHabitationPropre: number;
  fraisEntretienHabitationPropre: number;
  possedeBienRendement: boolean;
  loyersBiensRendement: number;
  valeurFiscaleBiensRendement: number;
  interetsHypothecairesBiensRendement: number;
  detteHypothecaireBiensRendement: number;
  fraisEntretienBiensRendement: number;
};

export type ClientFortune = {
  liquidites: number;
  titres: number;
  troisiemePilier: number;
  fortuneLppActuelle: number;
  immobilier: number;
  autresActifs: number;
  fortuneTotale: number;
  // Valeur fiscale estimée des participations privées / entreprises non cotées,
  // destinée à la fortune imposable cantonale.
  valeurFiscaleEntrepriseParticipation?: number;
};

export type ClientDettes = {
  hypotheques: number;
  autresDettes: number;
  totalDettes: number;
};

export type ClientCharges = {
  fraisEms: number;
  logement: number;
  logementIsHypothequeDeductible: boolean;
  primesMaladie: number;
  impotsRevenuFortune: number;
  fraisVie: number;
  autresCharges: number;
  autresChargesIsPensionDeductible: boolean;
  totalCharges: number;
};

export type ClientFiscalite = {
  anneeSimulation: number;
  revenuImposableIfd: number;
  revenuImposable: number;
  fortuneImposableActuelleSaisie: number;
  revenuFortuneBE: number;
  troisiemePilierSimule: number;
  rachatLpp: number;
  // Phase 8.1 — Champs optionnels 3a / rachat LPP par personne (couple).
  // Si non renseignés : fallback vers troisiemePilierSimule / rachatLpp pour P1, 0 pour P2.
  troisiemePilierPersonne1?: number;
  troisiemePilierPersonne2?: number;
  rachatLppPersonne1?: number;
  rachatLppPersonne2?: number;
  aLppActifPersonne1?: boolean;
  aLppActifPersonne2?: boolean;
  ajustementManuelRevenu: number;
  correctionFiscaleManuelleIfd: number;
  correctionFiscaleManuelleCanton: number;
  correctionFiscaleManuelleFortune: number;
  impotsEstimes: number;
  objectifFiscalPrincipal: string;
};

export type ClientObjectifs = {
  reduireImpots: boolean;
  preparerRetraite: boolean;
  protegerConjoint: boolean;
  structurerPatrimoine: boolean;
  transmettre: boolean;
  anticiperEMS: boolean;
  objectifPrincipal: string;
};

export type DossierClient = {
  identite: ClientIdentite;
  famille: ClientFamille;
  revenus: ClientRevenus;
  immobilier: ClientImmobilier;
  fortune: ClientFortune;
  dettes: ClientDettes;
  charges: ClientCharges;
  fiscalite: ClientFiscalite;
  objectifs: ClientObjectifs;
};
