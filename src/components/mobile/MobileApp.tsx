import { useState } from "react";
import "./mobile.css";
import MobileDomicileFlow, {
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

type MobileModule = "home" | "simulation" | "reforme" | "domicile" | "enfant";

type MobileAppProps = {
  userLabel: string;
  onLogout: () => void;
  onResolveLocation: (zip: string) => { locality: string } | null;
  onRunSimulation: (payload: MobileSimulationPayload) => Promise<MobileSimulationResult>;
  onRunReforme: (payload: MobileReformePayload) => Promise<MobileReformeResult>;
  onRunDomicile: (payload: MobileDomicilePayload) => Promise<MobileDomicileResult>;
  onRunEnfantTransition: (
    payload: MobileEnfantTransitionPayload
  ) => Promise<MobileEnfantTransitionResult>;
};

export default function MobileApp({
  userLabel,
  onLogout,
  onResolveLocation,
  onRunSimulation,
  onRunReforme,
  onRunDomicile,
  onRunEnfantTransition,
}: MobileAppProps) {
  const [module, setModule] = useState<MobileModule>("home");

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
              />
            ) : null}
            {module === "reforme" ? (
              <MobileReformeVLFlow
                onBack={() => setModule("home")}
                onResolveLocation={onResolveLocation}
                onRun={onRunReforme}
              />
            ) : null}
            {module === "domicile" ? (
              <MobileDomicileFlow
                onBack={() => setModule("home")}
                onResolveLocation={onResolveLocation}
                onRun={onRunDomicile}
              />
            ) : null}
            {module === "enfant" ? (
              <MobileEnfantTransitionFlow
                onBack={() => setModule("home")}
                onResolveLocation={onResolveLocation}
                onRun={onRunEnfantTransition}
              />
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
