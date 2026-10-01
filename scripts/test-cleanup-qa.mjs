import {neon} from '@neondatabase/serverless';
const schema=process.env.DATABASE_SCHEMA;
if(!/^arena_qa_[0-9]+$/.test(schema||''))throw new Error('Only generated QA schemas may be removed');
const sql=neon(process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL);
await sql.query(`DROP SCHEMA "${schema}" CASCADE`);
console.log('Removed isolated QA schema '+schema);
