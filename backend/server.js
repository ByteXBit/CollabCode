import express from "express"
import {createServer} from "http"
import {Server} from "socket.io"
import {YSocketIO} from "y-socket.io/dist/server"
import path from "path"
import { fileURLToPath } from "url"
import { rateLimit } from "express-rate-limit"
import { executeCode, getSupportedLanguages } from "./services/codeRunner.js"

// Rate limit for code execution: max 10 requests per minute per IP
const executeRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { stdout: "", stderr: "Rate limit exceeded. Try again in a minute.", exitCode: 1 },
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app=express()

app.use(express.json())
app.use(express.static("public"))

const httpServer=createServer(app)

const io=new Server(httpServer, {
  cors: { 
    origin: "*",
    methods: ["GET", "POST"]
  }
})

const ySocketIO=new YSocketIO(io)
ySocketIO.initialize()


app.get("/health",(req,res)=>{
  res.status(200).json({
    message: "Server is healthy",
    success: true
  })
})

// --- Code Execution API ---
app.post("/api/execute", executeRateLimit, async (req, res) => {
  const { language, code, stdin } = req.body

  if (!language || !code) {
    return res.status(400).json({
      stdout: "",
      stderr: "Missing 'language' or 'code' in request body",
      exitCode: 1,
    })
  }

  const result = await executeCode(language, code, stdin || "")
  res.json(result)
})

app.get("/api/languages", (req, res) => {
  res.json(getSupportedLanguages())
})

// Catch-all: serve index.html for any route not matched above
// This lets React Router handle client-side routing (e.g. /room/:roomId)
app.get("/{*splat}",(req,res)=>{
  res.sendFile(path.join(__dirname, "public", "index.html"))
})


httpServer.listen(3000,()=>{
  console.log("Server is running on port 3000")
})