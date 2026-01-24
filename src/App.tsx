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
  saveProjectSnapshot,
  updateProjectSnapshot,
  deleteSnapshot,
  projectNameExists,
  type Project,
  type ProjectData,
  type ProjectSnapshotMeta,
} from "./services/firestoreService";
import { getThemeColors } from "./utils/themeColors";
import {
  formatDateForFilename,
  normalizeDate,
  parseSnapshotDate,
} from "./utils/dateUtils";
import {
  convertScopesToEpics,
  convertEpicsToScopes,
  DEFAULT_EPICS,
  getNextScopeNumber,
  type Scope,
} from "./utils/epicUtils";
import {
  getButtonStyles,
  getInputStyles,
  getNavButtonStyles,
} from "./utils/uiStyles";
import { useAuth } from "./contexts/AuthContext";

const STORAGE_KEY = "hillChartEpics_v1";
const SELECTED_PROJECT_KEY = "hillChartSelectedProject_v1";

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
  return DEFAULT_EPICS;
}

/**
 * Extract project slug from URL path
 * Supports formats: /project/{slug} or /{slug}
 */
function getProjectSlugFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const path = window.location.pathname;
  // Match /project/{slug} or /{slug} (but not just /)
  const match = path.match(/^\/(?:project\/)?([^\/]+)$/);
  return match ? match[1] : null;
}

/**
 * Update URL to reflect selected project
 */
function updateUrlForProject(projectId: string | null) {
  if (typeof window === "undefined") return;
  const newPath = projectId ? `/project/${projectId}` : "/";
  if (window.location.pathname !== newPath) {
    window.history.pushState({ projectId }, "", newPath);
  }
}

