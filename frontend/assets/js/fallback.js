// Ponte temporária: enquanto /jobs/ não aceita filtros e /stats/ e /filters/ não existem,
// o painel calcula os mesmos números aqui no navegador a partir de /jobs/.
// Quando /jobs/ aceitar filtros e /stats/ e /filters/ existirem, este arquivo pode ser
// apagado junto com os três try/catch do api.js.

const AGE_BUCKETS = [
  { label: "Nova", test: (days) => days === 0 },
  { label: "1-7 dias", test: (days) => days >= 1 && days <= 7 },
  { label: "8-14 dias", test: (days) => days >= 8 && days <= 14 },
  { label: "15-30 dias", test: (days) => days >= 15 && days <= 30 },
  { label: "Mais de 30 dias", test: (days) => days > 30 }
];

export function localJobs(items, params = {}) {
  const matched = items.filter((job) => matches(job, params));
  const sorted = sort(matched, params.sort);

  const page = Number(params.page) || 1;
  const pageSize = Number(params.page_size) || 20;
  const start = (page - 1) * pageSize;

  return {
    items: sorted.slice(start, start + pageSize),
    total: sorted.length,
    page,
    page_size: pageSize,
    pages: Math.max(1, Math.ceil(sorted.length / pageSize))
  };
}

export function localStats(items, params = {}) {
  const matched = items.filter((job) => matches(job, params));

  return {
    total: matched.length,
    companies: new Set(matched.map((job) => job.company).filter(Boolean)).size,
    anywhere_count: matched.filter((job) => job.region === "Anywhere in the World").length,
    new_count: matched.filter((job) => job.posted_age_days <= 7).length,
    with_salary_count: matched.filter((job) => Boolean(job.salary_range)).length,
    last_collected_at: latest(items),
    by_category: countBy(matched, "category"),
    by_job_type: countBy(matched, "job_type"),
    by_salary_range: countBy(matched, "salary_range").sort(bySalary),
    by_age_bucket: countAges(matched),
    top_companies: countBy(matched, "company").slice(0, 10)
  };
}

export function localFilters(items) {
  return {
    categories: unique(items, "category"),
    job_types: unique(items, "job_type"),
    regions: unique(items, "region")
  };
}

function matches(job, params) {
  if (params.category && job.category !== params.category) return false;
  if (params.job_type && job.job_type !== params.job_type) return false;
  if (params.region && job.region !== params.region) return false;

  if (params.search) {
    const haystack = normalize(`${job.title ?? ""} ${job.company ?? ""}`);
    if (!haystack.includes(normalize(params.search))) return false;
  }

  return true;
}

function sort(items, mode) {
  const copy = [...items];

  if (mode === "title" || mode === "company") {
    return copy.sort((a, b) => String(a[mode] ?? "").localeCompare(String(b[mode] ?? ""), "pt-BR"));
  }

  return copy.sort((a, b) => String(b.collected_at ?? "").localeCompare(String(a.collected_at ?? "")));
}

function countBy(items, field) {
  const tally = new Map();

  for (const job of items) {
    const value = job[field];
    if (!value) continue;
    tally.set(value, (tally.get(value) ?? 0) + 1);
  }

  return [...tally]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function countAges(items) {
  return AGE_BUCKETS
    .map(({ label, test }) => ({
      label,
      count: items.filter((job) => Number.isFinite(job.posted_age_days) && test(job.posted_age_days)).length
    }))
    .filter((bucket) => bucket.count > 0);
}

function unique(items, field) {
  const values = new Set(items.map((job) => job[field]).filter(Boolean));
  return [...values].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function latest(items) {
  return items.reduce((newest, job) => {
    const value = job.collected_at;
    return value && value > (newest ?? "") ? value : newest;
  }, null);
}

function bySalary(a, b) {
  return firstAmount(a.label) - firstAmount(b.label);
}

function firstAmount(label) {
  const match = String(label).match(/\$([\d,]+)/);
  return match ? Number(match[1].replace(/,/g, "")) : 0;
}

function normalize(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
