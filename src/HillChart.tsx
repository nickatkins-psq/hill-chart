import React, { useCallback, useEffect, useRef, useState } from "react";

   export type HillPhase = "UPHILL" | "CREST" | "DOWNHILL" | "DONE";

   export interface EpicDot {
     key: string; // e.g. "PROJ-123"
     title: string;
     x: number; // 0–100, position along the hill
   }

interface HillChartProps {
  epics: EpicDot[];
  onUpdateEpicX: (key: string, x: number) => void;
}

const HILL_WIDTH = 800;
const HILL_HEIGHT = 400;
const MARGIN_X = 40;
const MARGIN_Y = 40;

// Simple "hill" function: x in [0, 100] => y in [0, 1]
function hillY01(x: number): number {
  const t = x / 100;
  return 4 * t * (1 - t); // 0 at ends, 1 at crest
}

// Given x in [0, 100], return SVG coords
function hillCoords(x: number) {
  const t = x / 100;
  const hillHeight = HILL_HEIGHT - 2 * MARGIN_Y;
  const hillWidth = HILL_WIDTH - 2 * MARGIN_X;

  const y01 = hillY01(x);
  const svgX = MARGIN_X + hillWidth * t;
  const svgY = HILL_HEIGHT - MARGIN_Y - hillHeight * y01; // invert y
  return { svgX, svgY };
}

export function computePhase(x: number): HillPhase {
  if (x < 25) return "UPHILL";
  if (x < 50) return "CREST";
  if (x < 80) return "DOWNHILL";
  return "DONE";
}

// Wrap text into multiple lines based on max width (approximate character count)
function wrapText(text: string, maxCharsPerLine: number = 15): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (currentLine === "") {
      currentLine = word;
    } else if ((currentLine + " " + word).length <= maxCharsPerLine) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [text];
}

const HillChart: React.FC<HillChartProps> = ({ epics, onUpdateEpicX }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!draggingKey || !svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();
      const relativeX = event.clientX - rect.left;

      const hillWidth = HILL_WIDTH - 2 * MARGIN_X;
      let t = (relativeX - MARGIN_X) / hillWidth;
      t = Math.max(0, Math.min(1, t));
      const x = t * 100;

      onUpdateEpicX(draggingKey, x);
    },
    [draggingKey, onUpdateEpicX],
  );

  const handleMouseUp = useCallback(() => {
    if (draggingKey) {
      setDraggingKey(null);
    }
  }, [draggingKey]);

  useEffect(() => {
    if (draggingKey) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [draggingKey, handleMouseMove, handleMouseUp]);

  // Precompute a smooth hill path
  const pathD = (() => {
    const pts: string[] = [];
    const steps = 50;
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * 100;
      const { svgX, svgY } = hillCoords(x);
      pts.push(`${svgX},${svgY}`);
    }
    return "M " + pts.join(" L ");
  })();

  return (
    <svg
      ref={svgRef}
      width="100%"
      height={HILL_HEIGHT}
      viewBox={`0 0 ${HILL_WIDTH} ${HILL_HEIGHT}`}
      style={{ border: "1px solid #ddd", borderRadius: 8, background: "#fafafa" }}
    >
      {/* Baseline */}
      <line
        x1={MARGIN_X}
        y1={HILL_HEIGHT - MARGIN_Y}
        x2={HILL_WIDTH - MARGIN_X}
        y2={HILL_HEIGHT - MARGIN_Y}
        stroke="#ccc"
        strokeWidth={2}
      />

      {/* Hill curve */}
      <path d={pathD} fill="none" stroke="#4b6fff" strokeWidth={4} />

      {/* Dots */}
      {epics.map((epic) => {
          const { svgX, svgY } = hillCoords(epic.x);
          const phase = computePhase(epic.x);
          const color =
            phase === "UPHILL"
              ? "#f97316"
              : phase === "CREST"
              ? "#eab308"
              : phase === "DOWNHILL"
              ? "#22c55e"
              : "#0ea5e9";

        const textLines = wrapText(epic.title, 18);
        const lineHeight = 14;
        const labelY = svgY - 20 - (textLines.length - 1) * (lineHeight / 2);

        return (
          <g
            key={epic.key}
            onMouseDown={() => setDraggingKey(epic.key)}
            style={{ cursor: "grab" }}
          >
            <circle cx={svgX} cy={svgY} r={10} fill={color} stroke="#1f2933" strokeWidth={1.5} />
            <text
              x={svgX}
              y={labelY}
              textAnchor="middle"
              fontSize={11}
              fill="#111827"
              fontWeight="500"
              style={{ pointerEvents: "none" }}
            >
              {textLines.map((line, index) => (
                <tspan
                  key={index}
                  x={svgX}
                  dy={index === 0 ? 0 : lineHeight}
                >
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
      </svg>
    );
  };

export default HillChart;