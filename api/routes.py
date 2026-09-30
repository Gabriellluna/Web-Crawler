from fastapi import APIRouter, HTTPException, Query
from database import jobs_collection

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.get("/")
def get_jobs():
    jobs = list(jobs_collection.find())

    for job in jobs:
        job["_id"] = str(job["_id"])

    return jobs