from fastapi import FastAPI
from api.routes import router

app = FastAPI(
    title="Job Crawler API",
    description="API para consulta das vagas coletadas pelo crawler",
    version="1.0.0"
)

app.include_router(router)


@app.get("/")
def root():
    return {
        "message": "Job Crawler API funcionando"
    }