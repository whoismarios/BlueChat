import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "icon";

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
}

/** Shared focus ring used by all interactive primitives. */
export const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(0_33_63/0.25)] hover:bg-brand-700 active:bg-brand-800 dark:bg-brand-500 dark:hover:bg-brand-400 dark:active:bg-brand-600",
  secondary:
    "border border-line-strong bg-surface-raised text-ink shadow-[0_1px_0_rgb(0_33_63/0.04)] hover:border-brand-300 hover:bg-surface-sunken dark:hover:border-brand-700",
  ghost: "text-ink-muted hover:bg-surface-sunken hover:text-ink",
  danger:
    "bg-danger text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] hover:brightness-110 active:brightness-95",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-lg px-3 text-[13px]",
  md: "h-10 gap-2 rounded-[10px] px-4 text-sm",
  icon: "size-9 rounded-[10px] p-0",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center justify-center font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,filter] duration-150 select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        focusRing,
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner className={size === "icon" ? "" : "-ml-0.5"} />}
      {loading && size === "icon" ? null : children}
    </button>
  );
}
