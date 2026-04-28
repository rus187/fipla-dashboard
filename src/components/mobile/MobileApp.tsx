import { useState } from "react";
import "./mobile.css";
import MobileActiveDossierCard from "./MobileActiveDossierCard";
import {
  emptyActiveClientDossier,
  type MobileActiveClientDossier,
} from "./activeClientDossier";
import DomicilePremiumHub from "./DomicilePremiumHub";
import {
  type MobileDomicilePayload,
  type MobileDomicileResult,
} from "./MobileDomicileFlow";
import MobileEnfantTransitionFlow, {
  type MobileEnfantTransitionPayload,
  type MobileEnfantTransitionResult,
} from "./MobileEnfantTransitionFlow";
import MobileHome from "./MobileHome";
import MobileReformeVLFlow, {
  type MobileReformePayload,
  type MobileReformeResult,
} from "./MobileReformeVLFlow";
import MobileSectionHeader from "./MobileSectionHeader";
import MobileSimulationFlow, {
  type MobileSimulationPayload,
  type MobileSimulationResult,
} from "./MobileSimulationFlow";
import MobileStatCard from "./MobileStatCard";
import StripeCheckoutCard from "../StripeCheckoutCard";
import useActiveClientDossier from "./useActiveClientDossier";

type MobileModule = "home" | "simulation" | "reforme" | "domicile" | "enfant";

type MobileAppProps = {
  userId: string;
  userLabel: string;
  profileId: string | null;
  accessToken?: string;
  onLogout: () => void;
  onBillingChanged?: () => void;
  onResolveLocation: (zip: string) => { locality: string } | null;
  onRunSimulation: (payload: MobileSimulationPayload) => Promise<MobileSimulationResult>;
  onRunReforme: (payload: MobileReformePayload) => Promise<MobileReformeResult>;
  onRunDomicile: (payload: MobileDomicilePayload) => Promise<MobileDomicileResult>;
  onRunEnfantTransition: (
    payload: MobileEnfantTransitionPayload
  ) => Promise<MobileEnfantTransitionResult>;
};

export default function MobileApp({
  userId,
  userLabel,
  profileId,
  accessToken = "",
  onLogout,
  onBillingChanged,
  onResolveLocation,
  onRunSimulation,
  onRunReforme,
  onRunDomicile,
  onRunEnfantTransition,
}: MobileAppProps) {
  const [module, setModule] = useState<MobileModule>("home");
  const {
    activeClientDossier,
    updateActiveClientDossier,
    replaceActiveClientDossier,
    clearActiveClientDossier,
  } = useActiveClientDossier(userId);

  const handleSaveActiveDossier = (nextValue: MobileActiveClientDossier) => {
    replaceActiveClientDossier(nextValue);
  };

  return (
    <div className="mobile-shell">
      <div className="mobile-shell__inner">
        <section className="mobile-surface">
          <div className="mobile-surface__content">
            <div className="mobile-topbar">
              <div className="mobile-topbar__brand">
                <div className="mobile-kicker">Conseil patrimonial mobile</div>
                <div className="mobile-topbar__title">FIPLA Signature</div>
              </div>
              <button type="button" className="mobile-pill-button" onClick={onLogout}>
                Déconnexion
              </button>
            </div>

            <MobileSectionHeader
              eyebrow="Version mobile premium"
              title="Une expertise transportable, prête à être montrée."
              description="Chaque écran est conçu pour soutenir la démonstration du conseiller avec une lecture sobre, statutaire et immédiate."
            />

            <MobileStatCard
              label="Conseiller connecté"
              value={userLabel}
              helper="Un accès mobile pensé pour la démonstration et la restitution en rendez-vous."
            />

            <StripeCheckoutCard
              profileId={profileId}
              accessToken={accessToken}
              onBillingChanged={onBillingChanged}
            />

            <MobileActiveDossierCard
              dossier={activeClientDossier}
              onSave={handleSaveActiveDossier}
              onResetToNew={() => {
                replaceActiveClientDossier(emptyActiveClientDossier);
                setModule("home");
              }}
              onClear={() => {
                clearActiveClientDossier();
                setModule("home");
              }}
            />
          </div>
        </section>

        <section className="mobile-surface">
          <div className="mobile-surface__content">
            {module === "home" ? <MobileHome onSelect={setModule} /> : null}
            {module === "simulation" ? (
              <MobileSimulationFlow
                onBack={() => setModule("home")}
                onResolveLocation={onResolveLocation}
                onRun={onRunSimulation}
                activeDossier={activeClientDossier}
                onActiveDossierChange={updateActiveClientDossier}
              />
            ) : null}
            {module === "reforme" ? (
              <MobileReformeVLFlow
                onBack={() => setModule("home")}
                onResolveLocation={onResolveLocation}
                onRun={onRunReforme}
                activeDossier={activeClientDossier}
                onActiveDossierChange={updateActiveClientDossier}
              />
            ) : null}
            {module === "domicile" ? (
              <DomicilePremiumHub
                onBack={() => setModule("home")}
                onResolveLocation={onResolveLocation}
                onRun={onRunDomicile}
                activeDossier={activeClientDossier}
                onActiveDossierChange={updateActiveClientDossier}
              />
            ) : null}
            {module === "enfant" ? (
              <MobileEnfantTransitionFlow
                onBack={() => setModule("home")}
                onResolveLocation={onResolveLocation}
                onRun={onRunEnfantTransition}
                activeDossier={activeClientDossier}
                onActiveDossierChange={updateActiveClientDossier}
              />
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
