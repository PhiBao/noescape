import { xy } from "@noescape/engine";

interface StampProps {
  caseId: bigint;
  turn: number;
  detective: number;
  cell: number;
  code: number;
  hour: string;
  latest: boolean;
}

function rotationOf(caseId: bigint, turn: number, detective: number): number {
  let hash = 2166136261;
  for (const character of `${caseId}:${turn}:${detective}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash % 9) - 4;
}

const stampCopy = ["NOTHING", "COLD", "FRESH"] as const;

export function Stamp({ caseId, turn, detective, cell, code, hour, latest }: StampProps) {
  const label = stampCopy[code] ?? "NOTHING";
  const color = code === 2 ? "var(--grease)" : code === 1 ? "var(--amber)" : "var(--ink-2)";
  const { x, y } = xy(cell);
  const rotation = rotationOf(caseId, turn, detective);

  return (
    <g
      transform={`translate(${x + 0.5} ${y + 0.5}) rotate(${rotation})`}
      opacity={latest ? 0.9 : 0.35}
    >
      <rect
        x="-0.62"
        y="-0.25"
        width="1.24"
        height="0.5"
        rx="0.04"
        fill="var(--paper)"
        fillOpacity="0.82"
        stroke={color}
        strokeWidth="0.04"
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontFamily="var(--font-display)"
        fontSize="0.34"
        fontWeight="700"
        letterSpacing="0.02"
      >
        {label}
      </text>
      <text
        y="0.41"
        textAnchor="middle"
        fill="var(--ink-2)"
        fontFamily="var(--font-mono)"
        fontSize="0.16"
      >
        {hour}
      </text>
    </g>
  );
}

interface SightingProps {
  cell: number;
  hour: string;
  latest: boolean;
}

export function Sighting({ cell, hour, latest }: SightingProps) {
  const { x, y } = xy(cell);
  return (
    <g transform={`translate(${x + 0.5} ${y + 0.5})`} opacity={latest ? 0.9 : 0.35}>
      <path
        d="M-0.34-0.18Q0-0.34 0.34-0.18Q0.48 0 0.32 0.2Q0 0.36-0.32 0.18Q-0.48 0-0.34-0.18Z"
        fill="none"
        stroke="var(--grease)"
        strokeWidth="0.05"
        strokeLinecap="round"
      />
      <text
        y="-0.48"
        textAnchor="middle"
        fill="var(--grease)"
        fontFamily="var(--font-mono)"
        fontSize="0.16"
      >
        {hour}
      </text>
    </g>
  );
}
