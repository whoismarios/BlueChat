/**
 * Shared contract between backend (API routes, lib/server/*) and frontend (components/*).
 * Keep this file framework-agnostic: no server-only imports.
 */
import type { UIMessage } from "ai";

/* ------------------------------------------------------------------ */
/* Models & chat settings                                              */
/* ------------------------------------------------------------------ */

export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

export interface ModelInfo {
  /** OpenAI model id, e.g. "gpt-5.5" */
  id: string;
  /** Display name, e.g. "GPT-5.5" */
  label: string;
  /** Short German description shown in the model picker */
  description: string;
  /** Supported reasoning efforts; null = no reasoning model (no picker shown) */
  reasoningEfforts: ReasoningEffort[] | null;
  defaultReasoningEffort: ReasoningEffort | null;
  supportsWebSearch: boolean;
  supportsTools: boolean;
}

export interface ToolToggles {
  webSearch: boolean;
  python: boolean;
}

/** Per-conversation settings (persisted on the conversation row). */
export interface ChatSettings {
  model: string;
  reasoningEffort: ReasoningEffort | null;
  tools: ToolToggles;
}

/** Global app settings (singleton row in `app_settings`). */
export interface AppSettings {
  systemPrompt: string;
  defaultModel: string;
  defaultReasoningEffort: ReasoningEffort | null;
  defaultTools: ToolToggles;
}

/* ------------------------------------------------------------------ */
/* Conversations                                                       */
/* ------------------------------------------------------------------ */

export interface ConversationSummary {
  id: string; // uuid
  title: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface Conversation extends ConversationSummary {
  settings: ChatSettings;
}

export interface ConversationWithMessages extends Conversation {
  messages: BlueChatUIMessage[];
}

/* ------------------------------------------------------------------ */
/* Python sandbox                                                      */
/* ------------------------------------------------------------------ */

export interface PythonToolInput {
  /** Python source to execute in the stateful Jupyter kernel of this conversation */
  code: string;
  /** Optional short German description of what the code does (shown as header) */
  title?: string;
}

export type PythonOutputItem =
  | { type: "stream"; name: "stdout" | "stderr"; text: string }
  /** text/plain of an execute_result / display_data without richer repr */
  | { type: "text"; text: string }
  /** data = base64 for png/jpeg, raw SVG markup for image/svg+xml */
  | { type: "image"; mime: "image/png" | "image/jpeg" | "image/svg+xml"; data: string; text?: string; export?: DataExport }
  /** `text` on image/html = text/plain repr (used to describe the output to the model) */
  /** Rich HTML. kind=table → pandas DataFrame; kind=plotly → full standalone plotly HTML page */
  | { type: "html"; kind: "table" | "plotly" | "generic"; html: string; text?: string; export?: DataExport }
  | { type: "error"; ename: string; evalue: string; traceback: string }
  /**
   * Interactive widget (sliders etc.) created in Python. `outputs` are the outputs of the
   * initial run with the default values. Changing a control re-runs the registered Python
   * function in the kernel (POST /api/sandbox/<sessionId>/widget) and replaces the outputs.
   */
  | { type: "widget"; id: string; title?: string; controls: WidgetControl[]; outputs: PythonOutputItem[] };

export type WidgetValue = number | string | boolean;

export type WidgetControl =
  | { type: "slider"; name: string; label: string; min: number; max: number; step: number; value: number; unit?: string }
  | { type: "select"; name: string; label: string; options: (string | number)[]; value: string | number }
  | { type: "checkbox"; name: string; label: string; value: boolean };

/** POST /api/sandbox/<sessionId>/widget → PythonToolOutput (outputs of the re-run) */
export interface WidgetRunRequest {
  widgetId: string;
  values: Record<string, WidgetValue>;
}

/** POST /api/sandbox/<sessionId>/execute → PythonToolOutput (user-edited code from a cell) */
export interface ExecuteCodeRequest {
  code: string;
}

/**
 * CSV export of the data behind a table/chart output (full DataFrame, plotly traces,
 * matplotlib lines/bars/scatter). Written by the sandbox to `exports/` in the session workdir.
 */
export interface DataExport {
  name: string; // e.g. "tabelle-3f9a.csv"
  path: string; // relative to session workdir, e.g. "exports/tabelle-3f9a.csv"
  rows: number;
  columns: number;
  size: number; // bytes
  /** Download URL via Next proxy (added by the backend) */
  url: string;
}

export interface SandboxFile {
  name: string; // file name, e.g. "report.csv"
  path: string; // path relative to the session workdir, e.g. "out/report.csv"
  size: number; // bytes
  /** Browser-usable download URL via Next proxy: /api/sandbox/<sessionId>/files/<path> */
  url: string;
}

export interface PythonToolOutput {
  status: "ok" | "error" | "timeout";
  outputs: PythonOutputItem[];
  /** Files created or modified in the session workdir during this execution */
  files: SandboxFile[];
  durationMs: number;
}

/** Response of POST /api/sandbox/<sessionId>/upload */
export type UploadedFile = Omit<SandboxFile, "url"> & { url: string };

/* ------------------------------------------------------------------ */
/* UI message typing                                                   */
/* ------------------------------------------------------------------ */

export interface BlueChatMessageMetadata {
  model?: string;
  reasoningEffort?: ReasoningEffort | null;
  createdAt?: string; // ISO
  /** Files the user attached to this (user) message – uploaded into the sandbox workdir */
  attachments?: Omit<SandboxFile, "url">[];
  usage?: { inputTokens?: number; outputTokens?: number; reasoningTokens?: number };
}

/**
 * Tool names (keys of the `tools` object passed to streamText). UI parts are typed
 * `tool-${name}`, i.e. "tool-python" and "tool-web_search".
 */
export const TOOL_NAMES = { python: "python", webSearch: "web_search", plan: "plan" } as const;

/** `plan` tool: the model publishes / updates its analysis plan (rendered as a checklist). */
export type PlanStepStatus = "pending" | "in_progress" | "done";
export interface PlanToolInput {
  title?: string;
  steps: { title: string; status: PlanStepStatus }[];
}

export type BlueChatUIMessage = UIMessage<BlueChatMessageMetadata>;

/* ------------------------------------------------------------------ */
/* HTTP contract                                                       */
/* ------------------------------------------------------------------ */

/**
 * POST /api/chat body. The client sends ONLY the last message
 * (via DefaultChatTransport.prepareSendMessagesRequest); the server loads the
 * history from Postgres. For trigger "regenerate-message" the server drops the
 * trailing assistant message before re-running.
 */
export interface ChatRequestBody {
  id: string; // conversation id (uuid, generated on the client for new chats)
  message?: BlueChatUIMessage; // absent for regenerate
  trigger: "submit-message" | "regenerate-message";
  messageId?: string;
  settings: ChatSettings;
}

export interface HealthStatus {
  db: boolean;
  sandbox: boolean;
  openaiKey: boolean; // OPENAI_API_KEY present and not the placeholder
}
