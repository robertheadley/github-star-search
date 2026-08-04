import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import { createServer } from "node:http"
import { extname, resolve, sep } from "node:path"

const root = resolve("docs")
const mimeTypes = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" }

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url || "/", "http://127.0.0.1").pathname)
    const target = resolve(root, pathname === "/" ? "index.html" : `.${pathname}`)
    if (target !== root && !target.startsWith(`${root}${sep}`)) throw new Error("Path escapes docs root")
    const info = await stat(target)
    if (!info.isFile()) throw new Error("Not a file")
    response.writeHead(200, { "content-type": mimeTypes[extname(target)] || "application/octet-stream", "cache-control": "no-store" })
    createReadStream(target).pipe(response)
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
    response.end("Not found")
  }
}).listen(4173, "127.0.0.1", () => console.log("Serving docs at http://127.0.0.1:4173"))
