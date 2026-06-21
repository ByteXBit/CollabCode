import { useEffect, useRef } from "react"

// Predefined color palette for user cursors
const CURSOR_COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#22c55e", // green
  "#f59e0b", // amber
  "#a855f7", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
]

/**
 * Picks a consistent color for a username by hashing it.
 * Same username always gets the same color.
 */
function getColorForUsername(username) {
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}

/**
 * CursorManager — Renders remote users' cursors and selections in the Monaco editor.
 *
 * How it works:
 * 1. When the local user moves their cursor, we update the Yjs awareness state
 * 2. When a remote user's awareness state changes, we render their cursor as a Monaco "decoration"
 * 3. Decorations are CSS-styled overlays that sit on top of the editor text
 *
 * Props:
 *   - editor: the Monaco editor instance
 *   - provider: the SocketIOProvider instance (has .awareness)
 *   - username: the local user's name (so we skip rendering our own remote cursor)
 */
function CursorManager({ editor, provider, username }) {
  const decorationsRef = useRef([])
  const styleRef = useRef(null)

  useEffect(() => {
    if (!editor || !provider) return

    // Create a <style> tag to inject cursor CSS dynamically
    const styleEl = document.createElement("style")
    document.head.appendChild(styleEl)
    styleRef.current = styleEl

    // Listen for local cursor movements → broadcast via awareness
    const cursorDisposable = editor.onDidChangeCursorPosition((e) => {
      const selection = editor.getSelection()
      provider.awareness.setLocalStateField("cursor", {
        position: {
          lineNumber: e.position.lineNumber,
          column: e.position.column,
        },
        selection: selection
          ? {
              startLineNumber: selection.startLineNumber,
              startColumn: selection.startColumn,
              endLineNumber: selection.endLineNumber,
              endColumn: selection.endColumn,
            }
          : null,
      })
    })

    // Listen for remote cursor changes → render decorations
    const handleAwarenessChange = () => {
      const states = Array.from(provider.awareness.getStates().entries())
      const localClientId = provider.awareness.clientID

      const newDecorations = []
      let cssRules = ""

      for (const [clientId, state] of states) {
        // Skip our own cursor
        if (clientId === localClientId) continue
        if (!state.user || !state.user.username || !state.cursor) continue

        const remoteUser = state.user.username
        const color = getColorForUsername(remoteUser)
        const cursor = state.cursor
        const className = `remote-cursor-${clientId}`
        const labelClassName = `remote-cursor-label-${clientId}`

        // CSS for the cursor line (a thin colored bar)
        cssRules += `
          .${className} {
            background: ${color} !important;
            width: 2px !important;
            margin-left: -1px;
          }
          .${labelClassName} {
            background: ${color};
            color: white;
            font-size: 11px;
            font-weight: 600;
            padding: 1px 6px;
            border-radius: 3px 3px 3px 0;
            position: relative;
            top: -1.4em;
            white-space: nowrap;
            z-index: 100;
          }
        `

        // Cursor decoration (the thin colored bar)
        newDecorations.push({
          range: {
            startLineNumber: cursor.position.lineNumber,
            startColumn: cursor.position.column,
            endLineNumber: cursor.position.lineNumber,
            endColumn: cursor.position.column,
          },
          options: {
            className: className,
            stickiness: 1, // NeverGrowsWhenTypingAtEdges
          },
        })

        // Username label decoration (floating above the cursor)
        newDecorations.push({
          range: {
            startLineNumber: cursor.position.lineNumber,
            startColumn: cursor.position.column,
            endLineNumber: cursor.position.lineNumber,
            endColumn: cursor.position.column,
          },
          options: {
            after: {
              content: remoteUser,
              inlineClassName: labelClassName,
            },
            stickiness: 1,
          },
        })

        // Selection highlight (if the remote user has text selected)
        if (
          cursor.selection &&
          (cursor.selection.startLineNumber !== cursor.selection.endLineNumber ||
            cursor.selection.startColumn !== cursor.selection.endColumn)
        ) {
          const selClassName = `remote-selection-${clientId}`
          cssRules += `
            .${selClassName} {
              background: ${color}33 !important;
            }
          `
          newDecorations.push({
            range: {
              startLineNumber: cursor.selection.startLineNumber,
              startColumn: cursor.selection.startColumn,
              endLineNumber: cursor.selection.endLineNumber,
              endColumn: cursor.selection.endColumn,
            },
            options: {
              className: selClassName,
              stickiness: 1,
            },
          })
        }
      }

      // Update the injected CSS
      styleEl.textContent = cssRules

      // Apply decorations to the editor
      // deltaDecorations: pass old decorations to remove, new ones to add
      decorationsRef.current = editor.deltaDecorations(
        decorationsRef.current,
        newDecorations
      )
    }

    provider.awareness.on("change", handleAwarenessChange)
    // Initial render
    handleAwarenessChange()

    return () => {
      cursorDisposable.dispose()
      provider.awareness.off("change", handleAwarenessChange)
      // Clean up decorations
      editor.deltaDecorations(decorationsRef.current, [])
      // Clean up injected styles
      if (styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl)
      }
    }
  }, [editor, provider, username])

  // This component doesn't render any DOM — it only manages Monaco decorations
  return null
}

export { getColorForUsername }
export default CursorManager
