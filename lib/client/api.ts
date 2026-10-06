"use client";

import type {
  AppSettings,
  ChatSettings,
  ConversationSummary,
  ExecuteCodeRequest,
  HealthStatus,
  PythonToolOutput,
  UploadedFile,
} from "@/lib/types";

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.clone().json();
    if (data && typeof data === "object") {
      const msg = (data as { error?: unknown; message?: unknown }).error ?? (data as { message?: unknown }).message;
      if (typeof msg === "string") return msg;
    }
  } catch {
    /* not json */
  }
  try {
    const text = await res.text();
    if (text) return text.slice(0, 300);
  } catch {
    /* ignore */
  }
  return `Anfrage fehlgeschlagen (${res.status})`;
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await readError(res));
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/* Conversations ----------------------------------------------------- */

export async function fetchConversations(): Promise<ConversationSummary[]> {
  const data = await apiFetch<ConversationSummary[] | { conversations: ConversationSummary[] }>("/api/conversations");
  return Array.isArray(data) ? data : (data?.conversations ?? []);
}

export function patchConversation(id: string, body: { title?: string; settings?: Partial<ChatSettings> }) {
  return apiFetch<unknown>(`/api/conversations/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function deleteConversation(id: string) {
  return apiFetch<unknown>(`/api/conversations/${id}`, { method: "DELETE" });
}

/* Settings / health -------------------------------------------------- */

export function fetchSettings() {
  return apiFetch<AppSettings>("/api/settings");
}

export function saveSettings(partial: Partial<AppSettings>) {
  return apiFetch<AppSettings>("/api/settings", { method: "PUT", body: JSON.stringify(partial) });
}

export function fetchHealth() {
  return apiFetch<HealthStatus>("/api/health");
}

/* Sandbox ------------------------------------------------------------ */

export function resetSandbox(sessionId: string) {
  return apiFetch<unknown>(`/api/sandbox/${sessionId}/reset`, { method: "POST" });
}

/**
 * Upload a file into the sandbox workdir of a session with progress reporting.
 * Uses XHR because fetch has no upload progress.
 */
export function uploadSandboxFile(
  sessionId: string,
  file: File,
  onProgress?: (fraction: number) => void,
): { promise: Promise<UploadedFile>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<UploadedFile>((resolve, reject) => {
    xhr.open("POST", `/api/sandbox/${sessionId}/upload`);
    xhr.responseType = "text";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as UploadedFile);
        } catch {
          reject(new Error("Ungültige Antwort vom Server"));
        }
      } else {
        let msg = `Upload fehlgeschlagen (${xhr.status})`;
        try {
          const data = JSON.parse(xhr.responseText);
          if (typeof data?.error === "string") msg = data.error;
        } catch {
          if (xhr.responseText && xhr.responseText.length < 300) msg = xhr.responseText;
        }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Netzwerkfehler beim Upload"));
    xhr.onabort = () => reject(new DOMException("Abgebrochen", "AbortError"));
    const form = new FormData();
    form.append("file", file, file.name);
    xhr.send(form);
  });
  return { promise, abort: () => xhr.abort() };
}

/* Voice input -------------------------------------------------------- */

/** Transcribe a recorded audio blob (German) → plain text. */
export async function transcribeAudio(blob: Blob, signal?: AbortSignal): Promise<string> {
  const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : blob.type.includes("wav") ? "wav" : "webm";
  const form = new FormData();
  form.append("audio", blob, `aufnahme.${ext}`);
  const data = await apiFetch<{ text: string }>("/api/transcribe", { method: "POST", body: form, signal });
  return data?.text ?? "";
}

/* Edited code cells -------------------------------------------------- */

/** Run user-edited code in the session's kernel → output of that run. */
export function executeCode(sessionId: string, code: string, signal?: AbortSignal) {
  const body: ExecuteCodeRequest = { code };
  return apiFetch<PythonToolOutput>(`/api/sandbox/${sessionId}/execute`, { method: "POST", body: JSON.stringify(body), signal });
}
