import { MISSING_ENDPOINTS, getFilterOptions, getStats, listJobs } from "./api.js";
import { createBarChart } from "./charts.js";
import { count, relative, shortSalary, text } from "./format.js";

const PAGE_SIZE = 20;

const elements = {
  notice: document.getElementById("notice"),
  lastCollect: document.getElementById("last-collect"),
  heroStatement: document.getElementById("hero-statement"),
  heroBand: document.getElementById("hero-band"),
  heroBandFill: document.getElementById("hero-band-fill"),
  heroNote: document.getElementById("hero-note"),
  metricTotal: document.getElementById("metric-total"),
  metricCompanies: document.getElementById("metric-companies"),
  metricNew: document.getElementById("metric-new"),
  metricSalary: document.getElementById("metric-salary"),
  filters: document.getElementById("filters"),
  search: document.getElementById("filter-search"),
  category: document.getElementById("filter-category"),
  jobType: document.getElementById("filter-job-type"),
  region: document.getElementById("filter-region"),
  resultsCount: document.getElementById("results-count"),
  resultsBody: document.getElementById("results-body"),
  pagination: document.getElementById("pagination"),
  pagePrev: document.getElementById("page-prev"),
  pageNext: document.getElementById("page-next"),
  pagePosition: document.getElementById("page-position")
};

const charts = {
  category: createBarChart({
    canvas: document.getElementById("chart-category"),
    empty: document.getElementById("chart-category-empty"),
    emptyMessage: "O crawler ainda não salva a categoria das vagas.",
    horizontal: true
  }),
  companies: createBarChart({
    canvas: document.getElementById("chart-companies"),
    empty: document.getElementById("chart-companies-empty"),
    emptyMessage: "Nenhuma empresa neste recorte.",
    horizontal: true
  }),
  salary: createBarChart({
    canvas: document.getElementById("chart-salary"),
    empty: document.getElementById("chart-salary-empty"),
    emptyMessage: "Nenhuma vaga deste recorte declara salário.",
    formatLabel: shortSalary
  }),
  age: createBarChart({
    canvas: document.getElementById("chart-age"),
    empty: document.getElementById("chart-age-empty"),
    emptyMessage: "Sem data de publicação nos dados coletados."
  })
};

const state = { search: "", category: "", job_type: "", region: "", page: 1 };

let pending = null;
let searchTimer = null;

start();

async function start() {
  bindEvents();
  await loadFilterOptions();
  await refresh();
}

function bindEvents() {
  elements.search.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = elements.search.value.trim();
      state.page = 1;
      refresh();
    }, 300);
  });

  for (const [key, field] of [["category", elements.category], ["job_type", elements.jobType], ["region", elements.region]]) {
    field.addEventListener("change", () => {
      state[key] = field.value;
      state.page = 1;
      refresh();
    });
  }

  elements.filters.addEventListener("reset", () => {
    Object.assign(state, { search: "", category: "", job_type: "", region: "", page: 1 });
    setTimeout(refresh);
  });

  elements.pagePrev.addEventListener("click", () => changePage(-1));
  elements.pageNext.addEventListener("click", () => changePage(1));
}

async function loadFilterOptions() {
  try {
    const options = await getFilterOptions();
    fillSelect(elements.category, options.categories);
    fillSelect(elements.jobType, options.job_types);
    fillSelect(elements.region, options.regions);
  } catch {
    elements.category.disabled = true;
    elements.jobType.disabled = true;
    elements.region.disabled = true;
  }
}

async function refresh() {
  if (pending) pending.abort();
  pending = new AbortController();
  const { signal } = pending;

  showSkeleton();

  try {
    const query = filterQuery();
    const [stats, page] = await Promise.all([
      getStats(query, signal),
      listJobs({ ...query, page: state.page, page_size: PAGE_SIZE }, signal)
    ]);

    renderHero(stats);
    renderMetrics(stats);
    renderCharts(stats);
    renderTable(page);
    renderNotice();
  } catch (error) {
    if (error.name !== "AbortError") renderError(error);
  }
}

function filterQuery() {
  return {
    search: state.search,
    category: state.category,
    job_type: state.job_type,
    region: state.region
  };
}

