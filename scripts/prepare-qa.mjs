import { neon } from "@neondatabase/serverless";
import { readFile, writeFile } from "node:fs/promises";
const base = neon(
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
);
const schema = "arena_qa_" + Date.now();
await base.query(`CREATE SCHEMA "${schema}"`);
try {
  const qa = base;
  const source = await readFile("src/lib/schema.sql", "utf8");
  const migrations = await Promise.all(
    [
      "002-manual-scan.sql",
      "003-presentation.sql",
      "004-display-rank.sql",
      "005-reactions-default.sql",
      "006-lucky-wheel.sql",
      "007-wheel-redraw.sql",
    ].map((name) => readFile(`src/lib/migrations/${name}`, "utf8")),
  );
  await qa.transaction([
    qa.query(`SET LOCAL search_path TO "${schema}"`),
    ...(source + "\n" + migrations.join("\n"))
      .replaceAll("-- statement", "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => qa.query(s)),
  ]);
  await writeFile(".env.qa.local", `DATABASE_SCHEMA=${schema}\nAPP_URL=\n`);
  console.log("QA schema ready: " + schema);
} catch (error) {
  await base.query(`DROP SCHEMA "${schema}" CASCADE`);
  throw error;
}
