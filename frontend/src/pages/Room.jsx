import { Editor } from "@monaco-editor/react"
import { MonacoBinding } from "y-monaco"
import { useRef, useState, useEffect, useMemo, useCallback } from "react"
import * as Y from "yjs"
import { SocketIOProvider } from "y-socket.io"
import { useParams, useNavigate } from "react-router-dom"
import CursorManager, { getColorForUsername } from "../components/CursorManager.jsx"
import ChatPanel from "../components/ChatPanel.jsx"

function Room() {
  const { roomId } = useParams()
  const navigate = useNavigate()

  const editorRef = useRef(null)
  const providerRef = useRef(null)

  const [username, setUsername] = useState(() => {
    return localStorage.getItem("collabcode_username") || ""
  })

  const [users, setUsers] = useState([])
  const [copied, setCopied] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [editorReady, setEditorReady] = useState(null)
  const [providerReady, setProviderReady] = useState(null)

  const ydoc = useMemo(() => new Y.Doc(), [])
  const ytext = useMemo(() => ydoc.getText("monaco"), [ydoc])

  const handleEditorMount = (editor) => {
    editorRef.current = editor
    setEditorReady(editor)

    new MonacoBinding(
      ytext,
      editorRef.current.getModel(),
      new Set([editorRef.current]),
    )
  }

  useEffect(() => {
    if (!username) return

    const provider = new SocketIOProvider("/", roomId, ydoc, {
      autoConnect: true,
    })
    providerRef.current = provider
    setProviderReady(provider)

    const color = getColorForUsername(username)

    provider.awareness.setLocalStateField("user", {
      username,
      color,
    })

    const updateUsers = () => {
      const states = Array.from(provider.awareness.getStates().values())
      setUsers(
        states
          .filter((state) => state.user && state.user.username)
          .map((state) => state.user)
      )
    }

    updateUsers()
    provider.awareness.on("change", updateUsers)

    function handleBeforeUnload() {
      provider.awareness.setLocalStateField("user", null)
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      provider.disconnect()
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [username, roomId, ydoc])

  const handleJoin = (e) => {
    e.preventDefault()
    const name = e.target.username.value.trim()
    if (!name) return
    localStorage.setItem("collabcode_username", name)
    setUsername(name)
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExitRoom = () => {
    if (providerRef.current) {
      providerRef.current.awareness.setLocalStateField("user", null)
      providerRef.current.disconnect()
    }
    localStorage.removeItem("collabcode_username")
    setUsername("")
    navigate("/")
  }

  const handleToggleChat = () => {
    setChatOpen((prev) => !prev)
    if (!chatOpen) {
      setUnreadCount(0) // Clear unread when opening
    }
  }

  const handleNewMessage = useCallback(() => {
    if (!chatOpen) {
      setUnreadCount((prev) => prev + 1)
    }
  }, [chatOpen])

  // Username entry screen
  if (!username) {
    return (
      <main className="h-screen w-full bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 max-w-sm w-full px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-1">Join Room</h2>
            <p className="text-gray-400 text-sm font-mono">
              {roomId.slice(0, 8)}...
            </p>
          </div>
          <form onSubmit={handleJoin} className="w-full flex flex-col gap-4">
            <input
              type="text"
              placeholder="Enter your username"
              className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700 
                         focus:border-blue-500 focus:outline-none placeholder-gray-500"
              name="username"
              autoFocus
            />
            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 
                         text-white font-semibold transition-colors cursor-pointer"
            >
              Join
            </button>
          </form>
        </div>
      </main>
    )
  }

  // Editor screen
  return (
    <main className="h-screen w-full bg-gray-950 flex flex-col">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <h1
            className="text-lg font-bold text-white cursor-pointer hover:text-blue-400 transition-colors"
            onClick={() => navigate("/")}
          >
            <span className="text-blue-500">&lt;</span>
            CollabCode
            <span className="text-blue-500">/&gt;</span>
          </h1>
          <span className="text-gray-500 text-sm font-mono">
            Room: {roomId.slice(0, 8)}...
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleCopyLink}
            className="px-4 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 
                       text-sm text-white transition-colors cursor-pointer"
          >
            {copied ? "✓ Copied!" : "📋 Copy Link"}
          </button>
          <span className="text-gray-400 text-sm">
            👤 {username}
          </span>
          <button
            onClick={handleExitRoom}
            className="px-4 py-1.5 rounded-md bg-red-600/80 hover:bg-red-500 
                       text-sm text-white transition-colors cursor-pointer"
          >
            Exit Room
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 gap-4 p-4 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 bg-gray-900 rounded-lg p-4 flex flex-col gap-4 border border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Active Users ({users.length})
          </h2>
          <ul className="space-y-2 overflow-y-auto">
            {users.map((user, index) => (
              <li
                key={index}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-white rounded-lg text-sm"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: user.color || "#22c55e" }}
                ></span>
                {user.username}
                {user.username === username && (
                  <span className="text-gray-500 text-xs ml-auto">(you)</span>
                )}
              </li>
            ))}
          </ul>
        </aside>

        {/* Editor */}
        <section className="flex-1 bg-neutral-800 rounded-lg overflow-hidden border border-gray-800">
          <Editor
            padding={10}
            height="100%"
            defaultLanguage="javascript"
            defaultValue="// Start coding here..."
            theme="vs-dark"
            onMount={handleEditorMount}
          />
          {/* CursorManager renders remote cursors as Monaco decorations — no visible DOM */}
          <CursorManager
            editor={editorReady}
            provider={providerReady}
            username={username}
          />
        </section>

        {/* Chat Panel */}
        <ChatPanel
          ydoc={ydoc}
          username={username}
          isOpen={chatOpen}
          onToggle={handleToggleChat}
          unreadCount={unreadCount}
          onMessageReceived={handleNewMessage}
        />
      </div>
    </main>
  )
}

export default Room
