import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { Profile } from "../lib/supabase/types";
import { consumeSimulationCredit } from "../lib/stripe/consumeSimulationCredit";
import { reconcileCheckoutSession } from "../lib/stripe/reconcileCheckoutSession";
import { fetchStripeAccessStatus } from "../lib/stripe/fetchAccessStatus";

const FREE_SIMULATION_LIMIT = 2;
const SIMULATION_USAGE_STORAGE_PREFIX = "fipla-simulations-used";
const SIMULATION_UNLOCKED_STORAGE_PREFIX = "fipla-simulations-unlocked";
const PENDING_CHECKOUT_SESSION_STORAGE_PREFIX = "fipla-pending-checkout-session";
const GLOBAL_PENDING_CHECKOUT_SESSION_STORAGE_KEY = "fipla-pending-checkout-session-global";

type UseStripeAccessParams = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isCheckoutSuccessRoute: boolean;
};

export function useStripeAccess({
  user,
  session,
  profile,
  isCheckoutSuccessRoute,
}: UseStripeAccessParams) {
  const [simulationUsageCount, setSimulationUsageCount] = useState(0);
  const [simulationCredits, setSimulationCredits] = useState(0);
  const [isSimulationAccessUnlocked, setIsSimulationAccessUnlocked] = useState(false);
  const [isSimulationAccessLoading, setIsSimulationAccessLoading] = useState(false);
  const [billingRefreshNonce, setBillingRefreshNonce] = useState(0);
  const [showUsageLimitModal, setShowUsageLimitModal] = useState(false);
  const [usageLimitError, setUsageLimitError] = useState("");
  const [isPreparingCheckout, setIsPreparingCheckout] = useState(false);

  const simulationUsageStorageKey = user ? `${SIMULATION_USAGE_STORAGE_PREFIX}:${user.id}` : null;
  const simulationUnlockedStorageKey = user
    ? `${SIMULATION_UNLOCKED_STORAGE_PREFIX}:${user.id}`
    : null;
  const pendingCheckoutSessionStorageKey = user
    ? `${PENDING_CHECKOUT_SESSION_STORAGE_PREFIX}:${user.id}`
    : null;

  const hasStoredSimulationAccessUnlock =
    user !== null &&
    typeof window !== "undefined" &&
    simulationUnlockedStorageKey !== null &&
    window.localStorage.getItem(simulationUnlockedStorageKey) === "true";
  const hasSimulationCreditsAvailable = simulationCredits > 0;
  const hasEffectiveSimulationAccess =
    isSimulationAccessUnlocked || hasStoredSimulationAccessUnlock;
  const isSimulationAccessVerificationBlocking =
    isSimulationAccessLoading && !hasStoredSimulationAccessUnlock;
  const hasReachedFreeSimulationLimit =
    !isSimulationAccessLoading &&
    !hasEffectiveSimulationAccess &&
    !hasSimulationCreditsAvailable &&
    simulationUsageCount >= FREE_SIMULATION_LIMIT;

  const openUsageLimitModal = () => {
    if (isSimulationAccessLoading || hasEffectiveSimulationAccess || hasSimulationCreditsAvailable) {
      console.info("[App][billing] Blocage ignore", {
        reason: isSimulationAccessLoading
          ? "premium-loading"
          : hasEffectiveSimulationAccess
            ? "premium-unlocked"
            : "simulation-credits-available",
        simulationUsageCount,
        simulationCredits,
        isSimulationAccessUnlocked: hasEffectiveSimulationAccess,
        isSimulationAccessLoading,
      });
      return;
    }

    console.info("[App][billing] Ouverture pop-up blocage", {
      simulationUsageCount,
      simulationCredits,
      isSimulationAccessUnlocked,
      isSimulationAccessLoading,
      hasReachedFreeSimulationLimit:
        !isSimulationAccessLoading &&
        !isSimulationAccessUnlocked &&
        simulationCredits <= 0 &&
        simulationUsageCount >= FREE_SIMULATION_LIMIT,
    });
    setUsageLimitError("");
    setShowUsageLimitModal(true);
  };

  const closeUsageLimitModal = () => {
    setShowUsageLimitModal(false);
    setUsageLimitError("");
  };

  const registerSuccessfulSimulationUsage = async () => {
    if (hasEffectiveSimulationAccess) {
      return;
    }

    if (simulationUsageCount < FREE_SIMULATION_LIMIT) {
      setSimulationUsageCount((current) => Math.min(FREE_SIMULATION_LIMIT, current + 1));
      return;
    }

    if (!hasSimulationCreditsAvailable) {
      return;
    }

    const previousCredits = simulationCredits;
    const nextCredits = Math.max(0, previousCredits - 1);
    setSimulationCredits(nextCredits);

    try {
      const accessToken = session?.access_token ?? "";
      const result = await consumeSimulationCredit(accessToken);
      setSimulationCredits(Math.max(0, result.simulation_credits));
    } catch (error) {
      setSimulationCredits(previousCredits);
      console.error("[App][billing] Consommation du credit Mini impossible", error);
    }
  };

  const canStartSimulationAttempt = () => {
    if (isSimulationAccessLoading) {
      return hasStoredSimulationAccessUnlock;
    }

    if (hasEffectiveSimulationAccess) {
      return true;
    }

    if (simulationUsageCount < FREE_SIMULATION_LIMIT) {
      return true;
    }

    if (hasSimulationCreditsAvailable) {
      return true;
    }

    if (simulationUsageCount >= FREE_SIMULATION_LIMIT) {
      openUsageLimitModal();
      return false;
    }

    return true;
  };

  const handleContinueWithSubscription = async () => {
    if (isPreparingCheckout) {
      return;
    }

    setUsageLimitError("");
    setIsPreparingCheckout(true);

    try {
      window.location.assign("/pricing");
    } catch (error) {
      setUsageLimitError(
        error instanceof Error
          ? error.message
          : "Impossible d'ouvrir la sélection des offres pour le moment."
      );
      setIsPreparingCheckout(false);
    }
  };

  const refreshBilling = () => {
    setBillingRefreshNonce((current) => current + 1);
  };

  const markAccessLoading = () => {
    setIsSimulationAccessLoading(true);
  };

  const resetBillingState = () => {
    if (typeof window !== "undefined") {
      if (simulationUsageStorageKey) {
        window.localStorage.removeItem(simulationUsageStorageKey);
      }
      if (simulationUnlockedStorageKey) {
        window.localStorage.removeItem(simulationUnlockedStorageKey);
      }
      if (pendingCheckoutSessionStorageKey) {
        window.sessionStorage.removeItem(pendingCheckoutSessionStorageKey);
        window.localStorage.removeItem(pendingCheckoutSessionStorageKey);
      }
      window.sessionStorage.removeItem(GLOBAL_PENDING_CHECKOUT_SESSION_STORAGE_KEY);
      window.localStorage.removeItem(GLOBAL_PENDING_CHECKOUT_SESSION_STORAGE_KEY);
    }

    setShowUsageLimitModal(false);
    setUsageLimitError("");
    setSimulationUsageCount(0);
    setSimulationCredits(0);
    setIsSimulationAccessUnlocked(false);
    setIsSimulationAccessLoading(false);
  };

  // Synchronisation principale de l'accès (Stripe + crédits + réconciliation checkout)
  useEffect(() => {
    let isMounted = true;

    const syncSimulationAccess = async () => {
      if (!user || typeof window === "undefined") {
        if (isMounted) {
          setSimulationUsageCount(0);
          setSimulationCredits(0);
          setIsSimulationAccessUnlocked(false);
          setIsSimulationAccessLoading(false);
          setShowUsageLimitModal(false);
          setUsageLimitError("");
        }
        return;
      }

      if (isMounted) {
        setIsSimulationAccessLoading(true);
        setShowUsageLimitModal(false);
        setUsageLimitError("");
      }

      const profileUsage =
        profile && typeof (profile as unknown as Record<string, unknown>).usage_count === "number"
          ? Math.max(
              0,
              Math.round((profile as unknown as Record<string, unknown>).usage_count as number)
            )
          : 0;

      const storedUsage = simulationUsageStorageKey
        ? Number.parseInt(window.localStorage.getItem(simulationUsageStorageKey) ?? "0", 10)
        : 0;
      const storedUnlocked = simulationUnlockedStorageKey
        ? window.localStorage.getItem(simulationUnlockedStorageKey) === "true"
        : false;

      if (isMounted) {
        setSimulationUsageCount(
          Math.max(
            0,
            Number.isFinite(profileUsage) ? profileUsage : 0,
            Number.isFinite(storedUsage) ? storedUsage : 0
          )
        );
      }

      const accessToken = session?.access_token ?? "";
      let hasDurablePaidAccess = false;
      let durableSimulationCredits = 0;
      let durableReadSucceeded = false;
      const checkoutSessionIdFromUrl =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("session_id")
          : null;
      const pendingCheckoutSessionId =
        checkoutSessionIdFromUrl ||
        (pendingCheckoutSessionStorageKey && typeof window !== "undefined"
          ? window.sessionStorage.getItem(pendingCheckoutSessionStorageKey) ||
            window.localStorage.getItem(pendingCheckoutSessionStorageKey)
          : null) ||
        (typeof window !== "undefined"
          ? window.sessionStorage.getItem(GLOBAL_PENDING_CHECKOUT_SESSION_STORAGE_KEY) ||
            window.localStorage.getItem(GLOBAL_PENDING_CHECKOUT_SESSION_STORAGE_KEY)
          : null);

      if (accessToken) {
        try {
          if (pendingCheckoutSessionId) {
            if (pendingCheckoutSessionStorageKey) {
              window.sessionStorage.removeItem(pendingCheckoutSessionStorageKey);
              window.localStorage.removeItem(pendingCheckoutSessionStorageKey);
            }
            if (typeof window !== "undefined") {
              window.sessionStorage.removeItem(GLOBAL_PENDING_CHECKOUT_SESSION_STORAGE_KEY);
              window.localStorage.removeItem(GLOBAL_PENDING_CHECKOUT_SESSION_STORAGE_KEY);
              const currentUrl = new URL(window.location.href);
              if (currentUrl.searchParams.has("session_id")) {
                currentUrl.searchParams.delete("session_id");
                window.history.replaceState({}, "", currentUrl.toString());
              }
            }

            try {
              const reconciliation = await reconcileCheckoutSession(
                accessToken,
                pendingCheckoutSessionId
              );

              console.info("[App][billing] Session Stripe reconcilee", reconciliation);
            } catch (error) {
              console.error("[App][billing] Reconciliation checkout Stripe impossible", error);
            }
          }

          const accessStatus = await fetchStripeAccessStatus(accessToken);
          hasDurablePaidAccess = accessStatus.has_paid_access;
          durableSimulationCredits = Math.max(0, accessStatus.simulation_credits ?? 0);
          durableReadSucceeded = true;

          console.info("[App][billing] Statut d'accès relu", accessStatus);
        } catch (error) {
          console.error("[App][billing] Lecture du statut d'accès impossible", error);
        }
      }

      if (!isMounted) {
        return;
      }

      const fallbackUnlocked = durableReadSucceeded
        ? isCheckoutSuccessRoute && storedUnlocked
        : storedUnlocked;
      const nextUnlocked = hasDurablePaidAccess || fallbackUnlocked;

      console.info("[App][billing] Synchronisation accès premium", {
        profileUsage,
        storedUsage,
        storedUnlocked,
        durableReadSucceeded,
        hasDurablePaidAccess,
        durableSimulationCredits,
        pendingCheckoutSessionId,
        nextUnlocked,
        isCheckoutSuccessRoute,
      });

      setSimulationCredits(durableSimulationCredits);
      setIsSimulationAccessUnlocked(nextUnlocked);
      setIsSimulationAccessLoading(false);

      if (nextUnlocked) {
        setShowUsageLimitModal(false);
        setUsageLimitError("");
      }
    };

    void syncSimulationAccess();

    return () => {
      isMounted = false;
    };
  }, [
    billingRefreshNonce,
    isCheckoutSuccessRoute,
    pendingCheckoutSessionStorageKey,
    profile,
    session,
    simulationUnlockedStorageKey,
    simulationUsageStorageKey,
    user,
  ]);

  // Persistance du compteur d'utilisation en localStorage
  useEffect(() => {
    if (!user || typeof window === "undefined" || !simulationUsageStorageKey) {
      return;
    }

    window.localStorage.setItem(simulationUsageStorageKey, String(simulationUsageCount));
  }, [simulationUsageCount, simulationUsageStorageKey, user]);

  // Persistance du flag d'accès débloqué en localStorage
  useEffect(() => {
    if (!user || typeof window === "undefined" || !simulationUnlockedStorageKey) {
      return;
    }

    window.localStorage.setItem(
      simulationUnlockedStorageKey,
      isSimulationAccessUnlocked ? "true" : "false"
    );
  }, [isSimulationAccessUnlocked, simulationUnlockedStorageKey, user]);

  // Déverrouillage immédiat sur la route checkout/success
  useEffect(() => {
    if (!user || !isCheckoutSuccessRoute) {
      return;
    }

    setIsSimulationAccessUnlocked(true);
    setShowUsageLimitModal(false);
    setUsageLimitError("");
  }, [isCheckoutSuccessRoute, user]);

  // Stockage de l'ID de session checkout en attente
  useEffect(() => {
    if (!isCheckoutSuccessRoute || typeof window === "undefined") {
      return;
    }

    const checkoutSessionId = new URLSearchParams(window.location.search).get("session_id");

    if (!checkoutSessionId) {
      return;
    }

    window.sessionStorage.setItem(GLOBAL_PENDING_CHECKOUT_SESSION_STORAGE_KEY, checkoutSessionId);
    window.localStorage.removeItem(GLOBAL_PENDING_CHECKOUT_SESSION_STORAGE_KEY);

    if (user && pendingCheckoutSessionStorageKey) {
      window.sessionStorage.setItem(pendingCheckoutSessionStorageKey, checkoutSessionId);
      window.localStorage.removeItem(pendingCheckoutSessionStorageKey);
    }
  }, [isCheckoutSuccessRoute, pendingCheckoutSessionStorageKey, user]);

  // Log de debug de l'état billing
  useEffect(() => {
    console.info("[App][billing] Etat pop-up blocage", {
      showUsageLimitModal,
      simulationUsageCount,
      simulationCredits,
      isSimulationAccessUnlocked,
      isSimulationAccessLoading,
      hasReachedFreeSimulationLimit,
    });
  }, [
    hasReachedFreeSimulationLimit,
    isSimulationAccessLoading,
    isSimulationAccessUnlocked,
    simulationCredits,
    showUsageLimitModal,
    simulationUsageCount,
  ]);

  return {
    simulationUsageCount,
    simulationCredits,
    isSimulationAccessUnlocked,
    isSimulationAccessLoading,
    showUsageLimitModal,
    usageLimitError,
    isPreparingCheckout,
    hasStoredSimulationAccessUnlock,
    hasSimulationCreditsAvailable,
    hasEffectiveSimulationAccess,
    isSimulationAccessVerificationBlocking,
    hasReachedFreeSimulationLimit,
    openUsageLimitModal,
    closeUsageLimitModal,
    registerSuccessfulSimulationUsage,
    canStartSimulationAttempt,
    handleContinueWithSubscription,
    refreshBilling,
    markAccessLoading,
    resetBillingState,
  };
}
