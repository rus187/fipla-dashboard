import { describe, it, expect } from "vitest";
import { buildTaxwarePayload } from "../buildTaxwarePayload";

describe("buildTaxwarePayload — cas de référence", () => {
  it("NE Le Locle — personne seule, revenu simple, sans immobilier", () => {
    const payload = buildTaxwarePayload({
      zip: "2400",
      city: "Le Locle",
      year: 2026,
      partnership: "Single",
      childrenCount: 0,
      netWages: 85000,
      thirdPillar: 7056,
      lppBuyback: 0,
      assets: 45000,
      debts: 0,
    });
    expect(payload).toMatchSnapshot();
  });

  it("BE Biel/Bienne — couple, 2 enfants, rachat LPP, revenus mobiliers", () => {
    const payload = buildTaxwarePayload({
      zip: "2500",
      city: "Biel/Bienne",
      year: 2026,
      partnership: "Marriage",
      childrenCount: 2,
      netWages: 120000,
      thirdPillar: 7056,
      lppBuyback: 15000,
      assetIncome: 3500,
      assets: 250000,
      debts: 50000,
      debtInterests: 800,
      spouseNetWages: 65000,
      spouseThirdPillar: 5000,
    });
    expect(payload).toMatchSnapshot();
  });

  it("VD Lausanne — couple, 1 enfant, immobilier locatif", () => {
    const payload = buildTaxwarePayload({
      zip: "1003",
      city: "Lausanne",
      year: 2026,
      partnership: "Marriage",
      childrenCount: 1,
      netWages: 140000,
      spouseNetWages: 40000,
      thirdPillar: 7056,
      spouseThirdPillar: 3500,
      lppBuyback: 0,
      assets: 800000,
      debts: 600000,
      debtInterests: 18000,
      realEstates: [
        {
          taxableValue: 850000,
          rentalIncome: 24000,
          effectiveExpenses: 6000,
        },
      ],
    });
    expect(payload).toMatchSnapshot();
  });

  it("ZG Zug — retraité seul, rente AVS, fortune importante", () => {
    const payload = buildTaxwarePayload({
      zip: "6300",
      city: "Zug",
      year: 2026,
      partnership: "Single",
      childrenCount: 0,
      netWages: 0,
      pensionIncome: 55000,
      hasOasiPensions: true,
      thirdPillar: 0,
      lppBuyback: 0,
      assetIncome: 12000,
      assets: 1200000,
      debts: 0,
    });
    expect(payload).toMatchSnapshot();
  });
});
