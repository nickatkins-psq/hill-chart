import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

export interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectData {
  project: string;
  generated: string;
  task_completion: {
    completed: number;
    total: number;
    percentage: number;
  };
  scopes: Array<{
    id: number;
    name: string;
    progress: number;
    direction: string;
    status: string;
    completed?: string[];
    gaps?: string[];
    blockers?: string[];
    next_steps?: string[];
  }>;
}

// Projects collection
const PROJECTS_COLLECTION = 'projects';
const PROJECT_DATA_COLLECTION = 'projectData';

/**
 * Get all projects
 */
export async function getProjects(): Promise<Project[]> {
  try {
    const projectsRef = collection(db, PROJECTS_COLLECTION);
    const q = query(projectsRef, orderBy('updatedAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    });
  } catch (error) {
    console.error('Error getting projects:', error);
    throw error;
  }
}

/**
 * Create a new project
 */
export async function createProject(name: string): Promise<Project> {
  try {
    const projectsRef = collection(db, PROJECTS_COLLECTION);
    const newProjectRef = doc(projectsRef);
    const now = Timestamp.now();
    
    const projectData = {
      name,
      createdAt: now,
      updatedAt: now,
    };
    
    await setDoc(newProjectRef, projectData);
    
    return {
      id: newProjectRef.id,
      name,
      createdAt: now.toDate(),
      updatedAt: now.toDate(),
    };
  } catch (error) {
    console.error('Error creating project:', error);
    throw error;
  }
}

/**
 * Get project data (JSON) for a project
 */
export async function getProjectData(projectId: string): Promise<ProjectData | null> {
  try {
    const projectDataRef = doc(db, PROJECT_DATA_COLLECTION, projectId);
    const projectDataSnap = await getDoc(projectDataRef);
    
    if (!projectDataSnap.exists()) {
      return null;
    }
    
    const data = projectDataSnap.data();
    return data as ProjectData;
  } catch (error) {
    console.error('Error getting project data:', error);
    throw error;
  }
}

/**
 * Save project data (JSON) for a project
 */
export async function saveProjectData(projectId: string, data: ProjectData): Promise<void> {
  try {
    const projectDataRef = doc(db, PROJECT_DATA_COLLECTION, projectId);
    await setDoc(projectDataRef, {
      ...data,
      updatedAt: Timestamp.now(),
    });
    
    // Also update the project's updatedAt timestamp
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    await setDoc(projectRef, { updatedAt: Timestamp.now() }, { merge: true });
  } catch (error) {
    console.error('Error saving project data:', error);
    throw error;
  }
}

/**
 * Delete a project and its data
 */
export async function deleteProject(projectId: string): Promise<void> {
  try {
    // Delete project data
    const projectDataRef = doc(db, PROJECT_DATA_COLLECTION, projectId);
    await deleteDoc(projectDataRef);
    
    // Delete project
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    await deleteDoc(projectRef);
  } catch (error) {
    console.error('Error deleting project:', error);
    throw error;
  }
}
