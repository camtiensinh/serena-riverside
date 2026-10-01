import { neon } from "@neondatabase/serverless";
export function db() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL chưa được cấu hình");
  const sql = neon(process.env.DATABASE_URL);
  // Optional isolated schema for local integration tests; production uses the plain client.
  const schema = process.env.DATABASE_SCHEMA;
  if (!schema) return sql;
  if (!/^[a-z][a-z0-9_]+$/.test(schema))
    throw new Error("Invalid database schema");
  const scope = () => sql.query(`SET LOCAL search_path TO "${schema}"`);
  const wrap = (query: any) => ({
    underlying: query,
    then: (resolve: any, reject: any) =>
      sql
        .transaction([scope(), query])
        .then((rows) => rows[1])
        .then(resolve, reject),
  });
  const scoped = (...args: any[]) => wrap((sql as any)(...args));
  scoped.query = (...args: any[]) => wrap((sql.query as any)(...args));
  scoped.transaction = (queries: any) => {
    const statements =
      typeof queries === "function"
        ? queries(sql)
        : queries.map((query: any) => query.underlying || query);
    return sql
      .transaction([scope(), ...statements])
      .then((rows) => rows.slice(1));
  };
  return scoped as unknown as typeof sql;
}
