import React, { useEffect, useState, useRef } from 'react';
import { getProjects, createProject, testFirestoreAccess, testSnapshotDiscovery, type Project } from '../services/firestoreService';
import { getThemeColors } from '../utils/themeColors';
import { getButtonStyles } from '../utils/uiStyles';
import { useAuth } from '../contexts/AuthContext';

interface ProjectSelectorProps {
  selectedProjectId: string | null;
  onProjectSelect: (projectId: string | null) => void;
  onProjectCreated: (project: Project) => void;
  onClear: () => void;
  isModified?: boolean;
  onSaveBeforeClear?: () => Promise<void>;
  onProjectListChange?: () => void;
  reloadTrigger?: number;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  selectedProjectId,
  onProjectSelect,
  onProjectCreated,
  onClear,
  isModified = false,
  onSaveBeforeClear,
  onProjectListChange,
  reloadTrigger,
}) => {
  const colors = getThemeColors(false); // Always use light mode
  const { user } = useAuth();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProjects();
    // Also run diagnostic test
    testFirestoreAccess();
    testSnapshotDiscovery();
  }, []);

  // Reload projects when reloadTrigger changes
  useEffect(() => {
    if (reloadTrigger !== undefined && reloadTrigger > 0) {
      loadProjects();
    }
  }, [reloadTrigger]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isDropdownOpen]);

  const loadProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const projectList = await getProjects();
      setProjects(projectList);
      if (projectList.length === 0) {
        setError('No projects found. Create a new project to get started.');
      }
      // Notify parent that project list changed
      if (onProjectListChange) {
        onProjectListChange();
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Failed to load projects: ${errorMessage}. Check your Firebase configuration and Firestore security rules.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async () => {
    setIsCreating(true);
    try {
      const ownerId = user?.uid || null;
      const newProject = await createProject('New Project', ownerId);
      setProjects((prev) => [newProject, ...prev]);
      onProjectCreated(newProject);
      onProjectSelect(newProject.id);
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{ marginBottom: 24, color: colors.textPrimary }}>
      {error && !isLoading && (
        <div style={{
          padding: '12px',
          marginBottom: 12,
          backgroundColor: colors.errorBg,
          border: `1px solid ${colors.errorBorder}`,
          borderRadius: 4,
          color: colors.errorText,
          fontSize: 13,
        }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }} ref={dropdownRef}>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              disabled={isLoading || !!error}
              style={{
                padding: '6px 12px',
                borderRadius: 4,
                border: `1px solid ${colors.selectBorder}`,
                fontSize: 14,
                minWidth: 200,
                backgroundColor: isLoading || error ? colors.bgTertiary : colors.selectBg,
                cursor: isLoading || error ? 'not-allowed' : 'pointer',
                color: colors.selectTextPlaceholder,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <span>{isLoading ? 'Loading...' : 'Select a project'}</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {isDropdownOpen && !isLoading && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 4,
                  minWidth: 200,
                  backgroundColor: colors.selectBg,
                  border: `1px solid ${colors.selectBorder}`,
                  borderRadius: 4,
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  zIndex: 1000,
                  maxHeight: 300,
                  overflowY: 'auto',
                }}
              >
                {projects.length === 0 ? (
                  <div style={{ padding: '12px', color: colors.textSecondary, fontSize: 13 }}>
                    No projects found
                  </div>
                ) : (
                  projects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => {
                        onProjectSelect(project.id);
                        setIsDropdownOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        textAlign: 'left',
                        border: 'none',
                        background: selectedProjectId === project.id ? colors.bgSecondary : 'transparent',
                        color: colors.textPrimary,
                        fontSize: 14,
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedProjectId !== project.id) {
                          e.currentTarget.style.backgroundColor = colors.bgSecondary;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedProjectId !== project.id) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      {project.name}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={loadProjects}
            disabled={isLoading}
            title="Refresh project list"
            style={{
              padding: '6px 8px',
              borderRadius: 4,
              border: `1px solid ${colors.borderSecondary}`,
              background: colors.buttonBg,
              color: colors.buttonText,
              fontSize: 14,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                animation: isLoading ? 'spin 1s linear infinite' : 'none',
              }}
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M21 21v-5h-5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={async () => {
              if (isModified && onSaveBeforeClear) {
                const shouldSave = window.confirm("Save changes?");
                if (shouldSave) {
                  await onSaveBeforeClear();
                }
              }
              onClear();
              // Immediately create a new project called "New Project"
              await handleCreateProject();
            }}
            disabled={isLoading || isCreating}
            style={getButtonStyles(colors, {
              variant: "info",
              disabled: isLoading || isCreating,
            })}
          >
            {isCreating ? 'Creating...' : '+ New Project'}
          </button>
        </div>
      </div>

      {projects.length === 0 && !isLoading && !error && (
        <div style={{ fontSize: 12, color: colors.textPrimary, fontStyle: 'italic' }}>
          No projects yet. Click "+ New Project" to create one.
        </div>
      )}
    </div>
  );
};

export default ProjectSelector;
