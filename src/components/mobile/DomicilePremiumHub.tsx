import { useState } from "react";
import type { MobileActiveClientDossier } from "./activeClientDossier";
import MobileDomicileFlow, {
  type MobileDomicilePayload,
  type MobileDomicileResult,
} from "./MobileDomicileFlow";
import PremiumDomicileAccroche from "./PremiumDomicileAccroche";
import PremiumDomicileResults from "./PremiumDomicileResults";

type View = "accroche" | "form" | "results";

type DomicilePremiumHubProps = {
  onBack: () => void;
  onResolveLocation: (zip: string) => { locality: string } | null;
  onRun: (payload: MobileDomicilePayload) => Promise<MobileDomicileResult>;
  activeDossier: MobileActiveClientDossier;
  onActiveDossierChange: (partial: Partial<MobileActiveClientDossier>) => void;
};

export default function DomicilePremiumHub({
  onBack,
  onResolveLocation,
  onRun,
  activeDossier,
  onActiveDossierChange,
}: DomicilePremiumHubProps) {
  const [view, setView] = useState<View>("accroche");
  const [result, setResult] = useState<MobileDomicileResult | null>(null);
  const [lastPayload, setLastPayload] = useState<MobileDomicilePayload | null>(null);

  const handleRun = async (payload: MobileDomicilePayload): Promise<MobileDomicileResult> => {
    const r = await onRun(payload);
    setLastPayload(payload);
    setResult(r);
    setView("results");
    return r;
  };

  if (view === "accroche") {
    return <PremiumDomicileAccroche onStart={() => setView("form")} onBack={onBack} />;
  }

  if (view === "form") {
    return (
      <MobileDomicileFlow
        onBack={() => setView("accroche")}
        onResolveLocation={onResolveLocation}
        onRun={handleRun}
        activeDossier={activeDossier}
        onActiveDossierChange={onActiveDossierChange}
      />
    );
  }

  return (
    <PremiumDomicileResults
      result={result!}
      payload={lastPayload!}
      onBack={() => setView("form")}
      onReset={() => {
        setResult(null);
        setLastPayload(null);
        setView("accroche");
      }}
    />
  );
}
