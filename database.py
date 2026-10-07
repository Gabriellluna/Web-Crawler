from pymongo import MongoClient
from datetime import datetime, timezone

MONGO_URI = "mongodb://localhost:27017"
DATABASE_NAME = "job_crawler"
COLLECTION_NAME = "jobs"

client = MongoClient(MONGO_URI)

db = client[DATABASE_NAME]
jobs_collection = db[COLLECTION_NAME]


def save_jobs(jobs):
    if not jobs:
        return 0

    inserted = 0

    for job in jobs:
        job["collected_at"] = datetime.now(timezone.utc)
        job["source_url"] = "https://weworkremotely.com/remote-jobs"

        result = jobs_collection.update_one(
            {"url": job["url"]},
            {"$set": job},
            upsert=True
        )

        if result.upserted_id:
            inserted += 1

    return inserted