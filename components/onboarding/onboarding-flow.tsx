import { CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";

export function OnboardingFlow({ title, steps }: { title: string; steps: string[] }) {
  return (
    <Card className="p-6 shadow-soft">
      <h1 className="text-3xl font-semibold text-clinic-ink">{title}</h1>
      <div className="mt-8 space-y-4">
        {steps.map((step, index) => (
          <div key={step} className="flex gap-4 rounded-xl border border-border bg-white p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-clinic-mist font-semibold text-clinic-navy">
              {index + 1}
            </div>
            <div>
              <p className="font-semibold text-clinic-ink">{step}</p>
              <p className="mt-1 text-sm text-slate-500">Prepared for validation, audit logging, and saved progress.</p>
            </div>
            {index === 0 && <CheckCircle2 className="ml-auto h-5 w-5 text-emerald-600" />}
          </div>
        ))}
      </div>
    </Card>
  );
}
