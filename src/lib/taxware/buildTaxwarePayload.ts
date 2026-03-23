type BuildPayloadParams = {
  realEstates?: Array<{
    taxableValue?: number;
    rentalIncome?: number;
    effectiveExpenses?: number;
  }>;
  zip: string;
  city: string;
  year?: number;
  partnership: "Single" | "Marriage";
  childrenCount: number;

  netWages: number;
  pensionIncome?: number;
  hasOasiPensions?: boolean;
  otherIncome?: number;
  thirdPillar: number;
  lppBuyback: number;
  assetIncome?: number;
  miscIncome?: number;
  miscExpenses?: number;
  debtInterests?: number;

  spouseNetWages?: number;
  spousePensionIncome?: number;
  spouseHasOasiPensions?: boolean;
  spouseOtherIncome?: number;
  spouseThirdPillar?: number;
  spouseLppBuyback?: number;

  assets: number;
  debts: number;
};

export function buildTaxwarePayload(params: BuildPayloadParams) {
  const {
    zip,
    city,
    year = 2026,
    realEstates,
    partnership,
    childrenCount,
    netWages,
    pensionIncome,
    hasOasiPensions,
    otherIncome,
    thirdPillar,
    lppBuyback,
    assetIncome,
    miscIncome,
    miscExpenses,
    debtInterests,
    spouseNetWages,
    spousePensionIncome,
    spouseHasOasiPensions,
    spouseOtherIncome,
    spouseThirdPillar,
    spouseLppBuyback,
    assets,
    debts,
  } = params;

  const isMarriage = partnership === "Marriage";

  return {
    Zip: Number(zip || 0),
    City: city || "",
    Year: year,
    Partnership: partnership,
    Assets: Number(assets || 0),
    AssetIncome: Number(assetIncome || 0),
    MiscIncome: Number(miscIncome || 0),
    MiscExpenses: Number(miscExpenses || 0),
    Debts: Number(debts || 0),
    DebtInterests: Number(debtInterests || 0),
    ChildrenCount: Number(childrenCount || 0),
    ...(realEstates && realEstates.length > 0
      ? {
          RealEstates: realEstates.map((realEstate) => ({
            ...(typeof realEstate.taxableValue === "number"
              ? { TaxableValue: Number(realEstate.taxableValue || 0) }
              : {}),
            RentalIncome: Number(realEstate.rentalIncome || 0),
            EffectiveExpenses: Number(realEstate.effectiveExpenses || 0),
          })),
        }
      : {}),

    PersonLeading: {
      NetWages: Number(netWages || 0),
      PensionIncome: Number(pensionIncome || 0),
      HasOasiPensions: Boolean(hasOasiPensions),
      OtherIncome: Number(otherIncome || 0),
      ThirdPillarContribution: Number(thirdPillar || 0),
      HasLobContributions: Number(lppBuyback || 0) > 0,
      LobContributions: Number(lppBuyback || 0),
    },

    ...(isMarriage
      ? {
          PersonSecond: {
            NetWages: Number(spouseNetWages || 0),
            PensionIncome: Number(spousePensionIncome || 0),
            HasOasiPensions: Boolean(spouseHasOasiPensions),
            OtherIncome: Number(spouseOtherIncome || 0),
            ThirdPillarContribution: Number(spouseThirdPillar || 0),
            HasLobContributions: Number(spouseLppBuyback || 0) > 0,
            LobContributions: Number(spouseLppBuyback || 0),
          },
        }
      : {}),
  };
}
