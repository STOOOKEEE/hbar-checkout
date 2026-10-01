type MarqueeProps = {
  items: string[];
  /** Duration of one full loop, in seconds. */
  speedSec?: number;
};

/** Infinite horizontal loop of items; pauses on hover. The duplicate track is hidden from assistive tech. */
export function Marquee({ items, speedSec = 30 }: MarqueeProps) {
  return (
    <div className="marquee">
      <div
        className="marquee-track"
        style={{ animationDuration: `${speedSec}s` }}
      >
        <ul className="marquee-group">
          {items.map((item, index) => (
            <li key={`${index}-${item}`}>{item}</li>
          ))}
        </ul>
        <ul className="marquee-group" aria-hidden="true">
          {items.map((item, index) => (
            <li key={`${index}-${item}`}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
