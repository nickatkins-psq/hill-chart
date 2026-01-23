# Debug: Projects Not Showing

If you have a project in Firestore but it's not showing in the app, follow these steps:

## Step 1: Check Browser Console

1. Open your app in the browser
2. Open Developer Tools (F12 or Cmd+Option+I)
3. Go to the **Console** tab
4. Look for log messages starting with `[getProjects]`
5. You should see:
   - How many documents were found
   - The raw data from each document
   - How each document was mapped to a project

## Step 2: Verify Collection Name

The app looks for projects in the **`hillcharts`** collection.

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **hillchart-e25ec**
3. Go to **Firestore Database** → **Data**
4. Check what collection your project is in:
   - ✅ **`hillcharts`** - This is correct
   - ❌ **`projects`** - Wrong collection (old structure)
   - ❌ **`projectData`** - Wrong collection (old structure)
   - ❌ Other name - Wrong collection

## Step 3: Check Document Structure

Your document in `hillcharts` should have these fields:

**Required:**
- `project` (string) - The project name
- `generated` (string) - ISO date string

**Optional:**
- `updatedAt` (Timestamp) - Last update time
- `scopes` (array) - Array of scope objects
- `task_completion` (object) - Completion stats

**Example document structure:**
```json
{
  "project": "My Project Name",
  "generated": "2024-01-15T10:30:00.000Z",
  "updatedAt": <Timestamp>,
  "scopes": [],
  "task_completion": {
    "completed": 0,
    "total": 0,
    "percentage": 0
  }
}
```

## Step 4: Common Issues

### Issue: Project is in `projects` collection instead of `hillcharts`
**Solution**: Move the document or update the code to check both collections

### Issue: Document has `name` field instead of `project` field
**Solution**: The code now handles this automatically (checks `project`, `name`, or `projectName`)

### Issue: Document doesn't have `generated` field
**Solution**: The code will use `createdAt` or `updatedAt` as fallback

### Issue: Document structure is completely different
**Solution**: Check the console logs to see what fields exist, then we can update the code

## Step 5: Check Console Logs

After refreshing the app, look for these console messages:

```
[getProjects] Found X documents in 'hillcharts' collection
[getProjects] Document <id>: { ... data ... }
[getProjects] Mapped to project: { id: ..., name: ..., ... }
[getProjects] Returning X projects
```

If you see:
- `Found 0 documents` → Collection is empty or wrong collection name
- `Found X documents` but `Returning 0 projects` → Mapping failed (check the mapped project logs)
- Error messages → Check the error details

## Quick Fix: Move Project to Correct Collection

If your project is in the wrong collection:

1. Go to Firebase Console → Firestore Database
2. Find your project document (in `projects` or wherever it is)
3. Note down all the field values
4. Create a new document in the **`hillcharts`** collection
5. Copy the data, making sure it has:
   - `project` field (string) with the project name
   - `generated` field (string, ISO date)
6. Delete the old document (optional)

## Still Not Working?

Share the console log output and we can debug further. The logs will show:
- What collection is being queried
- How many documents were found
- What data each document contains
- How each document was mapped
