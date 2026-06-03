interface CondorLogoProps {
  size?: number;
  animate?: boolean;
  className?: string;
}

/**
 * Cóndor logo — stylised Andean condor silhouette inside a dashed radar ring.
 * Drawn in `currentColor`; colour the element via `text-condor-primary` (or
 * any other Tailwind colour utility).
 *
 * Animation hooks: when `animate` is true the root element gets `.condor-animate`,
 * the dashed ring gets `.condor-ring-ping`, and the wings group gets `.condor-wings`.
 * The actual keyframes are defined in globals.css and are gated behind
 * `prefers-reduced-motion: no-preference`.
 */
export default function CondorLogo({
  size = 96,
  animate = false,
  className = '',
}: CondorLogoProps) {
  const rootClass = [
    'text-condor-primary',
    animate ? 'condor-animate' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="currentColor"
      aria-hidden="true"
      className={rootClass}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ── Dashed radar ring ─────────────────────────────────────── */}
      <circle
        className="condor-ring-ping"
        cx="50"
        cy="50"
        r="44"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeDasharray="5 4"
        strokeLinecap="round"
      />

      {/* ── Condor silhouette ─────────────────────────────────────── */}
      {/*
          The bird faces slightly left with wings spread wide.
          Wide primary feathers fan outward from each wingtip.
          A small rounded head sits atop a compact body.
      */}
      <g className="condor-wings">
        {/* Body */}
        <ellipse cx="50" cy="54" rx="7" ry="9" />

        {/* Head (slightly left of centre) */}
        <ellipse cx="45" cy="43" rx="4.5" ry="4" />

        {/* Beak — small horizontal stub pointing left */}
        <ellipse cx="40" cy="43.5" rx="3.5" ry="1.5" />

        {/* ── Left wing (viewer's left = bird's right) ── */}
        {/* Main wing membrane */}
        <path d="M 43 50 C 30 46, 18 42, 10 36 C 14 44, 22 52, 34 55 Z" />
        {/* Primary feather fingers */}
        <path d="M 10 36 C  8 32,  6 29,  8 25 C 11 30, 12 34, 14 38 Z" />
        <path d="M 14 33 C 12 28, 12 24, 15 20 C 17 26, 17 30, 18 34 Z" />
        <path d="M 18 31 C 17 26, 18 22, 22 19 C 23 25, 22 29, 22 33 Z" />
        <path d="M 22 30 C 22 25, 24 21, 28 19 C 28 25, 27 29, 27 32 Z" />
        <path d="M 27 30 C 27 25, 30 22, 34 21 C 33 27, 31 30, 32 33 Z" />

        {/* ── Right wing (viewer's right = bird's left) ── */}
        {/* Main wing membrane */}
        <path d="M 57 50 C 70 46, 82 42, 90 36 C 86 44, 78 52, 66 55 Z" />
        {/* Primary feather fingers */}
        <path d="M 90 36 C 92 32, 94 29, 92 25 C 89 30, 88 34, 86 38 Z" />
        <path d="M 86 33 C 88 28, 88 24, 85 20 C 83 26, 83 30, 82 34 Z" />
        <path d="M 82 31 C 83 26, 82 22, 78 19 C 77 25, 78 29, 78 33 Z" />
        <path d="M 78 30 C 78 25, 76 21, 72 19 C 72 25, 73 29, 73 32 Z" />
        <path d="M 73 30 C 73 25, 70 22, 66 21 C 67 27, 69 30, 68 33 Z" />

        {/* Tail */}
        <path d="M 46 63 C 45 68, 44 72, 46 75 C 48 72, 52 72, 54 75 C 56 72, 55 68, 54 63 Z" />
      </g>
    </svg>
  );
}
