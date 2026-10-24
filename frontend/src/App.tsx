import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BrainCircuit,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  LayoutDashboard,
  ListTodo,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
  Zap,
} from "lucide-react";

import {
  taskApi,
  type Task,
  type AgentExecuteResponse,
} from "./api";

import "./App.css";

function App() {
  // -------------------- TASK STATE --------------------

  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState("");
  const [hours, setHours] = useState(5);

  // -------------------- GENERAL UI STATE --------------------

  const [approved, setApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [message, setMessage] = useState(
    "Connect to your task database to begin planning."
  );

  // -------------------- LOCAL AI AGENT STATE --------------------

  const [agentInput, setAgentInput] = useState("");
  const [agentBusy, setAgentBusy] = useState(false);

  const [agentResult, setAgentResult] =
    useState<AgentExecuteResponse | null>(null);

  const actionsBusy = busy || agentBusy;

  // -------------------- LOAD TASKS --------------------

  useEffect(() => {
    let active = true;

    async function loadTasks() {
      try {
        const data = await taskApi.list();

        if (active) {
          setTasks(data);
          setMessage("Tasks loaded from your database.");
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load tasks."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadTasks();

    return () => {
      active = false;
    };
  }, []);

  // -------------------- DASHBOARD STATISTICS --------------------

  const completedCount = tasks.filter(
    (task) => task.completed
  ).length;

  const pendingCount = tasks.length - completedCount;

  // -------------------- SCHEDULING ENGINE --------------------
  // This scheduler allocates available hours by priority.
  // It is separate from the Ollama AI agent.

  const schedule = useMemo(() => {
    let remaining = hours;

    const priority: Record<Task["priority"], number> = {
      High: 3,
      Medium: 2,
      Low: 1,
    };

    const pendingTasks = tasks
      .filter((task) => !task.completed)
      .sort((a, b) => {
        const priorityDifference =
          priority[b.priority] - priority[a.priority];

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        // When priorities match, prefer tasks with deadlines.
        if (a.deadline && b.deadline) {
          return a.deadline.localeCompare(b.deadline);
        }

        if (a.deadline) return -1;
        if (b.deadline) return 1;

        return a.id - b.id;
      });

    return pendingTasks.map((task) => {
      const allocated = Math.min(
        task.duration,
        Math.max(0, remaining)
      );

      remaining = Math.max(0, remaining - allocated);

      return {
        ...task,
        allocated,
        deferred: allocated < task.duration,
      };
    });
  }, [tasks, hours]);

  const plannedHours = Number(
    schedule
      .reduce((total, task) => total + task.allocated, 0)
      .toFixed(2)
  );

  const unscheduledHours = Number(
    schedule
      .reduce(
        (total, task) =>
          total + Math.max(0, task.duration - task.allocated),
        0
      )
      .toFixed(2)
  );

  // -------------------- ADD TASK --------------------

  async function addTask() {
    const title = newTask.trim();

    if (!title || actionsBusy) return;

    setBusy(true);
    setError("");

    try {
      const task = await taskApi.create({
        title,
        deadline: null,
        duration: 1,
        priority: "Medium",
      });

      setTasks((current) => [task, ...current]);
      setNewTask("");
      setApproved(false);
      setAgentResult(null);

      setMessage(
        `Task "${task.title}" saved to the database.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not create task."
      );
    } finally {
      setBusy(false);
    }
  }

  // -------------------- COMPLETE / UNCOMPLETE TASK --------------------

  async function toggleTask(task: Task) {
    if (actionsBusy) return;

    setBusy(true);
    setError("");

    try {
      const updated = await taskApi.update(task.id, {
        completed: !task.completed,
      });

      setTasks((current) =>
        current.map((item) =>
          item.id === updated.id ? updated : item
        )
      );

      setApproved(false);
      setAgentResult(null);

      setMessage(
        updated.completed
          ? `"${updated.title}" marked complete and saved.`
          : `"${updated.title}" marked incomplete and saved.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update task."
      );
    } finally {
      setBusy(false);
    }
  }

  // -------------------- DELETE TASK --------------------

  async function deleteTask(id: number) {
    if (actionsBusy) return;

    setBusy(true);
    setError("");

    try {
      await taskApi.delete(id);

      setTasks((current) =>
        current.filter((task) => task.id !== id)
      );

      setApproved(false);
      setAgentResult(null);
      setMessage("Task deleted from the database.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not delete task."
      );
    } finally {
      setBusy(false);
    }
  }

  // -------------------- RUN LOCAL AI AGENT --------------------

  async function sendToAgent() {
    const prompt = agentInput.trim();

    if (!prompt || actionsBusy || loading) return;

    setAgentBusy(true);
    setError("");
    setApproved(false);
    setAgentResult(null);

    setMessage(
      "Kryom AI is analyzing your instruction using the local model..."
    );

    try {
      // Send the instruction to the FastAPI backend.
      // The backend calls Ollama and saves generated tasks.
      const result = await taskApi.executeAgent(prompt);

      // Fetch the latest database state after execution.
      const latestTasks = await taskApi.list();

      setTasks(latestTasks);
      setAgentResult(result);
      setAgentInput("");

      // Apply AI-proposed availability when it is a valid number.
      if (
        typeof result.available_hours === "number" &&
        Number.isFinite(result.available_hours)
      ) {
        const suggestedHours = Math.max(
          0,
          Math.min(12, result.available_hours)
        );

        setHours(suggestedHours);
      }

      const savedCount = result.saved_tasks.length;
      const skippedCount = result.skipped_tasks.length;

      setMessage(
        `AI understood: ${result.understood_goal} ` +
          `Saved ${savedCount} task(s).` +
          (skippedCount > 0
            ? ` ${skippedCount} task(s) were skipped or need attention.`
            : "")
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Kryom AI request failed."
      );

      setMessage(
        "The AI request could not be completed. Check the backend and Ollama."
      );
    } finally {
      setAgentBusy(false);
    }
  }

  // -------------------- RECALCULATE PLAN --------------------

  function generatePlan() {
    if (actionsBusy || loading) return;

    setApproved(false);

    setMessage(
      "Plan recalculated by task priority, deadlines, and available hours. The scheduling algorithm is rule-based; AI-generated instructions are handled separately."
    );
  }

  // -------------------- SIMULATE TIME CHANGE --------------------

  function loseTwoHours() {
    if (actionsBusy) return;

    setHours((current) => Math.max(0, current - 2));
    setApproved(false);

    setMessage(
      "Two hours removed from today's availability. Review the revised allocations."
    );
  }

  // -------------------- REFRESH TASKS --------------------

  async function refreshTasks() {
    if (actionsBusy) return;

    setLoading(true);
    setError("");

    try {
      const data = await taskApi.list();

      setTasks(data);
      setAgentResult(null);
      setMessage("Task list refreshed from the database.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not refresh tasks."
      );
    } finally {
      setLoading(false);
    }
  }

  // -------------------- DASHBOARD UI --------------------

  return (
    <div className="app-shell">
      {/* SIDEBAR */}

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <BrainCircuit size={25} />
          </div>

          <div>
            <h2>Kryom Agent</h2>
            <span>Intelligent planning</span>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>

        <nav className="navigation">
          <a className="nav-item active" href="#dashboard">
            <LayoutDashboard size={18} />
            Dashboard
          </a>

          <a className="nav-item" href="#tasks">
            <ListTodo size={18} />
            My Tasks
          </a>

          <a className="nav-item" href="#schedule">
            <CalendarDays size={18} />
            Schedule
          </a>

          <a className="nav-item" href="#agent">
            <BrainCircuit size={18} />
            Agent Decisions
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="agent-status">
            <span className="status-dot" />

            <div>
              <strong>Backend connected</strong>
              <span>FastAPI + SQLite</span>
            </div>
          </div>

          <p>AI Autonomous Decision-Making Agent</p>
        </div>
      </aside>

      {/* MAIN DASHBOARD */}

      <main className="main-content" id="dashboard">
        <header className="topbar">
          <div>
            <div className="eyebrow">
              YOUR PERSONAL AI AGENT
            </div>
            <h1>Dashboard</h1>
          </div>

          <button
            className="button secondary"
            onClick={() => void refreshTasks()}
            disabled={loading || actionsBusy}
          >
            <RefreshCw size={16} />
            Refresh tasks
          </button>
        </header>

        {/* WELCOME PANEL */}

        <section className="welcome-panel">
          <div>
            <div className="welcome-tag">
              <Sparkles size={15} />
              YOUR DAY, OPTIMIZED
            </div>

            <h2>Turn your goals into action.</h2>

            <p>
              Plan your work, prioritize deadlines, and adapt
              when plans change.
            </p>
          </div>

          <div className="welcome-art">
            <BrainCircuit size={76} strokeWidth={1.3} />
          </div>
        </section>

        {/* ERROR DISPLAY */}

        {error && (
          <div
            className="reasoning-box"
            role="alert"
            style={{ marginTop: 16 }}
          >
            <Activity size={19} />

            <div>
              <strong>Request failed</strong>
              <p>{error}</p>
              <p>
                Check that FastAPI is running at
                {" "}127.0.0.1:8000 and that Ollama is running
                for AI requests.
              </p>
            </div>
          </div>
        )}

        {/* STATISTICS */}

        <section className="stats-grid">
          <article className="stat-card">
            <div className="stat-top">
              <span>Total tasks</span>
              <ListTodo size={19} />
            </div>

            <strong>{tasks.length}</strong>
            <small>Tasks saved in the database</small>
          </article>

          <article className="stat-card">
            <div className="stat-top">
              <span>Completed</span>
              <CheckCircle2 size={19} />
            </div>

            <strong>{completedCount}</strong>

            <small>
              {tasks.length
                ? Math.round(
                    (completedCount / tasks.length) * 100
                  )
                : 0}
              % of all tasks
            </small>
          </article>

          <article className="stat-card">
            <div className="stat-top">
              <span>Available today</span>
              <Clock3 size={19} />
            </div>

            <strong>{hours}h</strong>
            <small>Hours available for planning</small>
          </article>

          <article className="stat-card">
            <div className="stat-top">
              <span>Unscheduled</span>
              <Activity size={19} />
            </div>

            <strong>{unscheduledHours}h</strong>
            <small>
              Pending work beyond allocated time
            </small>
          </article>
        </section>

        {/* TASKS AND SCHEDULE */}

        <div className="content-grid">
          {/* TASK MANAGEMENT */}

          <section className="panel" id="tasks">
            <div className="panel-heading">
              <div>
                <h3>My tasks</h3>
                <p>Changes are saved to the backend.</p>
              </div>

              <span className="count-pill">
                {tasks.length} tasks
              </span>
            </div>

            <form
              className="task-form"
              onSubmit={(event) => {
                event.preventDefault();
                void addTask();
              }}
            >
              <input
                value={newTask}
                onChange={(event) =>
                  setNewTask(event.target.value)
                }
                placeholder="What do you need to accomplish?"
                aria-label="New task name"
                maxLength={250}
                disabled={actionsBusy}
              />

              <button
                className="button primary"
                type="submit"
                disabled={actionsBusy || !newTask.trim()}
              >
                <Plus size={17} />
                Add
              </button>
            </form>

            <div className="task-list">
              {loading ? (
                <div className="empty-state">
                  Loading tasks...
                </div>
              ) : tasks.length === 0 ? (
                <div className="empty-state">
                  No saved tasks yet. Add your first task above
                  or ask Kryom AI to create one.
                </div>
              ) : (
                tasks.map((task) => (
                  <article
                    className="task-row"
                    key={task.id}
                  >
                    <button
                      className="complete-button"
                      onClick={() => void toggleTask(task)}
                      disabled={actionsBusy}
                      aria-label={
                        task.completed
                          ? "Mark incomplete"
                          : "Mark complete"
                      }
                    >
                      {task.completed ? (
                        <CheckCircle2 size={21} />
                      ) : (
                        <Circle size={21} />
                      )}
                    </button>

                    <div className="task-details">
                      <strong
                        className={
                          task.completed ? "done" : ""
                        }
                      >
                        {task.title}
                      </strong>

                      <span>
                        <Clock3 size={13} />
                        {task.duration}h ·{" "}
                        {task.deadline || "No deadline"}
                      </span>
                    </div>

                    <span
                      className={`priority priority-${task.priority.toLowerCase()}`}
                    >
                      {task.priority}
                    </span>

                    <button
                      className="icon-button delete-button"
                      onClick={() =>
                        void deleteTask(task.id)
                      }
                      disabled={actionsBusy}
                      aria-label={`Delete ${task.title}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>

          {/* SCHEDULING PANEL */}

          <section className="panel" id="schedule">
            <div className="panel-heading">
              <div>
                <h3>Today's schedule</h3>
                <p>Priority-based time allocation</p>
              </div>

              <CalendarDays size={20} />
            </div>

            <div className="capacity-control">
              <label htmlFor="hours">
                Available hours: <strong>{hours}</strong>
              </label>

              <input
                id="hours"
                type="range"
                min="0"
                max="12"
                value={hours}
                disabled={actionsBusy}
                onChange={(event) => {
                  setHours(Number(event.target.value));
                  setApproved(false);
                  setMessage(
                    "Availability changed. Review your new plan."
                  );
                }}
              />

              <div className="capacity-labels">
                <span>0 hours</span>
                <span>12 hours</span>
              </div>
            </div>

            <div className="schedule-list">
              {schedule.map((task, index) => (
                <div
                  className="schedule-row"
                  key={task.id}
                >
                  <div className="timeline-marker">
                    <span
                      className={
                        index === 0 ? "marker-current" : ""
                      }
                    />
                  </div>

                  <div className="schedule-details">
                    <strong>{task.title}</strong>

                    <span>
                      {task.allocated}h allocated of{" "}
                      {task.duration}h
                    </span>

                    {task.deferred && (
                      <span className="deferred-note">
                        {Number(
                          (task.duration - task.allocated).toFixed(2)
                        )}
                        h still unallocated
                      </span>
                    )}
                  </div>

                  <span className="schedule-duration">
                    {task.allocated}h
                  </span>
                </div>
              ))}

              {schedule.length === 0 && (
                <div className="empty-state">
                  Nothing pending to schedule.
                </div>
              )}
            </div>

            <div className="schedule-summary">
              <span>Allocated time</span>

              <strong>
                {plannedHours} / {hours} hours
              </strong>
            </div>
          </section>
        </div>

        {/* AI AGENT DECISION CENTER */}

        <section className="panel agent-panel" id="agent">
          <div className="agent-heading">
            <div className="agent-icon">
              <BrainCircuit size={24} />
            </div>

            <div>
              <h3>Agent decision center</h3>
              <p>
                Give instructions to your local AI agent.
              </p>
            </div>

            <span className="demo-badge">
              LOCAL AI + RULE-BASED SCHEDULER
            </span>
          </div>

          {/* NATURAL LANGUAGE INPUT */}

          <form
            className="task-form"
            onSubmit={(event) => {
              event.preventDefault();
              void sendToAgent();
            }}
          >
            <input
              value={agentInput}
              onChange={(event) =>
                setAgentInput(event.target.value)
              }
              placeholder="Ask Kryom AI: Create a high-priority AI assignment due tomorrow, 2 hours..."
              aria-label="Instruction for Kryom AI"
              maxLength={4000}
              disabled={agentBusy || busy || loading}
            />

            <button
              className="button primary"
              type="submit"
              disabled={
                agentBusy ||
                busy ||
                loading ||
                !agentInput.trim()
              }
            >
              <Sparkles size={17} />
              {agentBusy ? "Thinking..." : "Ask AI"}
            </button>
          </form>

          {agentBusy && (
            <p role="status" aria-live="polite">
              Kryom AI is processing your instruction. Please
              wait...
            </p>
          )}

          {/* LATEST DECISION */}

          <div className="reasoning-box">
            <Zap size={19} />

            <div>
              <strong>Latest decision</strong>
              <p>{message}</p>
            </div>
          </div>

          {/* AI RESPONSE DETAILS */}

          {agentResult && (
            <div className="agent-result">
              <div>
                <h4>AI understanding</h4>
                <p>{agentResult.understood_goal}</p>
              </div>

              {agentResult.recommendation && (
                <div>
                  <h4>AI recommendation</h4>
                  <p>{agentResult.recommendation}</p>
                </div>
              )}

              {agentResult.available_hours !== null && (
                <div>
                  <h4>Suggested available hours</h4>
                  <p>{agentResult.available_hours} hours</p>
                </div>
              )}

              {agentResult.saved_tasks.length > 0 && (
                <div>
                  <h4>
                    <CheckCircle2
                      size={16}
                      style={{
                        display: "inline",
                        verticalAlign: "middle",
                      }}
                    />{" "}
                    Tasks saved successfully
                  </h4>

                  <ul>
                    {agentResult.saved_tasks.map((task) => (
                      <li key={task.id}>
                        <strong>{task.title}</strong>
                        {" — "}
                        {task.priority} priority, {task.duration}h
                        {task.deadline
                          ? `, deadline: ${task.deadline}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {agentResult.skipped_tasks.length > 0 && (
                <div>
                  <h4>Tasks requiring attention</h4>

                  <ul>
                    {agentResult.skipped_tasks.map(
                      (task, index) => (
                        <li key={`${task.title}-${index}`}>
                          <strong>{task.title}</strong>
                          {" — "}
                          {task.reason}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              )}

              {agentResult.clarification_needed && (
                <div>
                  <h4>Clarification needed</h4>
                  <p>{agentResult.clarification_needed}</p>
                </div>
              )}
            </div>
          )}

          {/* SCHEDULING WARNING */}

          {unscheduledHours > 0 && (
            <p className="warning-text">
              Some work does not fit today's available time.
              Review the remaining work and deadlines.
            </p>
          )}

          {/* AGENT ACTIONS */}

          <div className="agent-actions">
            <button
              className="button secondary"
              onClick={generatePlan}
              disabled={loading || actionsBusy}
            >
              <RefreshCw size={16} />
              Recalculate plan
            </button>

            <button
              className="button secondary"
              onClick={loseTwoHours}
              disabled={hours === 0 || actionsBusy}
            >
              <Clock3 size={16} />
              Simulate losing 2 hours
            </button>

            <button
              className="button primary"
              onClick={() => {
                setApproved(true);
                setMessage(
                  "Plan approved locally. No external actions were executed."
                );
              }}
              disabled={approved || loading || actionsBusy}
            >
              <Check size={17} />
              {approved ? "Plan approved" : "Approve plan"}
            </button>
          </div>

          {/* PROJECT STATUS */}

          <div className="footer-note">
            <Target size={15} />

            <span>
              {pendingCount} pending task(s). Tasks persist in
              SQLite. AI instruction understanding and task
              creation use your local Ollama model through
              FastAPI. Scheduling remains a rule-based
              prototype, and plan approval is currently local.
            </span>
          </div>
        </section>

        {/* FOOTER */}

        <footer className="app-footer">
          <span>Kryom Agent</span>
          <span>Plan · Decide · Execute · Adapt</span>
        </footer>
      </main>
    </div>
  );
}

export default App;