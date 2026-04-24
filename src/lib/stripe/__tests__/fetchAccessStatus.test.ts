import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchStripeAccessStatus, type StripeAccessStatusResponse } from "../fetchAccessStatus";

afterEach(() => {
  vi.restoreAllMocks();
});

const stubResponse: StripeAccessStatusResponse = {
  has_paid_access: true,
  source: "stripe_subscription",
  simulation_credits: 3,
  profile_id: "user-123",
  organization_id: null,
  billing_plan: "premium",
  billing_status: "active",
  billing_current_period_end: "2026-12-31T00:00:00Z",
  billing_cancel_at_period_end: false,
  subscription_status: "active",
  stripe_subscription_id: "sub_abc123",
};

describe("fetchStripeAccessStatus — flux mocké", () => {
  it("lève une erreur si aucun accessToken n'est fourni", async () => {
    await expect(fetchStripeAccessStatus("")).rejects.toThrow("Connexion requise");
  });

  it("retourne le statut d'accès parsé quand le backend répond 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(stubResponse)),
      })
    );

    const result = await fetchStripeAccessStatus("tok_test");
    expect(result.has_paid_access).toBe(true);
    expect(result.simulation_credits).toBe(3);
    expect(result.billing_plan).toBe("premium");
  });

  it("lève une erreur réseau si fetch rejette", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network failure"))
    );

    await expect(fetchStripeAccessStatus("tok_test")).rejects.toThrow(
      "Impossible de contacter le backend Stripe"
    );
  });

  it("lève une erreur si la réponse HTTP n'est pas ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(JSON.stringify({ error: "Unauthorized" })),
      })
    );

    await expect(fetchStripeAccessStatus("tok_expired")).rejects.toThrow(
      "Impossible de lire le statut d'accès premium"
    );
  });

  it("transmet le token en header Authorization Bearer", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(stubResponse)),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchStripeAccessStatus("tok_test_xyz");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/stripe/access-status"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer tok_test_xyz",
        }),
      })
    );
  });

  it("lève une erreur si la réponse JSON est malformée", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("{ invalid json }"),
      })
    );

    await expect(fetchStripeAccessStatus("tok_test")).rejects.toThrow(
      /JSON|parse/i
    );
  });

  it("retourne le statut avec has_paid_access: false (utilisateur sans accès payant)", async () => {
    const noAccessResponse: StripeAccessStatusResponse = {
      has_paid_access: false,
      source: null,
      simulation_credits: 0,
      profile_id: "user-456",
      organization_id: null,
      billing_plan: null,
      billing_status: null,
      billing_current_period_end: null,
      billing_cancel_at_period_end: false,
      subscription_status: null,
      stripe_subscription_id: null,
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(noAccessResponse)),
      })
    );

    const result = await fetchStripeAccessStatus("tok_free_user");
    expect(result.has_paid_access).toBe(false);
    expect(result.simulation_credits).toBe(0);
    expect(result.billing_plan).toBeNull();
    expect(result.subscription_status).toBeNull();
  });
});
