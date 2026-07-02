import fs from "fs";
import path from "path";

export enum TaskStatus {
  PENDING = "pending",
  SEARCHING = "searching",
  EXTRACTING = "extracting",
  AWAITING_APPROVAL = "awaiting_approval",
  SUMMARIZING = "summarizing",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export interface ResearchTask {
  id: number;
  user_email: string;
  topic: string;
  status: TaskStatus;
  current_step: string;
  search_results: string | null;
  extracted_data: string | null;
  final_summary: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
  sources?: string | null;
  phase_states?: string | null; // JSON mapping of index -> status ('not_started' | 'in_progress' | 'completed')
  study_notes?: string | null;   // JSON mapping of index -> string
  duration?: string | null;
  focus?: string | null;
  task_type?: "learning" | "article" | null;
  num_pages?: number | null;
}

const DB_PATH = path.join(process.cwd(), "tasks-db.json");

function readDB(): ResearchTask[] {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2), "utf8");
      return [];
    }
    const data = fs.readFileSync(DB_PATH, "utf8");
    const tasks: any[] = JSON.parse(data);
    
    // Migration: ensure every task has a user_email field
    let migrated = false;
    tasks.forEach((task) => {
      if (!task.user_email) {
        task.user_email = "guest@persistiq.io";
        migrated = true;
      }
    });

    if (migrated) {
      fs.writeFileSync(DB_PATH, JSON.stringify(tasks, null, 2), "utf8");
    }

    return tasks;
  } catch (err) {
    console.error("Error reading DB file:", err);
    return [];
  }
}

function writeDB(tasks: ResearchTask[]): void {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(tasks, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing DB file:", err);
  }
}

export const db = {
  getTasks(userEmail: string): ResearchTask[] {
    return readDB()
      .filter((t) => t.user_email === userEmail)
      .sort((a, b) => b.id - a.id);
  },

  getTask(id: number): ResearchTask | null {
    const tasks = readDB();
    return tasks.find((t) => t.id === id) || null;
  },

  createTask(
    topic: string,
    userEmail: string,
    duration?: string,
    focus?: string,
    task_type?: "learning" | "article",
    num_pages?: number
  ): ResearchTask {
    const tasks = readDB();
    const id = tasks.reduce((max, t) => (t.id > max ? t.id : max), 0) + 1;
    const newTask: ResearchTask = {
      id,
      user_email: userEmail,
      topic,
      status: TaskStatus.PENDING,
      current_step: "pending",
      search_results: null,
      extracted_data: null,
      final_summary: null,
      error_message: null,
      retry_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sources: null,
      phase_states: "{}",
      study_notes: "{}",
      duration: duration || null,
      focus: focus || null,
      task_type: task_type || "learning",
      num_pages: num_pages || null,
    };
    tasks.push(newTask);
    writeDB(tasks);
    return newTask;
  },

  updateTask(id: number, updates: Partial<ResearchTask>): ResearchTask | null {
    const tasks = readDB();
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) return null;

    const updatedTask = {
      ...tasks[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    tasks[index] = updatedTask;
    writeDB(tasks);
    return updatedTask;
  },

  deleteTask(id: number): boolean {
    const tasks = readDB();
    const filtered = tasks.filter((t) => t.id !== id);
    if (filtered.length === tasks.length) return false;
    writeDB(filtered);
    return true;
  },
};
