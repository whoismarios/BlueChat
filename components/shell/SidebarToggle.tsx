"use client";

import { PanelLeftOpen, SquarePen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useShell } from "@/lib/client/shell";
import { useConversations } from "@/lib/client/conversations";
import { IconButton } from "@/components/ui";
import { BrandMark } from "./Wordmark";

/**
 * Leading controls for the chat header ("mobile top bar"): opens the drawer on mobile,
 * re-expands the collapsed sidebar on desktop, plus a quick "new chat" button.
 */
export function SidebarToggle() {
  const { collapsed, showSidebar } = useShell();
  const { startNewChat } = useConversations();
  return (
    <div className={cn("flex items-center gap-0.5", !collapsed && "lg:hidden")}>
      <IconButton label="Seitenleiste öffnen" tooltipSide="bottom" onClick={showSidebar}>
        <PanelLeftOpen />
      </IconButton>
      <IconButton label="Neuer Chat" tooltipSide="bottom" onClick={startNewChat}>
        <SquarePen />
      </IconButton>
      <BrandMark className="mx-1.5 size-6 sm:hidden" />
    </div>
  );
}
