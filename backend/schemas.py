from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=250)
    deadline: str | None = Field(default=None, max_length=100)
    duration: float = Field(default=1.0, gt=0, le=24)
    priority: Literal["High", "Medium", "Low"] = "Medium"


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=250)
    deadline: str | None = Field(default=None, max_length=100)
    duration: float | None = Field(default=None, gt=0, le=24)
    priority: Literal["High", "Medium", "Low"] | None = None
    completed: bool | None = None


class TaskResponse(BaseModel):
    id: int
    title: str
    deadline: str | None
    duration: float
    priority: str
    completed: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class PlanRequest(BaseModel):
    available_hours: float = Field(ge=0, le=24)


class PlannedTask(BaseModel):
    task_id: int
    title: str
    priority: str
    deadline: str | None
    duration: float
    allocated_hours: float
    status: Literal["scheduled", "deferred"]
    reason: str


class PlanResponse(BaseModel):
    available_hours: float
    allocated_hours: float
    remaining_hours: float
    scheduled: list[PlannedTask]
    deferred: list[PlannedTask]
    explanation: str