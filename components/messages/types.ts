import type { BlueChatUIMessage, PlanToolInput, PythonToolInput, PythonToolOutput } from "@/lib/types";

export type MessagePart = BlueChatUIMessage["parts"][number];

export type ToolState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied";

/** Loosely typed view on a `tool-python` UI part (BlueChatUIMessage has untyped tools). */
export interface PythonToolPartView {
  type: "tool-python";
  toolCallId: string;
  state: ToolState;
  input?: Partial<PythonToolInput>;
  output?: PythonToolOutput;
  errorText?: string;
  preliminary?: boolean;
}

/** `tool-plan` UI part: the model's analysis plan (input = full step list with statuses). */
export interface PlanToolPartView {
  type: "tool-plan";
  toolCallId: string;
  state: ToolState;
  /** Partial while streaming (steps may be incomplete) */
  input?: Partial<PlanToolInput>;
  output?: { ok?: boolean; done?: number; total?: number };
  errorText?: string;
}

/** OpenAI provider-executed web search output (see @ai-sdk/openai `webSearch` tool). */
export interface WebSearchOutput {
  action?:
    | { type: "search"; query?: string; queries?: string[] }
    | { type: "openPage"; url?: string | null }
    | { type: "findInPage"; url?: string | null; pattern?: string | null };
  sources?: Array<{ type: "url"; url: string } | { type: "api"; name: string }>;
}

export interface WebSearchPartView {
  type: "tool-web_search";
  toolCallId: string;
  state: ToolState;
  input?: unknown;
  output?: WebSearchOutput;
  errorText?: string;
}
