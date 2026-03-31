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
  salaire: number;
  avs: number;
  lpp: number;
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
  interetsHypothecairesBiensRendement: number;
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
  revenuImposableIfd: number;
  revenuImposable: number;
  fortuneImposableActuelleSaisie: number;
  troisiemePilierSimule: number;
  rachatLpp: number;
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
