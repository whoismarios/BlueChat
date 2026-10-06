"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { focusRing } from "./Button";
import { Tooltip } from "./Tooltip";

export interface IconButtonProps extends Omit<ComponentProps<"button">, "children"> {
  /** Required: used as aria-label and tooltip text. */
  label: string;
  size?: "sm" | "md";
  variant?: "ghost" | "solid";
  tooltipSide?: "top" | "bottom" | "left" | "right";
  /** Set false to suppress the tooltip (aria-label stays). */
  showTooltip?: boolean;
  /** The icon. */
  children: ReactNode;
}

const sizes = {
  sm: "size-7 rounded-md [&_svg]:size-[15px]",
  md: "size-9 rounded-[10px] [&_svg]:size-[18px]",
};

const variants = {
  ghost: "text-ink-muted hover:bg-surface-sunken hover:text-ink aria-expanded:bg-surface-sunken aria-expanded:text-ink",
  solid:
    "border border-line bg-surface-raised text-ink-muted shadow-[0_1px_0_rgb(0_33_63/0.04)] hover:border-line-strong hover:text-ink aria-expanded:border-line-strong aria-expanded:text-ink",
};

/** Square icon-only button with built-in tooltip. */
export function IconButton({
  label,
  size = "md",
  variant = "ghost",
  tooltipSide = "top",
  showTooltip = true,
  className,
  children,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <Tooltip content={label} side={tooltipSide} disabled={!showTooltip}>
      <button
        type={type}
        aria-label={label}
        className={cn(
          "inline-flex shrink-0 cursor-pointer items-center justify-center transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0",
          focusRing,
          sizes[size],
          variants[variant],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    </Tooltip>
  );
}
