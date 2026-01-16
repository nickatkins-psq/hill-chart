import React, { useEffect, useState } from "react";
import HillChart, {
  type EpicDot,
  type HillPhase,
  computePhase,
} from "./HillChart";

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
  const [epics, setEpics] = useState<EpicDot[]>(() => loadInitialEpics());
  const [projectName, setProjectName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [hasPreviousDay, setHasPreviousDay] = useState(false);
  const [hasNextDay, setHasNextDay] = useState(false);
  // Store uploaded files in memory keyed by date string (YYYY-MM-DD)
  const [uploadedFiles, setUploadedFiles] = useState<Map<string, HillChartData>>(new Map());

  // Auto-load JSON data on mount
  useEffect(() => {
    loadHillChartData().then((data) => {
      if (data && data.scopes.length > 0) {
        const convertedEpics = convertScopesToEpics(data.scopes);
        setEpics(convertedEpics);
        setProjectName(data.project);
        // Try to parse date from generated field or filename
        if (data.generated) {
          const parsedDate = new Date(data.generated);
          if (!isNaN(parsedDate.getTime())) {
            setCurrentDate(parsedDate);
          }
        }
      }
    });
  }, []);

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
        setProjectName(data.project);
        setCurrentDate(date);
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      alert("Please upload a JSON file");
      return;
    }

    setIsLoading(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text) as HillChartData;

        // Validate the data structure
        if (!data.scopes || !Array.isArray(data.scopes) || data.scopes.length === 0) {
          alert("Invalid JSON format: 'scopes' array is required and must not be empty");
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
        setProjectName(data.project || null);
        
        if (parsedDate) {
          setCurrentDate(parsedDate);
        }

        alert(`Successfully imported ${data.scopes.length} scopes${data.project ? ` from ${data.project}` : ""}${parsedDate ? ` for ${formatDateForDisplay(parsedDate)}` : ""}`);
      } catch (error) {
        alert(`Error parsing JSON file: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsLoading(false);
        // Reset the input so the same file can be uploaded again
        event.target.value = "";
      }
    };

    reader.onerror = () => {
      alert("Error reading file");
      setIsLoading(false);
      event.target.value = "";
    };

    reader.readAsText(file);
  };

  return (
    <div
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        padding: 24,
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
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
            {projectName ? `${projectName} - Hill Chart` : "Team Hill Chart (local prototype)"}
            {currentDate && (
              <span style={{ fontSize: 16, fontWeight: "normal", color: "#6b7280", marginLeft: 8 }}>
                {formatDateForDisplay(currentDate)}
              </span>
            )}
          </h2>
        </div>
        <div>
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
              display: "inline-block",
            }}
          >
            {isLoading ? "Loading..." : "Upload JSON File"}
          </label>
        </div>
      </div>
      <p style={{ marginBottom: 16, color: "#4b5563" }}>
        Drag dots along the hill to reflect where each scope is. Positions are saved locally.
      </p>

      <HillChart epics={epics} onUpdateEpicX={handleUpdateEpicX} />

      <div style={{ marginTop: 24, display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ flex: 2 }}>
          <h3 style={{ marginBottom: 8 }}>Scopes on this hill</h3>
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
              marginBottom: 12,
            }}
          >
            + Add Epic
          </button>
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

        <div style={{ flex: 1 }}>
          <h3 style={{ marginBottom: 8 }}>How to use</h3>
          <ol style={{ fontSize: 13, color: "#4b5563", paddingLeft: 18 }}>
            <li>Click "Upload JSON File" to upload and load scopes from a JSON file.</li>
            <li>Drag dots along the hill to update their position.</li>
            <li>
              Positions are saved in your browser's localStorage, so they persist between sessions.
            </li>
            <li>Use "Add Epic" to manually add additional scopes.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default App;