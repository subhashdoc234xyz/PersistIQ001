import { auth } from "./firebase";

export interface ResearchTask {
  id: number;
  topic: string;
  status: string;
  current_step: string;
  search_results: string | null;
  extracted_data: string | null;
  final_summary: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
  sources?: string | null;
  phase_states?: string | null;
  study_notes?: string | null;
  duration?: string | null;
  focus?: string | null;
  task_type?: "learning" | "article" | null;
  num_pages?: number | null;
}

const getUserEmail = (): string => {
  if (auth.currentUser) {
    const user = auth.currentUser;
    let email = user.email;
    if (!email && user.providerData) {
      for (const profile of user.providerData) {
        if (profile.email) {
          email = profile.email;
          break;
        }
      }
    }
    if (!email && user.providerData.some(p => p.providerId === "github.com")) {
      email = localStorage.getItem(`persistiq_github_email_${user.uid}`) || null;
    }
    return email || `guest_${user.uid}@persistiq.io`;
  }
  return "guest@persistiq.io";
};

const apiRequest = async (url: string, options?: RequestInit) => {
  const userEmail = getUserEmail();
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-User-Email": userEmail,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `HTTP Error ${res.status}`);
  }

  return res.json();
};

export const tasksApi = {
  getAll: (): Promise<ResearchTask[]> => apiRequest("/tasks"),
  getOne: (id: number): Promise<ResearchTask> => apiRequest(`/tasks/${id}`),
  create: (topic: string, duration?: string, focus?: string, task_type?: "learning" | "article", num_pages?: number): Promise<ResearchTask> =>
    apiRequest("/tasks", {
      method: "POST",
      body: JSON.stringify({ topic, duration, focus, task_type, num_pages }),
    }),
  resume: (id: number): Promise<ResearchTask> =>
    apiRequest(`/tasks/${id}/resume`, {
      method: "POST",
    }),
  retry: (id: number): Promise<ResearchTask> =>
    apiRequest(`/tasks/${id}/retry`, {
      method: "POST",
    }),
  stop: (id: number): Promise<ResearchTask> =>
    apiRequest(`/tasks/${id}/stop`, {
      method: "POST",
    }),
  updatePhases: (id: number, phase_states: string): Promise<ResearchTask> =>
    apiRequest(`/tasks/${id}/phases`, {
      method: "POST",
      body: JSON.stringify({ phase_states }),
    }),
  updateNotes: (id: number, study_notes: string): Promise<ResearchTask> =>
    apiRequest(`/tasks/${id}/notes`, {
      method: "POST",
      body: JSON.stringify({ study_notes }),
    }),
  delete: (id: number): Promise<{ message: string }> =>
    apiRequest(`/tasks/${id}`, {
      method: "DELETE",
    }),
  shareEmail: (id: number, recipientEmail?: string, customMessage?: string): Promise<{ success: boolean; message: string }> =>
    apiRequest(`/tasks/${id}/share-email`, {
      method: "POST",
      body: JSON.stringify({ recipientEmail, customMessage }),
    }),
};
