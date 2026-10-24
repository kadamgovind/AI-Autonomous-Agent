from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import models  # noqa: F401
from ai_service import understand_request
from database import Base, engine, get_db
from models import Task
from scheduler import create_plan
from schemas import PlanRequest, PlanResponse, TaskCreate, TaskResponse, TaskUpdate


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Kryom Agent API",
    description="Task management API for the autonomous planning agent.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.get("/")
def root():
    return {
        "name": "Kryom Agent API",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/api/tasks", response_model=TaskResponse, status_code=201)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)):
    task = Task(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.get("/api/tasks", response_model=list[TaskResponse])
def list_tasks(db: Session = Depends(get_db)):
    return (
        db.query(Task)
        .order_by(Task.created_at.desc(), Task.id.desc())
        .all()
    )


@app.get("/api/tasks/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)

    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    return task


@app.patch("/api/tasks/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
):
    task = db.get(Task, task_id)

    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task


@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)

    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    db.delete(task)
    db.commit()
    return Response(status_code=204)

@app.post("/api/plan", response_model=PlanResponse)
def generate_plan(
    payload: PlanRequest,
    db: Session = Depends(get_db),
):
    tasks = db.query(Task).all()

    return create_plan(
        tasks=tasks,
        available_hours=payload.available_hours,
    )

@app.post("/api/agent/understand")
def understand_user_request(payload: dict):
    message = payload.get("message")

    if not isinstance(message, str) or not message.strip():
        raise HTTPException(
            status_code=422,
            detail="Please provide a non-empty message.",
        )

    if len(message) > 4000:
        raise HTTPException(
            status_code=422,
            detail="Message must be 4000 characters or fewer.",
        )

    try:
        return understand_request(message.strip())
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc

@app.post("/api/agent/execute")
def execute_agent_request(
    payload: dict,
    db: Session = Depends(get_db),
):
    message = payload.get("message")

    if not isinstance(message, str) or not message.strip():
        raise HTTPException(
            status_code=422,
            detail="Please provide a non-empty message.",
        )

    if len(message) > 4000:
        raise HTTPException(
            status_code=422,
            detail="Message must be 4000 characters or fewer.",
        )

    try:
        result = understand_request(message.strip())
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc

    saved_tasks = []
    skipped_tasks = []
    existing_titles = {
        task.title.strip().casefold()
        for task in db.query(Task).all()
    }

    for item in result["tasks"]:
        title = item["title"].strip()
        duration = item.get("duration")

        if duration is None:
            skipped_tasks.append({
                "title": title,
                "reason": "Duration is unknown. Please specify the duration.",
            })
            continue

        if title.casefold() in existing_titles:
            skipped_tasks.append({
                "title": title,
                "reason": "A task with this title already exists.",
            })
            continue

        task = Task(
            title=title,
            deadline=item.get("deadline"),
            duration=duration,
            priority=item.get("priority", "Medium"),
            completed=False,
        )

        db.add(task)
        existing_titles.add(title.casefold())
        saved_tasks.append(task)

    try:
        db.commit()

        for task in saved_tasks:
            db.refresh(task)

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to save tasks to the database.",
        ) from exc

    return {
        "understood_goal": result["understood_goal"],
        "available_hours": result.get("available_hours"),
        "saved_tasks": [
            {
                "id": task.id,
                "title": task.title,
                "deadline": task.deadline,
                "duration": task.duration,
                "priority": task.priority,
                "completed": task.completed,
            }
            for task in saved_tasks
        ],
        "skipped_tasks": skipped_tasks,
        "recommendation": result.get("recommendation", ""),
        "clarification_needed": result.get("clarification_needed"),
    }