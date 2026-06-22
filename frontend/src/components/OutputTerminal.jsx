import { useState, useRef, useEffect } from "react"

/**
 * OutputTerminal — Displays code execution output styled like a terminal.
 *
 * Props:
 *   - output: string (stdout + stderr combined)
 *   - isRunning: boolean (shows a spinner while code is executing)
 *   - exitCode: number | null (0 = success, non-zero = error)
 *   - isOpen: boolean (whether the terminal panel is visible)
 *   - onToggle: callback to toggle visibility
 */
function OutputTerminal({ output, isRunning, exitCode, isOpen, onToggle }) {
  const outputRef = useRef(null)

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])

  if (!isOpen) return null

  return (
    <div className="h-48 bg-gray-950 rounded-lg border border-gray-800 flex flex-col overflow-hidden">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500"></span>
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
          </div>
          <span className="text-gray-400 text-xs font-mono ml-2">Output</span>
        </div>
        <div className="flex items-center gap-3">
          {exitCode !== null && !isRunning && (
            <span className={`text-xs font-mono ${exitCode === 0 ? "text-green-400" : "text-red-400"}`}>
              exit: {exitCode}
            </span>
          )}
          <button
            onClick={onToggle}
            className="text-gray-500 hover:text-gray-300 text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Terminal Output */}
      <div
        ref={outputRef}
        className="flex-1 p-3 overflow-y-auto font-mono text-sm"
      >
        {isRunning ? (
          <div className="flex items-center gap-2 text-gray-400">
            <span className="animate-spin">⟳</span>
            <span>Running...</span>
          </div>
        ) : output ? (
          <pre className="text-gray-200 whitespace-pre-wrap break-words">{output}</pre>
        ) : (
          <span className="text-gray-600">Click ▶ Run to execute your code</span>
        )}
      </div>
    </div>
  )
}

export default OutputTerminal