function loadSelectedProjectId(): string | null {
  // First, try to get from URL
  const urlSlug = getProjectSlugFromUrl();
  if (urlSlug) {
    return urlSlug;
  }
  
  // Fallback to localStorage for backward compatibility
  if (typeof window !== "undefined") {
    try {
      const projectId = window.localStorage.getItem(SELECTED_PROJECT_KEY);
      return projectId || null;
    } catch {
      // ignore parse errors
    }
  }
  return null;
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
  const colors = getThemeColors(false); // Always use light mode
  const { user, logout } = useAuth();
  const [profileImageError, setProfileImageError] = useState(false);
  
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => loadSelectedProjectId());
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
  // Track which epic field is being edited (format: "key-{epicKey}" or "title-{epicKey}")
  const [editingField, setEditingField] = useState<string | null>(null);
  // Store temporary edit values
  const [editValue, setEditValue] = useState<string>("");
  // Store original value when editing starts (for cancel/revert)
  const [originalEditValue, setOriginalEditValue] = useState<string>("");
  // Track newly added scopes (to remove them if Escape is pressed)
  const [newlyAddedScopes, setNewlyAddedScopes] = useState<Set<string>>(new Set());
  // Store original epic positions for reset functionality
  const [originalEpics, setOriginalEpics] = useState<EpicDot[]>(() => loadInitialEpics());
  // Track if project title is being edited
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState("");

  // Reset profile image error when user changes
  useEffect(() => {
    setProfileImageError(false);
  }, [user?.uid]);

  // Sync URL when project is loaded from localStorage on initial mount
  useEffect(() => {
    const urlSlug = getProjectSlugFromUrl();
    // If we have a project ID but URL doesn't match, update URL
    if (selectedProjectId && urlSlug !== selectedProjectId) {
      updateUrlForProject(selectedProjectId);
    }
  }, []); // Only run on mount

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const urlSlug = getProjectSlugFromUrl();
      if (urlSlug !== selectedProjectId) {
        setSelectedProjectId(urlSlug);
        // Update localStorage for backward compatibility
        if (typeof window !== "undefined") {
          try {
            if (urlSlug) {
              window.localStorage.setItem(SELECTED_PROJECT_KEY, urlSlug);
            } else {
              window.localStorage.removeItem(SELECTED_PROJECT_KEY);
            }
          } catch {
            // ignore write errors
          }
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [selectedProjectId]);

  // Helper function to set project data state
  const setProjectDataState = (
    epics: EpicDot[],
    projectName: string | null,
    date: Date | null
  ) => {
    setEpics(epics);
    setOriginalEpics(epics);
    setProjectName(projectName);
    setCurrentDate(date);
    setIsModified(false);
  };

  // Load project data from Firestore when project is selected
  useEffect(() => {
    if (!selectedProjectId) {
      // If no project selected, try to load from local file (backward compatibility)
      loadHillChartData().then((data) => {
        if (data && data.scopes.length > 0) {
          const convertedEpics = convertScopesToEpics(data.scopes);
          setEpics(convertedEpics);
          setOriginalEpics(convertedEpics);
          setProjectName(data.project);
          // Try to parse date from generated field or filename
          if (data.generated) {
            const parsedDate = new Date(data.generated);
            if (!isNaN(parsedDate.getTime())) {
              setCurrentDate(parsedDate);
            } else {
              setCurrentDate(null);
            }
          } else {
            setCurrentDate(null);
          }
        } else {
          setCurrentDate(null);
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
            const date = parseSnapshotDate(snapshot.id, snapshotData.generated);
            setProjectDataState(
              convertedEpics,
              snapshotData.project || currentProjectName || null,
              date
            );
          } else {
            setProjectDataState([], currentProjectName || null, null);
          }
          setHasPreviousDay(lastIndex > 0);
          setHasNextDay(lastIndex < snapshots.length - 1);
        } else {
          // Fallback to root project data if no snapshots exist
          const data = await getProjectData(selectedProjectId);
          if (data && data.scopes && data.scopes.length > 0) {
            const convertedEpics = convertScopesToEpics(data.scopes);
            const date = data.generated ? new Date(data.generated) : null;
            if (date && isNaN(date.getTime())) {
              setProjectDataState(convertedEpics, data.project, null);
            } else {
              setProjectDataState(convertedEpics, data.project, date);
            }
          } else {
            setProjectDataState([], currentProjectName || null, null);
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
        setProjectDataState(convertedEpics, data.project, date);
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
        const date = parseSnapshotDate(snapshot.id, snapshotData.generated);
        setProjectDataState(
          convertedEpics,
          snapshotData.project || selectedProjectName || projectName || null,
          date
        );
      }
      setCurrentSnapshotIndex(index);
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

  const handleReset = () => {
    if (originalEpics.length === 0) return;
    setEpics([...originalEpics]);
    setIsModified(false);
    setToast({
      message: "Chart positions reset to original state",
      type: 'info',
    });
  };



  const handleRemoveEpic = async (key: string) => {
    if (!window.confirm(`Remove ${key} from this hill?`)) return;
    setEpics((prev) => {
      const updated = prev.filter((e) => e.key !== key);
      // Auto-save if editing an existing snapshot
      if (selectedProjectId && currentSnapshotIndex !== null) {
        setIsModified(true);
        autoSaveTableEdits(updated);
      }
      return updated;
    });
    setNewlyAddedScopes((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const handleAddScope = async () => {
    const newScopeNumber = getNextScopeNumber(epics);
    const newKey = `SCOPE-${newScopeNumber}`;
    const newEpic: EpicDot = {
      key: newKey,
      title: "New scope",
      x: 10, // Default to uphill position
    };
    setEpics((prev) => [...prev, newEpic]);
    setIsModified(true);
    // Track this as a newly added scope
    setNewlyAddedScopes((prev) => new Set(prev).add(newKey));
    // Start editing the title immediately
    setEditingField(`title-${newKey}`);
    setEditValue("New scope");
    // Auto-save if editing an existing snapshot (will save after user edits the title)
    // Don't save immediately since the title is just a placeholder
  };

  const handleStartEdit = (field: "key" | "title", epicKey: string, currentValue: string) => {
    setEditingField(`${field}-${epicKey}`);
    setEditValue(currentValue);
    setOriginalEditValue(currentValue); // Store original value for cancel
    // Mark as modified when starting to edit (if editing an existing snapshot)
    if (selectedProjectId && currentSnapshotIndex !== null) {
      setIsModified(true);
    }
  };

  const handleSaveEdit = (field: "key" | "title", epicKey: string) => {
    const trimmedValue = editValue.trim();
    if (!trimmedValue) {
      // If it's a newly added scope with empty value, remove it
      if (newlyAddedScopes.has(epicKey)) {
        setEpics((prev) => prev.filter((e) => e.key !== epicKey));
        setNewlyAddedScopes((prev) => {
          const next = new Set(prev);
          next.delete(epicKey);
          return next;
        });
        setIsModified(false); // Reset modification flag if removing newly added scope
      }
      setEditingField(null);
      setEditValue("");
      return;
    }

    // Get the original value to check if it changed
    const epic = epics.find((e) => e.key === epicKey);
    const originalValue = field === "key" ? epic?.key : epic?.title;
    const hasChanged = originalValue !== trimmedValue;

    if (field === "key") {
      // Check if key already exists (and it's not the same epic)
      const keyExists = epics.some((e) => e.key === trimmedValue && e.key !== epicKey);
      if (keyExists) {
        setToast({
          message: `Key "${trimmedValue}" already exists. Please use a unique key.`,
          type: "error",
        });
        return;
      }
      setEpics((prev) =>
        prev.map((e) => (e.key === epicKey ? { ...e, key: trimmedValue } : e))
      );
      // Update newlyAddedScopes if key changed
      if (newlyAddedScopes.has(epicKey)) {
        setNewlyAddedScopes((prev) => {
          const next = new Set(prev);
          next.delete(epicKey);
          next.add(trimmedValue);
          return next;
        });
      }
    } else {
      setEpics((prev) => {
        const updated = prev.map((e) => (e.key === epicKey ? { ...e, title: trimmedValue } : e));
        // Auto-save if editing an existing snapshot
        if (hasChanged && selectedProjectId && currentSnapshotIndex !== null) {
          setIsModified(true);
          autoSaveTableEdits(updated);
        }
        return updated;
      });
    }
    // Remove from newlyAddedScopes once saved (scope is no longer "new")
    setNewlyAddedScopes((prev) => {
      const next = new Set(prev);
      next.delete(epicKey);
      return next;
    });
    // Only set modified if the value actually changed (for key field)
    if (field === "key" && hasChanged) {
      setIsModified(true);
      // Auto-save if editing an existing snapshot
      if (selectedProjectId && currentSnapshotIndex !== null) {
        // Get updated epics for key change
        const updatedEpics = epics.map((e) => (e.key === epicKey ? { ...e, key: trimmedValue } : e));
        autoSaveTableEdits(updatedEpics);
      }
    }
    setEditingField(null);
    setEditValue("");
  };

  const handleCancelEdit = (epicKey?: string) => {
    // If Escape is pressed on a newly added scope, remove it
    if (epicKey && newlyAddedScopes.has(epicKey)) {
      setEpics((prev) => prev.filter((e) => e.key !== epicKey));
      setNewlyAddedScopes((prev) => {
        const next = new Set(prev);
        next.delete(epicKey);
        return next;
      });
      setIsModified(false); // Reset modification flag if removing newly added scope
    } else if (epicKey && editingField) {
      // If canceling an edit to an existing scope, revert to original value
      const field = editingField.startsWith("key-") ? "key" : "title";
      const epic = epics.find((e) => e.key === epicKey);
      if (epic && originalEditValue !== editValue) {
        // Only revert if the value actually changed
        if (field === "key") {
          setEpics((prev) =>
            prev.map((e) => (e.key === epicKey ? { ...e, key: originalEditValue } : e))
          );
        } else {
          setEpics((prev) =>
            prev.map((e) => (e.key === epicKey ? { ...e, title: originalEditValue } : e))
          );
        }
        // Check if we need to reset isModified (if no other changes exist)
        const hasOtherChanges = epics.some((e) => {
          if (e.key === epicKey) return false;
          const orig = originalEpics.find((orig) => orig.key === e.key);
          return !orig || orig.x !== e.x || orig.title !== e.title || orig.key !== e.key;
        });
        if (!hasOtherChanges) {
          setIsModified(false);
        }
      }
    }
    setEditingField(null);
    setEditValue("");
    setOriginalEditValue("");
  };

  const handleKeyPress = (e: React.KeyboardEvent, field: "key" | "title", epicKey: string) => {
    if (e.key === "Enter") {
      handleSaveEdit(field, epicKey);
    } else if (e.key === "Escape") {
      handleCancelEdit(epicKey);
    }
  };

  const handleProjectSelect = (projectId: string | null) => {
    setSelectedProjectId(projectId);
    // Update URL
    updateUrlForProject(projectId);
    // Save selected project to localStorage for backward compatibility
    if (typeof window !== "undefined") {
      try {
        if (projectId) {
          window.localStorage.setItem(SELECTED_PROJECT_KEY, projectId);
        } else {
          window.localStorage.removeItem(SELECTED_PROJECT_KEY);
        }
      } catch {
        // ignore write errors
      }
    }
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
    setProjectName(project.name);
    // Update URL
    updateUrlForProject(project.id);
    // Save selected project to localStorage for backward compatibility
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(SELECTED_PROJECT_KEY, project.id);
      } catch {
        // ignore write errors
      }
    }
  };

  const handleClear = () => {
    // Clear localStorage
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem(SELECTED_PROJECT_KEY);
      } catch {
        // ignore errors
      }
    }
    
    // Reset all state to fresh state
    setSelectedProjectId(null);
    setSelectedProjectName(null);
    setEpics(DEFAULT_EPICS);
    setOriginalEpics(DEFAULT_EPICS);
    setProjectName(null);
    setCurrentDate(null);
    setHasPreviousDay(false);
    setHasNextDay(false);
    setProjectSnapshots([]);
    setCurrentSnapshotIndex(null);
    setIsModified(false);
    setEditingField(null);
    setEditValue("");
    setNewlyAddedScopes(new Set());
    // Update URL to root
    updateUrlForProject(null);
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

      // Save as a snapshot with timestamp
      const snapshotId = await saveProjectSnapshot(selectedProjectId, projectData);
      const snapshotDate = parseSnapshotDate(snapshotId) || new Date();
      
      // Reload snapshots to include the new one
      const updatedSnapshots = await getProjectSnapshots(selectedProjectId);
      setProjectSnapshots(updatedSnapshots);
      const newSnapshotIndex = updatedSnapshots.findIndex(s => s.id === snapshotId);
      setCurrentSnapshotIndex(newSnapshotIndex >= 0 ? newSnapshotIndex : updatedSnapshots.length - 1);
      
      setProjectName(projectData.project);
      setCurrentDate(snapshotDate);
      setOriginalEpics(epics); // Update original positions after saving
      setIsModified(false); // Reset modification flag after saving
      setHasPreviousDay(updatedSnapshots.length > 1);
      setHasNextDay(false); // New snapshot is always the latest
      setToast({
        message: "Snapshot saved successfully.",
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

  const autoSaveTableEdits = async (epicsToSave?: EpicDot[]) => {
    // Only auto-save if editing an existing snapshot
    if (!selectedProjectId || currentSnapshotIndex === null || !projectSnapshots[currentSnapshotIndex]) {
      return;
    }

    // Use provided epics or current state
    const epicsToUse = epicsToSave || epics;

    if (epicsToUse.length === 0) {
      return; // Don't save empty state
    }

    // Don't show loading state for auto-save to avoid UI flicker
    try {
      const snapshot = projectSnapshots[currentSnapshotIndex];
      const scopes = convertEpicsToScopes(epicsToUse, selectedProjectName || projectName || "Untitled Project");
      const projectData: ProjectData = {
        project: selectedProjectName || projectName || "Untitled Project",
        generated: snapshot.generated || new Date().toISOString(),
        task_completion: {
          completed: epicsToUse.filter((e) => e.x >= 80).length,
          total: epicsToUse.length,
          percentage: epicsToUse.length > 0 
            ? (epicsToUse.filter((e) => e.x >= 80).length / epicsToUse.length) * 100 
            : 0,
        },
        scopes,
      };

      // Update the existing snapshot
      await updateProjectSnapshot(selectedProjectId, snapshot.id, projectData);
      
      setOriginalEpics(epicsToUse); // Update original positions after saving
      setIsModified(false); // Reset modification flag after saving
    } catch (error) {
      console.error("Error auto-saving table edits:", error);
      setToast({
        message: "Failed to save changes. Please try again.",
        type: 'error',
      });
    }
  };

  const handleDeleteSnapshot = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!selectedProjectId || currentSnapshotIndex === null || !projectSnapshots[currentSnapshotIndex]) {
      console.warn("Cannot delete: missing project ID or snapshot index");
      return;
    }

    const snapshot = projectSnapshots[currentSnapshotIndex];
    const confirmed = window.confirm("Are you sure you want to delete this snapshot?");
    if (!confirmed) {
      console.log("Delete cancelled by user");
      return;
    }
    
    console.log("Deleting snapshot:", snapshot.id);

    setIsLoading(true);
    try {
      await deleteSnapshot(selectedProjectId, snapshot.id);
      
      // Reload snapshots
      const updatedSnapshots = await getProjectSnapshots(selectedProjectId);
      setProjectSnapshots(updatedSnapshots);
      
      if (updatedSnapshots.length === 0) {
        // No snapshots left, load root project data or show empty state
        const data = await getProjectData(selectedProjectId);
        if (data && data.scopes && data.scopes.length > 0) {
          const convertedEpics = convertScopesToEpics(data.scopes);
          const date = data.generated ? new Date(data.generated) : null;
          if (date && isNaN(date.getTime())) {
            setProjectDataState(convertedEpics, data.project, null);
          } else {
            setProjectDataState(convertedEpics, data.project, date);
          }
        } else {
          setProjectDataState([], selectedProjectName || null, null);
        }
        setCurrentSnapshotIndex(null);
        setHasPreviousDay(false);
        setHasNextDay(false);
      } else {
        // Load the last snapshot (or the one before the deleted one)
        const newIndex = Math.min(currentSnapshotIndex, updatedSnapshots.length - 1);
        await loadSnapshotByIndex(newIndex);
      }
      
      setToast({
        message: "Snapshot deleted successfully.",
        type: 'success',
      });
    } catch (error) {
      console.error("Error deleting snapshot:", error);
      setToast({
        message: "Failed to delete snapshot. Please try again.",
        type: 'error',
      });
    } finally {
      setIsLoading(false);
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
      {/* Header with logo, title, and user info */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img 
            src="https://img.icons8.com/?size=96&id=3IgibUo37hPA&format=png" 
            alt="ParentSquare Logo" 
            style={{ height: 32, width: 32 }}
          />
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, color: colors.textPrimary }}>
             ParentSquare Hill Charts
          </h1>
        </div>
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {user.photoURL && !profileImageError ? (
              <img
                src={user.photoURL}
                alt={user.displayName || "User"}
                onError={() => {
                  setProfileImageError(true);
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: `1px solid ${colors.borderSecondary}`,
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: `1px solid ${colors.borderSecondary}`,
                  backgroundColor: colors.bgSecondary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 500,
                  color: colors.textSecondary,
                }}
              >
                {(user.displayName || user.email || "U")[0].toUpperCase()}
              </div>
            )}
            <span style={{ fontSize: 14, color: colors.textSecondary }}>
              {user.displayName || user.email}
            </span>
            <button
              type="button"
              onClick={logout}
              style={{
                padding: "6px 12px",
                borderRadius: 4,
                border: `1px solid ${colors.borderSecondary}`,
                background: colors.buttonBg,
                color: colors.textSecondary,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
      
      <ProjectSelector
        selectedProjectId={selectedProjectId}
        onProjectSelect={handleProjectSelect}
        onProjectCreated={handleProjectCreated}
        onClear={handleClear}
        isModified={isModified}
        onSaveBeforeClear={selectedProjectId ? handleSaveToFirestore : undefined}
      />
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              onClick={handlePreviousDay}
              disabled={!hasPreviousDay || isLoading}
              style={getNavButtonStyles(colors, hasPreviousDay && !isLoading)}
            >
              ←
            </button>
            <button
              type="button"
              onClick={handleNextDay}
              disabled={!hasNextDay || isLoading}
              style={getNavButtonStyles(colors, hasNextDay && !isLoading)}
            >
              →
            </button>
          </div>
          {isEditingTitle && selectedProjectId ? (
            <input
              type="text"
              value={editingTitleValue}
              onChange={(e) => setEditingTitleValue(e.target.value)}
              onBlur={async () => {
                const trimmedName = editingTitleValue.trim();
                if (trimmedName) {
                  // Check if name already exists (excluding current project)
                  const nameExists = await projectNameExists(trimmedName, selectedProjectId);
                  if (nameExists) {
                    setToast({
                      message: `A project named "${trimmedName}" already exists. Please choose a different name.`,
                      type: 'error',
                    });
                    setIsEditingTitle(false);
                    return;
                  }
                  setProjectName(trimmedName);
                  setSelectedProjectName(trimmedName);
                  setIsModified(true);
                }
                setIsEditingTitle(false);
              }}
              onKeyDown={async (e) => {
                if (e.key === "Enter") {
                  const trimmedName = editingTitleValue.trim();
                  if (trimmedName) {
                    // Check if name already exists (excluding current project)
                    const nameExists = await projectNameExists(trimmedName, selectedProjectId);
                    if (nameExists) {
                      setToast({
                        message: `A project named "${trimmedName}" already exists. Please choose a different name.`,
                        type: 'error',
                      });
                      setIsEditingTitle(false);
                      return;
                    }
                    setProjectName(trimmedName);
                    setSelectedProjectName(trimmedName);
                    setIsModified(true);
                  }
                  setIsEditingTitle(false);
                } else if (e.key === "Escape") {
                  setIsEditingTitle(false);
                }
              }}
              autoFocus
              style={{
                margin: 0,
                padding: "4px 8px",
                fontSize: "1.5em",
                fontWeight: "bold",
                color: colors.textPrimary,
                background: colors.inputBg,
                border: `1px solid ${colors.inputBorder}`,
                borderRadius: 4,
                outline: "none",
                minWidth: 150,
              }}
            />
          ) : (
            <h2
              style={{
                margin: 0,
                color: colors.textPrimary,
                cursor: selectedProjectId ? "pointer" : "default",
              }}
              onClick={() => {
                if (selectedProjectId) {
                  setEditingTitleValue(projectName || "New Project");
                  setIsEditingTitle(true);
                }
              }}
              title={selectedProjectId ? "Click to edit title" : undefined}
            >
              {selectedProjectId && projectName ? projectName : "New Project"}
            </h2>
          )}
        </div>
        {selectedProjectId && currentSnapshotIndex !== null && !isModified && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={handleDeleteSnapshot}
              disabled={isLoading}
              style={getButtonStyles(colors, {
                variant: "danger",
                disabled: isLoading,
                height: "32px",
              })}
            >
              <span>Delete snapshot</span>
            </button>
          </div>
        )}
        {isModified && selectedProjectId && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={handleReset}
              disabled={isLoading || originalEpics.length === 0}
              style={getButtonStyles(colors, {
                variant: "danger",
                disabled: isLoading || originalEpics.length === 0,
                height: "32px",
              })}
            >
              <span>↺</span>
              <span>Reset</span>
            </button>
            <button
              key="save-button"
              type="button"
              onClick={handleSaveToFirestore}
              disabled={isSaving || isLoading}
              style={getButtonStyles(colors, {
                variant: "info",
                disabled: isSaving || isLoading,
                height: "32px",
              })}
            >
              <span>☁</span>
              <span>{isSaving ? "Saving..." : "Save New Snapshot"}</span>
            </button>
          </div>
        )}
      </div>

      <div style={{ backgroundColor: colors.bgPrimary }}>
        <HillChart 
          epics={epics} 
          onUpdateEpicX={handleUpdateEpicX}
          title={selectedProjectId && projectName ? projectName : "New Project"}
          date={currentDate}
        />
      </div>

      <div style={{ marginTop: 24, display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ flex: 2 }}>
          <h3 style={{ marginBottom: 8, color: colors.textPrimary }}>Scopes on this hill</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleAddScope}
              disabled={isLoading}
              style={getButtonStyles(colors, {
                variant: "info",
                disabled: isLoading,
              })}
            >
              <span>+</span>
              <span>Add Scope</span>
            </button>
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
                const isEditingKey = editingField === `key-${e.key}`;
                const isEditingTitle = editingField === `title-${e.key}`;
                return (
                  <tr key={e.key}>
                    <td
                      style={{
                        padding: 4,
                        color: colors.textPrimary,
                        cursor: "pointer",
                      }}
                      onClick={() => !isEditingKey && handleStartEdit("key", e.key, e.key)}
                      onDoubleClick={() => handleStartEdit("key", e.key, e.key)}
                    >
                      {isEditingKey ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(evt) => {
                            setEditValue(evt.target.value);
                            // Mark as modified as soon as value changes
                            if (selectedProjectId && currentSnapshotIndex !== null) {
                              setIsModified(true);
                            }
                          }}
                          onBlur={() => {
                            // Only save if not empty, otherwise handleCancelEdit will remove newly added scopes
                            if (editValue.trim()) {
                              handleSaveEdit("key", e.key);
                            } else {
                              handleCancelEdit(e.key);
                            }
                          }}
                          onKeyDown={(evt) => handleKeyPress(evt, "key", e.key)}
                          autoFocus
                          style={getInputStyles(colors)}
                        />
                      ) : (
                        <span style={{ textDecoration: "underline", textDecorationStyle: "dotted" }}>
                          {e.key}
                        </span>
                      )}
                    </td>
                    <td
                      style={{
                        padding: 4,
                        color: colors.textPrimary,
                        cursor: "pointer",
                      }}
                      onClick={() => !isEditingTitle && handleStartEdit("title", e.key, e.title)}
                      onDoubleClick={() => handleStartEdit("title", e.key, e.title)}
                    >
                      {isEditingTitle ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(evt) => {
                            setEditValue(evt.target.value);
                            // Mark as modified as soon as value changes
                            if (selectedProjectId && currentSnapshotIndex !== null) {
                              setIsModified(true);
                            }
                          }}
                          onBlur={() => {
                            // Only save if not empty, otherwise handleCancelEdit will remove newly added scopes
                            if (editValue.trim()) {
                              handleSaveEdit("title", e.key);
                            } else {
                              handleCancelEdit(e.key);
                            }
                          }}
                          onKeyDown={(evt) => handleKeyPress(evt, "title", e.key)}
                          autoFocus
                          style={getInputStyles(colors)}
                        />
                      ) : (
                        <span style={{ textDecoration: "underline", textDecorationStyle: "dotted" }}>
                          {e.title}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 4, color: colors.textPrimary }}>{e.x.toFixed(0)}%</td>
                    <td style={{ padding: 4, color: colors.textPrimary }}>{phaseLabel(phase)}</td>
                    <td style={{ padding: 4 }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveEpic(e.key)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: colors.errorText,
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
                    No scopes yet. Click "Add Scope" to create one.
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