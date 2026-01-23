import React, { useEffect, useState } from 'react';
import { getProjects, createProject, type Project } from '../services/firestoreService';

interface ProjectSelectorProps {
  selectedProjectId: string | null;
  onProjectSelect: (projectId: string | null) => void;
  onProjectCreated: (project: Project) => void;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  selectedProjectId,
  onProjectSelect,
  onProjectCreated,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const projectList = await getProjects();
      setProjects(projectList);
    } catch (error) {
      console.error('Error loading projects:', error);
      alert('Failed to load projects. Please check your Firebase configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      alert('Please enter a project name');
      return;
    }

    setIsCreating(true);
    try {
      const newProject = await createProject(newProjectName.trim());
      setProjects((prev) => [newProject, ...prev]);
      setNewProjectName('');
      setShowCreateForm(false);
      onProjectCreated(newProject);
      onProjectSelect(newProject.id);
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '12px', color: '#6b7280' }}>
        Loading projects...
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <label style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>
          Project:
        </label>
        <select
          value={selectedProjectId || ''}
          onChange={(e) => onProjectSelect(e.target.value || null)}
          style={{
            padding: '6px 12px',
            borderRadius: 4,
            border: '1px solid #d1d5db',
            fontSize: 14,
            minWidth: 200,
          }}
        >
          <option value="">-- Select a project --</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            padding: '6px 12px',
            borderRadius: 4,
            border: '1px solid #4b6fff',
            background: '#4b6fff',
            color: 'white',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          + New Project
        </button>
      </div>

      {showCreateForm && (
        <form
          onSubmit={handleCreateProject}
          style={{
            padding: 12,
            border: '1px solid #e5e7eb',
            borderRadius: 4,
            backgroundColor: '#f9fafb',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Enter project name"
              disabled={isCreating}
              style={{
                flex: 1,
                padding: '6px 12px',
                borderRadius: 4,
                border: '1px solid #d1d5db',
                fontSize: 14,
              }}
              autoFocus
            />
            <button
              type="submit"
              disabled={isCreating || !newProjectName.trim()}
              style={{
                padding: '6px 12px',
                borderRadius: 4,
                border: '1px solid #4b6fff',
                background: '#4b6fff',
                color: 'white',
                fontSize: 13,
                cursor: isCreating || !newProjectName.trim() ? 'not-allowed' : 'pointer',
                opacity: isCreating || !newProjectName.trim() ? 0.6 : 1,
              }}
            >
              {isCreating ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false);
                setNewProjectName('');
              }}
              disabled={isCreating}
              style={{
                padding: '6px 12px',
                borderRadius: 4,
                border: '1px solid #d1d5db',
                background: 'white',
                color: '#374151',
                fontSize: 13,
                cursor: isCreating ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {projects.length > 0 && (
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          {projects.length} project{projects.length !== 1 ? 's' : ''} available
        </div>
      )}
    </div>
  );
};

export default ProjectSelector;
