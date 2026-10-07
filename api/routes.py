import math
import re

from bson import ObjectId
from bson.errors import InvalidId
from collections import Counter
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query

from database import jobs_collection

jobs_router = APIRouter(prefix="/jobs", tags=["Jobs"])
stats_router = APIRouter(prefix="/stats", tags=["Stats"])
filters_router = APIRouter(prefix="/filters", tags=["Filters"])

ANYWHERE = "Anywhere in the World"
NEW_LIMIT_DAYS = 7
SORT_FIELDS = ["title", "company"]

AGE_BUCKETS = [
    ("Nova", 0, 0),
    ("1-7 dias", 1, 7),
    ("8-14 dias", 8, 14),
    ("15-30 dias", 15, 30),
    ("Mais de 30 dias", 31, None)
]


def age_in_days(posted_at):
    if not posted_at:
        return None

    # O pymongo devolve datas sem fuso, mas o banco guarda sempre em UTC.
    if posted_at.tzinfo is None:
        posted_at = posted_at.replace(tzinfo=timezone.utc)

    return max(0, (datetime.now(timezone.utc) - posted_at).days)


def serialize_job(job: dict) -> dict:
    job["_id"] = str(job["_id"])
    job["posted_age_days"] = age_in_days(job.get("posted_at"))
    return job


def job_filters(
    search: str = "",
    category: str = "",
    job_type: str = "",
    region: str = ""
) -> dict:
    query = {}

    if category:
        query["category"] = category

    if job_type:
        query["job_type"] = job_type

    if region:
        query["region"] = region

    if search:
        pattern = {"$regex": re.escape(search), "$options": "i"}
        query["$or"] = [{"title": pattern}, {"company": pattern}]

    return query


def sort_order(sort: str) -> list:
    if sort in SORT_FIELDS:
        return [(sort, 1)]

    return [("collected_at", -1)]


def count_by(jobs: list, field: str) -> list:
    tally = Counter(job[field] for job in jobs if job.get(field))

    return [
        {"label": label, "count": count}
        for label, count in tally.most_common()
    ]


def salary_order(row: dict) -> int:
    match = re.search(r"\$([\d,]+)", row["label"])

    return int(match.group(1).replace(",", "")) if match else 0


def count_ages(jobs: list) -> list:
    ages = [
        job["posted_age_days"]
        for job in jobs
        if job["posted_age_days"] is not None
    ]

    buckets = []

    for label, minimum, maximum in AGE_BUCKETS:
        count = sum(
            1 for age in ages
            if age >= minimum and (maximum is None or age <= maximum)
        )

        if count:
            buckets.append({"label": label, "count": count})

    return buckets


def last_collected_at():
    job = jobs_collection.find_one(sort=[("collected_at", -1)])

    return job["collected_at"] if job else None


def distinct_values(field: str) -> list:
    values = jobs_collection.distinct(field)

    return sorted(value for value in values if value)


@jobs_router.get("/") #retorna as vagas em si
def get_jobs(
    query: dict = Depends(job_filters),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    total = jobs_collection.count_documents(query)

    jobs = (
        jobs_collection.find(query)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )

    return {
        "items": [serialize_job(job) for job in jobs],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, math.ceil(total / page_size))
    }


@jobs_router.get("/{job_id}") #retorna dados de uma vaga de acordo com o id
def get_job_by_id(job_id: str):
    try:
        object_id = ObjectId(job_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="ID de vaga inválido")

    job = jobs_collection.find_one({"_id": object_id})

    if job is None:
        raise HTTPException(status_code=404, detail="Vaga não encontrada")

    return serialize_job(job)


@stats_router.get("/") #retorna estatísticas das vagas, de acordo com os filtros do usuário
def get_stats(query: dict = Depends(job_filters)):
    #array com vagas de acordo com o filtro passado
    jobs = [serialize_job(job) for job in jobs_collection.find(query)]

    #retorno de estatísticas sobre esse array
    return {
        "total": len(jobs), #número de vagas
        "companies": len({job["company"] for job in jobs if job.get("company")}),#número de empresas
        "anywhere_count": sum(1 for job in jobs if job.get("region") == ANYWHERE), #vagas de qualquer lugar no mundo
        "new_count": sum(
            1 for job in jobs
            if job["posted_age_days"] is not None
            and job["posted_age_days"] <= NEW_LIMIT_DAYS
        ),#número de vagas recém adicionadas
        "with_salary_count": sum(1 for job in jobs if job.get("salary_range")),#vagas que tenham informações sobre faixa salarial
        "last_collected_at": last_collected_at(), #data que foi buscado pelo web crawler
        "by_category": count_by(jobs, "category"),
        "by_job_type": count_by(jobs, "job_type"),
        "by_salary_range": sorted(count_by(jobs, "salary_range"), key=salary_order),
        "by_age_bucket": count_ages(jobs),
        "top_companies": count_by(jobs, "company")[:10]
    }


@filters_router.get("/")
def get_filter_options():
    return {
        "categories": distinct_values("category"), #retorna todas as categorias existentes das vagas
        "job_types": distinct_values("job_type"), #retorna os tipos de contrato das vagas
        "regions": distinct_values("region") #retorna as regiões das vagas
    }
