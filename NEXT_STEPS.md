# 🗺️ CollabCode — Feature Roadmap & Implementation Guide

> This document is your step-by-step guide to turning a simple collaborative editor into a **resume-worthy, full-stack project**. Each phase builds on the previous one. Follow in order.

---

## Overview — What We're Building

By the end of all phases, your app will look like this:

```
┌─────────────────────────────────────────────────────────────┐
│  CollabCode          Room: abc-123     👤 Alice  👤 Bob     │
├──────────┬──────────────────────────────┬───────────────────┤
│ SIDEBAR  │     MONACO CODE EDITOR       │   CHAT PANEL      │
│          │                              │                   │
│ 📁 Files │  function greet(name) {      │  Alice: hey!      │
│          │    return `Hello ${name}`;   │  Bob: let's code  │
│ 👥 Users │  }                 ← cursor │                   │
│  Alice🟢 │           Bob's cursor →  |  │  [type message..] │
│  Bob  🔵 │  console.log(greet("World"))│                   │
│          ├──────────────────────────────┤                   │
│ ⚙️ Lang  │  OUTPUT TERMINAL             │                   │
│ [Python] │  > Hello World               │                   │
│          │  > Process exited (0)        │                   │
│ [▶ Run]  │                              │                   │
└──────────┴──────────────────────────────┴───────────────────┘
```

### Tech Stack After All Phases

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Monaco Editor, TailwindCSS, React Router |
| Real-time Sync | Yjs, y-socket.io, y-monaco |
| Backend | Express 5, Socket.IO, Node.js |
| Code Execution | Docker containers (ephemeral, sandboxed) |
| Database | MongoDB with Mongoose |
| Auth | JWT + bcrypt (email/password) |
| DevOps | Docker, Docker Compose, multi-stage builds |

### Phase Order & Dependencies

```
Phase 1: Room System ──────────────┐
                                   ├──→ Phase 4: Database
Phase 2: Collaborative Features ───┘         │
                                             ▼
Phase 3: Code Execution ──────────→ Phase 5: Auth & Dashboard
```

---

## Phase 1: Room/Session Management

> **Goal:** Users create or join unique rooms via URL instead of everyone sharing one global document.

### Why This Comes First
Everything else (saving rooms to DB, auth, per-room chat) depends on rooms existing. This is the foundation.

### What Changes

**Current behavior:**
- Everyone connects to one Yjs document called `"monaco"`
- No concept of separate sessions

**New behavior:**
- User visits `/` → Landing page with "Create Room" button
- Clicking it generates a UUID and redirects to `/room/abc-123`
- User can share the URL — anyone with the link joins the same room
- Different rooms = different documents, completely isolated

### Frontend Changes

#### 1. Install React Router

```bash
cd frontend
npm install react-router-dom
```

**What is React Router?**
React is a Single Page Application (SPA) — there's only one HTML file. React Router fakes "pages" by swapping components based on the URL, without a full page reload.

#### 2. Create the Route Structure

```
src/
├── main.jsx           ← Wrap <App /> with <BrowserRouter>
├── pages/
│   ├── Home.jsx       ← Landing page with "Create Room" button
│   └── Room.jsx       ← The editor page (current App.jsx logic moves here)
└── app/
    └── App.jsx        ← Just contains <Routes> now
```

**Key concepts to learn:**
- `<BrowserRouter>` — Enables routing in your app
- `<Routes>` and `<Route>` — Define URL → Component mappings
- `useParams()` — Hook to read URL parameters (e.g., the room ID)
- `useNavigate()` — Hook to programmatically redirect users
- `uuid` or `crypto.randomUUID()` — Generate unique room IDs

#### 3. Landing Page (Home.jsx)

```jsx
// When user clicks "Create Room":
const roomId = crypto.randomUUID()   // generates "550e8400-e29b-..."
navigate(`/room/${roomId}`)          // redirects to the room
```

