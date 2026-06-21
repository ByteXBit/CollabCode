# 🚀 CollabCode — Real-Time Collaborative Code Editor

> A full-stack collaborative code editor where multiple users can type in the same file at the same time, seeing each other's changes instantly — like Google Docs, but for code.

**Built with:** React · Monaco Editor · Yjs · Socket.IO · Express · Docker

---

## 📖 Table of Contents

1. [What Does This Project Do?](#-what-does-this-project-do)
2. [The Big Picture — Architecture](#-the-big-picture--architecture)
3. [Concepts You Will Learn](#-concepts-you-will-learn)
4. [Project Structure — Every File Explained](#-project-structure--every-file-explained)
5. [Backend Deep Dive — server.js](#-backend-deep-dive--serverjs)
6. [Frontend Deep Dive — App.jsx](#-frontend-deep-dive--appjsx)
7. [The Magic of Yjs — How Real-Time Sync Works](#-the-magic-of-yjs--how-real-time-sync-works)
8. [Docker & Multi-Stage Builds](#-docker--multi-stage-builds)
9. [How to Run the Project](#-how-to-run-the-project)
10. [Glossary](#-glossary)

---

## 🎯 What Does This Project Do?

Imagine you and your friend are both looking at the same code file. You type on line 1, your friend types on line 10 — and you **both** see each other's changes **instantly**, without pressing "Save" or "Refresh".

That's exactly what this project does. It's a **real-time collaborative code editor**.

### The User Flow:

```
1. User opens the app → sees a "Enter your username" form
2. User types their name and clicks "Join"
3. They land on a page with:
   - LEFT SIDE:  A list of all users currently editing
   - RIGHT SIDE: A code editor (Monaco — the same one VS Code uses)
4. Whatever they type appears on every other user's screen INSTANTLY
```

---

## 🏗 The Big Picture — Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      THE BROWSER                        │
│                                                         │
│  ┌──────────────┐    ┌────────────────────────────┐     │
│  │ Active Users │    │   Monaco Code Editor       │     │
│  │ Sidebar      │    │   (VS Code in the browser) │     │
│  │              │    │                            │     │
│  │ • Alice      │    │   const x = 10;            │     │
│  │ • Bob        │    │   console.log(x);  ← YOU   │     │
│  │ • You        │    │                    TYPE     │     │
│  └──────────────┘    └────────────────────────────┘     │
│         │                        │                      │
│         │    Yjs (CRDT Magic)    │                      │
│         └────────┬───────────────┘                      │
│                  │                                      │
│          Socket.IO Connection                           │
│          (WebSocket under the hood)                     │
└──────────────────┼──────────────────────────────────────┘
                   │
                   │  Real-time two-way communication
                   │
┌──────────────────┼──────────────────────────────────────┐
│                  │        THE SERVER                    │
│                  ▼                                      │
│  ┌──────────────────────────────┐                      │
│  │   Express + Socket.IO        │                      │
│  │   YSocketIO (Yjs Server)     │                      │
│  │                              │                      │
│  │   Receives changes from      │                      │
│  │   User A, broadcasts to      │                      │
│  │   User B, C, D...            │                      │
│  └──────────────────────────────┘                      │
│                                                         │
│  Also serves the built frontend                         │
│  files from the /public folder                          │
└─────────────────────────────────────────────────────────┘
```

---

## 🧠 Concepts You Will Learn

### 1. WebSockets & Socket.IO

**The Problem:** Normal HTTP is like sending letters. You send a request, wait for a response. That's too slow for real-time editing.

**The Solution:** WebSockets are like a phone call — once connected, both sides can talk whenever they want, instantly.

**Socket.IO** is a library that makes WebSockets easy. It handles:
- Automatic reconnection if the connection drops
- Fallback to HTTP polling if WebSockets aren't supported
- Room-based messaging

```
HTTP (Traditional):
  Browser: "Hey server, any updates?" → Server: "Nope"
  Browser: "Hey server, any updates?" → Server: "Nope"
  Browser: "Hey server, any updates?" → Server: "Yes! Here."
  (This is called POLLING — very wasteful)

WebSocket:
  Browser ←————————————→ Server
  (Always connected. Server pushes updates the INSTANT they happen)
```

### 2. CRDTs & Yjs (Conflict-Free Replicated Data Types)

**The Problem:** What happens when two users type at the same position at the exact same time? Whose change wins?

**The Solution:** **CRDTs** — a data structure designed so that conflicts are *mathematically impossible*. Every change from every user can be merged automatically without any conflicts.

**Yjs** is a JavaScript implementation of CRDTs. Think of it like this:

```
Normal string:  "Hello World"
                 → If Alice inserts "X" at position 5
                 → And Bob deletes position 5
                 → CONFLICT! What's the final state?

Yjs Y.Text:     Each character has a unique ID
                 → Alice's insert and Bob's delete are
                    independent operations
                 → Yjs merges them automatically
                 → No conflict, ever.
```

**Key Yjs concepts used in this project:**
| Concept | What It Is | Where We Use It |
|---------|-----------|-----------------|
| `Y.Doc` | The main Yjs document. A container for all shared data. | `new Y.Doc()` in App.jsx |
| `Y.Text` | A shared text type — like a collaborative string. | `ydoc.getText("monaco")` |
| `Provider` | Connects your Y.Doc to other users via a network. | `SocketIOProvider` |
| `Awareness` | Lightweight state for non-document data (cursors, usernames). | `provider.awareness` |
| `MonacoBinding` | Glues Y.Text to the Monaco Editor so edits flow both ways. | `new MonacoBinding(...)` |

### 3. Monaco Editor

Monaco is the **exact same code editor** that powers VS Code. When you use it in the browser, you get:
- Syntax highlighting for 50+ languages
- IntelliSense / autocomplete
- Multiple cursor support
- Find and replace
- Minimap

We use the `@monaco-editor/react` package which wraps Monaco in a React component.

### 4. React Hooks Used

| Hook | What It Does | How We Use It |
|------|-------------|---------------|
| `useState` | Stores a value that, when changed, re-renders the component. | Storing `username` and `users` list |
| `useRef` | Stores a value that does NOT cause re-renders. Perfect for DOM refs. | Storing the Monaco editor instance |
| `useEffect` | Runs side-effect code after render (API calls, subscriptions). | Connecting to Socket.IO when username is set |
| `useMemo` | Caches a computed value so it's not re-created on every render. | Creating `Y.Doc` and `Y.Text` only once |

### 5. Express.js

A minimal web framework for Node.js. In our project it does two things:
1. **Serves static files** — The built React app (HTML, CSS, JS) from the `/public` folder
2. **Health check endpoint** — A simple `/health` route to verify the server is alive

### 6. Docker & Multi-Stage Builds

Docker lets you package your entire app (code + dependencies + runtime) into a portable container.

**Multi-stage builds** use multiple `FROM` instructions in one Dockerfile to keep the final image small:

```
Stage 1 (Builder): Install ALL dependencies, build the React app → produces /dist
Stage 2 (Runner):  Copy ONLY the built files + backend code → small, clean image
```

---

## 📁 Project Structure — Every File Explained

```
DOCKER-AWS/
│
├── 📄 dockerfile              ← Packages the entire app into a Docker container
├── 📄 .dockerignore            ← Files Docker should ignore (like .gitignore for Docker)
│
├── 📂 backend/                 ← The Node.js server
│   ├── 📄 package.json         ← Backend dependencies & scripts
│   ├── 📄 server.js            ← THE main server file (Express + Socket.IO + Yjs)
│   └── 📂 public/              ← Where the built frontend gets copied to (served as static files)
│       └── 📄 index.html       ← The production frontend entry point (after build)
│
├── 📂 frontend/                ← The React application
│   ├── 📄 package.json         ← Frontend dependencies & scripts
│   ├── 📄 vite.config.js       ← Vite bundler configuration
│   ├── 📄 eslint.config.js     ← Code quality/linting rules
│   ├── 📄 index.html           ← The HTML shell that React mounts into
│   └── 📂 src/
│       ├── 📄 main.jsx         ← React entry point — renders <App /> into the DOM
│       └── 📂 app/
│           ├── 📄 App.jsx      ← THE main component (editor + users + Yjs logic)
│           └── 📄 App.css      ← Imports TailwindCSS
```

---

## 🔧 Backend Deep Dive — server.js

Let's go through the backend **line by line**.

### The Imports

```javascript
import express from "express"
```
**`express`** — A web framework for Node.js. It lets you create a web server in a few lines. Without it, you'd have to manually parse HTTP requests, handle routing, etc.

```javascript
import { createServer } from "http"
```
**`createServer`** — Built into Node.js. Creates a raw HTTP server. We need this because Socket.IO requires a raw HTTP server to attach to (it can't attach to just an Express app).

```javascript
import { Server } from "socket.io"
```
**`Server`** — The Socket.IO server class. This upgrades the HTTP server to support WebSocket connections.

```javascript
import { YSocketIO } from "y-socket.io/dist/server"
```
**`YSocketIO`** — The Yjs plugin for Socket.IO. It automatically syncs Yjs documents across all connected clients. Without this, you'd have to manually handle Yjs update messages yourself.

### Setting Up The Server

```javascript
const app = express()
```
Creates an Express application. Think of `app` as your web server that can handle routes and middleware.

```javascript
app.use(express.static("public"))
```
**`express.static()`** — A built-in middleware function. It tells Express: "If someone requests a file (like `index.html`, `style.css`, `app.js`), look for it in the `public/` folder and serve it."

This is how the React frontend gets served in production. After `npm run build`, the built files go into `public/`, and this line serves them.

```javascript
const httpServer = createServer(app)
```
Wraps the Express app in a raw HTTP server. This is necessary because:
- Express alone only handles HTTP requests
- Socket.IO needs access to the raw HTTP server to establish WebSocket connections
- Both Express routes AND WebSocket connections now share the same server on port 3000

```javascript
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})
```
Creates a Socket.IO server attached to the HTTP server.

**CORS (Cross-Origin Resource Sharing):**
- During development, your frontend runs on `localhost:5173` (Vite) and backend on `localhost:3000`
- Browsers block requests between different origins by default (security feature)
- `origin: "*"` means "allow connections from anywhere" (fine for development, restrict in production!)

```javascript
const ySocketIO = new YSocketIO(io)
ySocketIO.initialize()
```
This is where the magic happens. `YSocketIO`:
1. Listens for new Socket.IO connections
2. When a client connects, it syncs the Yjs document state to them
3. When a client makes an edit, it broadcasts the Yjs update to all other clients
4. Handles all the CRDT merging logic automatically

**You don't have to write any sync logic yourself.** These two lines replace hundreds of lines of manual code.

### The Health Check Route

```javascript
app.get("/health", (req, res) => {
  res.status(200).json({
    message: "Server is healthy",
    success: true
  })
})
```
**`app.get(path, handler)`** — Registers a route. When someone visits `http://localhost:3000/health`, this handler runs.

**Why is this useful?**
- Docker can use it to check if the container is alive (`HEALTHCHECK` instruction)
- AWS load balancers ping health endpoints to decide if a server should receive traffic
- You can quickly verify the backend is running

### Starting the Server

```javascript
httpServer.listen(3000, () => {
  console.log("Server is running on port 3000")
})
```
Starts listening for connections on port 3000. The callback runs once the server is ready.

---

## ⚛️ Frontend Deep Dive — App.jsx

### The Imports

```javascript
import { Editor } from "@monaco-editor/react"
```
A React wrapper around the Monaco Editor. Gives us a `<Editor />` component.

```javascript
import { MonacoBinding } from "y-monaco"
```
The glue between Yjs and Monaco. It:
- Listens for changes in the Monaco Editor → pushes them to the Yjs document
- Listens for changes in the Yjs document → applies them to the Monaco Editor

```javascript
import { useRef, useState, useEffect, useMemo } from "react"
```
React hooks (explained in the concepts section above).

```javascript
import * as Y from "yjs"
```
The Yjs library. `* as Y` imports everything under the namespace `Y`, so you write `Y.Doc`, `Y.Text`, etc.

```javascript
import { SocketIOProvider } from "y-socket.io"
```
Connects your local `Y.Doc` to the server via Socket.IO. This is the "transport layer" — it doesn't care about what's in the document, it just sends Yjs update bytes back and forth.

### State & Refs

```javascript
const editorRef = useRef(null)
```
**Why `useRef` and not `useState`?**
We need a reference to the Monaco editor instance to bind Yjs to it. But we do NOT want the component to re-render when we store this reference. `useRef` is perfect — it holds a value without triggering re-renders.

```javascript
const [username, setUsername] = useState(() => {
  return new URLSearchParams(window.location.search).get("username") || ""
})
```
**Lazy initialization of state.** The function inside `useState(()=> ...)` runs only ONCE on the first render. It reads the URL query parameter `?username=Alice` so that if you share the link, the username is pre-filled.

**`URLSearchParams`** — A built-in browser API for parsing URL query strings:
```
URL: http://localhost:5173/?username=Alice
new URLSearchParams("?username=Alice").get("username")  →  "Alice"
```

```javascript
const [users, setUsers] = useState([])
```
Stores the list of currently active users. Updated whenever Yjs awareness state changes.

### Creating the Yjs Document (useMemo)

```javascript
const ydoc = useMemo(() => new Y.Doc(), [])
const ytext = useMemo(() => ydoc.getText("monaco"), [ydoc])
```
**Why `useMemo`?**
Without `useMemo`, every time the component re-renders, `new Y.Doc()` would create a brand new document — breaking the sync. `useMemo(() => ..., [])` ensures the document is created exactly ONCE and reused on every render.

- **`Y.Doc()`** — Creates a new Yjs document (the container).
- **`ydoc.getText("monaco")`** — Creates (or retrieves) a shared text type named `"monaco"` inside the document. The name `"monaco"` is arbitrary — it just needs to match on all clients.

### Binding Monaco to Yjs (onMount)

```javascript
const handleoMount = (editor) => {
  editorRef.current = editor

  new MonacoBinding(
    ytext,                          // The Yjs shared text
    editorRef.current.getModel(),   // The Monaco text model
    new Set([editorRef.current]),   // The set of editors to bind
  )
}
```
This runs when the Monaco Editor has fully loaded. Here's what each argument does:

| Argument | What It Is |
|----------|-----------|
| `ytext` | The Yjs Y.Text instance — the "source of truth" for the document content |
| `editor.getModel()` | The Monaco "model" — its internal representation of the text content |
| `new Set([editor])` | Which editors to sync cursors for (we only have one) |

After this binding is created, a two-way sync is active:
```
You type in Monaco → MonacoBinding detects the change → updates Y.Text
                                                          ↓
                                                   SocketIOProvider sends
                                                   update to server
                                                          ↓
                                                   Server broadcasts to
                                                   all other clients
                                                          ↓
                                              Their MonacoBinding receives
                                              the Y.Text update → updates
                                              their Monaco Editor
```

### Connecting to the Server (useEffect)

```javascript
useEffect(() => {
  if (username) {
    const provider = new SocketIOProvider("/", "monaco", ydoc, {
      autoConnect: true,
    })
```
**`SocketIOProvider(serverUrl, roomName, ydoc, options)`:**
- `"/"` — Connect to the same server that served the page (in production)
- `"monaco"` — The room name. All clients with the same room name share the same document
- `ydoc` — The local Yjs document to sync
- `autoConnect: true` — Connect immediately

### Awareness — Showing Active Users

```javascript
provider.awareness.setLocalStateField("user", {
  username
})
```
**Awareness** is a Yjs feature for sharing lightweight, temporary state that is NOT part of the document. Perfect for:
- Who is online
- Cursor positions
- Selection ranges
- User names and colors

`setLocalStateField("user", { username })` says: "My awareness state has a field called `user` with my username."

```javascript
provider.awareness.on("change", () => {
  const states = Array.from(provider.awareness.getStates().values())
  setUsers(
    states
      .filter(state => state.user && state.user.username)
      .map(state => state.user)
  )
})
```
Whenever ANY user's awareness state changes (someone joins, leaves, or updates), this fires. It:
1. Gets all awareness states (a `Map` of clientID → state)
2. Filters out entries without a username
3. Extracts just the `user` object
4. Updates our React state → the sidebar re-renders

### Cleanup on Page Close

```javascript
function handleBeforeUnload() {
  provider.awareness.setLocalStateField("user", null)
}
window.addEventListener("beforeunload", handleBeforeUnload)
```
When the user closes the tab or navigates away:
1. Sets their awareness `user` field to `null` (removing them from the active users list)
2. The `beforeunload` browser event fires right before the page unloads

The `useEffect` cleanup function disconnects the provider and removes the event listener:
```javascript
return () => {
  provider.disconnect()
  window.removeEventListener("beforeunload", handleBeforeUnload)
}
```

### The Join Form (Conditional Rendering)

```javascript
if (!username) {
  return (
    <main className="h-screen w-full bg-gray-950 flex items-center justify-center">
      <form onSubmit={handleJoin} className="flex flex-col gap-4">
        <input type="text" placeholder="Enter your username" name="username" ... />
        <button type="submit" ...>Join</button>
      </form>
    </main>
  )
}
```
**Conditional rendering** — If no username is set, show the join form instead of the editor. This is a common React pattern: render different UI based on state.

```javascript
const handleJoin = (e) => {
  e.preventDefault()
  setUsername(e.target.username.value.trim())
  window.history.pushState(null, "", `?username=${e.target.username.value.trim()}`)
}
```
- **`e.preventDefault()`** — Stops the form from doing a full page reload (default browser behavior)
- **`e.target.username.value`** — Gets the input value using the input's `name` attribute
- **`.trim()`** — Removes whitespace from both ends
- **`window.history.pushState()`** — Updates the URL without reloading the page, so the username persists in the URL

---

## 🪄 The Magic of Yjs — How Real-Time Sync Works

Here's the complete flow when you type a character:

```
Step 1: You press "A" on your keyboard
         ↓
Step 2: Monaco Editor inserts "A" into its internal text model
         ↓
Step 3: MonacoBinding detects the Monaco change
         ↓
Step 4: MonacoBinding applies the change to the local Y.Text
         ↓
Step 5: Y.Doc generates an "update" (a compact binary diff)
         ↓
Step 6: SocketIOProvider sends this update over WebSocket to the server
         ↓
Step 7: YSocketIO (server) receives the update
         ↓
Step 8: Server broadcasts the update to ALL other connected clients
         ↓
Step 9: Other clients' SocketIOProvider receives the update
         ↓
Step 10: Their Y.Doc applies the update to their local Y.Text
         ↓
Step 11: Their MonacoBinding detects the Y.Text change
         ↓
Step 12: Their Monaco Editor displays the new character

Total time: ~50-100 milliseconds
```

---

## 🐳 Docker & Multi-Stage Builds

### The Dockerfile Explained

```dockerfile
# ──── STAGE 1: Build the frontend ────
FROM node:20-alpine AS frontend-builder
# Uses a lightweight Node.js 20 image based on Alpine Linux (~50MB vs ~350MB for full)
# "AS frontend-builder" gives this stage a name we can reference later

COPY ./frontend /app
# Copies your frontend source code into the container's /app directory

WORKDIR /app
# Sets the working directory (like "cd /app")

RUN npm install
# Installs all frontend dependencies (react, vite, yjs, etc.)

RUN npm run build
# Runs "vite build" → compiles React + JSX into plain HTML/CSS/JS in /app/dist


# ──── STAGE 2: Production server ────
FROM node:20-alpine
# Starts a FRESH, clean image (Stage 1's node_modules are NOT carried over)

COPY ./backend /app
WORKDIR /app
RUN npm install
# Sets up the backend

COPY --from=frontend-builder /app/dist /app/public
# THIS is the multi-stage magic:
# Copies ONLY the built files from Stage 1 into the backend's public/ folder
# All the frontend node_modules, source code, etc. are LEFT BEHIND
# Result: a much smaller final image

CMD ["node", "server.js"]
# The command that runs when the container starts
```

### .dockerignore

```
.env
node_modules
```
Tells Docker: "Don't copy these files into the image." This makes builds faster and images smaller (node_modules get installed fresh inside the container anyway).

---

## 🏃 How to Run the Project

### Development Mode (Two Terminals)

**Terminal 1 — Backend:**
```bash
cd backend
npm install
npm run dev    # starts the server on port 3000 with auto-restart (nodemon)
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm install
npm run dev    # starts Vite dev server on port 5173 with hot-reload
```

Open `http://localhost:5173` in your browser.

### Production Mode with Docker

```bash
# Build the Docker image
docker build -t collabcode .

# Run the container
docker run -p 3000:3000 collabcode
```

Open `http://localhost:3000` in your browser.

---

## 📚 Glossary

| Term | Meaning |
|------|---------|
| **WebSocket** | A protocol for persistent, two-way communication between browser and server |
| **Socket.IO** | A library that makes WebSockets easy with auto-reconnect and fallbacks |
| **CRDT** | Conflict-free Replicated Data Type — a data structure that allows automatic conflict resolution |
| **Yjs** | A JavaScript CRDT implementation for building collaborative apps |
| **Y.Doc** | The main Yjs document container that holds all shared data types |
| **Y.Text** | A Yjs shared data type for collaborative text editing |
| **Awareness** | A Yjs feature for sharing ephemeral state (cursors, usernames) |
| **Provider** | A Yjs plugin that handles network sync (Socket.IO, WebRTC, etc.) |
| **Monaco** | The code editor that powers VS Code, usable in the browser |
| **MonacoBinding** | Glue code that syncs Y.Text ↔ Monaco Editor |
| **Express** | A minimal web framework for Node.js |
| **Middleware** | Functions that process requests before they reach your route handlers |
| **CORS** | Cross-Origin Resource Sharing — browser security mechanism for cross-domain requests |
| **Vite** | A fast frontend build tool and dev server |
| **Docker** | A platform for packaging apps into portable containers |
| **Multi-Stage Build** | A Docker technique using multiple `FROM` stages to produce smaller images |
| **Alpine** | A tiny Linux distribution (~5MB) commonly used as a Docker base image |
| **ESLint** | A tool that analyzes your code for errors and style issues |
| **TailwindCSS** | A utility-first CSS framework (classes like `bg-gray-950`, `flex`, `p-6`) |
| **JSX** | JavaScript XML — lets you write HTML-like syntax in JavaScript (React feature) |
| **Hot Module Replacement** | Vite feature that updates your app in the browser without a full page reload |

---

## 🗺️ What's Next?

This project has a solid foundation. Future improvements could include:

- **Room System** — Create unique room URLs so different groups can collaborate separately
- **Code Execution** — Run the code inside Docker containers and show output
- **Authentication** — Add user login with GitHub/Google OAuth
- **Database Persistence** — Save documents so they survive server restarts
- **Cursor Awareness** — Show other users' cursors with their names in the editor
- **CI/CD Pipeline** — Auto-deploy to AWS with GitHub Actions

---

*Built with ❤️ as a learning project for real-time systems, Docker, and collaborative editing.*
