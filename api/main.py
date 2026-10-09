from fastapi import FastAPI

from api.routes import filters_router, jobs_router, stats_router

app = FastAPI(
    title="Job Crawler API",
    description="API para consulta das vagas coletadas pelo crawler",
    version="1.0.0"
)

app.include_router(jobs_router)
app.include_router(stats_router)
app.include_router(filters_router)