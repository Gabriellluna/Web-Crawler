from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, HTTPException

from database import jobs_collection

router = APIRouter(prefix="/jobs", tags=["Jobs"])


def serialize_job(job: dict) -> dict:
    job["_id"] = str(job["_id"])
    return job


@router.get("/")
def get_jobs():
    jobs = jobs_collection.find().sort("collected_at", -1)
    return [serialize_job(job) for job in jobs]


@router.get("/{job_id}")
def get_job_by_id(job_id: str):
    try:
        object_id = ObjectId(job_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="ID de vaga inválido")

    job = jobs_collection.find_one({"_id": object_id})

    if job is None:
        raise HTTPException(status_code=404, detail="Vaga não encontrada")

    return serialize_job(job)
