import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getConversationWithMessages, isUuid } from "@/lib/server/conversations";
import { Chat } from "@/components/chat/Chat";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "blueChat" };
  try {
    const conversation = await getConversationWithMessages(id);
    return { title: conversation ? `${conversation.title} · blueChat` : "blueChat" };
  } catch {
    return { title: "blueChat" };
  }
}

export default async function ConversationPage({ params }: PageProps) {
  await connection();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const conversation = await getConversationWithMessages(id);
  if (!conversation) notFound();

  return (
    <Chat
      key={conversation.id}
      id={conversation.id}
      initialMessages={conversation.messages}
      initialSettings={conversation.settings}
      initialTitle={conversation.title}
      persisted
    />
  );
}
