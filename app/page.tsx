import { connection } from "next/server";
import type { AppSettings } from "@/lib/types";
import { getAppSettings } from "@/lib/server/settings";
import { NewChat } from "@/components/chat/NewChat";
import { chatSettingsFromApp } from "@/components/chat/settings";

async function loadAppSettings(): Promise<AppSettings | null> {
  try {
    // Don't let an unreachable database block the new-chat page for long.
    return await Promise.race([
      getAppSettings(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
  } catch (error) {
    console.error("[blueChat] App-Einstellungen konnten nicht geladen werden:", error);
    return null;
  }
}

export default async function NewChatPage() {
  // Always render per request – defaults live in the database.
  await connection();
  const settings = chatSettingsFromApp(await loadAppSettings());
  return <NewChat initialSettings={settings} />;
}
