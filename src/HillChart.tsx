import React, { useCallback, useEffect, useRef, useState } from "react";
import { getThemeColors } from "./utils/themeColors";
import { formatDateWithTime } from "./utils/dateUtils";

   export type HillPhase = "UPHILL" | "CREST" | "DOWNHILL" | "DONE";

   export interface EpicDot {
     key: string; // e.g. "PROJ-123"
     title: string;
     x: number; // 0–100, position along the hill
   }

interface HillChartProps {
  epics: EpicDot[];
  onUpdateEpicX: (key: string, x: number) => void;
  title?: string | null;
  date?: Date | null;
}

const HILL_WIDTH = 800;
const HILL_HEIGHT = 400;
const MARGIN_X = 40;
const MARGIN_Y = 40;
const TITLE_HEIGHT = 60; // Space for title and date at bottom

// Simple "hill" function: x in [0, 100] => y in [0, 1]
function hillY01(x: number): number {
  const t = x / 100;
  return 4 * t * (1 - t); // 0 at ends, 1 at crest
}

// Given x in [0, 100], return SVG coords
function hillCoords(x: number) {
  const t = x / 100;
  const hillHeight = HILL_HEIGHT - 2 * MARGIN_Y - TITLE_HEIGHT;
  const hillWidth = HILL_WIDTH - 2 * MARGIN_X;
  const hillTopY = MARGIN_Y;

  const y01 = hillY01(x);
  const svgX = MARGIN_X + hillWidth * t;
  const svgY = hillTopY + hillHeight - hillHeight * y01; // invert y, accounting for title space at bottom
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

const HillChart: React.FC<HillChartProps> = ({ epics, onUpdateEpicX, title, date }) => {
  const colors = getThemeColors(false); // Always use light mode
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

  // Calculate label positions with collision avoidance
  const calculateLabelPositions = () => {
    const labelData = epics.map((epic) => {
      const { svgX, svgY } = hillCoords(epic.x);
      const textLines = wrapText(epic.title, 18);
      const lineHeight = 14;
      const longestLine = textLines.reduce((a, b) => a.length > b.length ? a : b, "");
      const estimatedCharWidth = 6.5;
      const textWidth = longestLine.length * estimatedCharWidth;
      const textHeight = textLines.length * lineHeight;
      const paddingX = 6;
      const paddingY = 4;
      const boxWidth = textWidth + paddingX * 2;
      const boxHeight = textHeight + paddingY * 2;
      
      return {
        epic,
        svgX,
        svgY,
        boxWidth,
        boxHeight,
        textLines,
        lineHeight,
        paddingX,
        paddingY,
      };
    });

    // Sort by x position to process left to right
    const sorted = [...labelData].sort((a, b) => a.svgX - b.svgX);
    
    // Calculate initial Y positions (above dots)
    const labelPositions = sorted.map((data) => {
      const baseY = data.svgY - 20 - (data.textLines.length - 1) * (data.lineHeight / 2);
      return {
        ...data,
        labelY: baseY,
        boxY: baseY - data.lineHeight + 2 - data.paddingY,
      };
    });

    // Resolve overlaps by adjusting Y positions
    const minSpacing = 8; // Minimum spacing between labels
    for (let i = 0; i < labelPositions.length; i++) {
      const current = labelPositions[i];
      
      // Check for overlaps with previous labels
      for (let j = 0; j < i; j++) {
        const previous = labelPositions[j];
        
        // Check if labels overlap horizontally
        const horizontalOverlap = 
          current.svgX + current.boxWidth / 2 > previous.svgX - previous.boxWidth / 2 &&
          current.svgX - current.boxWidth / 2 < previous.svgX + previous.boxWidth / 2;
        
        if (horizontalOverlap) {
          // Check if labels overlap vertically
          const currentTop = current.boxY;
          const currentBottom = current.boxY + current.boxHeight;
          const previousTop = previous.boxY;
          const previousBottom = previous.boxY + previous.boxHeight;
          
          const verticalOverlap = 
            currentBottom > previousTop - minSpacing &&
            currentTop < previousBottom + minSpacing;
          
          if (verticalOverlap) {
            // Move current label up or down to avoid overlap
            const overlapAmount = (previousBottom + minSpacing) - currentTop;
            if (overlapAmount > 0) {
              // Move current label down
              current.labelY += overlapAmount;
              current.boxY += overlapAmount;
            } else {
              // Try moving current label up
              const moveUpAmount = (currentBottom + minSpacing) - previousTop;
              if (moveUpAmount < 0) {
                current.labelY += moveUpAmount;
                current.boxY += moveUpAmount;
              }
            }
          }
        }
      }
    }

    return labelPositions;
  };

  const labelPositions = calculateLabelPositions();
  // Create a map for quick lookup by epic key
  const labelMap = new Map(labelPositions.map(lp => [lp.epic.key, lp]));

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
        y1={HILL_HEIGHT - MARGIN_Y - TITLE_HEIGHT}
        x2={HILL_WIDTH - MARGIN_X}
        y2={HILL_HEIGHT - MARGIN_Y - TITLE_HEIGHT}
        stroke={colors.chartBaseline}
        strokeWidth={2}
      />

      {/* Hill curve */}
      <path d={pathD} fill="none" stroke={colors.chartLine} strokeWidth={4} />

      {/* Dots */}
      {epics.map((epic) => {
          const labelData = labelMap.get(epic.key);
          if (!labelData) return null;
          
          const { svgX, svgY, boxWidth, boxHeight, textLines, lineHeight, labelY, boxY } = labelData;
          const phase = computePhase(epic.x);
          const color =
            phase === "UPHILL"
              ? "#f97316"
              : phase === "CREST"
              ? "#eab308"
              : phase === "DOWNHILL"
              ? "#22c55e"
              : "#0ea5e9";

        const boxX = svgX - boxWidth / 2;

        return (
          <g
            key={epic.key}
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent text selection while dragging
              setDraggingKey(epic.key);
            }}
            style={{ cursor: draggingKey === epic.key ? "grabbing" : "grab" }}
          >
            <circle cx={svgX} cy={svgY} r={10} fill={color} stroke="#1f2933" strokeWidth={1.5} />
            {/* Semi-opaque background for text */}
            <rect
              x={boxX}
              y={boxY}
              width={boxWidth}
              height={boxHeight}
              rx={4}
              ry={4}
              fill="rgba(255, 255, 255, 0.9)"
              stroke="rgba(209, 213, 219, 0.7)"
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
      
      {/* Title - below baseline */}
      {title && (
        <text
          x={HILL_WIDTH / 2}
          y={HILL_HEIGHT - MARGIN_Y - TITLE_HEIGHT + 25}
          textAnchor="middle"
          fontSize={20}
          fill={colors.chartText}
          fontWeight="600"
          style={{ pointerEvents: "none" }}
        >
          {title}
        </text>
      )}
      
      {/* Date with timestamp - below title */}
      {date && (
        <text
          x={HILL_WIDTH / 2}
          y={HILL_HEIGHT - MARGIN_Y - TITLE_HEIGHT + 45}
          textAnchor="middle"
          fontSize={12}
          fill={colors.chartText}
          opacity={0.7}
          style={{ pointerEvents: "none" }}
        >
          {formatDateWithTime(date)}
        </text>
      )}
      </svg>
    );
  };

export default HillChart;