import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
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

// Hillcharts collection - contains both project metadata and data
const HILLCHARTS_COLLECTION = 'hillcharts';

/**
 * Get all projects from the hillcharts collection
 */
export async function getProjects(): Promise<Project[]> {
  try {
    const hillchartsRef = collection(db, HILLCHARTS_COLLECTION);
    const querySnapshot = await getDocs(hillchartsRef);
    
    const projects = querySnapshot.docs.map((doc) => {
      const data = doc.data() as ProjectData & { updatedAt?: Timestamp };
      const projectName = data.project || 'Untitled Project';
      const generatedDate = data.generated ? new Date(data.generated) : new Date();
      const updatedDate = data.updatedAt?.toDate() || generatedDate;
      
      return {
        id: doc.id,
        name: projectName,
        createdAt: generatedDate,
        updatedAt: updatedDate,
      };
    });
    
    // Sort by updatedAt descending (most recently updated first)
    return projects.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  } catch (error) {
    console.error('Error getting projects:', error);
    throw error;
  }
}

/**
 * Create a new project in the hillcharts collection
 */
export async function createProject(name: string): Promise<Project> {
  try {
    const hillchartsRef = collection(db, HILLCHARTS_COLLECTION);
    const newProjectRef = doc(hillchartsRef);
    const now = Timestamp.now();
    
    // Create initial project data structure
    const initialProjectData: ProjectData = {
      project: name,
      generated: now.toDate().toISOString(),
      task_completion: {
        completed: 0,
        total: 0,
        percentage: 0,
      },
      scopes: [],
    };
    
    await setDoc(newProjectRef, {
      ...initialProjectData,
      updatedAt: now,
    });
    
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
 * Get project data from the hillcharts collection
 */
export async function getProjectData(projectId: string): Promise<ProjectData | null> {
  try {
    const projectDataRef = doc(db, HILLCHARTS_COLLECTION, projectId);
    const projectDataSnap = await getDoc(projectDataRef);
    
    if (!projectDataSnap.exists()) {
      return null;
    }
    
    const data = projectDataSnap.data();
    // Remove updatedAt if present (it's not part of ProjectData interface)
    const { updatedAt, ...projectData } = data;
    return projectData as ProjectData;
  } catch (error) {
    console.error('Error getting project data:', error);
    throw error;
  }
}

/**
 * Save project data to the hillcharts collection
 */
export async function saveProjectData(projectId: string, data: ProjectData): Promise<void> {
  try {
    const projectDataRef = doc(db, HILLCHARTS_COLLECTION, projectId);
    await setDoc(projectDataRef, {
      ...data,
      updatedAt: Timestamp.now(),
    }, { merge: true });
  } catch (error) {
    console.error('Error saving project data:', error);
    throw error;
  }
}

/**
 * Delete a project from the hillcharts collection
 */
export async function deleteProject(projectId: string): Promise<void> {
  try {
    const projectRef = doc(db, HILLCHARTS_COLLECTION, projectId);
    await deleteDoc(projectRef);
  } catch (error) {
    console.error('Error deleting project:', error);
    throw error;
  }
}
