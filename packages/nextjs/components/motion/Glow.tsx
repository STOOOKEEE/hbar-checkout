type GlowProps = {
  className?: string;
};

/** Decorative blurred lime/violet/sky blobs drifting slowly behind a section. */
export function Glow({ className }: GlowProps) {
  return (
    <div
      className={className ? `glow ${className}` : "glow"}
      aria-hidden="true"
    >
      <span className="glow-blob glow-lime" />
      <span className="glow-blob glow-violet" />
      <span className="glow-blob glow-sky" />
    </div>
  );
}
