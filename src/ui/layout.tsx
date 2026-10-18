import { useEffect } from "react";
import type { ReactNode } from "react";
import { money, useT } from "@/i18n";
import { useGame } from "@/store/game";
import { sfx } from "@/audio/sfx";
import { Icon } from "./Icon";

/** Full-screen panel with a header (title, back) used by every menu. */
export function Sheet({ title, onClose, children, right, wide }: { title: string; onClose: () => void; children: ReactNode; right?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        sfx("back");
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-center bg-black/55 backdrop-blur-sm animate-fade sm:items-center sm:p-6">
      <div className={`card flex h-full w-full flex-col overflow-hidden !rounded-none sm:h-[min(860px,94vh)] sm:!rounded-card animate-pop ${wide ? "sm:max-w-5xl" : "sm:max-w-3xl"}`}>
        <header className="flex items-center gap-2 border-b border-border px-3 py-2.5 safe-top">
          <button className="btn btn-ghost btn-sm !px-2" onClick={() => { sfx("back"); onClose(); }} aria-label="Back">
            <Icon name="back" />
          </button>
          <h2 className="flex-1 truncate text-lg font-black tracking-tight">{title}</h2>
          {right}
        </header>
        <div className="scroll-y flex-1 p-3 sm:p-4">{children}</div>
      </div>
    </div>
  );
}

export function Modal({ children, onClose, className = "" }: { children: ReactNode; onClose?: () => void; className?: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm animate-fade" onClick={onClose}>
      <div className={`card w-full max-w-md p-4 animate-pop ${className}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function Confirm({ text, onYes, onNo, danger }: { text: string; onYes: () => void; onNo: () => void; danger?: boolean }) {
  const t = useT();
  return (
    <Modal onClose={onNo}>
      <p className="mb-4 font-semibold">{text}</p>
      <div className="flex justify-end gap-2">
        <button className="btn" onClick={onNo}>{t("common.no")}</button>
        <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onYes}>{t("common.yes")}</button>
      </div>
    </Modal>
  );
}

export function MoneyChip({ amount }: { amount: number }) {
  const t = useT();
  return (
    <span className="chip text-amber-300">
      <Icon name="coin" size={14} />
      <span className="tabular-nums">{money(amount, t.lang)}</span>
    </span>
  );
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);
  const t = useT();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3">
      {toasts.map((x) => (
        <button key={x.id} className="card pointer-events-auto flex max-w-sm items-center gap-3 px-4 py-2.5 animate-slide-up" onClick={() => dismiss(x.id)}>
          {x.icon && <span className="grid h-8 w-8 place-items-center rounded-full bg-accent/20 text-accent"><Icon name={x.icon} size={18} /></span>}
          <span className="text-left text-sm font-bold">
            {t(x.key, x.params)}
            {x.key === "trophies.unlocked" && x.params?.id && <span className="block text-xs font-semibold text-text-secondary">{t.list(`ach.${x.params.id}`)[0]}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-control bg-canvas/50 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          className={`whitespace-nowrap rounded-control px-3 py-1.5 text-xs font-extrabold transition ${value === o.id ? "bg-accent text-accent-foreground" : "text-text-secondary hover:bg-surface-hover"}`}
          onClick={() => { sfx("select"); onChange(o.id); }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="inline-flex items-center gap-1">
      <button className="btn btn-sm !px-2" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}><Icon name="minus" size={14} /></button>
      <span className="w-8 text-center font-black tabular-nums">{value}</span>
      <button className="btn btn-sm !px-2" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}><Icon name="plus" size={14} /></button>
    </div>
  );
}
