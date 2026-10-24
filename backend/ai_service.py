import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
OLLAMA_MODEL = "llama3.2:3b"


SYSTEM_PROMPT = """
You are Kryom Agent, a student task-planning assistant.

Extract tasks and constraints from the user's message.
Never invent deadlines, task durations, or available hours.
If a value is unknown, use null and ask for clarification.
Only use High, Medium, or Low for priority.
Do not claim that tasks have been saved.

Return only valid JSON with these fields:
{
  "understood_goal": "string",
  "available_hours": null,
  "tasks": [
    {
      "title": "string",
      "deadline": null,
      "duration": 2,
      "priority": "High"
    }
  ],
  "clarification_needed": null,
  "recommendation": "string"
}

Use a number or null for available_hours.
Use a string or null for deadline.
Use a positive number for duration, or null if unknown.
If no tasks are mentioned, return an empty tasks array.
"""


def understand_request(message: str) -> dict:
    payload = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "format": "json",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": message},
        ],
        "options": {"temperature": 0},
    }

    request = Request(
        OLLAMA_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlopen(request, timeout=180) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise RuntimeError(
            f"Ollama returned HTTP {exc.code}. Check that the model is installed."
        ) from exc
    except URLError as exc:
        raise RuntimeError(
            "Cannot connect to Ollama. Make sure Ollama is running."
        ) from exc
    except TimeoutError as exc:
        raise RuntimeError(
            "Ollama took too long to respond. Try again."
        ) from exc

    try:
        data = json.loads(result["message"]["content"])

        if not isinstance(data.get("understood_goal"), str):
            raise ValueError("Invalid understood_goal")

        if not isinstance(data.get("tasks"), list):
            raise ValueError("Invalid tasks")

        hours = data.get("available_hours")
        if hours is not None and (
            isinstance(hours, bool)
            or not isinstance(hours, (int, float))
            or not 0 <= hours <= 24
        ):
            raise ValueError("Invalid available_hours")

        for task in data["tasks"]:
            if not isinstance(task, dict):
                raise ValueError("Invalid task")

            if not isinstance(task.get("title"), str) or not task["title"].strip():
                raise ValueError("Invalid task title")

            duration = task.get("duration")
            if duration is not None and (
                isinstance(duration, bool)
                or not isinstance(duration, (int, float))
                or not 0 < duration <= 24
            ):
                raise ValueError("Invalid task duration")

            if task.get("priority") not in ("High", "Medium", "Low"):
                task["priority"] = "Medium"

            deadline = task.get("deadline")
            if deadline is not None and not isinstance(deadline, str):
                task["deadline"] = None

        data.setdefault("clarification_needed", None)
        data.setdefault("recommendation", "")
        return data

    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise RuntimeError(
            "The local AI returned an invalid response. Please try again."
        ) from exc