import { readFileSync } from "fs";

// Scripts run outside Next, so load .env.local ourselves instead of adding dotenv.
try {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (line.trimStart().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 1) continue;
    const k = line.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = line.slice(i + 1).trim();
  }
} catch {
  /* no .env.local — rely on the real environment */
}
