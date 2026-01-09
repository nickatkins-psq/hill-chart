## Hill Chart Prototype

A small React + TypeScript app for visualizing Shape Up–style **hill charts**.  
Each dot on the hill represents a **scope** within a project; you drag dots along the hill to show where the scope is (uphill / crest / downhill / done). Data is stored in the browser’s `localStorage`.

---

## Features

1. One hill per browser tab (simple prototype).
2. Each dot = a scope, not Jira stories/tasks.
3. Drag & drop dots along the hill to update position.
4. Phase labels derived from position:
   - 0–25: Uphill – still figuring it out  
   - 25–50: Crest – approach is clear  
   - 50–80: Downhill – executing  
   - 80–100: Done / rollout
5. State is saved locally so positions persist between sessions on the same machine.
---

## Prerequisites

- Node: 18+ (22.x recommended)  
- npm: 9+

**Check versions:**

node -v
npm -v---

## Getting started

**Clone and install:**

git clone git@github.com:deeptichatur/hill-chart.git
cd hill-chart
npm install**Run the dev server:**

npm run devThen open the URL printed in the terminal (usually `http://localhost:5173`).

---

## Using the hill chart
1. Open your Jira Epics in another window/tab.
2. In the app:
   - Click “+ Add Epic”.
   - For **Key**, paste your Jira Epic key (or use `PROJECT:Scope name` if you prefer).
   - Give it a short **Title** (1–3 words) describing the scope.
3. Drag the dot for each scope along the hill based on the team’s discussion:
   - Left side: still shaping / unknowns.  
   - Top / middle: risky bits are understood; solution is clear.  
   - Right side: mostly execution, QA, rollout.
4. The table under the hill shows:
   - Key, title, numeric position (`0–100%`), and phase label.
5. Positions are saved in your browser’s `localStorage` so you can reopen the app next week and see movement.

---

## How to use this with your team

- **Per project**
  - Define a set of scopes (Shape Up style) for the project.
  - Add one dot per scope.

- **Weekly ritual**
  - Open the hill chart in the team meeting.
  - For each scope, ask “where are we on the hill now?” and drag accordingly.
  - Capture screenshots for sharing in Slack/Confluence or leadership updates.

