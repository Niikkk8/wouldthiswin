"use client";

import * as React from "react";
import { cn } from "cn";
import { CheckIcon } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-[18px] shrink-0 rounded-[4px] border border-border-strong bg-surface transition-colors disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-text data-[state=checked]:bg-text data-[state=checked]:text-bg",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center"
      >
        <CheckIcon className="size-3.5" strokeWidth={1.75} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
