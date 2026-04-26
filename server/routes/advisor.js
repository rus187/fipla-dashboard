import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

const SYSTEM_PROMPT = `Tu es un conseiller expert en gestion de patrimoine suisse. Tu analyses des dossiers de clients et rédiges des synthèses de conseil personnalisées en français professionnel.

Tes analyses portent sur :
- La fiscalité cantonale et communale suisse (ICC/IFD)
- L'optimisation patrimoniale et immobilière
- La prévoyance (pilier 2, pilier 3a, assurance-vie)
- La transmission et la protection du conjoint
- Les régimes matrimoniaux et successoraux suisses
- L'immobilier en régime actuel vs réforme fiscale

Tu retournes UNIQUEMENT un objet JSON valide (sans balise markdown, sans texte autour) avec exactement ces quatre champs :
{
  "recommendationLogic": "paragraphe sur la logique de recommandation (2-3 phrases)",
  "actionPriorities": "paragraphe sur les priorités d'action concrètes (2-3 phrases)",
  "vigilancePoints": "paragraphe sur les points de vigilance (2-3 phrases)",
  "conclusion": "paragraphe de conclusion et mise en oeuvre (2-3 phrases)"
}

Sois concis, professionnel et personnalisé. Évite le jargon excessif.`;

function buildUserPrompt(ctx) {
  const lines = [
    "Profil client :",
    `- Âge : ${ctx.age} ans`,
    `- Situation familiale : ${ctx.partnership === "Marriage" ? "Marié(e)" : "Célibataire"}`,
    `- Enfants : ${ctx.childrenCount}`,
    `- Revenu total : ${Math.round(ctx.totalIncome).toLocaleString("fr-CH")} CHF`,
    `- Fortune brute : ${Math.round(ctx.totalWealth).toLocaleString("fr-CH")} CHF`,
    `- Immobilier : ${ctx.hasRealEstate ? `Oui (régime ${ctx.realEstateRegime ?? "non précisé"})` : "Non"}`,
  ];

  if (typeof ctx.taxGainVsBase === "number") {
    lines.push(`- Gain fiscal estimé vs base : ${Math.round(ctx.taxGainVsBase).toLocaleString("fr-CH")} CHF`);
  }
  if (typeof ctx.variantSpread === "number") {
    lines.push(`- Écart entre variantes : ${Math.round(ctx.variantSpread).toLocaleString("fr-CH")} CHF`);
  }
  if (ctx.recommendedVariantLabel) {
    lines.push(`- Variante recommandée : ${ctx.recommendedVariantLabel} (régime ${ctx.recommendedVariantRegime ?? "non précisé"})`);
  }
  if (ctx.objectivePrincipal) {
    lines.push(`- Objectif principal : ${ctx.objectivePrincipal}`);
  }

  const objectives = [];
  if (ctx.hasRetirementObjective) objectives.push("préparation retraite");
  if (ctx.hasConjointProtectionObjective) objectives.push("protection du conjoint");
  if (ctx.hasTransmissionObjective) objectives.push("transmission patrimoniale");
  if (ctx.hasStructuringObjective) objectives.push("structuration du patrimoine");
  if (ctx.hasTaxOptimizationObjective) objectives.push("optimisation fiscale");
  if (objectives.length > 0) {
    lines.push(`- Objectifs déclarés : ${objectives.join(", ")}`);
  }
  if (typeof ctx.annualMargin === "number") {
    lines.push(`- Marge annuelle : ${Math.round(ctx.annualMargin).toLocaleString("fr-CH")} CHF`);
  }
  if (typeof ctx.totalTax === "number") {
    lines.push(`- Charge fiscale totale : ${Math.round(ctx.totalTax).toLocaleString("fr-CH")} CHF`);
  }

  lines.push("", "Rédige une synthèse de conseil adaptée à ce profil.");
  return lines.join("\n");
}

router.post("/api/advisor/generate", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return res.status(503).json({ error: "ANTHROPIC_API_KEY non configurée sur le serveur" });
  }

  const ctx = req.body;
  if (!ctx || typeof ctx.age !== "number") {
    return res.status(400).json({ error: "Corps de requête invalide — contexte manquant" });
  }

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: buildUserPrompt(ctx) }],
    });

    const raw = message.content[0]?.text ?? "";

    let blocks;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      blocks = JSON.parse(match?.[0] ?? raw);
    } catch {
      blocks = { recommendationLogic: raw, actionPriorities: "", vigilancePoints: "", conclusion: "" };
    }

    return res.json({ blocks, usage: message.usage });
  } catch (err) {
    console.error("[ADVISOR] Erreur Anthropic:", err?.message ?? err);
    return res.status(500).json({ error: "Erreur lors de la génération de l'analyse Claude" });
  }
});

export default router;
