# MVP — Web Crawler de Vagas

MVP do projeto de Web Crawler baseado no desafio:

Site → Web Crawler → MongoDB

## 1. Pré-requisitos

- Python 3.11+
- MongoDB rodando localmente
- Internet

## 2. Instalação

```bash
python -m venv .venv
```

Windows:

```bash
.venv\Scripts\activate
```

Instale as dependências:

```bash
pip install -r requirements.txt
```

## 3. MongoDB

O crawler usa:

- Banco: `job_crawler`
- Collection: `jobs`

Por padrão:

```text
mongodb://localhost:27017
```

Se seu MongoDB estiver em outro endereço, altere `MONGO_URI` em `crawler.py`.

## 4. Executar

```bash
python crawler.py
```

Exemplo esperado:

```text
Coletando: https://weworkremotely.com/remote-jobs
Vagas encontradas: 20
Novas vagas: 20
Vagas atualizadas: 0
Coleta finalizada.
```

Ao executar novamente, a URL da vaga é usada para gerar um identificador único. Assim, a coleta não cria duplicatas.

## 5. Documento salvo no MongoDB

Exemplo:

```json
{
  "job_id": "hash-da-url",
  "title": "Software Engineer",
  "company": "Empresa",
  "region": "Anywhere in the World",
  "category": "Back-End Programming",
  "url": "https://weworkremotely.com/remote-jobs/...",
  "source": "We Work Remotely",
  "source_url": "https://weworkremotely.com/remote-jobs",
  "collected_at": "2026-09-29T16:00:00Z",
  "created_at": "2026-09-29T16:00:00Z",
  "updated_at": "2026-09-29T16:00:00Z"
}
```

## 6. Próxima etapa

Depois de validar o crawler, a arquitetura pode evoluir para:

```text
We Work Remotely
       ↓
    crawler
       ↓
    MongoDB
       ↓
    FastAPI
       ↓
   Dashboard
```

A API deverá posteriormente permitir listagem, consulta individual, filtros e estatísticas, conforme o enunciado.
