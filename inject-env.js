// inject-env.js
import { readFileSync, writeFileSync } from "fs";

const SRC = "config.template.js";
const DST = "config.js";

function mustEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`[inject-env] Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

const url = mustEnv("SUPABASE_URL");
const key = mustEnv("SUPABASE_ANON_KEY");

let code = readFileSync(SRC, "utf8");
code = code.replace(/\{\{SUPABASE_URL\}\}/g, url)
           .replace(/\{\{SUPABASE_ANON_KEY\}\}/g, key);

writeFileSync(DST, code, "utf8");
console.log("[inject-env] Wrote", DST);