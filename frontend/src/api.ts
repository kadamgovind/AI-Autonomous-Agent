const API_BASE_URL = "http://127.0.0.1:8000";

// -------------------- TASK TYPES --------------------

export type TaskPriority = "High" | "Medium" | "Low";

export type Task = {
  id: number;
  title: string;
  deadline: string | null;
  duration: number;
  priority: TaskPriority;
  completed: boolean;
  created_at: string;
};

export type CreateTask = {
  title: string;
  deadline?: string | null;
  duration?: number;
  priority?: TaskPriority;
};

export type UpdateTask = Partial<CreateTask> & {
  completed?: boolean;
};

// -------------------- AI AGENT TYPES --------------------

export type AgentSavedTask = {
  id: number;
  title: string;
  deadline: string | null;
  duration: number;
  priority: TaskPriority;
  completed: boolean;
};

export type AgentSkippedTask = {
  title: string;
  reason: string;
};

export type AgentExecuteResponse = {
  understood_goal: string;
  available_hours: number | null;
  saved_tasks: AgentSavedTask[];
  skipped_tasks: AgentSkippedTask[];
  recommendation: string;
  clarification_needed: string | null;
};

// -------------------- API ERROR --------------------

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

// -------------------- COMMON REQUEST FUNCTION --------------------

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      "Cannot connect to the Kryom backend. Make sure FastAPI is running at http://127.0.0.1:8000.",
    );
  }

  if (!response.ok) {
    let errorMessage = `API request failed with status ${response.status}.`;
    let detail: unknown;

    try {
      const errorData: unknown = await response.json();

      if (
        typeof errorData === "object" &&
        errorData !== null &&
        "detail" in errorData
      ) {
        detail = errorData.detail;

        if (typeof errorData.detail === "string") {
          errorMessage = errorData.detail;
        } else {
          errorMessage = JSON.stringify(errorData.detail);
        }
      } else {
        errorMessage = JSON.stringify(errorData);
      }
    } catch {
      const text = await response.text().catch(() => "");
      if (text) {
        errorMessage = text;
      }
    }

    throw new ApiError(response.status, errorMessage, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// -------------------- TASK API --------------------

export const taskApi = {
  // Get all tasks
  list: (): Promise<Task[]> => request<Task[]>("/api/tasks"),

  // Create a task
  create: (task: CreateTask): Promise<Task> =>
    request<Task>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(task),
    }),

  // Update a task
  update: (id: number, changes: UpdateTask): Promise<Task> =>
    request<Task>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    }),

  // Delete a task
  delete: (id: number): Promise<void> =>
    request<void>(`/api/tasks/${id}`, {
      method: "DELETE",
    }),

  // -------------------- KRYOM AI AGENT --------------------

  // Ask local Ollama AI to understand an instruction
  understandAgent: (
    message: string,
  ): Promise<{
    understood_goal: string;
    available_hours: number | null;
    tasks: Array<{
      title: string;
      deadline: string | null;
      duration: number | null;
      priority: TaskPriority;
    }>;
    clarification_needed: string | null;
    recommendation: string;
  }> =>
    request("/api/agent/understand", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  // Ask AI to understand an instruction and save the generated tasks
  executeAgent: (message: string): Promise<AgentExecuteResponse> =>
    request<AgentExecuteResponse>("/api/agent/execute", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};