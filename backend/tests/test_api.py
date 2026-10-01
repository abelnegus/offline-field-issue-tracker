import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(
        bind=engine, autocommit=False, autoflush=False
    )
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_and_get_report_api(client):
    report_id = str(uuid.uuid4())
    payload = {
        "id": report_id,
        "category": "water_point",
        "description": "Main pump failure",
        "location": "North Station",
        "priority": "high",
        "status": "draft",
        "reported_at": datetime.now(timezone.utc).isoformat(),
    }

    # Create Report
    res = client.post("/api/reports", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["id"] == report_id
    assert data["category"] == "water_point"

    # Get Single Report
    res_get = client.get(f"/api/reports/{report_id}")
    assert res_get.status_code == 200
    assert res_get.json()["id"] == report_id

    # List Reports
    res_list = client.get("/api/reports")
    assert res_list.status_code == 200
    assert len(res_list.json()) == 1


def test_get_report_not_found(client):
    non_existent_id = str(uuid.uuid4())
    res = client.get(f"/api/reports/{non_existent_id}")
    assert res.status_code == 404


def test_idempotent_duplicate_post_api(client):
    report_id = str(uuid.uuid4())
    payload = {
        "id": report_id,
        "category": "equipment",
        "description": "Transformer spark",
        "location": "Substation 3",
        "priority": "critical",
        "status": "submitted",
        "reported_at": datetime.now(timezone.utc).isoformat(),
    }

    res1 = client.post("/api/reports", json=payload)
    assert res1.status_code == 201

    # Retry same POST payload
    res2 = client.post("/api/reports", json=payload)
    assert res2.status_code == 201
    assert res2.json()["id"] == report_id

    res_list = client.get("/api/reports")
    assert len(res_list.json()) == 1


def test_conflicting_duplicate_post_api(client):
    report_id = str(uuid.uuid4())
    payload1 = {
        "id": report_id,
        "category": "equipment",
        "description": "Original description",
        "location": "Substation 3",
        "priority": "medium",
        "status": "draft",
        "reported_at": datetime.now(timezone.utc).isoformat(),
    }
    client.post("/api/reports", json=payload1)

    payload2 = {
        "id": report_id,
        "category": "safety",
        "description": "Conflicting description",
        "location": "Substation 3",
        "priority": "high",
        "status": "draft",
        "reported_at": datetime.now(timezone.utc).isoformat(),
    }
    res_conflict = client.post("/api/reports", json=payload2)
    assert res_conflict.status_code == 409


def test_status_update_and_history_api(client):
    report_id = str(uuid.uuid4())
    payload = {
        "id": report_id,
        "category": "maintenance",
        "description": "Road pothole near gate",
        "location": "Gate 1",
        "priority": "low",
        "status": "draft",
        "reported_at": datetime.now(timezone.utc).isoformat(),
    }
    client.post("/api/reports", json=payload)

    # Valid status transition: draft -> submitted
    res_patch = client.patch(
        f"/api/reports/{report_id}/status",
        json={"status": "submitted"},
    )
    assert res_patch.status_code == 200
    assert res_patch.json()["status"] == "submitted"

    # Invalid status transition: submitted -> in_progress (Must go to assigned first)
    res_invalid = client.patch(
        f"/api/reports/{report_id}/status",
        json={"status": "in_progress"},
    )
    assert res_invalid.status_code == 409

    # Check History
    res_hist = client.get(f"/api/reports/{report_id}/history")
    assert res_hist.status_code == 200
    history = res_hist.json()
    assert len(history) == 2
    assert history[0]["event_type"] == "report_created"
    assert history[1]["event_type"] == "status_changed"
