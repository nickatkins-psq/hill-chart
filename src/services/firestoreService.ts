import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { formatDateAsSnapshotId } from '../utils/dateUtils';

export interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  ownerId?: string | null; // User ID of the project creator, null/undefined means no owner (editable by anyone)
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

export interface ProjectSnapshotMeta {
  id: string;
  generated?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Hillcharts collection - contains both project metadata and data
const HILLCHARTS_COLLECTION = 'hillcharts';

/**
 * Sanitize a project name to be a valid Firestore document ID
 * - Converts to lowercase
 * - Replaces spaces and special characters with hyphens
 * - Removes invalid characters
 * - Ensures it's not empty
 */
function sanitizeProjectNameForId(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-') // Replace non-alphanumeric (except hyphens) with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    || 'untitled-project'; // Fallback if empty after sanitization
}

/**
 * Generate a unique document ID from a project name
 * If a project with the sanitized name already exists, append a number
 */
async function generateUniqueProjectId(name: string): Promise<string> {
  const baseId = sanitizeProjectNameForId(name);
  const hillchartsRef = collection(db, HILLCHARTS_COLLECTION);
  
  // Check if base ID exists
  const baseDocRef = doc(hillchartsRef, baseId);
  const baseDocSnap = await getDoc(baseDocRef);
  
  if (!baseDocSnap.exists()) {
    return baseId;
  }
  
  // If exists, try appending numbers until we find an available ID
  let counter = 1;
  let candidateId = `${baseId}-${counter}`;
  
  while (counter < 1000) { // Safety limit
    const candidateDocRef = doc(hillchartsRef, candidateId);
    const candidateDocSnap = await getDoc(candidateDocRef);
    
    if (!candidateDocSnap.exists()) {
      return candidateId;
    }
    
    counter++;
    candidateId = `${baseId}-${counter}`;
  }
  
  // Fallback: append timestamp if we can't find a unique ID
  return `${baseId}-${Date.now()}`;
}

function getStoredProjectIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem('hillchart_project_ids');
    if (!raw) return [];
    return raw
      .split(/[\n,]+/)
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  } catch {
    return [];
  }
}

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
 * Diagnostic: discover snapshots via collectionGroup
 */
