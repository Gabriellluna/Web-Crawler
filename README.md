# Web Crawler de Vagas Remotas

Plataforma de coleta, armazenamento e visualização de vagas de emprego remoto (projeto CP5 de Python). Um crawler coleta as vagas do [We Work Remotely](https://weworkremotely.com/remote-jobs) automaticamente, guarda tudo no MongoDB, uma API FastAPI disponibiliza os dados e um painel web permite explorá-los.

**Acesse online:** https://web-crawler-orcin.vercel.app

```text
We Work Remotely → Crawler (GitHub Actions) → MongoDB Atlas → API FastAPI (Vercel) → Painel web (Vercel)
```

## Como funciona

O sistema tem dois caminhos independentes, e o MongoDB Atlas é o único ponto de encontro entre eles:

**Escrita (a cada 5 minutos)**
1. O GitHub Actions dispara o workflow `.github/workflows/crawler.yml` sozinho, a cada 5 minutos.
2. O workflow executa `run_crawler()`, de `crawler.py`: acessa o site, extrai as vagas e trata os dados.
3. As vagas são gravadas no Atlas com `upsert` pela `url`: vagas novas são inseridas e as que já existem têm só a data da coleta atualizada. Nada é apagado.

**Leitura (quando alguém acessa)**
1. O navegador baixa o painel (`public/`) servido pela Vercel.
2. O JavaScript do painel faz requisições `GET` à API (`/jobs/`, `/stats/`, `/filters/`).
3. A API, que roda na Vercel como função sob demanda, consulta o Atlas e responde com JSON.
4. O painel desenha indicadores, gráficos e tabela com o que recebeu.

Como o crawler escreve no banco de forma independente e a API lê o banco a cada requisição, as vagas novas aparecem no painel sem nenhuma ação manual, bastando recarregar a página.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Coleta | Python, `requests`, `BeautifulSoup` |
| Agendamento | GitHub Actions (cron a cada 5 minutos) |
| Banco de dados | MongoDB Atlas, via `pymongo` |
| API | FastAPI |
| Painel | HTML, CSS e JavaScript puro, com Chart.js para os gráficos |
| Hospedagem | Vercel (API e painel) |

## Site coletado

[We Work Remotely](https://weworkremotely.com/remote-jobs): listagem pública de vagas remotas. O crawler coleta apenas dados das vagas (título, empresa, categoria, contrato, faixa salarial, região, data de publicação e link), sem dados pessoais.

## Estrutura do projeto

```text
Web-Crawler/
├── .github/
│   └── workflows/
│       └── crawler.yml      # Agenda e executa o crawler a cada 5 minutos
├── api/
│   ├── main.py              # App FastAPI e registro das rotas
│   └── routes.py            # Endpoints /jobs, /stats e /filters
├── public/                  # Painel web (HTML, CSS e JS puro)
│   ├── index.html           # Painel: indicadores, gráficos, filtros e lista
│   ├── job.html             # Tela de detalhes (job.html?id=...)
│   └── assets/
│       ├── css/app.css
│       └── js/              # api, painel, detalhe, charts e format
├── app.py                   # Ponto de entrada da API para a Vercel
├── crawler.py               # Requisição ao site, parsing e tratamento dos dados
├── database.py              # Conexão e persistência no MongoDB
└── requirements.txt
```

## Banco de dados

- Banco: `job_crawler`
- Collection: `jobs`
- Identificação de duplicados: a `url` da vaga. A coleta usa `upsert`, então novas execuções não duplicam registros nem apagam dados anteriores.

Exemplo de documento:

```json
{
  "_id": "ObjectId(...)",
  "title": "Software Engineer",
  "company": "Empresa",
  "location": "HQ: Tallinn, Estonia",
  "url": "https://weworkremotely.com/remote-jobs/...",
  "category": "Full-Stack Programming",
  "job_type": "Full-Time",
  "salary_range": "$75,000 - $99,999 USD",
  "region": "Anywhere in the World",
  "posted_at": "2026-09-27T16:00:00Z",
  "company_logo": "https://we-work-remotely.imgix.net/logos/...",
  "source": "We Work Remotely",
  "source_url": "https://weworkremotely.com/remote-jobs",
  "collected_at": "2026-09-29T16:00:00Z"
}
```

| Campo | Descrição |
|---|---|
| `title` | Título da vaga |
| `company` | Empresa (pode ser nulo) |
| `location` | Sede da empresa, como o site informa (pode ser nulo) |
| `url` | Link da vaga no site de origem |
| `category` | Área da vaga, vinda da seção do site (ex.: `Design`) |
| `job_type` | Tipo de contrato (ex.: `Full-Time`, `Contract`) |
| `salary_range` | Faixa salarial declarada, quando existe |
| `region` | Região aceita. Vagas com vários países viram `Vários países` |
| `posted_at` | Data de publicação, calculada a partir da idade mostrada no site |
| `company_logo` | Logo da empresa (só nas vagas patrocinadas) |
| `source` / `source_url` | De onde o dado foi coletado |
| `collected_at` | Data e hora (UTC) da última coleta da vaga |

A API não guarda a idade da vaga em dias: ela calcula `posted_age_days` a partir de `posted_at` na hora de responder, para o número não envelhecer dentro do banco.

## Endpoints da API

Documentação interativa (Swagger): https://web-crawler-orcin.vercel.app/docs

| Método | Rota | Descrição |
|---|---|---|
| GET | `/jobs/` | Lista paginada de vagas, com busca e filtros |
| GET | `/jobs/{job_id}` | Retorna uma vaga pelo `_id`. Responde `400` se o ID for inválido e `404` se não existir |
| GET | `/stats/` | Indicadores e agregações do mesmo recorte aceito por `/jobs/` |
| GET | `/filters/` | Valores disponíveis para os filtros de categoria, contrato e região |

Os filtros são opcionais e combinam entre si. `search` procura no título e na empresa, ignorando maiúsculas; `category`, `job_type` e `region` são correspondência exata.

| Parâmetro | Padrão | Aceita |
|---|---|---|
| `search` | vazio | Qualquer texto |
| `category` / `job_type` / `region` | vazio | Um dos valores devolvidos por `/filters/` |
| `page` | `1` | Inteiro a partir de 1 |
| `page_size` | `20` | De 1 a 100 |

`/jobs/` responde com `items`, `total`, `page`, `page_size` e `pages`. Cada vaga traz também `posted_age_days`, a idade do anúncio em dias.

`/stats/` responde com os totais `total`, `companies`, `anywhere_count`, `new_count` (publicadas nos últimos 7 dias) e `with_salary_count`, a data `last_collected_at` (sempre da base inteira, para não mudar conforme o filtro) e as agregações `by_category`, `by_job_type`, `by_salary_range`, `by_age_bucket` e `top_companies`, todas como listas de `{label, count}`.

Exemplos:

```bash
curl https://web-crawler-orcin.vercel.app/jobs/
curl "https://web-crawler-orcin.vercel.app/jobs/?search=python&category=Design&page=2"
curl https://web-crawler-orcin.vercel.app/jobs/66f9a1b2c3d4e5f6a7b8c9d0
curl "https://web-crawler-orcin.vercel.app/stats/?job_type=Contract"
curl https://web-crawler-orcin.vercel.app/filters/
```

## Painel web

- `index.html` (`/`): painel com quatro indicadores (vagas, empresas, novas na semana e vagas com salário), quatro gráficos (vagas por categoria, empresas que mais contratam, faixa salarial e idade do anúncio), busca por título ou empresa, filtros de categoria, contrato e região, e a lista paginada de vagas. Todos os dados vêm exclusivamente da API.
- `job.html?id=<_id>`: detalhes da vaga (empresa, contrato, região, faixa salarial, fonte e data da coleta) e botão para abrir a vaga original.

## Executar localmente

Pré-requisitos: Python 3.11+ e um MongoDB local em `mongodb://localhost:27017` (ou um cluster Atlas).

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/macOS

pip install -r requirements.txt
```

**Rodar o crawler uma vez** (coleta o site e grava no banco):

```bash
python -c "from crawler import run_crawler; run_crawler()"
```

**Rodar a API:**

```bash
python -m uvicorn api.main:app --reload
```

- API: http://localhost:8000
- Swagger: http://localhost:8000/docs

Para usar outro banco, defina a variável de ambiente `MONGO_URI` antes de rodar (veja a tabela abaixo). Sem ela, o projeto usa o MongoDB local.

> A API local não serve mais o painel. O painel chama a API pelo mesmo endereço de onde foi aberto, então ele funciona na versão publicada. Para vê-lo localmente é preciso servir `public/` e a API na mesma origem, por exemplo com `vercel dev`.

## Publicação (deploy)

A versão online usa três serviços gratuitos, cada um com um papel:

| Serviço | Papel |
|---|---|
| MongoDB Atlas | Armazena as vagas |
| GitHub Actions | Executa o crawler a cada 5 minutos |
| Vercel | Hospeda a API e o painel |

**1. Atlas**
- Crie um cluster gratuito (M0).
- Em *Database Access*, crie dois usuários: um com permissão de escrita (para o crawler) e um somente leitura (para a API).
- Em *Network Access*, libere `0.0.0.0/0`, pois os IPs do GitHub e da Vercel não são fixos.

**2. GitHub**
- Em *Settings → Secrets and variables → Actions*, crie o secret `MONGO_URI` com a connection string do usuário de **escrita**.
- O workflow `.github/workflows/crawler.yml` já agenda a coleta. Para testar à mão, use *Actions → Crawler → Run workflow*.

**3. Vercel**
- Importe o repositório e, em *Environment Variables*, crie `MONGO_URI` com a connection string do usuário **somente leitura**.
- A Vercel detecta o FastAPI sozinha (ponto de entrada em `app.py`) e serve a pasta `public/` como painel.

### Variáveis de ambiente

| Variável | Onde | Valor |
|---|---|---|
| `MONGO_URI` | Secret do GitHub | Connection string do Atlas, usuário de escrita |
| `MONGO_URI` | Variável da Vercel | Connection string do Atlas, usuário de leitura |

Nunca versione connection strings: o `.gitignore` já ignora o arquivo `.env`.

## Observações

- O agendamento do GitHub Actions funciona em "melhor esforço": a coleta pode atrasar alguns minutos em relação aos 5 minutos configurados.
- O cron da Vercel não é usado porque o plano gratuito só permite execução uma vez por dia. Por isso a coleta fica no GitHub Actions.
- A API é pública e só tem rotas `GET`. O usuário somente leitura do Atlas garante que ela não consiga alterar os dados.
- O painel não se atualiza sozinho: recarregue a página para ver as vagas mais recentes.
