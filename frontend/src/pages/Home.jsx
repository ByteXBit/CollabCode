import { useState } from "react"
import { useNavigate } from "react-router-dom"

function Home() {
  const [joinRoomId, setJoinRoomId] = useState("")
  const navigate = useNavigate()

  const handleCreateRoom = () => {
    const roomId = crypto.randomUUID()
    navigate(`/room/${roomId}`)
  }

  const handleJoinRoom = (e) => {
    e.preventDefault()
    const trimmed = joinRoomId.trim()
    if (!trimmed) return

    // Support pasting full URLs like http://localhost:5173/room/abc-123
    // or just the room ID directly
    const match = trimmed.match(/\/room\/(.+)$/)
    const id = match ? match[1] : trimmed
    navigate(`/room/${id}`)
  }

  return (
    <main className="h-screen w-full bg-gray-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-8 max-w-md w-full px-6">

        {/* Logo / Title */}
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-2">
            <span className="text-blue-500">&lt;</span>
            CollabCode
            <span className="text-blue-500">/&gt;</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Real-time collaborative code editor
          </p>
        </div>

        {/* Create Room */}
        <button
          onClick={handleCreateRoom}
          className="w-full py-3 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 
                     text-white font-semibold text-lg transition-colors cursor-pointer"
        >
          + Create New Room
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 w-full">
          <div className="flex-1 h-px bg-gray-700"></div>
          <span className="text-gray-500 text-sm">or join existing</span>
          <div className="flex-1 h-px bg-gray-700"></div>
        </div>

        {/* Join Room */}
        <form onSubmit={handleJoinRoom} className="w-full flex gap-3">
          <input
            type="text"
            placeholder="Paste room ID or link..."
            value={joinRoomId}
            onChange={(e) => setJoinRoomId(e.target.value)}
            className="flex-1 p-3 rounded-lg bg-gray-800 text-white border border-gray-700 
                       focus:border-blue-500 focus:outline-none placeholder-gray-500"
          />
          <button
            type="submit"
            className="px-6 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 
                       text-white font-semibold transition-colors cursor-pointer"
          >
            Join
          </button>
        </form>

      </div>
    </main>
  )
}

export default Home
