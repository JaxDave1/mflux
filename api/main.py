from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import config, gallery, jobs, models, secrets, system, uploads

app = FastAPI(title="MFLUX Neural Interface API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:4173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(system.router)
app.include_router(models.router)
app.include_router(config.router)
app.include_router(secrets.router)
app.include_router(gallery.router)
app.include_router(uploads.router)
app.include_router(jobs.router)


@app.on_event("startup")
def startup_cleanup_uploads() -> None:
    uploads.cleanup_old_uploads()
