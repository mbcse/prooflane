import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import { config as loadEnv } from "dotenv";
import express from "express";
import { apiErrorHandler } from "./error-handler.js";
import { asyncHandler } from "./async-handler.js";
import { registerRoutes } from "./registerRoutes.js";
import { handleGitHubPushWebhook } from "./webhooks/githubPush.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
for (const p of [
  resolve(__dirname, "../../.env"),
  resolve(__dirname, "../../.env.local"),
  resolve(__dirname, "../.env"),
]) {
  if (existsSync(p)) loadEnv({ path: p });
}

const app = express();
app.use(cors({ origin: true, credentials: true }));

/** GitHub webhooks require raw body for HMAC-SHA256 verification (must run before express.json). */
app.post(
  "/v1/webhooks/github",
  express.raw({
    type: ["application/json", "application/vnd.github+json"],
    limit: "1mb",
  }),
  asyncHandler(handleGitHubPushWebhook),
);

app.use(express.json({ limit: "4mb" }));

registerRoutes(app);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(apiErrorHandler);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, "0.0.0.0", () => {
  console.log(`API listening on http://0.0.0.0:${port}`);
});
