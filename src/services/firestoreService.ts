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
 * Diagnostic function to test Firestore access
 */
export async function testFirestoreAccess(): Promise<void> {
  try {
    console.log('[testFirestoreAccess] Testing access to hillcharts collection...');
    console.log('[testFirestoreAccess] Collection name:', HILLCHARTS_COLLECTION);
    console.log('[testFirestoreAccess] Database:', db.app.options.projectId);
    
    const hillchartsRef = collection(db, HILLCHARTS_COLLECTION);
    
    // Try to get documents
    console.log('[testFirestoreAccess] Executing getDocs query...');
    const querySnapshot = await getDocs(hillchartsRef);
    
    console.log(`[testFirestoreAccess] Query completed. Found ${querySnapshot.docs.length} documents`);
    console.log(`[testFirestoreAccess] Query metadata:`, {
      fromCache: querySnapshot.metadata.fromCache,
      hasPendingWrites: querySnapshot.metadata.hasPendingWrites,
    });
    
    // Log document IDs if any exist
    if (querySnapshot.docs.length > 0) {
      console.log('[testFirestoreAccess] ✅ Document IDs found:', querySnapshot.docs.map(d => d.id));
      querySnapshot.docs.forEach((doc) => {
        const data = doc.data();
        console.log(`[testFirestoreAccess] Document ${doc.id}:`, {
          id: doc.id,
          exists: doc.exists(),
          hasData: !!data,
          fields: Object.keys(data || {}),
          projectField: data?.project || data?.name || 'NOT FOUND',
          rawData: data,
        });
      });
    } else {
      console.warn('[testFirestoreAccess] ⚠️ No documents found. Possible causes:');
      console.warn('  1. Collection is empty (check Firebase Console)');
      console.warn('  2. Security rules are blocking read access');
      console.warn('  3. Collection name mismatch (check case sensitivity)');
      console.warn('  4. Network/permission issues');
      console.warn(`[testFirestoreAccess] Please verify in Firebase Console:`);
      console.warn(`  - Collection name is exactly: "${HILLCHARTS_COLLECTION}"`);
      console.warn(`  - Documents exist in the collection`);
      console.warn(`  - Security rules allow read access`);
    }
  } catch (error: any) {
    console.error('[testFirestoreAccess] ❌ Error:', error);
    console.error('[testFirestoreAccess] Error code:', error?.code);
    console.error('[testFirestoreAccess] Error message:', error?.message);
    console.error('[testFirestoreAccess] Full error:', error);
    
    if (error?.code === 'permission-denied') {
      console.error('[testFirestoreAccess] PERMISSION DENIED - Security rules are blocking access');
    }
  }
}

/**
 * Get all projects from the hillcharts collection
 */
export async function getProjects(): Promise<Project[]> {
  try {
    console.log(`[getProjects] ========================================`);
    console.log(`[getProjects] Starting getProjects()...`);
    console.log(`[getProjects] Collection name: '${HILLCHARTS_COLLECTION}'`);
    console.log(`[getProjects] Database project: ${db.app.options.projectId}`);
    console.log(`[getProjects] ========================================`);
    
    const hillchartsRef = collection(db, HILLCHARTS_COLLECTION);
    console.log(`[getProjects] Collection reference created, executing query...`);
    
    const querySnapshot = await getDocs(hillchartsRef);
    
    console.log(`[getProjects] Query completed successfully`);
    console.log(`[getProjects] Documents found: ${querySnapshot.docs.length}`);
    console.log(`[getProjects] Query metadata:`, {
      fromCache: querySnapshot.metadata.fromCache,
      hasPendingWrites: querySnapshot.metadata.hasPendingWrites,
    });
    
    // Check if this might be a permissions issue
    if (querySnapshot.docs.length === 0) {
      console.warn(`[getProjects] ⚠️ WARNING: No documents found in '${HILLCHARTS_COLLECTION}' collection`);
      console.warn(`[getProjects] This could mean:`);
      console.warn(`[getProjects]   1. The collection is empty (verify in Firebase Console)`);
      console.warn(`[getProjects]   2. Firestore security rules are blocking read access`);
      console.warn(`[getProjects]   3. The collection name is incorrect (check case sensitivity)`);
      console.warn(`[getProjects]   4. Documents exist but are in a different collection`);
      console.warn(`[getProjects] Please verify in Firebase Console:`);
      console.warn(`[getProjects]   - Go to Firestore Database → Data`);
      console.warn(`[getProjects]   - Check that collection is named exactly: "${HILLCHARTS_COLLECTION}"`);
      console.warn(`[getProjects]   - Verify documents exist and have data`);
      console.warn(`[getProjects]   - Check Firestore Rules allow read access to hillcharts collection`);
    }
    
    const projects = querySnapshot.docs.map((doc) => {
      try {
        const data = doc.data();
        console.log(`[getProjects] Document ${doc.id}:`, data);
        
        // Try multiple possible field names for project name
        const projectName = 
          data.project ||           // Expected field name
          data.name ||              // Alternative field name
          data.projectName ||       // Another alternative
          doc.id ||                 // Fallback to document ID
          'Untitled Project';       // Final fallback
        
        // Helper function to safely parse dates
        const safeDate = (value: any): Date => {
          if (!value) return new Date();
          try {
            if (value.toDate && typeof value.toDate === 'function') {
              return value.toDate();
            }
            if (typeof value === 'string' || typeof value === 'number') {
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                return date;
              }
            }
          } catch (e) {
            console.warn(`[getProjects] Failed to parse date:`, value, e);
          }
          return new Date();
        };
        
        // Try multiple possible field names for date
        const generatedDate = 
          safeDate(data.generated) ||
          safeDate(data.createdAt) ||
          safeDate(data.updatedAt) ||
          new Date();
        
        const updatedDate = 
          safeDate(data.updatedAt) ||
          generatedDate;
        
        const project = {
          id: doc.id,
          name: String(projectName).trim() || 'Untitled Project',
          createdAt: generatedDate,
          updatedAt: updatedDate,
        };
        
        console.log(`[getProjects] Mapped to project:`, project);
        return project;
      } catch (error) {
        console.error(`[getProjects] Error mapping document ${doc.id}:`, error);
        // Return a basic project even if mapping fails
        return {
          id: doc.id,
          name: doc.id || 'Untitled Project',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
    }).filter((project) => {
      // Filter out any null/undefined projects
      return project && project.id && project.name;
    });
    
    console.log(`[getProjects] Returning ${projects.length} projects`);
    
    // Sort by updatedAt descending (most recently updated first)
    return projects.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  } catch (error: any) {
    console.error('[getProjects] Error getting projects:', error);
    
    // Check for specific Firestore errors
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      console.error('[getProjects] PERMISSION DENIED: Firestore security rules are blocking read access to the hillcharts collection.');
      console.error('[getProjects] Please update your Firestore rules to allow read access:');
      console.error(`
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /hillcharts/{projectId} {
      allow read, write: if true; // Change for production!
    }
  }
}
      `);
    }
    
    if (error?.code === 'not-found' || error?.message?.includes('not found')) {
      console.error('[getProjects] Collection not found. Verify the collection name is exactly: hillcharts');
    }
    
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
