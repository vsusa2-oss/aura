import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full bg-transparent px-3 text-sm text-cyan-50 placeholder:text-cyan-200/35 outline-none",
        "border border-cyan-400/25 focus:border-cyan-300/70 focus:shadow-[0_0_18px_rgba(0,229,255,0.15)]",
        "font-[family-name:var(--font-mono)]",
        className,
      )}
      {...props}
    />
  );
}
