import * as React from "react";
import { cn } from "cn";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-[60px] w-full min-w-0 rounded-control border border-border-strong bg-surface px-5 font-mono text-[16px] text-text transition-colors outline-none placeholder:text-text-subtle hover:border-text-subtle focus-visible:border-text disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-loss",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
