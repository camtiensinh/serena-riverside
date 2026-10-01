import { randomBytes } from "node:crypto";
import { appendFileSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const path = ".env.local";
const current = readFileSync(path, "utf8");
const values = {
  ADMIN_PASSWORD: randomBytes(18).toString("base64url"),
  SESSION_SECRET: randomBytes(32).toString("hex"),
  KEY_ENCRYPTION_SECRET: randomBytes(32).toString("hex"),
  CRON_SECRET: randomBytes(32).toString("hex"),
};
for (const [name, value] of Object.entries(values)) {
  if (new RegExp("^" + name + "=", "m").test(current))
    throw new Error("Secrets already configured; refusing rotation");
  appendFileSync(path, `\n${name}="${value}"\n`);
  const result = spawnSync("vercel.cmd", ["env", "add", name, "production"], {
    input: value,
    encoding: "utf8",
    shell: true,
  });
  if (result.status !== 0) throw new Error("Failed to configure " + name);
  console.log(name + " configured");
}
writeFileSync(
  "ADMIN-ACCESS.local.txt",
  `CMS: https://serena-kickoff-arena.vercel.app/admin\nPassword: ${values.ADMIN_PASSWORD}\nKeep this file private. Change ADMIN_PASSWORD in Vercel to rotate access.\n`,
);
