import { getJob } from "./api.js";
import { dateTime, text } from "./format.js";

const elements = {
  state: document.getElementById("state"),
  detail: document.getElementById("detail"),
  logo: document.getElementById("logo"),
  company: document.getElementById("company"),
  title: document.getElementById("title"),
  chips: document.getElementById("chips"),
  original: document.getElementById("original"),
  source: document.getElementById("source"),
  sourceUrl: document.getElementById("source-url"),
  collectedAt: document.getElementById("collected-at"),
  location: document.getElementById("location")
};

load();

async function load() {
  const id = new URLSearchParams(window.location.search).get("id");

  if (!id) {
    fail("Nenhuma vaga selecionada. Volte ao painel e escolha uma.");
    return;
  }

  try {
    render(await getJob(id));
  } catch (error) {
    fail(error.status === 404 || error.status === 400
      ? "Essa vaga não foi encontrada no banco."
      : `${error.message}. Confira se o uvicorn e o MongoDB estão rodando.`);
  }
}

function render(job) {
  document.title = `${text(job.title, "Vaga")} — vagas remotas`;

  elements.company.textContent = text(job.company, "Empresa não informada");
  elements.title.textContent = text(job.title, "Sem título");

  if (job.company_logo) {
    elements.logo.src = job.company_logo;
    elements.logo.alt = "";
    elements.logo.hidden = false;
  }

  for (const value of [job.job_type, job.region, job.salary_range]) {
    if (!value) continue;
    const chip = document.createElement("li");
    chip.className = "chip";
    chip.textContent = value;
    elements.chips.append(chip);
  }

  elements.original.href = job.url;
  elements.source.textContent = text(job.source);
  elements.sourceUrl.textContent = text(job.source_url);
  elements.collectedAt.textContent = dateTime(job.collected_at);
  elements.location.textContent = text(job.location).replace(/^HQ:\s*/, "");

  elements.state.hidden = true;
  elements.detail.hidden = false;
}

function fail(message) {
  elements.state.textContent = message;
  elements.state.className = "state state--error";
}