Also include an input field where users can paste a room link to join.

#### 4. Room Page (Room.jsx)

Move your current `App.jsx` editor logic here. The key change:

```jsx
// OLD: hardcoded room name
const provider = new SocketIOProvider("/", "monaco", ydoc, { ... })

// NEW: use the room ID from the URL
const { roomId } = useParams()
const provider = new SocketIOProvider("/", roomId, ydoc, { ... })
```

That's it! The `SocketIOProvider` second argument IS the room name. Different room names = different Yjs documents.

### Backend Changes

**Almost nothing!** The `y-socket.io` library already handles room isolation automatically based on the room name the client provides. You just need to make sure Express serves `index.html` for all routes (so React Router can handle them):

```javascript
// Add this AFTER your API routes, BEFORE the listen() call
app.get("*", (req, res) => {
  res.sendFile("index.html", { root: "public" })
})
```

This is called a **catch-all route**. Without it, visiting `/room/abc-123` directly would return a 404 because Express looks for a file called `room/abc-123` in the public folder.

### Resume Talking Points
- "Implemented client-side routing with React Router for room-based session isolation"
- "Each room maintains an independent CRDT document via Yjs namespace separation"

---

## Phase 2: Rich Collaborative Features

> **Goal:** Show other users' cursors in real-time, add colored labels, and build an in-editor chat.

### 2A. Real-Time Cursors with User Labels

**What it looks like:** You see a colored cursor with a floating name tag (e.g., "Alice" in blue) moving around the editor as the other person types.

**How it works — Awareness Protocol:**
You're already using `provider.awareness` for the user list. We extend it to include cursor position and a color:

```javascript
provider.awareness.setLocalStateField("user", {
  username,
  color: "#3b82f6",        // a unique color per user
  cursor: { line: 5, col: 12 }
})
```

**Monaco Decorations:**
Monaco has a "decorations" API — you can overlay visual elements (colored highlights, labels) on top of the text. For each remote user's cursor position, you create a decoration.

**Key concepts:**
- `editor.deltaDecorations()` — Add/update visual overlays in Monaco
- `awareness.on("change")` — Listen for other users' cursor movements
- CSS injection — You'll dynamically inject CSS for each user's cursor color

**Implementation approach:**
1. Listen for Monaco's `onDidChangeCursorPosition` event
2. When local cursor moves → update awareness state
3. When remote awareness changes → render their cursor as a Monaco decoration
4. Assign each user a random color from a preset palette on join

### 2B. Real-Time Chat

**What it looks like:** A chat panel on the right side of the screen. Messages appear instantly for all users in the room.

**Two approaches:**

| Approach | Pros | Cons |
|----------|------|------|
| **Yjs Y.Array** | Messages persist, sync automatically, survive reconnects | More complex |
| **Raw Socket.IO events** | Simple to implement, you already have Socket.IO | Messages lost on refresh |

**Recommended: Yjs Y.Array** (better for resume)

```javascript
// Create a shared array in the Yjs document
const ymessages = ydoc.getArray("chat")

// Send a message
ymessages.push([{
  username: "Alice",
  text: "Hello!",
  timestamp: Date.now()
}])

// Listen for new messages
ymessages.observe(event => {
  // Update your React state with the new messages
})
```

Since it's a Yjs type, it syncs automatically via the existing SocketIOProvider — no extra backend code needed.

**Frontend components to build:**
- `ChatPanel.jsx` — The chat container
- `ChatMessage.jsx` — Individual message bubble
- `ChatInput.jsx` — Text input with send button

### Resume Talking Points
- "Built real-time cursor presence using Yjs Awareness protocol and Monaco decoration API"
- "Implemented persistent in-room chat using CRDT-backed shared arrays"

---

## Phase 3: Remote Code Execution

> **Goal:** Users click "Run" and see their code's output in a terminal panel below the editor.

### ⚠️ Security Warning — Why Docker Is Essential

