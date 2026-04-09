import { buttonVariants } from "../tokens/design";

export function GenerateButton({
  onClick,
  loading = false,
  disabled = false,
  label = "GENERATE",
  icon = "bolt",
  variant = "primary",
  className = ""
}: {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
  icon?: string;
  variant?: keyof typeof buttonVariants;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex items-center justify-center gap-2 rounded-panel px-4 py-3 font-label text-xs tracking-[0.24em] disabled:cursor-not-allowed disabled:opacity-40 ${buttonVariants[variant]} ${className}`}
    >
      <span className="material-symbols-outlined text-[18px]">{loading ? "progress_activity" : icon}</span>
      {loading ? "GENERATING" : label}
    </button>
  );
}
