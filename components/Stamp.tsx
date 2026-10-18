/**
 * The inspector's stamp: SWITCHYARD's one signature mark. Pressed onto a sheet
 * where a verdict is recorded (Challenge, Verify, Decide). Text always carries
 * the meaning; the ink colour only repeats it.
 */
export function Stamp({ word, sub, ring = "SWITCHYARD · DECISION ROOM ·", fail = false, size = 132, rot = -8, className = "" }:
  { word: string; sub?: string; ring?: string; fail?: boolean; size?: number; rot?: number; className?: string }) {
  const id = `ring-${word.replace(/\W/g, "")}-${size}`;
  const long = word.length > 9;
  return (
    <div className={`stamp pointer-events-none select-none ${fail ? "is-fail" : ""} ${className}`} style={{ width: size, height: size, ["--stamp-rot" as string]: `${rot}deg` }} role="img" aria-label={`${word}${sub ? `, ${sub}` : ""}`}>
      <svg viewBox="0 0 120 120" width={size} height={size} fill="none" stroke="currentColor">
        <defs><path id={id} d="M60,60 m-45,0 a45,45 0 1,1 90,0 a45,45 0 1,1 -90,0" /></defs>
        <circle cx="60" cy="60" r="57" strokeWidth="2.6" />
        <circle cx="60" cy="60" r="53" strokeWidth="0.9" />
        <circle cx="60" cy="60" r="38.5" strokeWidth="0.9" />
        <text fill="currentColor" stroke="none" fontSize="7.6" fontWeight="700" style={{ fontStretch: "80%" }}>
          <textPath href={`#${id}`} startOffset="0" textLength={276} lengthAdjust="spacing">{ring.length < 20 ? `${ring} ${ring}` : ring}</textPath>
        </text>
        <line x1="22" y1="49" x2="98" y2="49" strokeWidth="1.3" />
        <line x1="22" y1="71" x2="98" y2="71" strokeWidth="1.3" />
        <text x="60" y={long ? 64.2 : 65.8} textAnchor="middle" fill="currentColor" stroke="none" fontSize={long ? 12.5 : 16} fontWeight="800" style={{ fontStretch: "75%" }} textLength={long ? 70 : undefined} lengthAdjust="spacingAndGlyphs">{word}</text>
        {sub && <text x="60" y="83" textAnchor="middle" fill="currentColor" stroke="none" fontSize="5.8" fontWeight="700" letterSpacing="0.3" style={{ fontStretch: "85%" }}>{sub}</text>}
      </svg>
    </div>
  );
}
