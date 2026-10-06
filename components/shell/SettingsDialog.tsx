"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Monitor, Moon, Sun } from "lucide-react";
import type { AppSettings } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fetchSettings, saveSettings } from "@/lib/client/api";
import { useShell } from "@/lib/client/shell";
import { useTheme, type ThemePreference } from "@/lib/client/theme";
import { Button, Dialog, Spinner, Switch, Textarea, useToast } from "@/components/ui";
import { ModelPicker } from "@/components/chat/ModelPicker";
import { ReasoningPicker } from "@/components/chat/ReasoningPicker";
import { resolveModel, withModel } from "@/components/chat/settings";

function Section({ index, title, hint, children }: { index: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-x-6 gap-y-3 border-t border-line py-5 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[150px_1fr]">
      <div>
        <p className="font-mono text-[10.5px] tracking-[0.12em] text-ink-faint">{index}</p>
        <h3 className="mt-1 text-[14px] font-medium text-ink">{title}</h3>
        {hint && <p className="mt-1 text-[12.5px] leading-snug text-ink-muted">{hint}</p>}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Hell", icon: <Sun /> },
  { value: "dark", label: "Dunkel", icon: <Moon /> },
  { value: "system", label: "System", icon: <Monitor /> },
];

export function SettingsDialog() {
  const { settingsOpen, setSettingsOpen } = useShell();
  const { preference, setPreference } = useTheme();
  const { toast } = useToast();
  const router = useRouter();
  const [form, setForm] = useState<AppSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settingsOpen) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(null);
    setLoadError(null);
    fetchSettings()
      .then((s) => !cancelled && setForm(s))
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : "Unbekannter Fehler"));
    return () => {
      cancelled = true;
    };
  }, [settingsOpen]);

  const model = resolveModel(form?.defaultModel);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const saved = await saveSettings(form);
      if (saved) setForm(saved);
      toast({ title: "Einstellungen gespeichert", description: "Gilt für neue Chats.", tone: "success" });
      setSettingsOpen(false);
      router.refresh();
    } catch (e) {
      toast({ title: "Speichern fehlgeschlagen", description: e instanceof Error ? e.message : undefined, tone: "danger" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={settingsOpen}
      onOpenChange={(o) => !saving && setSettingsOpen(o)}
      title="Einstellungen"
      description="Systemprompt und Standardwerte für neue Unterhaltungen."
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(false)} disabled={saving}>
            Abbrechen
          </Button>
          <Button variant="primary" size="sm" onClick={save} loading={saving} disabled={!form}>
            Speichern
          </Button>
        </>
      }
    >
      {loadError ? (
        <div className="rounded-lg border border-danger/25 bg-danger/5 p-4 text-[13px] text-danger">
          Einstellungen konnten nicht geladen werden: {loadError}
        </div>
      ) : !form ? (
        <div className="flex items-center gap-2 py-10 text-[13px] text-ink-muted" role="status">
          <Spinner /> Lade Einstellungen …
        </div>
      ) : (
        <div>
          <Section index="01" title="Systemprompt" hint="Wird jeder Unterhaltung als Anweisung vorangestellt.">
            <div>
              <Textarea
                value={form.systemPrompt}
                onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                maxHeight={300}
                rows={7}
                aria-label="Systemprompt"
                className="min-h-[160px] text-[13.5px]"
              />
              <p className="mt-1.5 text-right font-mono text-[10.5px] text-ink-faint tabular-nums">
                {form.systemPrompt.length.toLocaleString("de-DE")} Zeichen
              </p>
            </div>
          </Section>

          <Section index="02" title="Neue Chats" hint="Standardmodell und Werkzeuge. Jeder Chat kann sie individuell ändern.">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[12.5px] font-medium text-ink-muted">Modell</p>
                <ModelPicker
                  variant="field"
                  value={form.defaultModel}
                  onChange={(id) => {
                    const next = withModel(
                      { model: form.defaultModel, reasoningEffort: form.defaultReasoningEffort, tools: form.defaultTools },
                      id,
                    );
                    setForm({ ...form, defaultModel: next.model, defaultReasoningEffort: next.reasoningEffort, defaultTools: next.tools });
                  }}
                />
              </div>
              {model.reasoningEfforts && (
                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium text-ink-muted">Denkaufwand</p>
                  <ReasoningPicker
                    variant="field"
                    model={model}
                    value={form.defaultReasoningEffort}
                    onChange={(e) => setForm({ ...form, defaultReasoningEffort: e })}
                  />
                </div>
              )}
            </div>
            <div className="divide-y divide-line rounded-xl border border-line">
              <Switch
                className="p-3.5"
                label="Python-Codeausführung"
                description="Das Modell darf Code in einer isolierten Jupyter-Sandbox ausführen."
                checked={form.defaultTools.python && model.supportsTools}
                disabled={!model.supportsTools}
                onCheckedChange={(v) => setForm({ ...form, defaultTools: { ...form.defaultTools, python: v } })}
              />
              <Switch
                className="p-3.5"
                label="Websuche"
                description={
                  model.supportsWebSearch ? "Aktuelle Informationen aus dem Web abrufen." : `${model.label} unterstützt keine Websuche.`
                }
                checked={form.defaultTools.webSearch && model.supportsWebSearch}
                disabled={!model.supportsWebSearch}
                onCheckedChange={(v) => setForm({ ...form, defaultTools: { ...form.defaultTools, webSearch: v } })}
              />
            </div>
          </Section>

          <Section index="03" title="Darstellung" hint="Wird sofort übernommen und lokal gespeichert.">
            <div role="radiogroup" aria-label="Farbschema" className="inline-flex rounded-xl border border-line bg-surface-sunken p-1">
              {THEME_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={preference === o.value}
                  onClick={() => setPreference(o.value)}
                  className={cn(
                    "flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/70 [&_svg]:size-3.5",
                    preference === o.value
                      ? "bg-surface-raised text-ink shadow-[0_1px_2px_rgb(0_33_63/0.12)]"
                      : "text-ink-muted hover:text-ink",
                  )}
                >
                  {o.icon}
                  {o.label}
                </button>
              ))}
            </div>
          </Section>
        </div>
      )}
    </Dialog>
  );
}
