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
const TITLE_HEIGHT = 40; // Space for title and date at bottom

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
    const DOT_RADIUS = 10;
    const MIN_SPACING = 8; // Minimum spacing between labels and dots
    
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
        needsConnector: false, // Will be set to true if label is moved away from dot
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
        needsConnector: false,
        isBelowDot: false, // Track if label is below the dot
        isAngled: false, // Track if label is positioned at an angle
        offsetX: 0, // Horizontal offset for angled labels
        offsetY: 0, // Vertical offset for angled labels
        isAtClosestPosition: false, // Track if label is at closest/default position
      };
    });

    // Helper function to check if two boxes overlap
    const boxesOverlap = (
      box1X: number, box1Y: number, box1Width: number, box1Height: number,
      box2X: number, box2Y: number, box2Width: number, box2Height: number
    ): boolean => {
      return (
        box1X + box1Width / 2 > box2X - box2Width / 2 &&
        box1X - box1Width / 2 < box2X + box2Width / 2 &&
        box1Y + box1Height > box2Y - MIN_SPACING &&
        box1Y < box2Y + box2Height + MIN_SPACING
      );
    };

    // Helper function to check if a box overlaps with a circle (dot)
    const boxOverlapsDot = (
      boxX: number, boxY: number, boxWidth: number, boxHeight: number,
      dotX: number, dotY: number, dotRadius: number
    ): boolean => {
      // Find the closest point on the box to the dot center
      const closestX = Math.max(boxX - boxWidth / 2, Math.min(dotX, boxX + boxWidth / 2));
      const closestY = Math.max(boxY, Math.min(dotY, boxY + boxHeight));
      
      // Calculate distance from dot center to closest point
      const dx = dotX - closestX;
      const dy = dotY - closestY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      return distance < dotRadius + MIN_SPACING;
    };

    // Define bounds for label placement
    const minY = MARGIN_Y + 5; // Top margin with small padding
    const maxY = HILL_HEIGHT - MARGIN_Y - TITLE_HEIGHT - 5; // Bottom margin (above title area)
    
    // Resolve overlaps by adjusting Y positions
    for (let i = 0; i < labelPositions.length; i++) {
      const current = labelPositions[i];
      let moved = false;
      
      // Calculate initial positions (above and below)
      const initialYAbove = current.svgY - 20 - (current.textLines.length - 1) * (current.lineHeight / 2);
      const initialBoxYAbove = initialYAbove - current.lineHeight + 2 - current.paddingY;
      
      // Position below dot: label starts below the dot
      const initialYBelow = current.svgY + 20 + (current.textLines.length - 1) * (current.lineHeight / 2);
      const initialBoxYBelow = initialYBelow - current.lineHeight + 2 - current.paddingY;
      
      // Helper function to check if label is within bounds
      const isWithinBounds = (boxY: number, boxHeight: number): boolean => {
        return boxY >= minY && (boxY + boxHeight) <= maxY;
      };
      
      // Helper function to check for overlaps
      const checkOverlaps = (boxY: number, boxX?: number): boolean => {
        const labelX = boxX !== undefined ? boxX : current.svgX;
        
        // Check bounds first
        if (!isWithinBounds(boxY, current.boxHeight)) {
          return true; // Out of bounds counts as overlap
        }
        
        // Check horizontal bounds for angled labels
        if (boxX !== undefined) {
          const boxLeft = labelX - current.boxWidth / 2;
          const boxRight = labelX + current.boxWidth / 2;
          if (boxLeft < MARGIN_X || boxRight > HILL_WIDTH - MARGIN_X) {
            return true; // Out of horizontal bounds
          }
        }
        
        // Check overlap with own dot first (most important - don't obscure own dot)
        if (boxOverlapsDot(
          labelX, boxY, current.boxWidth, current.boxHeight,
          current.svgX, current.svgY, DOT_RADIUS
        )) {
          return true;
        }
        
        // Check overlap with other labels that have already been positioned (j < i)
        for (let j = 0; j < i; j++) {
          const other = labelPositions[j];
          const otherX = other.isAngled ? (other.svgX + other.offsetX) : other.svgX;
          
          if (boxesOverlap(
            labelX, boxY, current.boxWidth, current.boxHeight,
            otherX, other.boxY, other.boxWidth, other.boxHeight
          )) {
            return true;
          }
        }
        
        // Check overlap with all other dots (excluding own dot)
        for (let j = 0; j < labelPositions.length; j++) {
          if (i === j) continue; // Skip own dot (already checked above)
          const other = labelPositions[j];
          
          // Check if current label overlaps with this dot
          if (boxOverlapsDot(
            labelX, boxY, current.boxWidth, current.boxHeight,
            other.svgX, other.svgY, DOT_RADIUS
          )) {
            return true;
          }
        }
        
        return false;
      };
      
      // Check nearby dots to determine preferred side
      // If nearby dots have labels above, prefer below (and vice versa)
      const NEARBY_THRESHOLD = 100; // Distance in pixels to consider dots "nearby"
      let nearbyAbove = 0;
      let nearbyBelow = 0;
      
      for (let j = 0; j < i; j++) {
        const other = labelPositions[j];
        const distance = Math.abs(current.svgX - other.svgX);
        
        if (distance < NEARBY_THRESHOLD) {
          if (other.isBelowDot) {
            nearbyBelow++;
          } else {
            nearbyAbove++;
          }
        }
      }
      
      // Determine preferred side based on nearby dots
      // If more nearby dots have labels above, prefer below (and vice versa)
      const preferBelow = nearbyAbove > nearbyBelow;
      
      // Helper function to try positioning a label on a specific side
      // Returns { success: boolean, moved: boolean } where moved indicates if label was moved from initial position
      const tryPosition = (isBelow: boolean): { success: boolean; moved: boolean } => {
        const initialY = isBelow ? initialYBelow : initialYAbove;
        const initialBoxY = isBelow ? initialBoxYBelow : initialBoxYAbove;
        
        current.labelY = initialY;
        current.boxY = initialBoxY;
        current.isBelowDot = isBelow;
        
        // Check if initial position is out of bounds
        if (!isWithinBounds(current.boxY, current.boxHeight)) {
          return { success: false, moved: false };
        }
        
        // Check if initial position is valid (no overlaps)
        if (!checkOverlaps(current.boxY)) {
          return { success: true, moved: false }; // At closest position
        }
        
        // Try moving away from dot to find a valid position
        let attempts = 0;
        const maxAttempts = 100;
        const stepSize = 5;
        const direction = isBelow ? 'down' : 'up';
        
        while (attempts < maxAttempts) {
          // Check if current position is valid
          if (!checkOverlaps(current.boxY)) {
            return { success: true, moved: true }; // Moved from initial position
          }
          
          // Move label away from dot
          const moveAmount = direction === 'up' ? -stepSize : stepSize;
          current.labelY += moveAmount;
          current.boxY += moveAmount;
          
          // Check bounds
          if (direction === 'up' && current.boxY < minY) {
            return { success: false, moved: true }; // Gone out of bounds
          }
          if (direction === 'down' && current.boxY + current.boxHeight > maxY) {
            return { success: false, moved: true }; // Gone out of bounds
          }
          
          attempts++;
        }
        
        return { success: false, moved: true }; // Couldn't find valid position
      };
      
      // Helper function to try angled positions
      const tryAngledPosition = (): boolean => {
        const angleOffsets = [
          { x: current.boxWidth / 2 + 15, y: -current.boxHeight / 2 - 10 }, // Top-right
          { x: -(current.boxWidth / 2 + 15), y: -current.boxHeight / 2 - 10 }, // Top-left
          { x: current.boxWidth / 2 + 15, y: current.boxHeight / 2 + 10 }, // Bottom-right
          { x: -(current.boxWidth / 2 + 15), y: current.boxHeight / 2 + 10 }, // Bottom-left
        ];
        
        for (const offset of angleOffsets) {
          const angledX = current.svgX + offset.x;
          const angledY = current.svgY + offset.y;
          const angledBoxY = angledY - current.lineHeight + 2 - current.paddingY;
          
          if (!checkOverlaps(angledBoxY, angledX)) {
            current.labelY = angledY;
            current.boxY = angledBoxY;
            current.isAngled = true;
            current.offsetX = offset.x;
            current.offsetY = offset.y;
            current.isBelowDot = offset.y > 0; // Below if positive Y offset
            return true;
          }
        }
        
        return false;
      };
      
      // Track if label was moved from closest position
      let wasMoved = false;
      
      // Try preferred side first (opposite of nearby dots)
      if (preferBelow) {
        const result = tryPosition(true);
        moved = result.success;
        wasMoved = result.moved;
        if (!moved) {
          const result2 = tryPosition(false); // Fallback to above
          moved = result2.success;
          wasMoved = wasMoved || result2.moved;
        }
      } else {
        const result = tryPosition(false);
        moved = result.success;
        wasMoved = result.moved;
        if (!moved) {
          const result2 = tryPosition(true); // Fallback to below
          moved = result2.success;
          wasMoved = wasMoved || result2.moved;
        }
      }
      
      // Last resort: try angled positions
      if (!moved) {
        moved = tryAngledPosition();
        if (moved) {
          wasMoved = true; // Angled labels are always moved
        }
      }
      
      // Ensure final position is within bounds (clamp if necessary)
      if (current.boxY < minY) {
        current.boxY = minY;
        current.labelY = minY + current.lineHeight - 2 + current.paddingY;
      }
      if (current.boxY + current.boxHeight > maxY) {
        current.boxY = maxY - current.boxHeight;
        current.labelY = current.boxY + current.lineHeight - 2 + current.paddingY;
      }
      
      // Check if label is at its closest/default position
      // Label is at closest position if it wasn't moved from initial position and is not angled
      current.isAtClosestPosition = !wasMoved && !current.isAngled;
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
      style={{ 
        border: `1px solid ${colors.chartBorder}`, 
        borderRadius: 8, 
        background: colors.chartBg,
        userSelect: "none",
        WebkitUserSelect: "none",
        MozUserSelect: "none",
        msUserSelect: "none"
      }}
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

      {/* Dots and Labels */}
      {epics.map((epic) => {
          const labelData = labelMap.get(epic.key);
          if (!labelData) return null;
          
          const { svgX, svgY, boxWidth, boxHeight, textLines, lineHeight, labelY, boxY, isBelowDot, isAngled, offsetX, isAtClosestPosition } = labelData;
          const phase = computePhase(epic.x);
          const color =
            phase === "UPHILL"
              ? "#f97316"
              : phase === "CREST"
              ? "#eab308"
              : phase === "DOWNHILL"
              ? "#22c55e"
              : "#0ea5e9";

        // Calculate label box X position (centered on dot, or offset for angled labels)
        const labelX = isAngled ? (svgX + offsetX) : svgX;
        const boxX = labelX - boxWidth / 2;
        
        // Calculate connector line endpoints
        let connectorStartX: number;
        let connectorStartY: number;
        let connectorEndX: number;
        let connectorEndY: number;
        
        if (isAngled) {
          // For angled labels, connect from dot center to label box center
          connectorStartX = svgX;
          connectorStartY = svgY;
          connectorEndX = labelX;
          connectorEndY = boxY + boxHeight / 2;
        } else {
          // For vertical labels, connect from top/bottom of dot to label box
          connectorStartX = svgX;
          connectorStartY = isBelowDot ? svgY + 10 : svgY - 10;
          connectorEndX = svgX;
          connectorEndY = isBelowDot ? boxY : boxY + boxHeight;
        }

        return (
          <g
            key={epic.key}
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent text selection while dragging
              setDraggingKey(epic.key);
            }}
            style={{ 
              cursor: draggingKey === epic.key ? "grabbing" : "grab",
              userSelect: "none",
              WebkitUserSelect: "none",
              MozUserSelect: "none",
              msUserSelect: "none"
            }}
          >
            <circle cx={svgX} cy={svgY} r={10} fill={color} stroke="#1f2933" strokeWidth={1.5} />
            
            {/* Connector line from dot to label (only if not at closest position) */}
            {!isAtClosestPosition && (
              <line
                x1={connectorStartX}
                y1={connectorStartY}
                x2={connectorEndX}
                y2={connectorEndY}
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray="3,3"
                opacity={0.5}
                style={{ pointerEvents: "none" }}
              />
            )}
            
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
              style={{ 
                pointerEvents: "auto",
                cursor: draggingKey === epic.key ? "grabbing" : "grab",
                userSelect: "none",
                WebkitUserSelect: "none",
                MozUserSelect: "none",
                msUserSelect: "none"
              }}
            />
            <text
              x={labelX}
              y={labelY}
              textAnchor="middle"
              fontSize={11}
              fill={colors.chartText}
              fontWeight="500"
              style={{ 
                pointerEvents: "auto",
                cursor: draggingKey === epic.key ? "grabbing" : "grab",
                userSelect: "none",
                WebkitUserSelect: "none",
                MozUserSelect: "none",
                msUserSelect: "none"
              }}
            >
              {textLines.map((line, index) => (
                <tspan
                  key={index}
                  x={labelX}
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
          y={HILL_HEIGHT - MARGIN_Y - TITLE_HEIGHT + 30}
          textAnchor="middle"
          fontSize={20}
          fill={colors.chartText}
          fontWeight="600"
          style={{ 
            pointerEvents: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
            MozUserSelect: "none",
            msUserSelect: "none"
          }}
        >
          {title}
        </text>
      )}
      
      {/* Date with timestamp - below title */}
      {date && (
        <text
          x={HILL_WIDTH / 2}
          y={HILL_HEIGHT - MARGIN_Y - TITLE_HEIGHT + 48}
          textAnchor="middle"
          fontSize={12}
          fill={colors.chartText}
          opacity={0.7}
          style={{ 
            pointerEvents: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
            MozUserSelect: "none",
            msUserSelect: "none"
          }}
        >
          {formatDateWithTime(date)}
        </text>
      )}
      </svg>
    );
  };

export default HillChart;