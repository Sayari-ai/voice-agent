import type { Metadata } from "next";
import { Card, Chip, PageHeader, type ChipTone } from "@/components/ui";
import { languageModels } from "@/lib/mock-data";
import { Languages } from "lucide-react";

export const metadata: Metadata = { title: "Language Models" };

const statusTone: Record<string, ChipTone> = {
  Production: "green",
  Beta: "amber",
  Training: "gray",
};

export default function LanguageModelsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Language Models"
        subtitle="Speech recognition and intent models for African languages, trained with native-speaker data partners."
        action={<Chip tone="gold">9 languages · 5 in production</Chip>}
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {languageModels.map((m) => (
          <Card key={m.code} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
                  <Languages className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-navy-950">{m.name}</h2>
                  <p className="font-mono text-[11px] text-slate-400">
                    {m.code} · {m.version}
                  </p>
                </div>
              </div>
              <Chip tone={statusTone[m.status]}>{m.status}</Chip>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                <p className="text-[11px] text-slate-500">ASR word error rate</p>
                <p className="mt-0.5 text-sm font-semibold text-navy-950">{m.wer}</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                <p className="text-[11px] text-slate-500">Intent F1 score</p>
                <p className="mt-0.5 text-sm font-semibold text-navy-950">{m.intentF1}</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[11px] text-slate-500">Dialect coverage</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {m.dialects.map((d) => (
                  <span
                    key={d}
                    className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>

            <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
              Last evaluation: {m.updated}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
