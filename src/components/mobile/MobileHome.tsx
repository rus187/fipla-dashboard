type MobileHomeCard = {
  id: "simulation" | "reforme" | "domicile" | "enfant";
  tag: string;
  title: string;
  description: string;
  footer: string;
};

type MobileHomeProps = {
  onSelect: (module: MobileHomeCard["id"]) => void;
};

const cards: MobileHomeCard[] = [
  {
    id: "simulation",
    tag: "Module signature",
    title: "Simulation fiscale",
    description:
      "Une lecture nette de la charge fiscale, calibrée pour expliquer la situation avec autorité et précision.",
    footer: "Diagnostic immédiat, restitution premium.",
  },
  {
    id: "reforme",
    tag: "Lecture immobilière",
    title: "Réforme VL",
    description:
      "Un support clair pour montrer l’effet de la réforme valeur locative dans un cadre sobre et rassurant.",
    footer: "Comparaison actuelle vs réforme, en face client.",
  },
  {
    id: "domicile",
    tag: "Décision patrimoniale",
    title: "Changement de domicile",
    description:
      "Une comparaison fiscale verticale qui rend visible l’avantage concret d’un nouveau domicile.",
    footer: "Capacité d’analyse immédiate, partout.",
  },
  {
    id: "enfant",
    tag: "Transition familiale",
    title: "Fin de déduction enfant",
    description:
      "Une simulation claire pour montrer l’impact fiscal d’une majorité ou d’une fin de formation.",
    footer: "Lecture avant / après, immédiatement démonstrative.",
  },
];

export default function MobileHome({ onSelect }: MobileHomeProps) {
  return (
    <div className="mobile-home-grid">
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          className="mobile-home-card"
          onClick={() => onSelect(card.id)}
        >
          <span className="mobile-home-card__tag">{card.tag}</span>
          <h2 className="mobile-home-card__title">{card.title}</h2>
          <p className="mobile-home-card__description">{card.description}</p>
          <div className="mobile-home-card__footer">{card.footer}</div>
        </button>
      ))}
    </div>
  );
}
