import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { db } from "./src/server/db";
import { runPipeline, resumePipeline } from "./src/server/agent";
import { sendTaskEmail } from "./src/server/mailer";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser middleware
  app.use(express.json());

  // Log API requests for debugging
  app.use((req, res, next) => {
    if (req.path.startsWith("/tasks") || req.path === "/health") {
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });

  // ── Health Check ────────────────────────────────────────────────────────────
  app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "PersistIQ" });
  });

  // ── API Endpoints ───────────────────────────────────────────────────────────
  
  // Helper to extract clean user email from headers
  const getRequestUserEmail = (req: express.Request): string => {
    return String(req.headers["x-user-email"] || "guest@persistiq.io");
  };

  // POST /tasks - Create a new task and run pipeline in background
  app.post("/tasks", (req, res) => {
    const { topic, duration, focus, task_type, num_pages } = req.body;
    const userEmail = getRequestUserEmail(req);

    if (!topic || typeof topic !== "string" || topic.trim().length < 3) {
      return res.status(400).json({ detail: "Topic must be at least 3 characters." });
    }

    const task = db.createTask(
      topic.trim(),
      userEmail,
      typeof duration === "string" ? duration : undefined,
      typeof focus === "string" ? focus : undefined,
      typeof task_type === "string" ? (task_type as any) : undefined,
      typeof num_pages === "number" ? num_pages : undefined
    );

    // Trigger pipeline asynchronously in background without blocking response
    runPipeline(task.id).catch((err) => {
      console.error(`[Orchestrator] Error during pipeline run for task ${task.id}:`, err);
    });

    res.status(201).json(task);
  });

  // POST /tasks/:id/phases - Update phase checklist states
  app.post("/tasks/:id/phases", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const userEmail = getRequestUserEmail(req);

    if (isNaN(id)) {
      return res.status(400).json({ detail: "Invalid task ID format." });
    }

    const { phase_states } = req.body;
    if (typeof phase_states !== "string") {
      return res.status(400).json({ detail: "phase_states must be a JSON string." });
    }

    const task = db.getTask(id);
    if (!task) {
      return res.status(404).json({ detail: "Task not found." });
    }
    if (task.user_email !== userEmail) {
      return res.status(403).json({ detail: "Access denied to this task's syllabus." });
    }

    const updated = db.updateTask(id, { phase_states });
    res.json(updated);
  });

  // POST /tasks/:id/notes - Update study notes
  app.post("/tasks/:id/notes", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const userEmail = getRequestUserEmail(req);

    if (isNaN(id)) {
      return res.status(400).json({ detail: "Invalid task ID format." });
    }

    const { study_notes } = req.body;
    if (typeof study_notes !== "string") {
      return res.status(400).json({ detail: "study_notes must be a JSON string." });
    }

    const task = db.getTask(id);
    if (!task) {
      return res.status(404).json({ detail: "Task not found." });
    }
    if (task.user_email !== userEmail) {
      return res.status(403).json({ detail: "Access denied to this task's notes." });
    }

    const updated = db.updateTask(id, { study_notes });
    res.json(updated);
  });

  // GET /tasks - Return all tasks, newest first
  app.get("/tasks", (req, res) => {
    const userEmail = getRequestUserEmail(req);
    res.json(db.getTasks(userEmail));
  });

  // GET /tasks/:id - Return a single task by ID (Shared/Public access is permitted for syllabus reading)
  app.get("/tasks/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ detail: "Invalid task ID format." });
    }

    const task = db.getTask(id);
    if (!task) {
      return res.status(404).json({ detail: "Task not found." });
    }

    res.json(task);
  });

  // POST /tasks/:id/resume - Approve and resume the summarization step
  app.post("/tasks/:id/resume", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const userEmail = getRequestUserEmail(req);

    if (isNaN(id)) {
      return res.status(400).json({ detail: "Invalid task ID format." });
    }

    const task = db.getTask(id);
    if (!task) {
      return res.status(404).json({ detail: "Task not found." });
    }
    if (task.user_email !== userEmail) {
      return res.status(403).json({ detail: "Access denied to resume this task." });
    }

    if (task.status !== "awaiting_approval") {
      return res.status(400).json({
        detail: `Task is not awaiting approval. Current status: ${task.status}`,
      });
    }

    // Trigger resume asynchronously in background
    resumePipeline(id).catch((err) => {
      console.error(`[Orchestrator] Error resuming pipeline for task ${id}:`, err);
    });

    // Return the updated task representation
    res.json(db.getTask(id));
  });

  // POST /tasks/:id/retry - Retry a failed or stopped task from where it failed/stopped
  app.post("/tasks/:id/retry", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const userEmail = getRequestUserEmail(req);

    if (isNaN(id)) {
      return res.status(400).json({ detail: "Invalid task ID format." });
    }

    const task = db.getTask(id);
    if (!task) {
      return res.status(404).json({ detail: "Task not found." });
    }
    if (task.user_email !== userEmail) {
      return res.status(403).json({ detail: "Access denied to retry this task." });
    }

    if (task.status !== "failed" && task.status !== "cancelled") {
      return res.status(400).json({ detail: "Only failed or stopped tasks can be retried." });
    }

    // If task was stopped/cancelled, translate current_step to corresponding failed step
    if (task.status === "cancelled") {
      let failStep = task.current_step;
      if (task.current_step === "searching") failStep = "search_failed";
      else if (task.current_step === "extracting") failStep = "extract_failed";
      else if (task.current_step === "summarizing") failStep = "summarize_failed";

      db.updateTask(id, {
        status: "failed" as any,
        current_step: failStep,
        error_message: "Stopped by user.",
      });
    }

    // Trigger retry asynchronously in background
    runPipeline(id).catch((err) => {
      console.error(`[Orchestrator] Error retrying pipeline for task ${id}:`, err);
    });

    res.json(db.getTask(id));
  });

  // POST /tasks/:id/stop - Stop/Cancel a running task research pipeline
  app.post("/tasks/:id/stop", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const userEmail = getRequestUserEmail(req);

    if (isNaN(id)) {
      return res.status(400).json({ detail: "Invalid task ID format." });
    }

    const task = db.getTask(id);
    if (!task) {
      return res.status(404).json({ detail: "Task not found." });
    }
    if (task.user_email !== userEmail) {
      return res.status(403).json({ detail: "Access denied to stop this task." });
    }

    const activeStatuses = ["searching", "extracting", "summarizing", "pending"];
    if (!activeStatuses.includes(task.status)) {
      return res.status(400).json({ detail: "Task is not currently running." });
    }

    // Mark task as CANCELLED in database
    db.updateTask(id, {
      status: "cancelled" as any,
      error_message: "Stopped by user.",
    });

    res.json(db.getTask(id));
  });

  // DELETE /tasks/:id - Delete a task
  app.delete("/tasks/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const userEmail = getRequestUserEmail(req);

    if (isNaN(id)) {
      return res.status(400).json({ detail: "Invalid task ID format." });
    }

    const task = db.getTask(id);
    if (!task) {
      return res.status(404).json({ detail: "Task not found." });
    }
    if (task.user_email !== userEmail) {
      return res.status(403).json({ detail: "Access denied to delete this task." });
    }

    db.deleteTask(id);
    res.json({ message: "Task deleted." });
  });
  
  // POST /tasks/:id/share-email - Send/email a task's interactive syllabus and roadmap link
  app.post("/tasks/:id/share-email", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const userEmail = getRequestUserEmail(req);

    if (isNaN(id)) {
      return res.status(400).json({ detail: "Invalid task ID format." });
    }

    const task = db.getTask(id);
    if (!task) {
      return res.status(404).json({ detail: "Task not found." });
    }

    const { recipientEmail, customMessage } = req.body;
    const targetEmail = recipientEmail || userEmail;

    if (!targetEmail || !targetEmail.includes("@") || targetEmail === "guest@persistiq.io") {
      return res.status(400).json({ 
        detail: "A valid email address is required. Please sign in with Google/GitHub or provide a recipient email address." 
      });
    }

    try {
      const success = await sendTaskEmail(task, targetEmail, customMessage);
      if (success) {
        return res.json({ success: true, message: `Successfully emailed study guide to ${targetEmail}` });
      } else {
        return res.status(500).json({ detail: "Failed to dispatch email. Please check your SMTP environment configuration." });
      }
    } catch (err: any) {
      console.error("[API] Error in share-email endpoint:", err);
      return res.status(500).json({ detail: err.message || "An error occurred while emailing the study guide." });
    }
  });

  // ── Front-End / Static asset integration ────────────────────────────────────

  if (process.env.NODE_ENV !== "production") {
    // Development Mode: Mount Vite in middlewareMode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production Mode: Serve built files directly from dist folder
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] PersistIQ full-stack server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[Server] Fatal error starting server:", err);
});
