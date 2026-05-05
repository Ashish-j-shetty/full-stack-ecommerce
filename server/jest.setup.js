// Load root .env before tests run — no dotenv dependency needed
const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf-8")
    .split("\n")
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eq = trimmed.indexOf("=");
      if (eq < 1) return;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      // Don't override vars already set in the environment (e.g. CI)
      if (!process.env[key]) process.env[key] = val;
    });
}

// Fallbacks for CI where .env doesn't exist
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "test-secret";
