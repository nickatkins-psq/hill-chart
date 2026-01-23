import type { EpicDot } from "../HillChart";
import { computePhase } from "../HillChart";

export interface Scope {
  id: number;
  name: string;
  progress: number;
  direction: string;
  status: string;
  completed?: string[];
  gaps?: string[];
  blockers?: string[];
  next_steps?: string[];
}

/**
 * Default epic data used throughout the application
 */
export const DEFAULT_EPICS: EpicDot[] = [
  { key: "SCOPE-101", title: "Mobile onboarding revamp", x: 10 },
  { key: "SCOPE-102", title: "Teacher messaging improvements", x: 35 },
  { key: "SCOPE-103", title: "Notifications reliability", x: 65 },
];

/**
 * Convert scopes to epics
 */
export function convertScopesToEpics(scopes: Scope[]): EpicDot[] {
  return scopes.map((scope) => ({
    key: `SCOPE-${scope.id}`,
    title: scope.name,
    x: scope.progress,
  }));
}

/**
 * Convert epics to scopes
 */
export function convertEpicsToScopes(
  epics: EpicDot[],
  _projectName: string
): Scope[] {
  return epics.map((epic, index) => {
    // Extract ID from key (e.g., "SCOPE-1" -> 1) or use index
    const idMatch = epic.key.match(/SCOPE-(\d+)/);
    const id = idMatch ? parseInt(idMatch[1], 10) : index + 1;

    const phase = computePhase(epic.x);
    return {
      id,
      name: epic.title,
      progress: epic.x,
      direction: phase === "UPHILL" ? "uphill" : 
                 phase === "CREST" ? "crest" :
                 phase === "DOWNHILL" ? "downhill" : "done",
      status: epic.x >= 80 ? "done" : "in_progress",
    };
  });
}

/**
 * Find the next available scope number
 */
export function getNextScopeNumber(epics: EpicDot[]): number {
  let maxScopeNumber = 0;
  epics.forEach((epic) => {
    const match = epic.key.match(/^SCOPE-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxScopeNumber) {
        maxScopeNumber = num;
      }
    }
  });
  return maxScopeNumber + 1;
}
