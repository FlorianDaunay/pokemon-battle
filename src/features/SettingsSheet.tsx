import { useGame } from "@/store/game";
import { useSettings } from "@/store/settings";
import { themes, useActiveTheme, useThemeStore, themeToStyle } from "@/themes";
import { useT } from "@/i18n";
import { Sheet } from "@/ui/layout";

const SPEEDS = [["slow", 32], ["normal", 18], ["fast", 8], ["instant", 0]] as const;

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const s = useSettings();
  const screen = useGame((x) => x.screen);
  const quit = useGame((x) => x.quit);
  const active = useActiveTheme();
  const { selectTheme, followSystem, setFollowSystem } = useThemeStore();
  return (
    <Sheet title={t("settings.title")} onClose={onClose}>
      <div className="space-y-4">
        <section className="card space-y-3 p-3">
          <Field label={t("settings.language")}>
            <div className="flex gap-1">
              {(["en", "fr"] as const).map((l) => <button key={l} className={`btn btn-sm ${s.lang === l ? "btn-primary" : ""}`} onClick={() => s.set({ lang: l })}>{l === "en" ? "English" : "Français"}</button>)}
            </div>
          </Field>
          <Field label={t("settings.music")}><Slider value={s.music} onChange={(v) => s.set({ music: v })} /></Field>
          <Field label={t("settings.sfx")}><Slider value={s.sfx} onChange={(v) => s.set({ sfx: v })} /></Field>
          <Field label={t("settings.textSpeed")}>
            <div className="flex flex-wrap gap-1">
              {SPEEDS.map(([k, v]) => <button key={k} className={`btn btn-sm ${s.textSpeed === v ? "btn-primary" : ""}`} onClick={() => s.set({ textSpeed: v })}>{t(`settings.speeds.${k}`)}</button>)}
            </div>
          </Field>
          <Toggle label={t("settings.reducedFx")} value={s.reducedFx} onChange={(v) => s.set({ reducedFx: v })} />
          <Toggle label={t("settings.cries")} value={s.cries} onChange={(v) => s.set({ cries: v })} />
        </section>
        <section className="card p-3">
          <div className="label mb-2">{t("settings.theme")}</div>
          <Toggle label={t("settings.followSystem")} value={followSystem} onChange={setFollowSystem} />
          <div className="mt-2 grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
            {themes.map((th) => (
              <button key={th.id} style={themeToStyle(th)} className={`rounded-tile border-2 bg-canvas p-2 text-left text-text-primary ${active.id === th.id ? "border-accent" : "border-border"}`} onClick={() => selectTheme(th.id)}>
                <div className="flex gap-1">
                  <span className="h-3 w-3 rounded-full bg-accent" /><span className="h-3 w-3 rounded-full bg-surface" /><span className="h-3 w-3 rounded-full bg-success" />
                </div>
                <div className="mt-1 truncate text-xs font-bold">{th.name}</div>
              </button>
            ))}
          </div>
        </section>
        <section className="card space-y-2 p-3 text-xs text-text-secondary">
          <p>{t("settings.credits")}</p>
          <p>{t("settings.version", { v: __APP_VERSION__ })}</p>
          {screen !== "title" && <button className="btn btn-sm" onClick={() => { onClose(); quit(); }}>{t("settings.backToTitle")}</button>}
        </section>
      </div>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm font-bold">{label}</span>
      {children}
    </div>
  );
}

function Slider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return <input type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-44 accent-[rgb(var(--color-accent))]" />;
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2">
      <span className="text-sm font-bold">{label}</span>
      <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)} className={`relative h-6 w-11 rounded-full transition ${value ? "bg-accent" : "bg-surface-hover"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}
