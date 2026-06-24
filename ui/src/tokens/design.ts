export const colors = {
  primary: "#7C8CFF",
  secondary: "#00D4C8",
  tertiary: "#FFB454",
  background: "#001F3F",
  surfaceContainer: "#002B55",
  surfaceContainerLow: "#001428",
  onSurface: "#FFFFFF",
  onSurfaceVariant: "#A0B4D0"
} as const;

export const buttonVariants = {
  primary:
    "border border-secondary bg-secondary text-on-secondary shadow-glow-secondary-lg transition hover:brightness-110 active:scale-[0.99]",
  outline:
    "border border-secondary/60 bg-transparent text-secondary transition hover:border-secondary hover:shadow-glow-secondary",
  ghost:
    "border border-primary/60 bg-transparent text-primary transition hover:border-primary hover:shadow-glow-primary"
} as const;

export const panelClass =
  "rounded-panel border border-outline-variant/60 bg-surface-container text-on-surface";
