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
  saveProjectData,
  type Project,
  type ProjectData,
} from "./services/firestoreService";

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

function parseDateFromFilename(filename: string): Date | null {
  // Try to extract date from filename pattern: hillchart-YYYY-MM-DD.json
  const match = filename.match(/hillchart-(\d{4})-(\d{2})-(\d{2})\.json/i);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // Month is 0-indexed
    const day = parseInt(match[3], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
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
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null);
  const [epics, setEpics] = useState<EpicDot[]>(() => loadInitialEpics());
  const [projectName, setProjectName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [hasPreviousDay, setHasPreviousDay] = useState(false);
  const [hasNextDay, setHasNextDay] = useState(false);
  // Store uploaded files in memory keyed by date string (YYYY-MM-DD)
  const [uploadedFiles, setUploadedFiles] = useState<Map<string, HillChartData>>(new Map());
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

    // Load from Firestore
    setIsLoading(true);
    const currentProjectName = selectedProjectName;
    getProjectData(selectedProjectId)
      .then((data) => {
        if (data && data.scopes && data.scopes.length > 0) {
          const convertedEpics = convertScopesToEpics(data.scopes);
          setEpics(convertedEpics);
          setOriginalEpics(convertedEpics); // Store original positions
          setProjectName(data.project);
          if (data.generated) {
            const parsedDate = new Date(data.generated);
            if (!isNaN(parsedDate.getTime())) {
              setCurrentDate(parsedDate);
            }
          }
        } else {
          // New project - start with empty epics
          setEpics([]);
          setOriginalEpics([]);
          setProjectName(currentProjectName || null);
          setCurrentDate(null);
        }
        setIsModified(false); // Reset modification flag when loading data
      })
      .catch((error) => {
        console.error("Error loading project data:", error);
        alert("Failed to load project data. Please try again.");
      })
      .finally(() => {
        setIsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  // Check for previous/next day files when date changes
  useEffect(() => {
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
  }, [currentDate, uploadedFiles]);

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

  const handlePreviousDay = () => {
    if (!currentDate || !hasPreviousDay) return;
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - 1);
    loadDataForDate(prevDate);
  };

  const handleNextDay = () => {
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

  const handleAddEpic = () => {
    const key = window.prompt("Enter Jira Epic key (e.g. PROJ-123):");
    if (!key) return;
    const title = window.prompt("Short title for this Epic (for you):") || key;
    setEpics((prev) => [...prev, { key: key.trim(), title: title.trim(), x: 5 }]);
  };

  const handleRemoveEpic = (key: string) => {
    if (!window.confirm(`Remove ${key} from this hill?`)) return;
    setEpics((prev) => prev.filter((e) => e.key !== key));
  };

  const handleProjectSelect = (projectId: string | null) => {
    setSelectedProjectId(projectId);
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      setToast({
        message: "Please upload a JSON file",
        type: 'error',
      });
      return;
    }

    setIsLoading(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text) as HillChartData;

        // Validate the data structure
        if (!data.scopes || !Array.isArray(data.scopes) || data.scopes.length === 0) {
          setToast({
            message: "Invalid JSON format: 'scopes' array is required and must not be empty",
            type: 'error',
          });
          setIsLoading(false);
          return;
        }

        // Try to extract date from filename first, then from generated field
        let parsedDate: Date | null = parseDateFromFilename(file.name);
        if (!parsedDate && data.generated) {
          parsedDate = new Date(data.generated);
          if (isNaN(parsedDate.getTime())) {
            parsedDate = null;
          }
        }

        // Store the uploaded file data in memory
        if (parsedDate) {
          const dateStr = normalizeDate(parsedDate);
          setUploadedFiles((prev) => {
            const newMap = new Map(prev);
            newMap.set(dateStr, data);
            return newMap;
          });
        }

        const convertedEpics = convertScopesToEpics(data.scopes);
        setEpics(convertedEpics);
        setOriginalEpics(convertedEpics); // Store original positions
        setProjectName(data.project || null);
        
        if (parsedDate) {
          setCurrentDate(parsedDate);
        }

        // Auto-save to Firestore if project is selected
        if (selectedProjectId) {
          try {
            const scopes = convertEpicsToScopes(convertedEpics, data.project || selectedProjectName || "Untitled Project");
            const projectData: ProjectData = {
              project: data.project || selectedProjectName || "Untitled Project",
              generated: new Date().toISOString(),
              task_completion: {
                completed: convertedEpics.filter((e) => e.x >= 80).length,
                total: convertedEpics.length,
                percentage: convertedEpics.length > 0 
                  ? (convertedEpics.filter((e) => e.x >= 80).length / convertedEpics.length) * 100 
                  : 0,
              },
              scopes,
            };
            await saveProjectData(selectedProjectId, projectData);
            setProjectName(projectData.project);
            setCurrentDate(new Date());
            setOriginalEpics(convertedEpics); // Update original positions after auto-saving
            setIsModified(false); // Reset modification flag after auto-saving
            setToast({
              message: `Imported and saved ${data.scopes.length} scopes${data.project ? ` from ${data.project}` : ""}${parsedDate ? ` for ${formatDateForDisplay(parsedDate)}` : ""}`,
              type: 'success',
            });
          } catch (error) {
            console.error("Error auto-saving project data:", error);
            setToast({
              message: `Imported ${data.scopes.length} scopes${data.project ? ` from ${data.project}` : ""}${parsedDate ? ` for ${formatDateForDisplay(parsedDate)}` : ""} (save failed)`,
              type: 'success',
            });
          }
        } else {
          // Show toast notification (no auto-save if no project selected)
          setToast({
            message: `Imported ${data.scopes.length} scopes${data.project ? ` from ${data.project}` : ""}${parsedDate ? ` for ${formatDateForDisplay(parsedDate)}` : ""}`,
            type: 'success',
          });
        }
      } catch (error) {
        setToast({
          message: `Error parsing JSON file: ${error instanceof Error ? error.message : String(error)}`,
          type: 'error',
        });
      } finally {
        setIsLoading(false);
        // Reset the input so the same file can be uploaded again
        event.target.value = "";
      }
    };

    reader.onerror = () => {
      setToast({
        message: "Error reading file",
        type: 'error',
      });
      setIsLoading(false);
      event.target.value = "";
    };

    reader.readAsText(file);
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
        }}
      >
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
                border: "1px solid #9ca3af",
                background: hasPreviousDay && !isLoading ? "#ffffff" : "#d1d5db",
                color: hasPreviousDay && !isLoading ? "#374151" : "#6b7280",
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
                border: "1px solid #9ca3af",
                background: hasNextDay && !isLoading ? "#ffffff" : "#d1d5db",
                color: hasNextDay && !isLoading ? "#374151" : "#6b7280",
                fontSize: 13,
                cursor: hasNextDay && !isLoading ? "pointer" : "not-allowed",
                fontWeight: "bold",
                opacity: hasNextDay && !isLoading ? 1 : 0.6,
              }}
            >
              →
            </button>
          </div>
          <h2 style={{ margin: 0 }}>
            {selectedProjectId && projectName ? `${projectName} - Hill Chart` : "Team Hill Chart (local prototype)"}
            {currentDate && (
              <span style={{ fontSize: 16, fontWeight: "normal", color: "#6b7280", marginLeft: 8 }}>
                {formatDateForDisplay(currentDate)}
              </span>
            )}
          </h2>
        </div>
        <div />
      </div>
      <p style={{ marginBottom: 16, color: "#4b5563" }}>
        Drag dots along the hill to reflect where each scope is. 
        {selectedProjectId 
          ? " Click 'Save to Firestore' to save your changes." 
          : " Positions are saved locally. Select a project to save to Firestore."}
      </p>

      <HillChart epics={epics} onUpdateEpicX={handleUpdateEpicX} />

      <div style={{ marginTop: 24, display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ flex: 2 }}>
          <h3 style={{ marginBottom: 8 }}>Scopes on this hill</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleAddEpic}
              style={{
                padding: "6px 12px",
                borderRadius: 4,
                border: "1px solid #4b6fff",
                background: "#4b6fff",
                color: "white",
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>➕</span>
              <span>Add Epic</span>
            </button>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              disabled={isLoading}
              id="json-file-input"
              style={{ display: "none" }}
            />
            <label
              htmlFor="json-file-input"
              style={{
                padding: "6px 12px",
                borderRadius: 4,
                border: "1px solid #4b6fff",
                background: "#4b6fff",
                color: "white",
                fontSize: 13,
                cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.6 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>⬆</span>
              <span>{isLoading ? "Loading..." : "Upload JSON"}</span>
            </label>
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
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 4 }}>
                  Key
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 4 }}>
                  Title
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 4 }}>
                  Position
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: 4 }}>
                  Phase
                </th>
                <th style={{ borderBottom: "1px solid #e5e7eb" }} />
              </tr>
            </thead>
            <tbody>
              {epics.map((e) => {
                const phase = computePhase(e.x);
                return (
                  <tr key={e.key}>
                    <td style={{ padding: 4 }}>{e.key}</td>
                    <td style={{ padding: 4 }}>{e.title}</td>
                    <td style={{ padding: 4 }}>{e.x.toFixed(0)}%</td>
                    <td style={{ padding: 4 }}>{phaseLabel(phase)}</td>
                    <td style={{ padding: 4 }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveEpic(e.key)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "#b91c1c",
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
                  <td colSpan={5} style={{ padding: 8, color: "#6b7280" }}>
                    No scopes yet. Use "Add Epic" or import JSON data.
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