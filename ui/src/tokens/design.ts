export const colors = {
  primary: "#ff2d78",
  secondary: "#00ffcc",
  tertiary: "#ffe04a",
  background: "#0a0a12",
  surfaceContainer: "#141422",
  surfaceContainerLow: "#111118",
  onSurface: "#e8e0f0",
  onSurfaceVariant: "#a098b0"
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