**NEVER run user code directly on your server with `eval()` or `child_process.exec()`.**

A malicious user could run:
```javascript
require('fs').unlinkSync('/etc/passwd')  // delete system files
while(true) {}                            // freeze your server
require('child_process').exec('rm -rf /') // destroy everything
```

**Solution:** Run user code inside a **disposable Docker container** with:
- No network access
- Limited CPU and memory
- Auto-kill after a timeout
- A read-only filesystem

### Architecture

```
User clicks "Run"
      ↓
Frontend sends POST /api/execute { code, language }
      ↓
Backend receives the request
      ↓
Backend creates a temp file with the user's code
      ↓
Backend runs: docker run --rm --network=none --memory=64m
              --cpus=0.5 --timeout=10s <image> <command>
      ↓
Docker container executes the code
      ↓
Backend captures stdout/stderr
      ↓
Backend sends output back to frontend
      ↓
Frontend displays it in the terminal panel
```

### Backend Implementation

#### 1. Install Dockerode

```bash
cd backend
npm install dockerode
```

**Dockerode** is a Node.js client for the Docker Engine API. It lets you create, start, stop, and remove containers programmatically.

#### 2. Create the Execution Service

Create `backend/services/codeRunner.js`:

**Key function: `executeCode(language, code)`**

```javascript
import Docker from "dockerode"
const docker = new Docker()  // connects to local Docker daemon

async function executeCode(language, code) {
  // 1. Pick the right Docker image based on language
  const images = {
    javascript: { image: "node:20-alpine", cmd: ["node", "-e", code] },
    python:     { image: "python:3.12-alpine", cmd: ["python3", "-c", code] },
    // add more languages...
  }

  // 2. Create and start a container
  const container = await docker.createContainer({
    Image: images[language].image,
    Cmd: images[language].cmd,
    NetworkDisabled: true,           // no internet access
    HostConfig: {
      Memory: 64 * 1024 * 1024,     // 64MB max RAM
      CpuPeriod: 100000,
      CpuQuota: 50000,              // 50% of one CPU core
      AutoRemove: true,              // delete container when done
    }
  })

  await container.start()

  // 3. Wait for it to finish (with a timeout)
  // 4. Capture and return the output
  // 5. Kill if it takes too long
}
```

**Docker security flags explained:**

| Flag | What It Does |
|------|-------------|
| `NetworkDisabled: true` | Container cannot make any network requests |
| `Memory: 64MB` | Container is killed if it uses more than 64MB RAM |
| `CpuQuota: 50000` | Container gets max 50% of one CPU core |
| `AutoRemove: true` | Container is deleted as soon as it stops |
| Timeout (manual) | We kill the container after 10 seconds |

#### 3. Create the API Route

```javascript
app.post("/api/execute", async (req, res) => {
  const { language, code } = req.body
  const result = await executeCode(language, code)
  res.json(result)  // { stdout: "Hello World\n", stderr: "", exitCode: 0 }
})
```

#### 4. Pre-pull Docker Images

The first time you run code in a language, Docker needs to download the image (~50MB for alpine images). Pre-pull them:

```bash
docker pull node:20-alpine
docker pull python:3.12-alpine
docker pull gcc:14         # for C/C++
```

### Frontend Implementation

#### 1. Terminal Output Component

Create a `Terminal.jsx` component that shows the code output. Style it like a real terminal (dark background, monospace font, green text).

#### 2. Language Selector

Add a dropdown to pick the language (JavaScript, Python, C++). When changed, also update Monaco's syntax highlighting:

```javascript
// Monaco supports language switching at runtime
editor.getModel().setLanguage("python")
```

#### 3. Run Button

```jsx
const handleRun = async () => {
  setIsRunning(true)
  const response = await fetch("/api/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      language: selectedLanguage,
      code: editorRef.current.getValue()
    })
  })
  const result = await response.json()
  setOutput(result.stdout + result.stderr)
  setIsRunning(false)
}
```

