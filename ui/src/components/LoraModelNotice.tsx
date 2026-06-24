export function LoraModelNotice({
  notice
}: {
  notice: { message: string } | null;
}) {
  if (!notice) {
    return null;
  }

  return (
    <div className="fixed right-6 top-20 z-50 max-w-md rounded-panel border border-tertiary/60 bg-surface-container-high px-4 py-3 text-sm text-tertiary shadow-[0_0_18px_rgba(255,180,84,0.22)]">
      <div className="font-label text-[10px] tracking-[0.18em] text-tertiary">LORA COMPATIBILITY</div>
      <div className="mt-1 text-on-surface">{notice.message}</div>
    </div>
  );
}