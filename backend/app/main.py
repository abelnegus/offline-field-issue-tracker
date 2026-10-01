from fastapi import FastAPI

from app.api.reports import router as reports_router
from app.database import Base, engine
from app.models.history import ReportHistory
from app.models.report import Report

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Offline Field Issue Tracker API",
    version="0.1.0",
)

app.include_router(reports_router)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}