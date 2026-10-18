import { useState } from "react";
import { useGame, useSave } from "@/store/game";
import { buy, sell } from "@/core/game";
import { ITEMS, itemDef, sellPrice } from "@/core/items";
import type { ItemCategory } from "@/core/items";
import { itemDesc, itemName, money, useT } from "@/i18n";
import { ItemIcon } from "@/ui/sprites";
import { MoneyChip, Sheet, Stepper, Tabs } from "@/ui/layout";
import { sfx } from "@/audio/sfx";

const CATS: ItemCategory[] = ["ball", "medicine", "battle", "berry", "held", "evolution", "training"];

export function MartSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const save = useSave();
  const update = useGame((s) => s.update);
  const toast = useGame((s) => s.toast);
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [cat, setCat] = useState<ItemCategory>("ball");
  const [sel, setSel] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const reach = Math.max(save.progress.best, 1);

  const stock = ITEMS.filter((i) => i.category === cat && i.price > 0 && (i.unlock ?? 0) <= reach);
  const sellable = Object.entries(save.bag).filter(([id, n]) => n > 0 && sellPrice(id) > 0);
  const price = sel ? (tab === "buy" ? itemDef(sel)?.price ?? 0 : sellPrice(sel)) : 0;
  const maxQty = tab === "buy" ? Math.max(1, Math.min(99, Math.floor(save.money / Math.max(1, price)))) : save.bag[sel ?? ""] ?? 1;

  const confirm = () => {
    if (!sel) return;
    let ok = false;
    update((d) => void (ok = tab === "buy" ? buy(d, sel, qty) : sell(d, sel, qty)));
    if (ok) {
      sfx("coin");
      toast(tab === "buy" ? "shop.bought" : "shop.sold", { n: qty, item: itemName(sel, t.lang) }, "coin");
      setQty(1);
      if (tab === "sell" && (save.bag[sel] ?? 0) - qty <= 0) setSel(null);
    } else {
      sfx("error");
      toast("shop.poor", undefined, "coin");
    }
  };

  return (
    <Sheet title={t("shop.title")} onClose={onClose} right={<MoneyChip amount={save.money} />}>
      <p className="mb-2 text-sm text-text-secondary">{t("shop.hello")}</p>
      <Tabs value={tab} onChange={(v) => { setTab(v); setSel(null); setQty(1); }} options={[{ id: "buy", label: t("shop.buy") }, { id: "sell", label: t("shop.sell") }]} />
      {tab === "buy" && <div className="mt-2"><Tabs value={cat} onChange={(c) => { setCat(c); setSel(null); }} options={CATS.map((c) => ({ id: c, label: t(`bag.cat.${c}`) }))} /></div>}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {(tab === "buy" ? stock.map((i) => [i.id, save.bag[i.id] ?? 0] as [string, number]) : sellable).map(([id, n]) => (
          <button key={id} className={`flex items-center gap-3 rounded-tile border-2 p-2 text-left ${sel === id ? "border-accent bg-accent/10" : "border-transparent bg-canvas/40 hover:bg-surface-hover"}`} onClick={() => { setSel(id); setQty(1); }}>
            <ItemIcon id={id} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-black">{itemName(id, t.lang)}</div>
              <div className="text-xs text-text-muted">{t("common.owned", { n })}</div>
            </div>
            <span className="font-black tabular-nums text-amber-300">{money(tab === "buy" ? itemDef(id)!.price : sellPrice(id), t.lang)}</span>
          </button>
        ))}
        {tab === "sell" && sellable.length === 0 && <p className="col-span-full py-6 text-center text-text-muted">{t("shop.sellNothing")}</p>}
      </div>
      {tab === "buy" && <p className="mt-3 text-center text-xs text-text-muted">{t("shop.soon")}</p>}
      {sel && (
        <div className="card sticky bottom-0 mt-3 flex flex-wrap items-center gap-3 p-3">
          <ItemIcon id={sel} size={36} />
          <p className="min-w-[160px] flex-1 text-sm">{itemDesc(sel, t.lang)}</p>
          <Stepper value={qty} min={1} max={maxQty} onChange={setQty} />
          <button className="btn btn-primary" disabled={tab === "buy" && save.money < price * qty} onClick={confirm}>
            {tab === "buy" ? t("common.buy") : t("common.sell")} · {money(price * qty, t.lang)}
          </button>
        </div>
      )}
    </Sheet>
  );
}
