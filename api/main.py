import threading
import time
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from api.routes import router
from crawler import run_crawler

INTERVALO_MINUTOS = 5

app = FastAPI(
    title="Job Crawler API",
    description="API para consulta das vagas coletadas pelo crawler",
    version="1.0.0"
)

app.include_router(router)


def crawler_loop():
    while True:
        agora = datetime.now().strftime("%H:%M:%S")
        print(f"[{agora}] Iniciando coleta...")

        try:
            run_crawler()
        except Exception as error:
            print("Erro na coleta:", error)

        print(f"[{agora}] Coleta finalizada. Próxima em {INTERVALO_MINUTOS} minutos.")
        time.sleep(INTERVALO_MINUTOS * 60)


@app.on_event("startup")
def startup():
    threading.Thread(target=crawler_loop, daemon=True).start()


FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")