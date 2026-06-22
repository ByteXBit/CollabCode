/**
 * Code Runner Service — Docker-based
 * 
 * Executes user code inside ephemeral Docker containers.
 * Each execution:
 *   1. Spins up a fresh container from a language-specific image
 *   2. Passes code as a base64-encoded command argument
 *   3. Runs it with a 10-second timeout
 *   4. Captures stdout/stderr
 *   5. Destroys the container (no state persists)
 * 
 * Security measures:
 *   - Network disabled (--network none)
 *   - Memory capped at 64MB
 *   - CPU limited to 0.5 cores
 *   - 10-second kill timeout
 *   - Container auto-removed after execution
 */

import Docker from "dockerode"

const docker = new Docker()

// Language configs: which Docker image and how to run the code
const LANGUAGES = {
  javascript: {
    image: "node:20-alpine",
    extension: "js",
    run: (file) => `node ${file}`,
  },
  python: {
    image: "python:3.12-alpine",
    extension: "py",
    run: (file) => `python3 ${file}`,
  },
  c: {
    image: "gcc:13",
    extension: "c",
    run: (file) => `gcc ${file} -o /tmp/a.out && /tmp/a.out`,
  },
  cpp: {
    image: "gcc:13",
    extension: "cpp",
    run: (file) => `g++ ${file} -o /tmp/a.out && /tmp/a.out`,
  },
}

const TIMEOUT_MS = 10000

/**
 * Execute code inside a Docker container.
 * 
 * Strategy: encode the code as base64, decode it inside the container,
 * write to a file, then execute. This avoids stdin piping issues.
 */
async function executeCode(language, code, stdin = "") {
  const lang = LANGUAGES[language]

  if (!lang) {
    return {
      stdout: "",
      stderr: `Unsupported language: ${language}. Supported: ${Object.keys(LANGUAGES).join(", ")}`,
      exitCode: 1,
      error: "UNSUPPORTED_LANGUAGE",
    }
  }

  const filename = `/tmp/code.${lang.extension}`
  const b64Code = Buffer.from(code).toString("base64")
  const b64Stdin = Buffer.from(stdin).toString("base64")

  // Shell command: 
  // 1. Decode code → write to file
  // 2. Decode stdin → write to /tmp/input.txt
  // 3. Run program with stdin redirected from /tmp/input.txt
  const shellCmd = `echo '${b64Code}' | base64 -d > ${filename} && echo '${b64Stdin}' | base64 -d > /tmp/input.txt && ${lang.run(filename)} < /tmp/input.txt`

  let container
  try {
    container = await docker.createContainer({
      Image: lang.image,
      Cmd: ["sh", "-c", shellCmd],
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      NetworkDisabled: true,
      HostConfig: {
        Memory: 64 * 1024 * 1024,    // 64MB
        NanoCpus: 500000000,          // 0.5 CPU
      },
    })

    // Start + collect output
    await container.start()

    // Capture logs
    const logStream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
    })

    let stdout = ""
    let stderr = ""

    // Demux the multiplexed stream
    const { PassThrough } = await import("stream")
    const stdoutStream = new PassThrough()
    const stderrStream = new PassThrough()

    container.modem.demuxStream(logStream, stdoutStream, stderrStream)

    stdoutStream.on("data", (chunk) => { stdout += chunk.toString() })
    stderrStream.on("data", (chunk) => { stderr += chunk.toString() })

    // Wait for completion with timeout
    const exitCode = await Promise.race([
      container.wait().then((r) => r.StatusCode),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS)
      ),
    ])

    return {
      stdout: stdout.slice(0, 10000),
      stderr: stderr.slice(0, 10000),
      exitCode,
      error: null,
    }
  } catch (err) {
    if (err.message === "TIMEOUT") {
      // Kill the container if it timed out
      try { await container.kill() } catch (e) { /* already dead */ }
      return {
        stdout: "",
        stderr: "⏱ Execution timed out (10 seconds). Your code took too long.",
        exitCode: 1,
        error: "TIMEOUT",
      }
    }

    return {
      stdout: "",
      stderr: `Execution error: ${err.message}`,
      exitCode: 1,
      error: "DOCKER_ERROR",
    }
  } finally {
    // Always clean up the container
    if (container) {
      try { await container.remove({ force: true }) } catch (e) { /* ok */ }
    }
  }
}

function getSupportedLanguages() {
  return Object.keys(LANGUAGES).map((key) => ({
    id: key,
    name: key.charAt(0).toUpperCase() + key.slice(1),
    image: LANGUAGES[key].image,
  }))
}

export { executeCode, getSupportedLanguages, LANGUAGES }
