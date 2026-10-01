import { neon } from "@neondatabase/serverless";
import { readFile } from "node:fs/promises";
const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);
const schema = await readFile(
  new URL("../src/lib/schema.sql", import.meta.url),
  "utf8",
);
await sql.transaction(
  schema
    .replaceAll("-- statement", "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => sql.query(s)),
);
console.log("Database schema ready.");
const update = await readFile(
  new URL("../src/lib/migrations/002-manual-scan.sql", import.meta.url),
  "utf8",
);
await sql.transaction(
  update
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => sql.query(s)),
);
console.log("Manual scan migration ready.");
const presentation = await readFile(
  new URL("../src/lib/migrations/003-presentation.sql", import.meta.url),
  "utf8",
);
await sql.transaction(
  presentation
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => sql.query(s)),
);
console.log("Presentation controls ready.");
const rankMigration = await readFile(
  new URL("../src/lib/migrations/004-display-rank.sql", import.meta.url),
  "utf8",
);
await sql.transaction(
  rankMigration
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => sql.query(s)),
);
console.log("Manual rank controls ready.");
const reactionsMigration = await readFile(
  new URL("../src/lib/migrations/005-reactions-default.sql", import.meta.url),
  "utf8",
);
await sql.transaction(
  reactionsMigration
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => sql.query(s)),
);
console.log("Total reactions ranking ready.");
const luckyWheel = await readFile(
  new URL("../src/lib/migrations/006-lucky-wheel.sql", import.meta.url),
  "utf8",
);
await sql.transaction(
  luckyWheel
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => sql.query(s)),
);
console.log("Lucky wheel tables ready.");
const redrawMigration = await readFile(
  new URL("../src/lib/migrations/007-wheel-redraw.sql", import.meta.url),
  "utf8",
);
await sql.transaction(
  redrawMigration
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => sql.query(s)),
);
console.log("Lucky wheel redraw ready.");
