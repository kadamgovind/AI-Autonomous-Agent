# Kryom Agent — AI Autonomous Decision-Making Agent

Kryom Agent is a personal AI-powered task planning project designed to help users organize tasks, prioritize work, and manage available time. It combines a React dashboard, a FastAPI backend, SQLite persistence, and a locally running Ollama language model.

## Project Goals

- Convert natural-language instructions into structured tasks.
- Create and manage tasks through a dashboard.
- Prioritize pending tasks by priority and deadlines.
- Allocate available hours using a rule-based scheduling algorithm.
- Run language-model inference locally without requiring a paid OpenAI API.
- Build a foundation for more advanced autonomous planning and decision-making.

## Current Features

- Task management: Create, complete, update, delete, and refresh tasks.
- Dashboard: View task counts, completion statistics, and available hours.
- Scheduling: Allocate available time according to task priority.
- Local AI integration: Use Ollama with the "llama3.2:3b" model to interpret user instructions.
- AI task execution: Submit instructions to the backend and save generated tasks to SQLite.
- REST API: Access task-management and AI-agent endpoints through FastAPI.
- Error handling: Display backend and AI request errors in the frontend.

## Technology Stack

Component| Technology
Frontend| React, TypeScript, Vite
UI icons| Lucide React
Backend| Python, FastAPI
Database| SQLite, SQLAlchemy
Local language model| Ollama, Llama 3.2 3B
API communication| HTTP, JSON

## Architecture

User
  |
  v
React + TypeScript Dashboard
  |
  v
FastAPI Backend
  |
  +---- Task Management API
  |
  +---- AI Agent Service
  |         |
  |         v
  |      Ollama
  |      llama3.2:3b
  |
  +---- SQLAlchemy
            |
            v
          SQLite

The AI service interprets instructions, while the scheduling algorithm independently allocates available time based on task priority and duration.

## Repository Structure

AI-Autonomous-Agent/
├── backend/
│   ├── ai_service.py
│   ├── database.py
│   ├── main.py
│   ├── models.py
│   ├── requirements.txt
│   ├── scheduler.py
│   └── schemas.py
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── App.css
│   │   ├── api.ts
│   │   └── index.css
│   ├── package.json
│   └── vite.config.ts
├── .gitignore
└── README.md

## Prerequisites

Install the following before running the project:

- Python 3.11 or another version supported by the backend dependencies.
- Node.js and npm.
- Git.
- Ollama.
- The "llama3.2:3b" model.

## Installation and Setup

1. Clone the repository

git clone https: //github.com/kadamgovind/AI-Autonomous-Agent.git
cd AI-Autonomous-Agent

2.Set up the backend

Open a terminal in the repository root:

cd backend
python -m venv .venv

Activate the virtual environment on Windows PowerShell:

.\.venv\Scripts\Activate.ps1

Install backend dependencies:

pip install -r requirements.txt

Start the API server:

uvicorn main:app --reload

The backend should be available at:

- API: http: //127.0.0.1:8000
- Interactive API documentation: http: //127.0.0.1:8000/docs

3.Set up Ollama

Install Ollama from https: //ollama.com/ if it is not already installed.

Download the model:

ollama pull llama3.2:3b

Verify the model:

ollama list

Ensure the Ollama service is running before testing AI features.

4.Set up the frontend

Open a second terminal from the repository root:

cd frontend
npm install
npm run dev

Open the local URL displayed by Vite, usually:

 http: //localhost:5173

## API Endpoints

Method| Endpoint| Purpose
GET| "/"| Backend root
GET| "/health"| Health check
GET| "/api/tasks"| List tasks
POST| "/api/tasks"| Create a task
GET| "/api/tasks/{task_id}"| Retrieve a task
PATCH| "/api/tasks/{task_id}"| Update a task
DELETE| "/api/tasks/{task_id}"| Delete a task
POST| "/api/plan"| Generate a rule-based plan
POST| "/api/agent/understand"| Interpret an AI instruction
POST| "/api/agent/execute"| Interpret an instruction and save generated tasks

For request and response schemas, open the interactive API documentation at "/docs" while the backend is running.

## Current Limitations

- Scheduling currently uses a rule-based algorithm rather than a trained planning model.
- Local AI output may require validation or clarification.
- The current project is a development prototype, not a production-ready autonomous system.
- Plan approval is currently a local UI action.
- Runtime behavior depends on the installed dependencies and the local Ollama service.

## Roadmap

- Improve deadline-aware scheduling and task dependency handling.
- Add automated backend and frontend tests.
- Improve AI response validation and error recovery.
- Add persistent planning history and decision explanations.
- Introduce safer execution workflows and configurable user approvals.
- Improve deployment, documentation, and observability.

## Contributing

1. Create a feature branch.
2. Make a focused change.
3. Run relevant checks.
4. Commit your changes with a descriptive message.
5. Push your branch and open a pull request.

## License

No license has been specified yet. Until a license is added, permission to reuse, modify, or redistribute this project should not be assumed.

---

Kryom Agent — Plan. Decide. Execute. Adapt.


