from datetime import date
from typing import Any

PRIORITY_SCORE = {
    "High": 3,
    "Medium": 2,
    "Low": 1,
}


def deadline_days(deadline: str | None) -> int:
    """Return days until deadline. Unknown deadlines rank last."""

    if not deadline:
        return 36500

    value = deadline.strip().lower()
    today = date.today()

    if value == "today":
        return 0

    if value == "tomorrow":
        return 1

    if value.startswith("in ") and value.endswith(" days"):
        try:
            return max(0, int(value[3:-5]))
        except ValueError:
            pass

    try:
        due_date = date.fromisoformat(value)
        return (due_date - today).days
    except ValueError:
        return 36500


def prioritize(task: Any) -> tuple:
    days_left = deadline_days(task.deadline)

    # Overdue and nearest deadlines rank ahead.
    urgency = (
        4 if days_left < 0
        else 3 if days_left <= 1
        else 2 if days_left <= 3
        else 1 if days_left <= 7
        else 0
    )

    priority = PRIORITY_SCORE.get(task.priority, 1)

    return (
        -urgency,
        -priority,
        days_left,
        task.duration,
        task.id,
    )


def create_plan(tasks: list[Any], available_hours: float) -> dict:
    if available_hours < 0:
        raise ValueError("Available hours cannot be negative.")

    pending = [task for task in tasks if not task.completed]
    ordered = sorted(pending, key=prioritize)

    remaining = float(available_hours)
    scheduled = []
    deferred = []

    for task in ordered:
        days_left = deadline_days(task.deadline)

        if days_left < 0:
            reason = "Deadline has passed; review this task immediately."
        elif days_left <= 1:
            reason = "Urgent deadline and task priority."
        elif task.priority == "High":
            reason = "High priority task."
        elif days_left <= 3:
            reason = "Deadline is approaching."
        else:
            reason = "Scheduled according to priority and available time."

        item = {
            "task_id": task.id,
            "title": task.title,
            "priority": task.priority,
            "deadline": task.deadline,
            "duration": task.duration,
            "allocated_hours": 0.0,
            "status": "deferred",
            "reason": reason,
        }

        # Keep tasks whole rather than allocating unusable partial hours.
        if task.duration <= remaining:
            item["allocated_hours"] = task.duration
            item["status"] = "scheduled"
            remaining = round(remaining - task.duration, 2)
            scheduled.append(item)
        else:
            item["reason"] += (
                " Insufficient remaining time for the full task."
            )
            deferred.append(item)

    return {
        "available_hours": available_hours,
        "allocated_hours": round(available_hours - remaining, 2),
        "remaining_hours": round(remaining, 2),
        "scheduled": scheduled,
        "deferred": deferred,
        "explanation": (
            "Pending tasks were ranked by deadline urgency, priority, "
            "estimated duration and task ID. Completed tasks were excluded. "
            "Tasks are scheduled only when their full estimated duration fits."
        ),
    }