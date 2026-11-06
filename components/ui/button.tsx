import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-control font-sans font-bold whitespace-nowrap transition-[background-color,border-color,color,opacity] duration-150 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        primary: "bg-text text-bg hover:bg-text-muted",
        secondary: "border border-border-strong bg-transparent text-text hover:bg-surface-2",
        danger: "bg-loss text-bg hover:bg-loss/85",
        link: "h-auto px-0 text-text underline decoration-1 underline-offset-[6px] hover:text-text-muted",
      },
      size: {
        default: "h-[54px] px-7 text-[17px]",
        sm: "h-12 px-5 text-[15px]",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: { variant: "primary", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
