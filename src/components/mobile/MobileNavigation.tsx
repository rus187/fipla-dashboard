type MobileNavigationItem = {
  step: string;
  label: string;
};

type MobileNavigationProps = {
  items: MobileNavigationItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
};

export default function MobileNavigation({
  items,
  activeIndex,
  onSelect,
}: MobileNavigationProps) {
  return (
    <nav className="mobile-navigation" aria-label="Parcours mobile">
      {items.map((item, index) => {
        const isActive = index === activeIndex;

        return (
          <button
            key={`${item.step}-${item.label}`}
            type="button"
            className={`mobile-navigation__item${isActive ? " mobile-navigation__item--active" : ""}`}
            onClick={() => onSelect(index)}
          >
            <span className="mobile-navigation__step">{item.step}</span>
            <span className="mobile-navigation__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
