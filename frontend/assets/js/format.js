const numberFormat = new Intl.NumberFormat("pt-BR");

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

const relativeFormat = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

const RELATIVE_STEPS = [
  ["minute", 60],
  ["hour", 24],
  ["day", 30],
  ["month", 12],
  ["year", Infinity]
];

export function count(value) {
  return numberFormat.format(value ?? 0);
}

export function dateTime(value) {
  const date = toDate(value);
  return date ? dateTimeFormat.format(date) : "Não informado";
}

export function relative(value) {
  const date = toDate(value);
  if (!date) return "Não informado";

  let amount = (date.getTime() - Date.now()) / 1000 / 60;
  let unit = "minute";

  for (const [name, limit] of RELATIVE_STEPS) {
    unit = name;
    if (Math.abs(amount) < limit) break;
    amount = amount / limit;
  }

  return relativeFormat.format(Math.round(amount), unit);
}

export function text(value, fallback = "Não informado") {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || fallback;
}

export function shortSalary(label) {
  const matches = String(label).match(/\$([\d,]+)/g);
  if (!matches) return label;

  const toShort = (raw) => {
    const value = Number(raw.replace(/[$,]/g, ""));
    return value >= 1000 ? `${Math.round(value / 1000)}k` : String(value);
  };

  if (matches.length === 1) return `${toShort(matches[0])}+`;
  return `${toShort(matches[0])}–${toShort(matches[1])}`;
}

function toDate(value) {
  if (!value) return null;

  // O Mongo guarda em UTC e a API serializa sem fuso ("2026-10-06T02:00:00").
  // Sem o "Z" o JS leria como hora local e o horário sairia deslocado.
  const raw = typeof value === "string" && !/(Z|[+-]\d{2}:?\d{2})$/.test(value)
    ? `${value}Z`
    : value;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}
