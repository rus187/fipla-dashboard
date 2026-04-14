import type { DossierClient } from "../../types";
import { callTaxwareFromMunicipality } from "./callTaxware";
import {
  buildDomicilePayloadFromDossier,
  extractDomicileTaxwareMetrics,
  getDomicileLocationFromDossier,
  getDomicileValidationError,
  stripDomicilePayloadLocation,
} from "./domicileComparison";
import { resolveDomicileInsurancePrimesRealityDisplay } from "./insurancePrimesRealityCorrection";

export async function runDomicileRealSimulation(params: {
  referenceDossier: DossierClient;
  targetDossier: DossierClient;
}) {
  const currentLocation = getDomicileLocationFromDossier(params.referenceDossier);
  const targetLocation = getDomicileLocationFromDossier(params.targetDossier);
  const validationError = getDomicileValidationError(
    params.targetDossier,
    currentLocation,
    targetLocation
  );

  if (validationError) {
    throw new Error(validationError);
  }

  const currentPayload = buildDomicilePayloadFromDossier(params.targetDossier, currentLocation);
  const targetPayload = buildDomicilePayloadFromDossier(params.targetDossier, targetLocation);
  const currentResult = await callTaxwareFromMunicipality(currentPayload);
  const targetResult = await callTaxwareFromMunicipality(targetPayload);
  const currentMetrics = extractDomicileTaxwareMetrics(currentResult?.raw);
  const targetMetrics = extractDomicileTaxwareMetrics(targetResult?.raw);
  const currentDisplay = await resolveDomicileInsurancePrimesRealityDisplay({
    dossier: params.targetDossier,
    location: currentLocation,
    result: currentResult,
  });
  const targetDisplay = await resolveDomicileInsurancePrimesRealityDisplay({
    dossier: params.targetDossier,
    location: targetLocation,
    result: targetResult,
  });

  return {
    currentLocation,
    targetLocation,
    currentPayload,
    targetPayload,
    currentResult,
    targetResult,
    currentMetrics,
    targetMetrics,
    currentDisplay,
    targetDisplay,
    payloadsMatchOutsideLocation:
      JSON.stringify(stripDomicilePayloadLocation(currentPayload)) ===
      JSON.stringify(stripDomicilePayloadLocation(targetPayload)),
  };
}
