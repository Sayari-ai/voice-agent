"use client";

import { useState } from "react";
import { Building2, Languages, Lock, Plug, ShieldCheck } from "lucide-react";
import { Card, CardHeader, Chip, PageHeader } from "@/components/ui";

function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? "bg-emerald-500" : "bg-slate-300"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function SettingRow({
  title,
  desc,
  control,
}: {
  title: string;
  desc: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div>
        <p className="text-sm font-medium text-navy-950">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
      </div>
      {control}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-navy-900">
        {value}
      </p>
    </div>
  );
}

const allLanguages = ["Hausa", "Yoruba", "Igbo", "Swahili", "Nigerian Pidgin", "Amharic"];

export function SettingsForm() {
  const [lowConfidence, setLowConfidence] = useState(true);
  const [threshold, setThreshold] = useState(85);
  const [afterHours, setAfterHours] = useState(false);
  const [humanOnRequest, setHumanOnRequest] = useState(true);
  const [voice, setVoice] = useState("Amina Hausa (female)");
  const [rate, setRate] = useState(1.0);
  const [enabled, setEnabled] = useState<string[]>(["Hausa", "Yoruba", "Igbo", "Swahili"]);
  const [saved, setSaved] = useState(false);

  const toggleLanguage = (l: string) =>
    setEnabled((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        subtitle="Tenant configuration for the sandbox environment. Changes are stored locally in this demo."
      />

      <Card>
        <CardHeader icon={<Building2 className="h-4 w-4" />} title="Organization" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <ReadOnlyField label="Tenant" value="Afriklang Sandbox West Africa" />
          <ReadOnlyField label="Region" value="Lagos (af-west-1)" />
          <ReadOnlyField label="Plan" value="Enterprise Pilot" />
          <ReadOnlyField label="Support contact" value="success@afriklang.example" />
        </div>
      </Card>

      <Card>
        <CardHeader
          icon={<ShieldCheck className="h-4 w-4" />}
          title="Escalation & Safety"
          right={<Chip tone="navy">Policy engine v2</Chip>}
        />
        <div className="divide-y divide-slate-100">
          <SettingRow
            title="Auto-escalate high-risk intents"
            desc="Fraud, account-security and legal intents always route to a human."
            control={
              <span className="flex items-center gap-2">
                <Chip tone="amber">
                  <Lock className="h-3 w-3" /> Enforced by policy
                </Chip>
                <Toggle checked disabled label="Auto-escalate high-risk intents" />
              </span>
            }
          />
          <SettingRow
            title="Escalate below confidence threshold"
            desc={`Calls below ${threshold}% intent confidence are handed to a human.`}
            control={
              <span className="flex items-center gap-3">
                <input
                  type="range"
                  min={70}
                  max={95}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  disabled={!lowConfidence}
                  className="w-28 accent-gold-600"
                  aria-label="Confidence threshold"
                />
                <Toggle
                  checked={lowConfidence}
                  onChange={setLowConfidence}
                  label="Escalate below confidence threshold"
                />
              </span>
            }
          />
          <SettingRow
            title="After-hours autonomous actions"
            desc="Allow the agent to execute account actions outside business hours."
            control={<Toggle checked={afterHours} onChange={setAfterHours} label="After-hours autonomous actions" />}
          />
          <SettingRow
            title="Human on request"
            desc="Customers can ask for a human at any time, in any supported language."
            control={<Toggle checked={humanOnRequest} onChange={setHumanOnRequest} label="Human on request" />}
          />
        </div>
      </Card>

      <Card>
        <CardHeader icon={<Languages className="h-4 w-4" />} title="Voice & Language" />
        <div className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="voice" className="text-xs font-medium text-slate-500">
                Default agent voice
              </label>
              <select
                id="voice"
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-navy-900 focus:border-gold-400 focus:outline-none focus:ring-2 focus:ring-gold-100"
              >
                <option>Amina Hausa (female)</option>
                <option>Chinedu Igbo (male)</option>
                <option>Zainab Yoruba (female)</option>
              </select>
            </div>
            <div>
              <label htmlFor="rate" className="text-xs font-medium text-slate-500">
                Speaking rate: {rate.toFixed(1)}×
              </label>
              <input
                id="rate"
                type="range"
                min={0.8}
                max={1.3}
                step={0.1}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="mt-3 w-full accent-gold-600"
              />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Enabled languages</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {allLanguages.map((l) => {
                const on = enabled.includes(l);
                return (
                  <button
                    key={l}
                    onClick={() => toggleLanguage(l)}
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      on
                        ? "border-navy-900 bg-navy-900 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-navy-200"
                    }`}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          icon={<Plug className="h-4 w-4" />}
          title="Enterprise Integrations"
          right={<Chip tone="gold">Simulated</Chip>}
        />
        <div className="divide-y divide-slate-100">
          {[
            { name: "Core Banking API", url: "sandbox.corebank.afriklang.example" },
            { name: "Telco BSS", url: "sandbox.bss.afriklang.example" },
            { name: "CRM connector", url: "sandbox.crm.afriklang.example" },
          ].map((i) => (
            <div key={i.name} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
              <div>
                <p className="text-sm font-medium text-navy-950">{i.name}</p>
                <p className="mt-0.5 font-mono text-xs text-slate-500">{i.url}</p>
              </div>
              <span className="flex items-center gap-2">
                <Chip tone="green">Healthy</Chip>
                <Chip tone="gold">Simulated</Chip>
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          className="inline-flex items-center gap-2 rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-navy-950 transition-colors hover:bg-gold-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
        >
          {saved ? "Saved ✓" : "Save changes"}
        </button>
        <p className="text-xs text-slate-400">Settings only persist for this browser session.</p>
      </div>
    </div>
  );
}
