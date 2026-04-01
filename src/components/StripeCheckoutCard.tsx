import { useState, type FormEvent } from "react";
import { createStripeCheckoutSession } from "../lib/stripe/createCheckoutSession";

type StripeCheckoutCardProps = {
  profileId: string | null;
  organizationId?: string | null;
};

const defaultPlanId =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_STRIPE_DEFAULT_PLAN_ID
    ? String(import.meta.env.VITE_STRIPE_DEFAULT_PLAN_ID)
    : "";

export default function StripeCheckoutCard({
  profileId,
  organizationId = null,
}: StripeCheckoutCardProps) {
  const [planId, setPlanId] = useState(defaultPlanId);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!profileId) {
      setCheckoutError("Aucun profile_id disponible pour lancer Checkout.");
      return;
    }

    if (!planId.trim()) {
      setCheckoutError("Renseignez un plan_id avant de lancer Checkout.");
      return;
    }

    setIsCreatingCheckout(true);
    setCheckoutError("");

    try {
      const result = await createStripeCheckoutSession({
        planId: planId.trim(),
        profileId,
        organizationId,
      });

      if (!result.url) {
        throw new Error("Stripe n'a pas renvoye d'URL de redirection.");
      }

      window.location.assign(result.url);
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "Impossible de creer la session Stripe."
      );
    } finally {
      setIsCreatingCheckout(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        marginBottom: "20px",
        padding: "16px",
        borderRadius: "16px",
        border: "1px solid #dbe3ee",
        background: "#ffffff",
        display: "grid",
        gap: "12px",
      }}
    >
      <div style={{ display: "grid", gap: "4px" }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "#36516e",
          }}
        >
          Stripe Checkout
        </div>
        <div style={{ fontSize: "14px", lineHeight: 1.6, color: "#334155" }}>
          Ce formulaire envoie `plan_id`, `profile_id` et, si disponible, `organization_id` au
          backend Stripe.
        </div>
      </div>

      <div style={{ fontSize: "14px", lineHeight: 1.6, color: "#475569" }}>
        Profile ID relié: <strong>{profileId ?? "Indisponible"}</strong>
      </div>
      <div style={{ fontSize: "14px", lineHeight: 1.6, color: "#475569" }}>
        Organization ID envoyé: <strong>{organizationId ?? "résolu côté backend"}</strong>
      </div>

      <label style={{ display: "grid", gap: "8px" }}>
        <span style={{ color: "#334155", fontSize: "14px", fontWeight: 700 }}>Plan ID</span>
        <input
          type="text"
          value={planId}
          onChange={(event) => setPlanId(event.target.value)}
          placeholder="UUID du plan Supabase"
          style={{
            minHeight: "46px",
            padding: "0 14px",
            borderRadius: "14px",
            border: "1px solid #cbd5e1",
            fontSize: "15px",
          }}
        />
      </label>

      {checkoutError ? (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: "14px",
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            color: "#be123c",
            fontSize: "14px",
            lineHeight: 1.5,
          }}
        >
          {checkoutError}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isCreatingCheckout || !profileId}
        style={{
          minHeight: "48px",
          border: "none",
          borderRadius: "14px",
          background: isCreatingCheckout ? "#94a3b8" : "linear-gradient(135deg, #17324d 0%, #264b6f 100%)",
          color: "#ffffff",
          fontSize: "15px",
          fontWeight: 700,
          cursor: isCreatingCheckout || !profileId ? "not-allowed" : "pointer",
        }}
      >
        {isCreatingCheckout ? "Redirection vers Stripe..." : "Lancer Stripe Checkout"}
      </button>
    </form>
  );
}
