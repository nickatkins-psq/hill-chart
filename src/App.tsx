import React, { useEffect, useState } from "react";
import HillChart, {
  type EpicDot,
  type HillPhase,
  computePhase,
} from "./HillChart";
import ProjectSelector from "./components/ProjectSelector";
import Toast from "./components/Toast";
import {
  getProjectData,
  getProjectSnapshotData,
  getProjectSnapshots,
  saveProjectData,
  type Project,
  type ProjectData,
  type ProjectSnapshotMeta,
} from "./services/firestoreService";
import { useTheme } from "./hooks/useTheme";
import { getThemeColors } from "./utils/themeColors";

const STORAGE_KEY = "hillChartEpics_v1";

interface Scope {
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

interface HillChartData {
  project: string;
  generated: string;
  task_completion: {
    completed: number;
    total: number;
    percentage: number;
  };
  scopes: Scope[];
}

function convertScopesToEpics(scopes: Scope[]): EpicDot[] {
  return scopes.map((scope) => ({
    key: `SCOPE-${scope.id}`,
    title: scope.name,
    x: scope.progress,
  }));
}

function convertEpicsToScopes(epics: EpicDot[], _projectName: string): Scope[] {
  return epics.map((epic, index) => {
    // Extract ID from key (e.g., "SCOPE-1" -> 1) or use index
    const idMatch = epic.key.match(/SCOPE-(\d+)/);
    const id = idMatch ? parseInt(idMatch[1], 10) : index + 1;
    
    return {
      id,
      name: epic.title,
      progress: epic.x,
      direction: computePhase(epic.x) === "UPHILL" ? "uphill" : 
                 computePhase(epic.x) === "CREST" ? "crest" :
                 computePhase(epic.x) === "DOWNHILL" ? "downhill" : "done",
      status: epic.x >= 80 ? "done" : "in_progress",
    };
  });
}

function formatDateForFilename(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateForDisplay(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function parseSnapshotIdToDate(snapshotId: string): Date | null {
  // Expected format: YYYY-MM-DD-HHMMSSZ (e.g., 2026-01-16-175406Z)
  const match = snapshotId.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})Z$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  const hours = parseInt(match[4], 10);
  const minutes = parseInt(match[5], 10);
  const seconds = parseInt(match[6], 10);
  const date = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  return isNaN(date.getTime()) ? null : date;
}

function normalizeDate(date: Date): string {
  // Return a normalized string for date comparison (YYYY-MM-DD)
  return formatDateForFilename(date);
}

async function loadHillChartData(date?: Date): Promise<HillChartData | null> {
  try {
    const filename = date ? `hillchart-${formatDateForFilename(date)}.json` : "hillchart-data.json";
    const response = await fetch(`/${filename}`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function checkFileExists(date: Date): Promise<boolean> {
  try {
    const filename = `hillchart-${formatDateForFilename(date)}.json`;
    const response = await fetch(`/${filename}`, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

function loadInitialEpics(): EpicDot[] {
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as EpicDot[];
      }
    } catch {
      // ignore parse errors
    }
  }

  // Seed with a few example Epics – replace with your real Jira keys/titles
  return [
    { key: "MOB-101", title: "Mobile onboarding revamp", x: 10 },
    { key: "WEB-202", title: "Teacher messaging improvements", x: 35 },
    { key: "INFRA-303", title: "Notifications reliability", x: 65 },
  ];
}

function phaseLabel(phase: HillPhase): string {
  switch (phase) {
    case "UPHILL":
      return "Uphill – still figuring it out";
    case "CREST":
      return "Crest – approach is clear";
    case "DOWNHILL":
      return "Downhill – executing";
    case "DONE":
      return "Done / rollout";
  }
}

const App: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const colors = getThemeColors(theme === 'dark');
  
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null);
  const [epics, setEpics] = useState<EpicDot[]>(() => loadInitialEpics());
  const [projectName, setProjectName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [hasPreviousDay, setHasPreviousDay] = useState(false);
  const [hasNextDay, setHasNextDay] = useState(false);
  const [projectSnapshots, setProjectSnapshots] = useState<ProjectSnapshotMeta[]>([]);
  const [currentSnapshotIndex, setCurrentSnapshotIndex] = useState<number | null>(null);
  // Store uploaded files in memory keyed by date string (YYYY-MM-DD)
  const [uploadedFiles] = useState<Map<string, HillChartData>>(new Map());
  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  // Track if chart has been modified by dragging
  const [isModified, setIsModified] = useState(false);
  // Store original epics positions for restore functionality
  const [originalEpics, setOriginalEpics] = useState<EpicDot[]>(() => loadInitialEpics());

  // Load project data from Firestore when project is selected
  useEffect(() => {
    if (!selectedProjectId) {
      // If no project selected, try to load from local file (backward compatibility)
      loadHillChartData().then((data) => {
        if (data && data.scopes.length > 0) {
          const convertedEpics = convertScopesToEpics(data.scopes);
          setEpics(convertedEpics);
          setOriginalEpics(convertedEpics); // Store original positions
          setProjectName(data.project);
          // Try to parse date from generated field or filename
          if (data.generated) {
            const parsedDate = new Date(data.generated);
            if (!isNaN(parsedDate.getTime())) {
              setCurrentDate(parsedDate);
            }
          }
        }
        setIsModified(false); // Reset modification flag when loading data
      });
      return;
    }

    // Load from Firestore (snapshots)
    setIsLoading(true);
    const currentProjectName = selectedProjectName;
    const loadSnapshots = async () => {
      try {
        const snapshots = await getProjectSnapshots(selectedProjectId);
        setProjectSnapshots(snapshots);
        if (snapshots.length > 0) {
          const lastIndex = snapshots.length - 1;
          const snapshot = snapshots[lastIndex];
          setCurrentSnapshotIndex(lastIndex);
          const snapshotData = await getProjectSnapshotData(selectedProjectId, snapshot.id);
          if (snapshotData && snapshotData.scopes && snapshotData.scopes.length > 0) {
            const convertedEpics = convertScopesToEpics(snapshotData.scopes);
            setEpics(convertedEpics);
            setOriginalEpics(convertedEpics);
            setProjectName(snapshotData.project || currentProjectName || null);
            const parsedSnapshotDate =
              parseSnapshotIdToDate(snapshot.id) ||
              (snapshotData.generated ? new Date(snapshotData.generated) : null);
            if (parsedSnapshotDate && !isNaN(parsedSnapshotDate.getTime())) {
              setCurrentDate(parsedSnapshotDate);
            } else {
              setCurrentDate(null);
            }
          } else {
            setEpics([]);
            setOriginalEpics([]);
            setProjectName(currentProjectName || null);
            setCurrentDate(null);
          }
          setHasPreviousDay(lastIndex > 0);
          setHasNextDay(lastIndex < snapshots.length - 1);
        } else {
          // Fallback to root project data if no snapshots exist
          const data = await getProjectData(selectedProjectId);
          if (data && data.scopes && data.scopes.length > 0) {
            const convertedEpics = convertScopesToEpics(data.scopes);
            setEpics(convertedEpics);
            setOriginalEpics(convertedEpics);
            setProjectName(data.project);
            if (data.generated) {
              const parsedDate = new Date(data.generated);
              if (!isNaN(parsedDate.getTime())) {
                setCurrentDate(parsedDate);
              }
            }
          } else {
            setEpics([]);
            setOriginalEpics([]);
            setProjectName(currentProjectName || null);
            setCurrentDate(null);
          }
          setHasPreviousDay(false);
          setHasNextDay(false);
          setCurrentSnapshotIndex(null);
        }
        setIsModified(false);
      } catch (error) {
        console.error("Error loading project snapshots:", error);
        alert("Failed to load project data. Please check Firestore permissions.");
      } finally {
        setIsLoading(false);
      }
    };

    loadSnapshots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  // Check for previous/next day files when date changes
  useEffect(() => {
    if (selectedProjectId && projectSnapshots.length > 0 && currentSnapshotIndex !== null) {
      setHasPreviousDay(currentSnapshotIndex > 0);
      setHasNextDay(currentSnapshotIndex < projectSnapshots.length - 1);
      return;
    }

    if (!currentDate) {
      setHasPreviousDay(false);
      setHasNextDay(false);
      return;
    }

    const checkNavigation = async () => {
      const prevDate = new Date(currentDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const prevDateStr = normalizeDate(prevDate);
      const nextDateStr = normalizeDate(nextDate);

      // Check both uploaded files and server files
      const hasPrevUploaded = uploadedFiles.has(prevDateStr);
      const hasNextUploaded = uploadedFiles.has(nextDateStr);

      const [hasPrevServer, hasNextServer] = await Promise.all([
        checkFileExists(prevDate),
        checkFileExists(nextDate),
      ]);

      setHasPreviousDay(hasPrevUploaded || hasPrevServer);
      setHasNextDay(hasNextUploaded || hasNextServer);
    };

    checkNavigation();
  }, [currentDate, uploadedFiles, selectedProjectId, projectSnapshots, currentSnapshotIndex]);

  const loadDataForDate = async (date: Date) => {
    setIsLoading(true);
    try {
      const dateStr = normalizeDate(date);
      
      // First check uploaded files
      let data: HillChartData | null = uploadedFiles.get(dateStr) || null;
      
      // If not found in uploaded files, try loading from server
      if (!data) {
        data = await loadHillChartData(date);
      }

      if (data && data.scopes.length > 0) {
        const convertedEpics = convertScopesToEpics(data.scopes);
        setEpics(convertedEpics);
        setOriginalEpics(convertedEpics); // Store original positions
        setProjectName(data.project);
        setCurrentDate(date);
        setIsModified(false); // Reset modification flag when loading data
      }
      // If no data found, silently fail - buttons will be disabled
    } catch (error) {
      // Silently fail - buttons will be disabled
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSnapshotByIndex = async (index: number) => {
    if (!selectedProjectId || !projectSnapshots[index]) return;
    const snapshot = projectSnapshots[index];
    setIsLoading(true);
    try {
      const snapshotData = await getProjectSnapshotData(selectedProjectId, snapshot.id);
      if (snapshotData && snapshotData.scopes && snapshotData.scopes.length > 0) {
        const convertedEpics = convertScopesToEpics(snapshotData.scopes);
        setEpics(convertedEpics);
        setOriginalEpics(convertedEpics);
        setProjectName(snapshotData.project || selectedProjectName || projectName || null);
        const parsedSnapshotDate =
          parseSnapshotIdToDate(snapshot.id) ||
          (snapshotData.generated ? new Date(snapshotData.generated) : null);
        if (parsedSnapshotDate && !isNaN(parsedSnapshotDate.getTime())) {
          setCurrentDate(parsedSnapshotDate);
        }
      }
      setCurrentSnapshotIndex(index);
      setIsModified(false);
    } catch (error) {
      console.error("Error loading snapshot data:", error);
      setToast({
        message: "Failed to load snapshot data. Please check Firestore permissions.",
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreviousDay = () => {
    if (selectedProjectId && projectSnapshots.length > 0 && currentSnapshotIndex !== null) {
      if (!hasPreviousDay) return;
      loadSnapshotByIndex(currentSnapshotIndex - 1);
      return;
    }
    if (!currentDate || !hasPreviousDay) return;
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - 1);
    loadDataForDate(prevDate);
  };

  const handleNextDay = () => {
    if (selectedProjectId && projectSnapshots.length > 0 && currentSnapshotIndex !== null) {
      if (!hasNextDay) return;
      loadSnapshotByIndex(currentSnapshotIndex + 1);
      return;
    }
    if (!currentDate || !hasNextDay) return;
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);
    loadDataForDate(nextDate);
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(epics));
    } catch {
      // ignore write errors
    }
  }, [epics]);

  const handleUpdateEpicX = (key: string, x: number) => {
    setEpics((prev) => prev.map((e) => (e.key === key ? { ...e, x } : e)));
    setIsModified(true); // Mark as modified when dragging
  };

  const handleRestore = () => {
    if (originalEpics.length === 0) return;
    setEpics([...originalEpics]); // Restore to original positions
    setIsModified(false); // Reset modification flag
    setToast({
      message: "Positions restored to original state",
      type: 'info',
    });
  };


  const handleRemoveEpic = (key: string) => {
    if (!window.confirm(`Remove ${key} from this hill?`)) return;
    setEpics((prev) => prev.filter((e) => e.key !== key));
  };

  const handleProjectSelect = (projectId: string | null) => {
    setSelectedProjectId(projectId);
    if (!projectId) {
      setProjectSnapshots([]);
      setCurrentSnapshotIndex(null);
      setHasPreviousDay(false);
      setHasNextDay(false);
    }
  };

  const handleProjectCreated = (project: Project) => {
    setSelectedProjectName(project.name);
    setSelectedProjectId(project.id);
  };

  const handleSaveToFirestore = async () => {
    if (!selectedProjectId) {
      setToast({
        message: "Please select a project first",
        type: 'error',
      });
      return;
    }

    if (epics.length === 0) {
      setToast({
        message: "No scopes to save. Add at least one scope before saving.",
        type: 'error',
      });
      return;
    }

    setIsSaving(true);
    try {
      const scopes = convertEpicsToScopes(epics, selectedProjectName || projectName || "Untitled Project");
      const projectData: ProjectData = {
        project: selectedProjectName || projectName || "Untitled Project",
        generated: new Date().toISOString(),
        task_completion: {
          completed: epics.filter((e) => e.x >= 80).length,
          total: epics.length,
          percentage: epics.length > 0 
            ? (epics.filter((e) => e.x >= 80).length / epics.length) * 100 
            : 0,
        },
        scopes,
      };

      await saveProjectData(selectedProjectId, projectData);
      setProjectName(projectData.project);
      setCurrentDate(new Date());
      setOriginalEpics(epics); // Update original positions after saving
      setIsModified(false); // Reset modification flag after saving
      setToast({
        message: "Project data saved successfully!",
        type: 'success',
      });
    } catch (error) {
      console.error("Error saving project data:", error);
      setToast({
        message: "Failed to save project data. Please try again.",
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
          padding: 24,
          maxWidth: 1100,
          margin: "0 auto",
          backgroundColor: colors.bgPrimary,
          color: colors.textPrimary,
        }}
      >
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button
          type="button"
          onClick={toggleTheme}
          style={{
            padding: "6px 12px",
            borderRadius: 4,
            border: `1px solid ${colors.borderSecondary}`,
            background: colors.buttonBg,
            color: colors.buttonText,
            fontSize: 13,
            cursor: "pointer",
          }}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
      <ProjectSelector
        selectedProjectId={selectedProjectId}
        onProjectSelect={handleProjectSelect}
        onProjectCreated={handleProjectCreated}
      />
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              onClick={handlePreviousDay}
              disabled={!hasPreviousDay || isLoading}
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                border: `1px solid ${colors.borderTertiary}`,
                background: hasPreviousDay && !isLoading ? colors.buttonBg : colors.buttonBgDisabled,
                color: hasPreviousDay && !isLoading ? colors.buttonText : colors.buttonTextDisabled,
                fontSize: 13,
                cursor: hasPreviousDay && !isLoading ? "pointer" : "not-allowed",
                fontWeight: "bold",
                opacity: hasPreviousDay && !isLoading ? 1 : 0.6,
              }}
            >
              ←
            </button>
            <button
              type="button"
              onClick={handleNextDay}
              disabled={!hasNextDay || isLoading}
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                border: `1px solid ${colors.borderTertiary}`,
                background: hasNextDay && !isLoading ? colors.buttonBg : colors.buttonBgDisabled,
                color: hasNextDay && !isLoading ? colors.buttonText : colors.buttonTextDisabled,
                fontSize: 13,
                cursor: hasNextDay && !isLoading ? "pointer" : "not-allowed",
                fontWeight: "bold",
                opacity: hasNextDay && !isLoading ? 1 : 0.6,
              }}
            >
              →
            </button>
          </div>
          <h2 style={{ margin: 0, color: colors.textPrimary }}>
            {selectedProjectId && projectName ? `${projectName} - Hill Chart` : "Team Hill Chart (local prototype)"}
            {currentDate && (
              <span style={{ fontSize: 16, fontWeight: "normal", color: colors.textSecondary, marginLeft: 8 }}>
                {formatDateForDisplay(currentDate)}
              </span>
            )}
          </h2>
        </div>
        <div />
      </div>
      <p style={{ marginBottom: 16, color: colors.textSecondary }}>
        Drag dots along the hill to reflect where each scope is. 
        {selectedProjectId 
          ? " Click 'Save to Firestore' to save your changes." 
          : " Positions are saved locally. Select a project to save to Firestore."}
      </p>

      <div style={{ backgroundColor: colors.bgPrimary }}>
        <HillChart epics={epics} onUpdateEpicX={handleUpdateEpicX} />
      </div>

      <div style={{ marginTop: 24, display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ flex: 2 }}>
          <h3 style={{ marginBottom: 8, color: colors.textPrimary }}>Scopes on this hill</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {isModified && (
              <>
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={isLoading || originalEpics.length === 0}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 4,
                    border: "1px solid #f59e0b",
                    background: "#f59e0b",
                    color: "white",
                    fontSize: 13,
                    cursor: isLoading || originalEpics.length === 0 ? "not-allowed" : "pointer",
                    opacity: isLoading || originalEpics.length === 0 ? 0.6 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>↺</span>
                  <span>Restore</span>
                </button>
                {selectedProjectId && (
                  <button
                    key="save-button"
                    type="button"
                    onClick={handleSaveToFirestore}
                    disabled={isSaving || isLoading}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 4,
                      border: "1px solid #22c55e",
                      background: "#22c55e",
                      color: "white",
                      fontSize: 13,
                      cursor: isSaving || isLoading ? "not-allowed" : "pointer",
                      opacity: isSaving || isLoading ? 0.6 : 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span>⌄</span>
                    <span>{isSaving ? "Saving..." : "Save to Firestore"}</span>
                  </button>
                )}
              </>
            )}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: `1px solid ${colors.borderPrimary}`, padding: 4, color: colors.textPrimary, fontWeight: 600 }}>
                  Key
                </th>
                <th style={{ textAlign: "left", borderBottom: `1px solid ${colors.borderPrimary}`, padding: 4, color: colors.textPrimary, fontWeight: 600 }}>
                  Title
                </th>
                <th style={{ textAlign: "left", borderBottom: `1px solid ${colors.borderPrimary}`, padding: 4, color: colors.textPrimary, fontWeight: 600 }}>
                  Position
                </th>
                <th style={{ textAlign: "left", borderBottom: `1px solid ${colors.borderPrimary}`, padding: 4, color: colors.textPrimary, fontWeight: 600 }}>
                  Phase
                </th>
                <th style={{ borderBottom: `1px solid ${colors.borderPrimary}` }} />
              </tr>
            </thead>
            <tbody>
              {epics.map((e) => {
                const phase = computePhase(e.x);
                return (
                  <tr key={e.key}>
                    <td style={{ padding: 4, color: colors.textPrimary }}>{e.key}</td>
                    <td style={{ padding: 4, color: colors.textPrimary }}>{e.title}</td>
                    <td style={{ padding: 4, color: colors.textPrimary }}>{e.x.toFixed(0)}%</td>
                    <td style={{ padding: 4, color: colors.textPrimary }}>{phaseLabel(phase)}</td>
                    <td style={{ padding: 4 }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveEpic(e.key)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#ef4444",
                          cursor: "pointer",
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
              {epics.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 8, color: colors.textSecondary }}>
                    No scopes yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </>
  );
};

export default App;