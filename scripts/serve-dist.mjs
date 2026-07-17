import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import handler from "serve-handler";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, "..", "dist");
const port = Number(process.env.PORT) || 3000;

const server = createServer((req, res) =>
  handler(req, res, {
    public: dist,
    rewrites: [{ source: "**", destination: "/index.html" }],
    headers: [
      {
        source: "**/*.js",
        headers: [{ key: "Content-Type", value: "text/javascript; charset=utf-8" }],
      },
      {
        source: "**/*.css",
        headers: [{ key: "Content-Type", value: "text/css; charset=utf-8" }],
      },
    ],
  }),
);

server.listen(port, "0.0.0.0", () => {
  console.log(`Serving ${dist} on http://0.0.0.0:${port}`);
});
