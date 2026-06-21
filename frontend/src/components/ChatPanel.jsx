import { useState, useEffect, useRef, useMemo } from "react"

/**
 * ChatPanel — A real-time chat panel synced via Yjs Y.Array.
 *
 * How it works:
 * - Messages are stored in a Yjs Y.Array (a CRDT list)
 * - When you send a message, it gets pushed to the Y.Array
 * - The Y.Array syncs automatically via the existing SocketIOProvider
 * - No extra backend code needed — Yjs handles it all
 *
 * Props:
 *   - ydoc: the Yjs document instance
 *   - username: the local user's name
 *   - isOpen: whether the chat panel is visible
 *   - onToggle: callback to toggle chat visibility
 *   - unreadCount: number of unread messages (managed by parent)
 */
function ChatPanel({ ydoc, username, isOpen, onToggle, unreadCount, onMessageReceived }) {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState("")
  const messagesEndRef = useRef(null)
  const ymessages = useMemo(() => ydoc.getArray("chat"), [ydoc])

  // Sync messages from Y.Array → React state
  useEffect(() => {
    const updateMessages = () => {
      setMessages(ymessages.toArray())
    }

    // Load existing messages
    updateMessages()

    // Listen for changes (new messages from any user)
    // We use a named function so observe/unobserve use the same reference
    const handleObserve = (event) => {
      updateMessages()

      // Only count remote messages for the unread badge
      // event.transaction.local is true when WE sent the message
      if (event.changes.added.size > 0 && !event.transaction.local && onMessageReceived) {
        onMessageReceived()
      }
    }

    ymessages.observe(handleObserve)

    return () => {
      ymessages.unobserve(handleObserve)
    }
  }, [ymessages, onMessageReceived])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isOpen])

  const handleSend = (e) => {
    e.preventDefault()
    const text = inputValue.trim()
    if (!text) return

    ymessages.push([
      {
        username,
        text,
        timestamp: Date.now(),
      },
    ])

    setInputValue("")
  }

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-blue-600 
                   hover:bg-blue-500 text-white flex items-center justify-center 
                   shadow-lg transition-colors cursor-pointer z-50"
      >
        💬
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 
                       text-xs flex items-center justify-center font-bold"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="w-72 bg-gray-900 rounded-lg border border-gray-800 flex flex-col overflow-hidden">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          Chat
        </h3>
        <button
          onClick={onToggle}
          className="text-gray-500 hover:text-gray-300 text-lg cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <p className="text-gray-600 text-sm text-center py-4">
            No messages yet. Say hi! 👋
          </p>
        )}
        {messages.map((msg, index) => {
          const isMe = msg.username === username
          return (
            <div key={index} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              {/* Show username for other users */}
              {!isMe && (
                <span className="text-xs text-gray-500 mb-0.5 px-1">
                  {msg.username}
                </span>
              )}
              <div
                className={`max-w-[85%] px-3 py-1.5 rounded-lg text-sm break-words ${
                  isMe
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-gray-800 text-gray-200 rounded-bl-none"
                }`}
              >
                {msg.text}
              </div>
              <span className="text-xs text-gray-600 mt-0.5 px-1">
                {formatTime(msg.timestamp)}
              </span>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 rounded-lg bg-gray-800 text-white text-sm
                       border border-gray-700 focus:border-blue-500 focus:outline-none
                       placeholder-gray-500"
          />
          <button
            type="submit"
            className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 
                       text-white text-sm transition-colors cursor-pointer"
          >
            ➤
          </button>
        </div>
      </form>
    </div>
  )
}

export default ChatPanel
