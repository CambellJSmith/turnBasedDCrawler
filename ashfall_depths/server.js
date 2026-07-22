import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root_directory = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT) || 5173;
const mime_types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

const server = createServer((request, response) => {
  const request_path = decodeURIComponent((request.url ?? "/").split("?")[0]);
  const relative_path = request_path === "/" ? "index.html" : request_path.replace(/^\/+/, "");
  const normalized_path = normalize(relative_path);
  const file_path = join(root_directory, normalized_path);

  if (!file_path.startsWith(root_directory) || !existsSync(file_path) || statSync(file_path).isDirectory()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("not found");
    return;
  }

  response.writeHead(200, {
    "content-type": mime_types[extname(file_path)] ?? "application/octet-stream",
    "cache-control": "no-store"
  });
  createReadStream(file_path).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`ashfall depths is running at http://127.0.0.1:${port}`);
});