### Testing It

```
1. Make sure Docker Desktop / Docker Engine is running on your machine
2. Start the backend: npm run dev
3. Type: console.log("Hello from Docker!")
4. Click Run
5. See "Hello from Docker!" in the terminal panel
```

### Resume Talking Points
- "Built a sandboxed code execution engine using Docker containers with resource limits (CPU, memory, network isolation)"
- "Supports multiple languages (JS, Python, C++) with automatic container lifecycle management"
- "Implemented security measures: network isolation, memory caps, execution timeouts, auto-cleanup"

---

## Phase 4: Database Persistence (MongoDB)

> **Goal:** Save room data and documents to MongoDB so they survive server restarts.

### Why MongoDB?
- Stores documents as JSON (natural fit for JavaScript)
- Free tier on MongoDB Atlas (cloud-hosted, no setup)
- Mongoose ODM makes it easy to define schemas and validate data

### What We're Saving

| Data | Why |
|------|-----|
| Room metadata | Room name, creation date, language, creator |
| Yjs document state | The binary CRDT state so the document persists |
| Chat messages | So chat history is preserved |
| User accounts (Phase 5) | For authentication |

### Setup

```bash
cd backend
npm install mongoose
```

Sign up at [MongoDB Atlas](https://www.mongodb.com/atlas) → Create a free cluster → Get your connection string.

Create a `.env` file:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/collabcode
```

Install dotenv:
```bash
npm install dotenv
```

### Database Schema Design

```
backend/
├── models/
│   ├── Room.js        ← Room metadata + Yjs state
│   └── User.js        ← User accounts (Phase 5)
├── config/
│   └── db.js          ← MongoDB connection logic
```

**Room Model:**
```javascript
const roomSchema = new mongoose.Schema({
  roomId:    { type: String, required: true, unique: true },
  name:      { type: String, default: "Untitled Room" },
  language:  { type: String, default: "javascript" },
  yjsState:  { type: Buffer },  // Binary Yjs document state
  createdAt: { type: Date, default: Date.now },
  lastActive:{ type: Date, default: Date.now },
})
```

**Why `Buffer` for yjsState?**
Yjs documents are encoded as compact binary data (Uint8Array), not JSON. MongoDB's `Buffer` type stores raw binary efficiently.

### Saving & Loading Yjs State

**Saving (when users disconnect or periodically):**
```javascript
import * as Y from "yjs"

// Get the full document state as binary
const state = Y.encodeStateAsUpdate(ydoc)

// Save to MongoDB
await Room.findOneAndUpdate(
  { roomId },
  { yjsState: Buffer.from(state), lastActive: new Date() },
  { upsert: true }  // create if doesn't exist
)
```

**Loading (when a new user joins a room):**
```javascript
const room = await Room.findOne({ roomId })
if (room && room.yjsState) {
  Y.applyUpdate(ydoc, new Uint8Array(room.yjsState))
}
```

### API Routes to Add

```javascript
// Create a new room
app.post("/api/rooms", async (req, res) => { ... })

// Get room info
app.get("/api/rooms/:roomId", async (req, res) => { ... })

// List recent rooms (for dashboard in Phase 5)
app.get("/api/rooms", async (req, res) => { ... })

// Delete a room
app.delete("/api/rooms/:roomId", async (req, res) => { ... })
```

### Hooking Into y-socket.io

The `YSocketIO` instance emits events when documents are updated. You can listen to these to trigger saves:

```javascript
// Save to DB whenever the document changes (debounced)
ySocketIO.on("document-update", async (docName, update) => {
  // docName = the room ID
  // update = the Yjs binary update
  await saveToDatabase(docName, update)
})
```

Use **debouncing** (wait 2 seconds after the last change before saving) to avoid hammering the database on every keystroke.

### Resume Talking Points
- "Implemented CRDT state persistence using MongoDB with binary document encoding"
- "Designed a debounced save mechanism to balance real-time responsiveness with database write efficiency"

---

## Phase 5: Authentication & Dashboard

> **Goal:** Users create accounts, log in, and see a dashboard of their rooms.

### Auth Strategy: JWT + bcrypt

We'll use a simple email/password auth system with JSON Web Tokens. This is easier to implement than OAuth and equally impressive on a resume.

**How JWT Auth Works:**

```
1. User signs up → password is hashed with bcrypt → saved to DB
2. User logs in → server verifies password → server creates a JWT token
3. JWT is sent to the browser → stored in localStorage
4. Every API request includes the JWT in the Authorization header
5. Server verifies the JWT on each request → knows who the user is
```

**What is a JWT?**
A JSON Web Token is a signed string with three parts:
```
header.payload.signature
eyJhbGc...  .  eyJ1c2Vy...  .  SflKxwRJ...
```
- **Header:** Algorithm used (HS256)
- **Payload:** User data (userId, email, role)
- **Signature:** Proof that the token wasn't tampered with

### Setup

```bash
cd backend
npm install jsonwebtoken bcryptjs
```

### User Model

```javascript
const userSchema = new mongoose.Schema({
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },  // stored as bcrypt hash
  name:     { type: String, required: true },
  rooms:    [{ type: String }],  // array of room IDs they've joined
  createdAt:{ type: Date, default: Date.now },
})
```

### Auth Routes

```javascript
// POST /api/auth/signup  → create account
// POST /api/auth/login   → get JWT token
// GET  /api/auth/me      → get current user (requires JWT)
```

### Auth Middleware

A middleware is a function that runs BEFORE your route handler. It checks the JWT:

```javascript
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1]  // "Bearer <token>"
  if (!token) return res.status(401).json({ error: "No token" })

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded  // attach user info to the request
    next()              // continue to the route handler
  } catch {
    res.status(401).json({ error: "Invalid token" })
  }
}

