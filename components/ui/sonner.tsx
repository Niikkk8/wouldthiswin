"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="dark"
    position="bottom-center"
    toastOptions={{
      classNames: {
        toast:
          "!rounded-card !border !border-border-strong !bg-surface-2 !text-text !font-sans !text-[15px] !shadow-none",
        description: "!text-text-muted",
      },
    }}
    {...props}
  />
);

export { Toaster };
