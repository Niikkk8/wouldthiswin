/** The pill that marks sample data: a yellow dot and a mono label. */
export function SampleTag({ children }: { children: React.ReactNode }) {
  return (
    <p className="label-mono inline-flex items-center gap-2 rounded-full border border-border-strong px-3 py-1 uppercase">
      <span aria-hidden className="size-1.5 rounded-full bg-unclear" />
      {children}
    </p>
  );
}