// Usage: protect any route
app.get("/api/rooms", authMiddleware, async (req, res) => {
  // req.user is available here
})
```

### Frontend: Dashboard Page

Add a `/dashboard` page that shows:

```
┌──────────────────────────────────────────────┐
│  Welcome back, Atharva!          [+ New Room]│
├──────────────────────────────────────────────┤
│                                              │
│  📁 Your Rooms                               │
│  ┌────────────────────────────────────────┐  │
│  │ Room: Algorithm Practice               │  │
│  │ Language: Python │ Last active: 2 hrs  │  │
│  │ [Open] [Delete]                        │  │
│  ├────────────────────────────────────────┤  │
│  │ Room: React Component                  │  │
│  │ Language: JavaScript │ Last: 1 day     │  │
│  │ [Open] [Delete]                        │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### Frontend Route Structure (Final)

```
/                → Landing page (hero + CTA)
/login           → Login form
/signup          → Signup form
/dashboard       → User's rooms (protected route)
/room/:roomId    → The collaborative editor
```

**Protected Routes** — Redirect to `/login` if the user doesn't have a valid JWT:

```jsx
function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token")
  if (!token) return <Navigate to="/login" />
  return children
}
```

### Resume Talking Points
- "Implemented JWT-based authentication with bcrypt password hashing"
- "Built protected routes with auth middleware on both frontend and backend"
- "Created a user dashboard with CRUD operations for room management"

---

## Phase 6: Docker Compose — Tying It All Together

> **Goal:** Run the entire stack (backend, frontend, MongoDB) with one command.

### docker-compose.yml

```yaml
version: "3.8"

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/collabcode
      - JWT_SECRET=your-secret-key
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock  # for code execution
    depends_on:
      - mongo

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db  # persist DB data

volumes:
  mongo-data:
```

**Docker Socket Mount (`/var/run/docker.sock`):**
This lets the app container talk to the host's Docker daemon to spin up code execution containers. This is called "Docker-in-Docker" (DinD) via socket.

