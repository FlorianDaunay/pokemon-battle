import { useT } from "@/i18n";

/** Shown while a map downloads (first visit), or if it couldn't. */
export function WorldLoading({ error, onRetry }: { error: boolean; onRetry: () => void }) {
  const t = useT();
  return (
    <div className="absolute inset-0 grid place-items-center">
      {error ? (
        <div className="card flex flex-col items-center gap-2 p-4 text-center">
          <p className="text-sm font-semibold">{t("world.loadError")}</p>
          <button className="btn btn-primary btn-sm" onClick={onRetry}>{t("world.retry")}</button>
        </div>
      ) : (
        <div className="animate-pulse text-sm font-black text-white/80">{t("common.loading")}</div>
      )}
    </div>
  );
}
