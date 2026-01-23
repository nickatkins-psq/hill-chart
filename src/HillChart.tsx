import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "./hooks/useTheme";
import { getThemeColors } from "./utils/themeColors";

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
  const { theme } = useTheme();
  const colors = getThemeColors(theme === 'dark');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!draggingKey || !svgRef.current) return;

      // Convert screen coordinates to SVG coordinates to handle scaling
      const svg = svgRef.current;
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      
      const svgPoint = point.matrixTransform(ctm.inverse());
      
      const hillWidth = HILL_WIDTH - 2 * MARGIN_X;
      let t = (svgPoint.x - MARGIN_X) / hillWidth;
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
      style={{ border: `1px solid ${colors.chartBorder}`, borderRadius: 8, background: colors.chartBg }}
    >
      {/* Baseline */}
      <line
        x1={MARGIN_X}
        y1={HILL_HEIGHT - MARGIN_Y}
        x2={HILL_WIDTH - MARGIN_X}
        y2={HILL_HEIGHT - MARGIN_Y}
        stroke={colors.chartBaseline}
        strokeWidth={2}
      />

      {/* Hill curve */}
      <path d={pathD} fill="none" stroke={colors.chartLine} strokeWidth={4} />

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
        
        // Calculate background box dimensions
        const longestLine = textLines.reduce((a, b) => a.length > b.length ? a : b, "");
        const estimatedCharWidth = 6.5; // Approximate width per character at 11px font
        const textWidth = longestLine.length * estimatedCharWidth;
        const textHeight = textLines.length * lineHeight;
        const paddingX = 6;
        const paddingY = 4;
        const boxWidth = textWidth + paddingX * 2;
        const boxHeight = textHeight + paddingY * 2;
        const boxX = svgX - boxWidth / 2;
        const boxY = labelY - lineHeight + 2 - paddingY; // Adjust for text baseline

        return (
          <g
            key={epic.key}
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent text selection while dragging
              setDraggingKey(epic.key);
            }}
            style={{ cursor: draggingKey === epic.key ? "grabbing" : "grab" }}
          >
            <circle cx={svgX} cy={svgY} r={10} fill={color} stroke={theme === 'dark' ? '#f9fafb' : '#1f2933'} strokeWidth={1.5} />
            {/* Semi-opaque background for text */}
            <rect
              x={boxX}
              y={boxY}
              width={boxWidth}
              height={boxHeight}
              rx={4}
              ry={4}
              fill={theme === 'dark' ? 'rgba(17, 24, 39, 0.85)' : 'rgba(255, 255, 255, 0.9)'}
              stroke={theme === 'dark' ? 'rgba(75, 85, 99, 0.5)' : 'rgba(209, 213, 219, 0.7)'}
              strokeWidth={1}
              style={{ pointerEvents: "none" }}
            />
            <text
              x={svgX}
              y={labelY}
              textAnchor="middle"
              fontSize={11}
              fill={colors.chartText}
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