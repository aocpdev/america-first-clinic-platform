export type DashboardDateRange = {
  preset: string;
  from?: Date;
  to?: Date;
  label: string;
  fromInput: string;
  toInput: string;
};

export type DashboardDateRangeParams = {
  range?: string;
  from?: string;
  to?: string;
};

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function inputDate(date?: Date) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

function parseInputDate(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function labelDate(date?: Date) {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function parseDashboardDateRange(params?: DashboardDateRangeParams | null): DashboardDateRange {
  const now = new Date();
  const preset = params?.range || "30d";

  if (preset === "all") {
    return {
      preset,
      label: "All time",
      fromInput: "",
      toInput: ""
    };
  }

  if (preset === "custom") {
    const from = parseInputDate(params?.from);
    const to = parseInputDate(params?.to);
    const range = {
      preset,
      from: from ? startOfDay(from) : undefined,
      to: to ? endOfDay(to) : undefined,
      fromInput: inputDate(from),
      toInput: inputDate(to),
      label: from || to ? `${from ? labelDate(from) : "Start"} - ${to ? labelDate(to) : "Today"}` : "Custom range"
    };

    return range;
  }

  if (preset === "month") {
    const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const to = endOfDay(now);
    return {
      preset,
      from,
      to,
      label: "This month",
      fromInput: inputDate(from),
      toInput: inputDate(to)
    };
  }

  if (preset === "year") {
    const from = startOfDay(new Date(now.getFullYear(), 0, 1));
    const to = endOfDay(now);
    return {
      preset,
      from,
      to,
      label: "This year",
      fromInput: inputDate(from),
      toInput: inputDate(to)
    };
  }

  const days = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
  const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)));
  const to = endOfDay(now);

  return {
    preset,
    from,
    to,
    label: `Last ${days} days`,
    fromInput: inputDate(from),
    toInput: inputDate(to)
  };
}