export async function testSnapshotDiscovery(): Promise<void> {
  try {
    const snapshotsRef = collectionGroup(db, 'snapshots');
    await getDocs(snapshotsRef);
  } catch (error: any) {
    // Error handling
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
    
    // CRITICAL DISCOVERY: Document is in a SUBCOLLECTION!
    // User provided: /hillcharts/centralized-reporting/snapshots/2026-01-16-175406Z
    // This means: hillcharts (collection) → centralized-reporting (doc) → snapshots (subcollection) → 2026-01-16-175406Z (doc)
    
    // Test: Query all documents in hillcharts root to see what we can access
    const allDocsSnap = await getDocs(hillchartsRef);
    console.warn(`[getProjects] Documents in hillcharts root collection:`, allDocsSnap.docs.map(d => d.id));
    
    // Test 1: Try reading the parent document (even if it doesn't show in query)
    // Security rules might filter it from queries but allow direct reads
    try {
      const parentDocRef = doc(hillchartsRef, 'centralized-reporting');
      const parentDocSnap = await getDoc(parentDocRef);
      if (parentDocSnap.exists()) {
        console.warn(`[getProjects] ✅ Parent doc "centralized-reporting" EXISTS (can be read directly)!`);
        console.warn(`[getProjects] Parent doc data:`, parentDocSnap.data());
        
        // Test 2: Query the snapshots subcollection
        const snapshotsRef = collection(parentDocRef, 'snapshots');
        const snapshotsSnap = await getDocs(snapshotsRef);
        console.warn(`[getProjects] ✅ Found ${snapshotsSnap.docs.length} documents in snapshots subcollection`);
        console.warn(`[getProjects] Snapshot IDs:`, snapshotsSnap.docs.map(d => d.id));
        
        // Test 3: Read the specific snapshot document
        const snapshotDocRef = doc(snapshotsRef, '2026-01-16-175406Z');
        const snapshotDocSnap = await getDoc(snapshotDocRef);
        if (snapshotDocSnap.exists()) {
          const snapshotData = snapshotDocSnap.data();
          console.warn(`[getProjects] ✅ Snapshot doc "2026-01-16-175406Z" exists!`);
          console.warn(`[getProjects] Snapshot fields:`, Object.keys(snapshotData || {}));
          console.warn(`[getProjects] Snapshot data:`, snapshotData);
        } else {
          console.warn(`[getProjects] ❌ Snapshot doc "2026-01-16-175406Z" does not exist`);
        }
      } else {
        console.warn(`[getProjects] ❌ Parent doc "centralized-reporting" does not exist (cannot read directly)`);
      }
    } catch (subcollectionError: any) {
      console.warn(`[getProjects] ❌ Error accessing subcollection:`, subcollectionError?.code, subcollectionError?.message);
    }

    
    // Test: Try to find ALL parent documents by querying and checking each for subcollections
    console.warn(`[getProjects] 🔍 Testing all root documents for subcollections...`);
    for (const rootDoc of allDocsSnap.docs) {
      try {
        const subcollectionsRef = collection(rootDoc.ref, 'snapshots');
        const subcollectionsSnap = await getDocs(subcollectionsRef);
        if (subcollectionsSnap.docs.length > 0) {
          console.warn(`[getProjects] ✅ Root doc "${rootDoc.id}" has ${subcollectionsSnap.docs.length} snapshots!`);
        }
      } catch (e) {
        // Expected if no subcollection
      }
    }
    
    // Check if this might be a permissions issue
    if (querySnapshot.docs.length === 0) {
      // Test if we can write (to verify rules allow write but maybe not read)
      try {
        const testDocRef = doc(hillchartsRef, '_test_write_access');
        await setDoc(testDocRef, { test: true, timestamp: Timestamp.now() });
        await deleteDoc(testDocRef);
        console.warn(`[getProjects] ⚠️ Write test PASSED - rules allow write but read returns 0 docs (likely rules filtering)`);
        
        // Test reading the test document we just wrote (before deleting)
        try {
          const testReadRef = doc(hillchartsRef, '_test_write_access');
          await setDoc(testReadRef, { test: true, timestamp: Timestamp.now(), project: 'Test Project' });
          const testReadSnap = await getDoc(testReadRef);
          console.warn(`[getProjects] Direct document read (getDoc) test: ${testReadSnap.exists() ? 'SUCCESS' : 'FAILED'}`);
          
          // Test if we can query it back with getDocs
          const testQuerySnap = await getDocs(hillchartsRef);
          const testDocInQuery = testQuerySnap.docs.find(d => d.id === '_test_write_access');
          console.warn(`[getProjects] Test doc in getDocs query: ${testDocInQuery ? 'FOUND' : 'NOT FOUND'} (total docs: ${testQuerySnap.docs.length})`);
          
          await deleteDoc(testReadRef);
        } catch (readError: any) {
          console.warn(`[getProjects] Direct document read test FAILED:`, readError?.code, readError?.message);
        }
        
        // Test alternative collection names (case sensitivity)
        const altCollections = ['Hillcharts', 'HILLCHARTS', 'hillCharts'];
        for (const altName of altCollections) {
          try {
            const altRef = collection(db, altName);
            const altSnap = await getDocs(altRef);
            if (altSnap.docs.length > 0) {
              console.warn(`[getProjects] ⚠️ Found ${altSnap.docs.length} docs in collection "${altName}" - case sensitivity issue!`);
            }
          } catch (e) {
            // Expected to fail for wrong collection names
          }
        }
        
        // Try to create a document with the same structure as expected project data
        try {
          const testProjectDocRef = doc(hillchartsRef, '_test_project_structure');
          const testProjectData = {
            project: 'Test Project Name',
            generated: new Date().toISOString(),
            task_completion: {
              completed: 0,
              total: 0,
              percentage: 0,
            },
            scopes: [],
            updatedAt: Timestamp.now(),
          };
          await setDoc(testProjectDocRef, testProjectData);
          const testProjectQuerySnap = await getDocs(hillchartsRef);
          const testProjectInQuery = testProjectQuerySnap.docs.find(d => d.id === '_test_project_structure');
          console.warn(`[getProjects] Test project doc in query: ${testProjectInQuery ? 'FOUND' : 'NOT FOUND'} (total: ${testProjectQuerySnap.docs.length})`);
          await deleteDoc(testProjectDocRef);
        } catch (e: any) {
          // Error handling
        }
      } catch (writeError: any) {
        console.warn(`[getProjects] ⚠️ Write test FAILED:`, writeError?.code, writeError?.message);
      }
      
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
    
    const rootDocs = querySnapshot.docs.filter((doc) => !doc.id.startsWith('_test_'));
    const projects = rootDocs.map((doc) => {
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
          ownerId: data.ownerId || null, // Read ownerId from document, default to null
        };
        
        console.log(`[getProjects] Mapped to project:`, project);
        return project;
      } catch (error) {
        console.error(`[getProjects] Error mapping document ${doc.id}:`, error);
        // Return a basic project even if mapping fails
        try {
          const fallbackData = doc.data();
          return {
            id: doc.id,
            name: doc.id || 'Untitled Project',
            createdAt: new Date(),
            updatedAt: new Date(),
            ownerId: fallbackData?.ownerId || null,
          };
        } catch {
          return {
            id: doc.id,
            name: doc.id || 'Untitled Project',
            createdAt: new Date(),
            updatedAt: new Date(),
            ownerId: null,
          };
        }
      }
    }).filter((project) => {
      // Filter out any null/undefined projects
      return project && project.id && project.name;
    });
    
    console.log(`[getProjects] Returning ${projects.length} projects`);
    
    if (projects.length === 0) {
      try {
        const snapshotsRef = collectionGroup(db, 'snapshots');
        const snapshotsSnap = await getDocs(snapshotsRef);
        const snapshotProjects = await Promise.all(snapshotsSnap.docs.map(async (docSnap) => {
          const data = docSnap.data() as Partial<ProjectData>;
          const parts = docSnap.ref.path.split('/');
          const projectIndex = parts.findIndex((p) => p === 'hillcharts');
          const projectId = projectIndex >= 0 ? parts[projectIndex + 1] : docSnap.id;
          const projectName = data.project || projectId;
          const generated = typeof data.generated === 'string' ? new Date(data.generated) : new Date();
          // Try to get ownerId from the project document
          let ownerId: string | null = null;
          try {
            const projectDocRef = doc(db, HILLCHARTS_COLLECTION, projectId);
            const projectDocSnap = await getDoc(projectDocRef);
            if (projectDocSnap.exists()) {
              ownerId = projectDocSnap.data().ownerId || null;
            }
          } catch {
            // Ignore errors when reading ownerId
          }
          return {
            id: projectId,
            name: projectName,
            createdAt: generated,
            updatedAt: generated,
            ownerId,
          } as Project;
        }));
        const uniqueById = new Map<string, Project>();
        snapshotProjects.forEach((project) => {
          const existing = uniqueById.get(project.id);
          if (!existing || existing.updatedAt < project.updatedAt) {
            uniqueById.set(project.id, project);
          }
        });
        const snapshotProjectList = Array.from(uniqueById.values()).sort(
          (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
        );
        return snapshotProjectList;
      } catch (snapshotError: any) {
        // If collectionGroup is denied, try known project IDs directly
        const storedIds = getStoredProjectIds();
        const knownProjectIds = Array.from(
          new Set(['centralized-reporting', 'report-date-filtering', ...storedIds])
        );
        const discoveredProjects: Project[] = [];
        for (const projectId of knownProjectIds) {
          try {
            const snapshotsRef = collection(db, HILLCHARTS_COLLECTION, projectId, 'snapshots');
            const snapshotsSnap = await getDocs(snapshotsRef);
            if (snapshotsSnap.docs.length > 0) {
              const firstSnapshot = snapshotsSnap.docs[0].data() as Partial<ProjectData>;
              const projectName = firstSnapshot.project || projectId;
              const generated = typeof firstSnapshot.generated === 'string' ? new Date(firstSnapshot.generated) : new Date();
              // Try to get ownerId from the project document
              let ownerId: string | null = null;
              try {
                const projectDocRef = doc(db, HILLCHARTS_COLLECTION, projectId);
                const projectDocSnap = await getDoc(projectDocRef);
                if (projectDocSnap.exists()) {
                  ownerId = projectDocSnap.data().ownerId || null;
                }
              } catch {
                // Ignore errors when reading ownerId
              }
              discoveredProjects.push({
                id: projectId,
                name: projectName,
                createdAt: generated,
                updatedAt: generated,
                ownerId,
              });
            }
          } catch (directError) {
            // ignore and continue
          }
        }
        if (discoveredProjects.length > 0) {
          return discoveredProjects;
        }
        // If no known projects are found, return empty list instead of throwing
        // to avoid blocking the UI with a permission error.
        return [];
      }
    }
    
    // Sort by updatedAt descending (most recently updated first)
    const sortedProjects = projects.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    
    return sortedProjects;
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
 * Check if a project name already exists (excluding a specific project ID)
 */
export async function projectNameExists(name: string, excludeProjectId?: string): Promise<boolean> {
  try {
    const projects = await getProjects();
    return projects.some(
      (project) => project.name === name && project.id !== excludeProjectId
    );
  } catch (error) {
    console.error('Error checking project name:', error);
    // If we can't check, assume it doesn't exist to allow creation
    return false;
  }
}

/**
 * Find a unique project name by appending numbers if needed
 * e.g., "New Project", "New Project 1", "New Project 2", etc.
 */
export async function findUniqueProjectName(baseName: string, excludeProjectId?: string): Promise<string> {
  // First check if base name is available
  if (!(await projectNameExists(baseName, excludeProjectId))) {
    return baseName;
  }
  
  // Try appending numbers
  let counter = 1;
  let candidateName = `${baseName} ${counter}`;
  
  while (counter < 1000) { // Safety limit
    if (!(await projectNameExists(candidateName, excludeProjectId))) {
      return candidateName;
    }
    counter++;
    candidateName = `${baseName} ${counter}`;
  }
  
  // Fallback: append timestamp if we can't find a unique name
  return `${baseName} ${Date.now()}`;
}

/**
 * Create a new project in the hillcharts collection
 * Uses the project name (sanitized) as the document ID
 * Automatically finds a unique name if the requested name already exists
 * @param name - Project name
 * @param ownerId - User ID of the project creator (optional)
 */
export async function createProject(name: string, ownerId?: string | null): Promise<Project> {
  try {
    // Find a unique name if the requested name already exists
    const uniqueName = await findUniqueProjectName(name);
    
    const hillchartsRef = collection(db, HILLCHARTS_COLLECTION);
    const projectId = await generateUniqueProjectId(uniqueName);
    const newProjectRef = doc(hillchartsRef, projectId);
    const now = Timestamp.now();
    
    // Check if document already exists (shouldn't happen with generateUniqueProjectId, but double-check)
    const existingDoc = await getDoc(newProjectRef);
    if (existingDoc.exists()) {
      throw new Error(`Project with name "${uniqueName}" already exists`);
    }
    
    // Create initial project data structure
    const initialProjectData: ProjectData = {
      project: uniqueName,
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
      ownerId: ownerId || null, // Store ownerId, null means no owner (editable by anyone)
      updatedAt: now,
    });
    
    return {
      id: projectId,
      name: uniqueName,
      createdAt: now.toDate(),
      updatedAt: now.toDate(),
      ownerId: ownerId || null,
    };
  } catch (error) {
    console.error('Error creating project:', error);
    throw error;
  }
}

/**
 * Get snapshots for a project (from subcollection)
 */
export async function getProjectSnapshots(projectId: string): Promise<ProjectSnapshotMeta[]> {
  try {
    const snapshotsRef = collection(db, HILLCHARTS_COLLECTION, projectId, 'snapshots');
    const snapshotsSnap = await getDocs(snapshotsRef);
    const snapshots = snapshotsSnap.docs.map((docSnap) => {
      const data = docSnap.data() as Partial<ProjectData> & { createdAt?: any; updatedAt?: any };
      return {
        id: docSnap.id,
        generated: typeof data.generated === 'string' ? data.generated : undefined,
        createdAt: data.createdAt?.toDate?.() ?? undefined,
        updatedAt: data.updatedAt?.toDate?.() ?? undefined,
      } as ProjectSnapshotMeta;
    });
    const sorted = snapshots.sort((a, b) => a.id.localeCompare(b.id));
    return sorted;
  } catch (error: any) {
    throw error;
  }
}

/**
 * Get project snapshot data (JSON) for a snapshot document
 */
export async function getProjectSnapshotData(projectId: string, snapshotId: string): Promise<ProjectData | null> {
  try {
    const snapshotRef = doc(db, HILLCHARTS_COLLECTION, projectId, 'snapshots', snapshotId);
    const snapshotSnap = await getDoc(snapshotRef);
    if (!snapshotSnap.exists()) {
      return null;
    }
    const data = snapshotSnap.data();
    return data as ProjectData;
  } catch (error: any) {
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
    // Remove updatedAt and ownerId if present (they're not part of ProjectData interface)
    const { updatedAt, ownerId, ...projectData } = data;
    return projectData as ProjectData;
  } catch (error) {
    console.error('Error getting project data:', error);
    throw error;
  }
}

/**
 * Get project metadata including ownership
 */
export async function getProjectMetadata(projectId: string): Promise<{ ownerId?: string | null } | null> {
  try {
    const projectDataRef = doc(db, HILLCHARTS_COLLECTION, projectId);
    const projectDataSnap = await getDoc(projectDataRef);
    
    if (!projectDataSnap.exists()) {
      return null;
    }
    
    const data = projectDataSnap.data();
    return {
      ownerId: data.ownerId || null,
    };
  } catch (error) {
    console.error('Error getting project metadata:', error);
    throw error;
  }
}

/**
 * Check if a user can edit a project
 * Returns true if:
 * - The project has no owner (ownerId is null/undefined)
 * - The user is the owner of the project
 */
export function canUserEditProject(project: Project | null, userId: string | null | undefined): boolean {
  if (!project) return false;
  if (!userId) return false; // Must be logged in
  
  // Projects with no owner (null/undefined) are editable by anyone
  if (!project.ownerId) {
    return true;
  }
  
  // User must be the owner
  return project.ownerId === userId;
}

/**
 * Save project data as a snapshot in the snapshots subcollection
 */
export async function saveProjectSnapshot(projectId: string, data: ProjectData): Promise<string> {
  try {
    const now = new Date();
    const snapshotId = formatDateAsSnapshotId(now);
    const snapshotRef = doc(db, HILLCHARTS_COLLECTION, projectId, 'snapshots', snapshotId);
    await setDoc(snapshotRef, {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return snapshotId;
  } catch (error) {
    console.error('Error saving project snapshot:', error);
    throw error;
  }
}

/**
 * Update an existing snapshot in the snapshots subcollection
 */
export async function updateProjectSnapshot(
  projectId: string,
  snapshotId: string,
  data: ProjectData
): Promise<void> {
  try {
    const snapshotRef = doc(db, HILLCHARTS_COLLECTION, projectId, 'snapshots', snapshotId);
    await setDoc(snapshotRef, {
      ...data,
      updatedAt: Timestamp.now(),
    }, { merge: true });
  } catch (error) {
    console.error('Error updating project snapshot:', error);
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
 * Delete a snapshot from a project's snapshots subcollection
 */
export async function deleteSnapshot(projectId: string, snapshotId: string): Promise<void> {
  try {
    const snapshotRef = doc(db, HILLCHARTS_COLLECTION, projectId, 'snapshots', snapshotId);
    await deleteDoc(snapshotRef);
  } catch (error) {
    console.error('Error deleting snapshot:', error);
    throw error;
  }
}

/**
 * Update a project's name
 * If the new name results in a different slug, the project document and all snapshots will be moved to a new document
 * Returns the new project ID if it changed, or the same ID if it didn't
 */
export async function updateProjectName(projectId: string, newName: string): Promise<string> {
  try {
    // Check if name already exists (excluding current project)
    if (await projectNameExists(newName, projectId)) {
      throw new Error(`A project named "${newName}" already exists. Please choose a different name.`);
    }

    const newProjectId = await generateUniqueProjectId(newName);
    
    // If the slug hasn't changed, just update the project field in the document and snapshots
    if (newProjectId === projectId) {
      // Update the project document
      const projectData = await getProjectData(projectId);
      if (projectData) {
        await saveProjectData(projectId, {
          ...projectData,
          project: newName,
        });
      }
      
      // Update all snapshots to have the new project name
      const snapshots = await getProjectSnapshots(projectId);
      for (const snapshot of snapshots) {
        const snapshotData = await getProjectSnapshotData(projectId, snapshot.id);
        if (snapshotData) {
          await updateProjectSnapshot(projectId, snapshot.id, {
            ...snapshotData,
            project: newName,
          });
        }
      }
      
      return projectId;
    }
    
    // Slug changed - need to move everything to a new document
    // 1. Get all snapshots
    const snapshots = await getProjectSnapshots(projectId);
    const snapshotDataPromises = snapshots.map((snapshot) => 
      getProjectSnapshotData(projectId, snapshot.id)
    );
    const allSnapshotData = await Promise.all(snapshotDataPromises);
    
    // 2. Get project data
    const projectData = await getProjectData(projectId);
    
    // 3. Create new project document with updated name
    const now = Timestamp.now();
    const newProjectRef = doc(db, HILLCHARTS_COLLECTION, newProjectId);
    const newProjectData: ProjectData = projectData ? {
      ...projectData,
      project: newName,
    } : {
      project: newName,
      generated: now.toDate().toISOString(),
      task_completion: {
        completed: 0,
        total: 0,
        percentage: 0,
      },
      scopes: [],
    };
    
    await setDoc(newProjectRef, {
      ...newProjectData,
      updatedAt: now,
    });
    
    // 4. Copy all snapshots to new project
    for (let i = 0; i < snapshots.length; i++) {
      const snapshot = snapshots[i];
      const data = allSnapshotData[i];
      if (data) {
        const newSnapshotRef = doc(db, HILLCHARTS_COLLECTION, newProjectId, 'snapshots', snapshot.id);
        await setDoc(newSnapshotRef, {
          ...data,
          project: newName,
          createdAt: snapshot.createdAt ? Timestamp.fromDate(snapshot.createdAt) : Timestamp.now(),
          updatedAt: snapshot.updatedAt ? Timestamp.fromDate(snapshot.updatedAt) : Timestamp.now(),
        });
      }
    }
    
    // 5. Delete old project and snapshots
    await deleteProject(projectId);
    
    return newProjectId;
  } catch (error) {
    console.error('Error updating project name:', error);
    throw error;
  }
}

/**
 * Delete a project from the hillcharts collection
 * Also deletes all snapshots in the project's snapshots subcollection
 */
export async function deleteProject(projectId: string): Promise<void> {
  try {
    // First, delete all snapshots in the subcollection
    const snapshotsRef = collection(db, HILLCHARTS_COLLECTION, projectId, 'snapshots');
    const snapshotsSnap = await getDocs(snapshotsRef);
    
    // Delete all snapshot documents
    const deletePromises = snapshotsSnap.docs.map((docSnap) => deleteDoc(docSnap.ref));
    await Promise.all(deletePromises);
    
    // Then delete the project document itself
    const projectRef = doc(db, HILLCHARTS_COLLECTION, projectId);
    await deleteDoc(projectRef);
  } catch (error) {
    console.error('Error deleting project:', error);
    throw error;
  }
}