function renderHero(stats) {
  const { total, anywhere_count: anywhere, companies, last_collected_at: collectedAt } = stats;

  elements.lastCollect.textContent = collectedAt ? `coleta ${relative(collectedAt)}` : "";

  if (total === 0) {
    elements.heroStatement.textContent = isFiltered()
      ? "Nenhuma vaga com esses filtros"
      : "Nenhuma vaga no banco ainda";
    elements.heroBand.hidden = true;
    elements.heroNote.textContent = isFiltered()
      ? "Limpe a busca para ver a coleta inteira."
      : "Rode o crawler para a primeira coleta.";
    return;
  }

  if (anywhere > 0) {
    const share = Math.round((anywhere / total) * 100);
    elements.heroStatement.textContent = `${count(anywhere)} de ${count(total)} vagas não perguntam onde você mora`;
    elements.heroBand.hidden = false;
    elements.heroBandFill.style.width = `${share}%`;
    elements.heroNote.textContent = `${share}% da coleta aceita candidatos de qualquer lugar do mundo, em ${count(companies)} empresas.`;
    return;
  }

  elements.heroStatement.textContent = `${count(total)} vagas remotas coletadas`;
  elements.heroBand.hidden = true;
  elements.heroNote.textContent = `Coletadas do We Work Remotely em ${count(companies)} empresas diferentes.`;
}

function renderMetrics(stats) {
  elements.metricTotal.textContent = count(stats.total);
  elements.metricCompanies.textContent = count(stats.companies);
  elements.metricNew.textContent = count(stats.new_count);
  elements.metricSalary.textContent = count(stats.with_salary_count);
}

function renderCharts(stats) {
  charts.category.update(stats.by_category);
  charts.companies.update(stats.top_companies);
  charts.salary.update(stats.by_salary_range);
  charts.age.update(stats.by_age_bucket);
}

function renderTable(page) {
  const { items, total, pages } = page;
  elements.resultsBody.replaceChildren();

  if (items.length === 0) {
    elements.resultsBody.append(stateRow("Nenhuma vaga encontrada. Tente outra busca."));
    elements.resultsCount.textContent = "";
    elements.pagination.hidden = true;
    return;
  }

  const first = (page.page - 1) * page.page_size + 1;
  elements.resultsCount.textContent = `${first}–${first + items.length - 1} de ${count(total)}`;

  for (const job of items) {
    elements.resultsBody.append(jobRow(job));
  }

  elements.pagination.hidden = pages <= 1;
  elements.pagePrev.disabled = page.page <= 1;
  elements.pageNext.disabled = page.page >= pages;
  elements.pagePosition.textContent = `Página ${page.page} de ${pages}`;
}

function jobRow(job) {
  const row = document.createElement("tr");

  const link = document.createElement("a");
  link.className = "table__link";
  link.href = `job.html?id=${encodeURIComponent(job._id)}`;
  link.textContent = text(job.title, "Sem título");

  row.append(
    cell(link),
    cell(text(job.company, "—")),
    cell(text(job.category, "—")),
    cell(text(job.job_type, "—")),
    cell(relative(job.collected_at), "table__muted")
  );

  return row;
}

function renderNotice() {
  if (MISSING_ENDPOINTS.length === 0) {
    elements.notice.hidden = true;
    return;
  }

  elements.notice.hidden = false;
  elements.notice.textContent =
    `Ainda faltam na API: ${MISSING_ENDPOINTS.join(", ")}. ` +
    "Os números estão sendo calculados no navegador enquanto isso.";
}

function renderError(error) {
  elements.heroStatement.textContent = "A API não respondeu";
  elements.heroBand.hidden = true;
  elements.heroNote.textContent = `${error.message}. Confira se o uvicorn e o MongoDB estão rodando.`;
  elements.resultsBody.replaceChildren(stateRow("Sem dados para mostrar."));
  elements.pagination.hidden = true;
}

function showSkeleton() {
  const rows = Array.from({ length: 6 }, () => {
    const row = document.createElement("tr");

    for (let column = 0; column < 5; column += 1) {
      const span = document.createElement("span");
      span.className = "skeleton";
      row.append(cell(span));
    }

    return row;
  });

  elements.resultsBody.replaceChildren(...rows);
}

function changePage(offset) {
  state.page = Math.max(1, state.page + offset);
  refresh();
  window.scrollTo({ top: elements.resultsBody.offsetTop - 80, behavior: "smooth" });
}

function isFiltered() {
  return Boolean(state.search || state.category || state.job_type || state.region);
}

function cell(content, className) {
  const td = document.createElement("td");
  if (className) td.className = className;
  td.append(content);
  return td;
}

function stateRow(message) {
  const row = document.createElement("tr");
  const td = document.createElement("td");
  td.className = "table__state";
  td.colSpan = 5;
  td.textContent = message;
  row.append(td);
  return row;
}

function fillSelect(select, values) {
  for (const value of values ?? []) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
}
