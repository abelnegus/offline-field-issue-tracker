from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.reports import router as reports_router
from app.database import Base, engine
from app.models.history import ReportHistory
from app.models.report import Report

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Offline Field Issue Tracker API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reports_router)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}