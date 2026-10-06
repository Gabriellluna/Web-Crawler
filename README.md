# Web Crawler de Vagas Remotas

Plataforma de coleta e visualização de vagas de emprego remoto (projeto CP5 de Python).

```text
We Work Remotely → Web Crawler → MongoDB → FastAPI → Front-end (HTML + JS)
```

O crawler acessa o site público **a cada 5 minutos**, salva as vagas no MongoDB sem duplicar registros e a API disponibiliza os dados para as telas do front-end.

## Site escolhido

[We Work Remotely](https://weworkremotely.com/remote-jobs): listagem pública de vagas remotas. O crawler coleta apenas dados das vagas (título, empresa, categoria, contrato, faixa salarial, região, data de publicação e link), sem dados pessoais.

## Estrutura do projeto

```text
Web-Crawler/
├── api/
│   ├── main.py        # App FastAPI, serve o front e dispara a coleta a cada 5 minutos
│   └── routes.py      # Endpoints /jobs, /stats e /filters
├── frontend/          # Interface web (HTML, CSS e JS puro)
│   ├── index.html     # Painel: indicadores, gráficos, filtros e lista de vagas
│   ├── job.html       # Tela de detalhes (job.html?id=...)
│   └── assets/        # CSS e módulos JS do front
├── crawler.py         # Requisição ao site, parsing do HTML e loop de coleta
├── database.py        # Conexão e persistência no MongoDB
└── requirements.txt
```

## Pré-requisitos

- Python 3.11+
- MongoDB rodando em `mongodb://localhost:27017`
- Conexão com a internet

## Instalação

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/macOS

pip install -r requirements.txt
```

Para usar outro endereço do MongoDB, altere `MONGO_URI` em `database.py`.

## Como executar

Com o MongoDB ligado, rode na raiz do projeto:

```bash
python -m uvicorn api.main:app --reload
```

- Front-end (lista de vagas): http://localhost:8000
- Documentação interativa da API (Swagger): http://localhost:8000/docs

Ao iniciar, a API dispara o crawler em segundo plano. Não há nada para instalar no front: a própria API serve os arquivos HTML.

> Abra o front sempre pelo endereço `http://localhost:8000`. Abrir o `index.html` direto no navegador não funciona, pois as chamadas à API usam caminhos relativos.

### Coleta automática a cada 5 minutos

O crawler faz uma nova requisição ao site a cada **5 minutos**, enquanto a aplicação estiver rodando. A cada ciclo, o terminal mostra:

```text
[14:00:03] Iniciando coleta...
Coletando: https://weworkremotely.com/remote-jobs
Status: 200
Elementos encontrados: 193
Vagas encontradas: 192
Novas vagas inseridas: 0
Dados salvos no MongoDB.
[14:00:03] Coleta finalizada. Próxima em 5 minutos.
```

- Se o site falhar em uma coleta, o erro é exibido e o loop continua; a próxima tentativa acontece 5 minutos depois.
- Para mudar o intervalo, altere `INTERVALO_MINUTOS` em `api/main.py`.
- A página de listagem não atualiza sozinha: recarregue (F5) para ver as vagas novas.

### Rodar o crawler separado da API (opcional)

O crawler também funciona de forma independente da API, com o mesmo loop de 5 minutos:

```bash
python crawler.py
```

Use essa forma só se a coleta **não** estiver sendo disparada pela API (remova o `startup` do `api/main.py`). Não rode as duas ao mesmo tempo, senão o site será acessado em duplicidade.

## Banco de dados

- Banco: `job_crawler`
- Collection: `jobs`
- Identificação de duplicados: a `url` da vaga. A coleta usa `upsert`, então novas execuções não duplicam registros nem apagam dados anteriores. Em cada ciclo, as vagas já existentes têm o `collected_at` atualizado e apenas as vagas inéditas são inseridas.

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

| Método | Rota | Descrição |
|---|---|---|
| GET | `/jobs/` | Lista paginada de vagas, com busca, filtros e ordenação |
| GET | `/jobs/{job_id}` | Retorna uma vaga pelo `_id`. Responde `400` se o ID for inválido e `404` se não existir |
| GET | `/stats/` | Indicadores e agregações do mesmo recorte aceito por `/jobs/` |
| GET | `/filters/` | Valores disponíveis para os filtros de categoria, contrato e região |

Os filtros são opcionais e combinam entre si. `search` procura no título e na empresa, ignorando maiúsculas; `category`, `job_type` e `region` são correspondência exata.

| Parâmetro | Padrão | Aceita |
|---|---|---|
| `search` | vazio | Qualquer texto |
| `category` / `job_type` / `region` | vazio | Um dos valores devolvidos por `/filters/` |
| `sort` | `collected_at` decrescente | `title` ou `company` |
| `page` | `1` | Inteiro a partir de 1 |
| `page_size` | `20` | De 1 a 100 |

`/jobs/` responde com `items`, `total`, `page`, `page_size` e `pages`. Cada vaga traz também `posted_age_days`, a idade do anúncio em dias.

`/stats/` responde com os totais `total`, `companies`, `anywhere_count`, `new_count` (publicadas nos últimos 7 dias) e `with_salary_count`, a data `last_collected_at` (sempre da base inteira, para não mudar conforme o filtro) e as agregações `by_category`, `by_job_type`, `by_salary_range`, `by_age_bucket` e `top_companies`, todas como listas de `{label, count}`.

Exemplos:

```bash
curl http://localhost:8000/jobs/
curl "http://localhost:8000/jobs/?search=python&category=Design&page=2"
curl http://localhost:8000/jobs/66f9a1b2c3d4e5f6a7b8c9d0
curl "http://localhost:8000/stats/?job_type=Contract"
curl http://localhost:8000/filters/
```

> Os routers precisam ser registrados **antes** do `app.mount("/")` em `api/main.py`. O mount responde por qualquer caminho, então uma rota registrada depois dele nunca é alcançada.

## Telas do front-end

- `index.html` (`/`): painel com indicadores, gráficos, busca, filtros e a lista paginada de vagas; cada item leva ao detalhe.
- `job.html?id=<_id>`: detalhes da vaga (empresa, contrato, região, faixa salarial, fonte e data da coleta) e botão para abrir a vaga original.

## Roadmap

- [x] Endpoint de busca/filtro (ex.: `/jobs?search=python&category=Design`)
- [x] Endpoint de estatísticas (total, vagas por empresa, categoria, contrato e faixa salarial)
- [x] Dashboard com indicadores, gráficos e filtros