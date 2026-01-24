import React, { useEffect, useState } from 'react';
import { getProjects, createProject, testFirestoreAccess, testSnapshotDiscovery, type Project } from '../services/firestoreService';
import { getThemeColors } from '../utils/themeColors';

interface ProjectSelectorProps {
  selectedProjectId: string | null;
  onProjectSelect: (projectId: string | null) => void;
  onProjectCreated: (project: Project) => void;
  onClear: () => void;
  isModified?: boolean;
  onSaveBeforeClear?: () => Promise<void>;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  selectedProjectId,
  onProjectSelect,
  onProjectCreated,
  onClear,
  isModified = false,
  onSaveBeforeClear,
}) => {
  const colors = getThemeColors(false); // Always use light mode
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
    // Also run diagnostic test
    testFirestoreAccess();
    testSnapshotDiscovery();
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const projectList = await getProjects();
      setProjects(projectList);
      if (projectList.length === 0) {
        setError('No projects found. Create a new project to get started.');
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
      const newProject = await createProject('New Project');
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <label style={{ fontSize: 14, fontWeight: 500, color: colors.textPrimary }}>
          Project:
        </label>
        <select
          value={isLoading ? '' : (selectedProjectId || '')}
          onChange={(e) => {
            const value = e.target.value;
            onProjectSelect(value || null);
          }}
          disabled={isLoading || !!error}
          style={{
            padding: '6px 12px',
            borderRadius: 4,
            border: `1px solid ${colors.selectBorder}`,
            fontSize: 14,
            minWidth: 200,
            backgroundColor: isLoading || error ? colors.bgTertiary : colors.selectBg,
            cursor: isLoading || error ? 'not-allowed' : 'pointer',
            color: isLoading ? colors.selectTextPlaceholder : (selectedProjectId ? colors.selectText : colors.selectTextPlaceholder),
          }}
        >
          {isLoading ? (
            <option value="" disabled>
              Loading...
            </option>
          ) : (
            <>
              <option value="" disabled hidden>
                Select a project...
              </option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </>
          )}
        </select>
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
          style={{
            padding: '6px 12px',
            borderRadius: 4,
            border: `1px solid ${colors.borderSecondary}`,
            background: colors.buttonBg,
            color: colors.buttonText,
            fontSize: 13,
            cursor: isLoading || isCreating ? 'not-allowed' : 'pointer',
            opacity: isLoading || isCreating ? 0.6 : 1,
          }}
        >
          {isCreating ? 'Creating...' : '+ New Project'}
        </button>
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
