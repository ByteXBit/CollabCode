/**
 * useCursorAwareness — A custom hook that handles remote cursor rendering.
 * 
 * This is a hook (not a component) so it doesn't cause re-renders.
 * It directly talks to the Monaco editor and Yjs awareness.
 * 
 * What it does:
 * 1. Broadcasts YOUR cursor position to other users via awareness
 * 2. Listens for OTHER users' cursor positions
 * 3. Renders colored cursor bars + username labels in the editor using Monaco decorations
 */

import { useEffect, useRef } from "react"

const CURSOR_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b",
  "#a855f7", "#ec4899", "#06b6d4", "#f97316",
]

function getColorForUsername(username) {
  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}

function useCursorAwareness(editorRef, providerRef, username) {
  const decorationIds = useRef([])
  const styleElRef = useRef(null)

  useEffect(() => {
    const editor = editorRef.current
    const provider = providerRef.current
    if (!editor || !provider) return

    // Inject a <style> element for dynamic cursor CSS
    const styleEl = document.createElement("style")
    document.head.appendChild(styleEl)
    styleElRef.current = styleEl

    // 1. Broadcast local cursor position on every cursor move
    const disposable = editor.onDidChangeCursorPosition((e) => {
      const sel = editor.getSelection()
      provider.awareness.setLocalStateField("cursor", {
        lineNumber: e.position.lineNumber,
        column: e.position.column,
        selStartLine: sel?.startLineNumber,
        selStartCol: sel?.startColumn,
        selEndLine: sel?.endLineNumber,
        selEndCol: sel?.endColumn,
      })
    })

    // 2. Render remote cursors whenever awareness changes
    const renderRemoteCursors = () => {
      const myClientId = provider.awareness.clientID
      const decorations = []
      let css = ""

      provider.awareness.getStates().forEach((state, clientId) => {
        if (clientId === myClientId) return
        if (!state.user?.username || !state.cursor) return

        const name = state.user.username
        const color = state.user.color || getColorForUsername(name)
        const c = state.cursor
        const id = `rc-${clientId}`

        // CSS: colored left-border as cursor + ::after pseudo-element for label
        css += `.${id}{border-left:2px solid ${color}!important;}`
        css += `.${id}-label::after{content:"${name}";background:${color};color:#fff;font-size:10px;font-weight:700;padding:1px 5px;border-radius:2px;position:relative;top:-1.2em;left:2px;pointer-events:none;white-space:nowrap;z-index:10;}`

        // The cursor bar: use a 1-char range so Monaco actually renders the className
        const endCol = c.column + 1
        decorations.push({
          range: { startLineNumber: c.lineNumber, startColumn: c.column, endLineNumber: c.lineNumber, endColumn: endCol },
          options: { className: `${id} ${id}-label`, stickiness: 1 }
        })

        // Selection highlight (if they have text selected)
        if (c.selStartLine && (c.selStartLine !== c.selEndLine || c.selStartCol !== c.selEndCol)) {
          css += `.${id}-sel{background:${color}22!important;}`
          decorations.push({
            range: { startLineNumber: c.selStartLine, startColumn: c.selStartCol, endLineNumber: c.selEndLine, endColumn: c.selEndCol },
            options: { className: `${id}-sel`, stickiness: 1 }
          })
        }
      })

      styleEl.textContent = css
      decorationIds.current = editor.deltaDecorations(decorationIds.current, decorations)
    }

    provider.awareness.on("change", renderRemoteCursors)
    renderRemoteCursors()

    return () => {
      disposable.dispose()
      provider.awareness.off("change", renderRemoteCursors)
      editor.deltaDecorations(decorationIds.current, [])
      styleEl.remove()
    }
  }, [editorRef, providerRef, username])
}

export { getColorForUsername }
export default useCursorAwareness
