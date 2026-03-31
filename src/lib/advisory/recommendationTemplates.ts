export const ADVISORY_THRESHOLDS = {
  highIncome: 150000,
  highWealth: 1000000,
  seniorAge: 60,
  strongGain: 5000,
  lowGain: 1500,
  largeVariantGap: 5000,
  smallVariantGap: 1500,
} as const;

export const advisoryTemplates = {
  recommendationLogic: {
    individualBase: {
      title: "Situation individuelle",
      text: "La variante recommandée vise à améliorer l'efficacité fiscale globale du dossier tout en conservant une structure patrimoniale lisible, souple et facilement pilotable. La stratégie retenue privilégie une optimisation cohérente entre fiscalité, liquidité disponible et stabilité patrimoniale, sans introduire de complexité inutile.",
    },
    coupleWithoutChildren: {
      title: "Couple sans enfant",
      text: "La variante recommandée vise à améliorer l'efficacité fiscale globale du ménage tout en conservant une structure patrimoniale simple, lisible et facilement pilotable. En l'absence d'enjeux immédiats de transmission, la stratégie privilégie une optimisation directe de la fiscalité et de la liquidité, sans introduire de complexité inutile dans la détention des actifs.",
    },
    coupleWithChildren: {
      title: "Couple avec enfants",
      text: "La variante retenue s'inscrit dans une logique familiale élargie. Au-delà de l'optimisation fiscale immédiate, elle vise à sécuriser la structure du patrimoine, anticiper les besoins futurs liés aux enfants (formation, transmission, prévoyance) et renforcer la stabilité financière du ménage sur le long terme.",
    },
    highIncome: {
      title: "Revenu élevé",
      text: "Dans un contexte de revenus élevés, la priorité n'est plus uniquement l'optimisation, mais le pilotage de la pression fiscale dans la durée. La variante proposée permet de mieux structurer les flux, d'éviter une fiscalité subie et de maintenir une capacité d'arbitrage cohérente entre revenus, investissements et prévoyance.",
    },
    highWealth: {
      title: "Fortune élevée",
      text: "Lorsque la fortune devient significative, l'enjeu principal est la gouvernance du patrimoine. La recommandation retenue permet d'améliorer la lisibilité des avoirs, de clarifier leur rôle (liquidité, rendement, protection) et de préparer les décisions futures dans une logique structurée, notamment en matière de transmission.",
    },
    realEstate: {
      title: "Présence immobilière",
      text: "La présence d'un actif immobilier nécessite une lecture spécifique, notamment dans le contexte de la réforme de la valeur locative. La variante retenue permet d'intégrer cet élément dans une approche globale, en arbitrant intelligemment entre fiscalité immobilière, charges réelles et cohérence patrimoniale globale.",
    },
    largeGap: {
      title: "Écart important entre variantes",
      text: "L'écart significatif observé entre les scénarios permet de dégager une recommandation claire. Dans ce contexte, il est pertinent de privilégier la variante offrant le meilleur compromis entre réduction fiscale mesurable, stabilité patrimoniale et simplicité de mise en œuvre.",
    },
    smallGap: {
      title: "Écart faible entre variantes",
      text: "Lorsque les résultats sont proches, la décision ne doit pas être uniquement fiscale. Le choix final doit alors intégrer des critères qualitatifs : simplicité, flexibilité future, protection du patrimoine et cohérence avec les objectifs de vie du client.",
    },
    longTerm: {
      title: "Vision long terme",
      text: "L'approche retenue doit également être appréciée dans une logique de long terme, avec une attention particulière portée à la retraite, à la protection du niveau de vie et à la progressivité de mise en œuvre. Cette lecture permet de préserver la cohérence entre efficacité immédiate et sécurité patrimoniale future.",
    },
  },
  actionPriorities: {
    spouseProtection: {
      title: "Protection du conjoint",
      text: "Il est essentiel de vérifier que la structure patrimoniale protège efficacement le conjoint en cas d'événement de vie (décès, incapacité, changement de situation). Cela implique notamment une cohérence dans la détention des actifs, une couverture suffisante via la prévoyance et une anticipation des flux financiers en cas de rupture de revenu.",
    },
    taxOptimization: {
      title: "Optimisation fiscale",
      text: "L'optimisation doit se concentrer sur des leviers concrets et activables immédiatement : cotisations 3e pilier, rachats LPP, structuration des revenus et charges, arbitrages immobiliers. L'objectif est de générer un gain mesurable sans complexifier inutilement la situation.",
    },
    patrimonialStructuring: {
      title: "Structuration patrimoniale",
      text: "Il s'agit ici de donner une architecture claire au patrimoine : distinguer les actifs de sécurité, de rendement et de transmission, améliorer la lisibilité globale et éviter les empilements incohérents. Une bonne structuration facilite toutes les décisions futures.",
    },
    familyTransmission: {
      title: "Prévoyance et transmission",
      text: "En présence d'enfants ou d'un objectif de transmission, il convient de coordonner la prévoyance, la disponibilité future des capitaux et la logique de transmission du patrimoine. Cette étape vise à renforcer la cohérence familiale de la stratégie retenue.",
    },
    followUp: {
      title: "Suivi patrimonial",
      text: "Une stratégie patrimoniale n'est jamais figée. Il est recommandé de mettre en place un suivi annuel, une mise à jour des hypothèses fiscales et une réévaluation des objectifs familiaux. Cela permet d'ajuster les décisions sans subir les évolutions.",
    },
  },
  vigilancePoints: {
    taxPressure: {
      title: "Pression fiscale",
      text: "Une réduction d'impôt ne doit jamais être poursuivie au détriment de la cohérence globale. Certaines stratégies peuvent être fiscalement efficaces à court terme mais contraignantes sur la durée.",
    },
    patrimonialInconsistencies: {
      title: "Incohérences patrimoniales",
      text: "Attention aux situations où les actifs sont mal répartis, la liquidité est insuffisante ou les objectifs ne correspondent pas à la structure réelle. Ces incohérences réduisent fortement l'efficacité des optimisations.",
    },
    coordination: {
      title: "Coordination des décisions",
      text: "Chaque décision (fiscale, immobilière, prévoyance) doit être cohérente avec les autres. Un bon arbitrage fiscal peut devenir contre-productif s'il n'est pas aligné avec la stratégie globale.",
    },
    longTerm: {
      title: "Vision long terme",
      text: "Les décisions doivent être prises avec une vision à 5, 10 ou 15 ans : retraite, transmission, évolution du patrimoine. Une approche court-termiste fragilise la stratégie globale.",
    },
  },
  conclusions: {
    conclusion_prudente: {
      title: "Conclusion prudente",
      text: "Au vu des éléments analysés, la variante recommandée apparaît cohérente et défendable, sous réserve d'une validation finale des paramètres personnels, familiaux et patrimoniaux du dossier. La mise en œuvre peut être engagée de manière progressive, avec une attention particulière portée à la stabilité de la stratégie dans le temps.",
    },
    conclusion_affirmee: {
      title: "Conclusion affirmée",
      text: "L'écart observé entre les variantes permet de formuler une recommandation claire. La solution retenue présente, à ce stade, le meilleur compromis entre efficacité fiscale mesurable, cohérence patrimoniale et simplicité de mise en œuvre.",
    },
    conclusion_action: {
      title: "Conclusion orientée action",
      text: "La variante retenue constitue une base solide pour structurer la situation patrimoniale. Sa mise en œuvre peut être engagée immédiatement sur les leviers activables, tout en planifiant les ajustements complémentaires dans un cadre suivi et maîtrisé.",
    },
    conclusion_long_terme: {
      title: "Conclusion long terme",
      text: "La recommandation retenue doit être comprise comme une étape structurante d'une stratégie patrimoniale pilotée dans le temps. Elle invite à articuler de manière cohérente fiscalité, liquidité, protection et préparation des décisions futures dans un cadre de suivi régulier.",
    },
    conclusion_familiale: {
      title: "Conclusion familiale",
      text: "Dans une configuration familiale, la recommandation doit également renforcer la protection du foyer, la lisibilité des flux et l'anticipation des besoins futurs liés aux enfants, à la transmission et à la prévoyance. La qualité de mise en œuvre repose ici sur une coordination claire entre fiscalité, sécurité patrimoniale et stabilité du ménage.",
    },
    conclusion_coherence_patrimoniale: {
      title: "Cohérence patrimoniale",
      text: "La présence d'un actif immobilier invite à conserver une lecture patrimoniale cohérente entre détention, liquidité disponible, charges réelles et impact fiscal projeté. La mise en œuvre doit donc rester lisible, documentée et compatible avec l'équilibre global du patrimoine.",
    },
  },
} as const;
