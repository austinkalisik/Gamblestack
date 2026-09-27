import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "256kb" }));

// Lightweight global rate limiter with no external dependency.
const buckets = new Map<string, { count: number; resetAt: number }>();
app.use((req, res, next) => {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  current.count += 1;
  if (current.count > 300) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "rate_limit" });
  }
  next();
});

app.get("/health", (_, res) => res.json({ ok: true, service: "api-gateway" }));

app.use("/auth", createProxyMiddleware({
  target: process.env.AUTH_URL || "http://10.203.77.21:4001",
  changeOrigin: true,
  pathRewrite: { "^/auth": "" },
}));
app.use("/wallet", createProxyMiddleware({
  target: process.env.WALLET_URL || "http://10.203.77.22:4002",
  changeOrigin: true,
  pathRewrite: { "^/wallet": "" },
}));
app.use("/sportsbook", createProxyMiddleware({
  target: process.env.SPORTSBOOK_URL || "http://10.203.77.23:4003",
  changeOrigin: true,
  pathRewrite: { "^/sportsbook": "" },
}));
app.use("/games", createProxyMiddleware({
  target: process.env.GAMES_URL || "http://10.203.77.24:4004",
  changeOrigin: true,
  pathRewrite: { "^/games": "" },
}));

const port = Number(process.env.PORT || 4000);
app.listen(port, "0.0.0.0", () => console.log(`API Gateway listening on ${port}`));
