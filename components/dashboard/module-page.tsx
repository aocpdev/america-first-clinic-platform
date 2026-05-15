import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ModulePage({
  title,
  description,
  items
}: {
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <div className="space-y-5">
      <Card className="p-6">
        <Badge>Production module</Badge>
        <h2 className="mt-4 text-2xl font-semibold text-clinic-ink">{title}</h2>
        <p className="mt-2 max-w-3xl text-slate-600">{description}</p>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item) => (
          <Card key={item} className="p-5">
            <p className="text-sm font-semibold text-clinic-ink">{item}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">Ready for Prisma queries, RLS checks, server actions, and audit logs.</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
