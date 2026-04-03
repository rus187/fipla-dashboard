type MobilePrimaryActionProps = {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
};

export default function MobilePrimaryAction({
  label,
  onClick,
  disabled,
  type = "button",
}: MobilePrimaryActionProps) {
  return (
    <button
      type={type}
      className="mobile-primary-action"
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}
