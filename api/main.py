from fastapi import FastAPI
from api.routes import router
from crawler import run_crawler

app = FastAPI(
    title="Job Crawler API",
    description="API para consulta das vagas coletadas pelo crawler",
    version="1.0.0"
)

app.include_router(router)

@app.on_event("startup")
def startup():
    print("Iniciando crawler...")
    run_crawler()
    print("Crawler finalizado.")
    
@app.get("/")
def root():
    return {
        "message": "Job Crawler API funcionando"
    }