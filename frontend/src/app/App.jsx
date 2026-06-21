import "./App.css"
import {Editor} from "@monaco-editor/react"
import { MonacoBinding } from "y-monaco"
import { useRef , useState , useEffect} from "react"
import * as Y from "yjs"
import {SocketIOProvider} from "y-socket.io"
import { useMemo } from "react"

function App() {


  const editorRef=useRef(null)

  const [username,setUsername]=useState(()=>{
    return new URLSearchParams(window.location.search).get("username") || ""
  })

  const [users,setUsers]=useState([])

  const ydoc=useMemo  (()=>new Y.Doc(),[])
  const ytext=useMemo(()=>(ydoc.getText("monaco")),[ydoc])

  const handleoMount  =(editor)=>{
    editorRef.current=editor

    new MonacoBinding(
      ytext,
      editorRef.current.getModel(),
      new Set([editorRef.current]),
      
    )

  }


  useEffect(()=>{

    console.log("username",username)
    if(username){
      const provider=new SocketIOProvider("/","monaco",ydoc,{
      autoConnect: true,
    })

    provider.awareness.setLocalStateField("user",{
      username
    })


    const states=Array.from(provider.awareness.getStates().values())
    console.log("states",states)
    setUsers(states.filter(state => state.user && state.user.username).map(state=>state.user))
    
    provider.awareness.on("change",()=>{
      const states=Array.from(provider.awareness.getStates().values())
      setUsers(states.filter(state => state.user && state.user.username).map(state=>state.user))
    })

    function handleBeforeUnload(){
      provider.awareness.setLocalStateField("user",null)
    }

    window.addEventListener("beforeunload",handleBeforeUnload)

    
      return ()=>{
        provider.disconnect()
        window.removeEventListener("beforeunload",handleBeforeUnload)
    }
  }},[username])

  const handleJoin=(e)=>{
    e.preventDefault()
    setUsername(e.target.username.value.trim())
    window.history.pushState(null,"",`?username=${e.target.username.value.trim()}`)
  }

  if(!username){
    return (
      <main className="h-screen w-full bg-gray-950 flex items-center justify-center">
        <form
        onSubmit={handleJoin} 
        className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Enter your username"
            className="p-2 rounded-lg bg-gray-800 text-white"
            name="username"
          />
          <button
            type="submit"
            className="p-2 rounded-lg bg-blue-600 text-white"
          >
            Join
          </button>
        </form>
      </main>
    )
  }


  return (
    <main
      className="h-screen w-full bg-gray-950 flex gap-4 p-6"
      >
      <aside
        className="h-full w-1/4 bg-gray-400 rounded-lg"
      >
        <h2 className="text-xl font-bold mb-4">Active Users</h2>
        <ul className="space-y-2">
          {users.map((user,index)=>(
            <li
              key={index}
              className="p-2 bg-gray-800 text-white rounded-lg"
            >
              {user.username}
            </li>
          ))}
        </ul>
      </aside>
      <section
        className="w-3/4 bg-neutral-800 rounded-lg overflow-hidden">
        <Editor
          padding={10}
          height="100%"
          defaultLanguage="javascript"
          defaultValue="// some comment"
          theme="vs-dark"
          onMount={handleoMount}
        />
      </section>
    
    
    </main>
  )
}

export default App