**One command to run everything:**
```bash
docker compose up --build
```

### Resume Talking Points
- "Containerized the full stack with Docker Compose (app server + MongoDB)"
- "Implemented Docker-in-Docker for isolated code execution"

---

## 📋 Implementation Checklist

Use this to track your progress:

### Phase 1: Room System
- [ ] Install react-router-dom
- [ ] Create Home.jsx with "Create Room" button
- [ ] Create Room.jsx (move editor logic from App.jsx)
- [ ] Update App.jsx with Routes
- [ ] Update SocketIOProvider to use dynamic room ID
- [ ] Add catch-all route in Express
- [ ] Test: two tabs with different room URLs have separate documents

### Phase 2: Collaborative Features
- [ ] Add cursor position to awareness state
- [ ] Render remote cursors as Monaco decorations
- [ ] Assign random colors to users
- [ ] Create ChatPanel component
- [ ] Use Y.Array for synced chat messages
- [ ] Style the chat panel

### Phase 3: Code Execution
- [ ] Install dockerode on backend
- [ ] Create codeRunner service
- [ ] Add POST /api/execute route
- [ ] Add language selector dropdown to frontend
- [ ] Create Terminal output component
- [ ] Add Run button
- [ ] Pre-pull Docker images (node, python)
- [ ] Test with JavaScript and Python

### Phase 4: Database
- [ ] Set up MongoDB Atlas (free tier)
- [ ] Install mongoose
- [ ] Create Room model
- [ ] Save Yjs state on document update (debounced)
- [ ] Load Yjs state when room is opened
- [ ] Add CRUD API routes for rooms

### Phase 5: Auth & Dashboard
- [ ] Create User model
- [ ] Add signup/login routes with bcrypt + JWT
- [ ] Create auth middleware
- [ ] Build Login and Signup pages
- [ ] Build Dashboard page
- [ ] Add protected routes
- [ ] Link rooms to user accounts

### Phase 6: Docker Compose
- [ ] Create docker-compose.yml
- [ ] Add MongoDB service
- [ ] Mount Docker socket for code execution
- [ ] Test full stack with `docker compose up`

---

## 🎯 How to Explain This on Your Resume

### One-Liner
> "CollabCode — A real-time collaborative code editor with sandboxed code execution, built with React, Yjs CRDTs, Socket.IO, Docker, and MongoDB"

### Bullet Points for Resume

- Built a real-time collaborative code editor supporting multiple concurrent users using **Yjs CRDTs** and **Socket.IO WebSockets**
- Designed a **sandboxed code execution engine** using ephemeral Docker containers with CPU, memory, and network isolation
- Implemented **room-based session management** with React Router and Yjs namespace separation
- Developed **JWT authentication** with bcrypt password hashing and protected API routes
- Persisted CRDT document state to **MongoDB** with debounced binary encoding
- Containerized the full stack using **Docker Compose** with multi-stage builds
- Integrated **Monaco Editor** (VS Code's editor) with real-time cursor awareness and in-editor chat

### Interview Talking Points

**"How does the real-time sync work?"**
> "I use Yjs, which implements CRDTs — a data structure where every operation has a unique ID, so conflicts are mathematically impossible. Changes are encoded as compact binary updates and sent over WebSockets via Socket.IO. The server broadcasts updates to all connected clients in the same room."

**"How do you handle security for code execution?"**
> "User code never runs on the host machine. I spin up ephemeral Docker containers with network disabled, 64MB memory cap, 50% CPU limit, and a 10-second timeout. The container is auto-removed after execution."

**"Why not just use Firebase/Supabase?"**
> "I wanted to understand the fundamentals. Building the sync layer with Yjs taught me about CRDTs, binary encoding, and WebSocket lifecycle management. Building auth from scratch taught me JWT, bcrypt, and middleware patterns."

---

*Start with Phase 1 and work your way down. Each phase is designed to be completable in 1-2 days. Good luck! 🚀*
