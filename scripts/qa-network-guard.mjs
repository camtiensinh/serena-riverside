if(!process.env.DATABASE_SCHEMA?.startsWith('arena_qa_'))throw new Error('QA server requires isolated schema');
const original=globalThis.fetch;
globalThis.fetch=(input,init)=>{if(String(input).startsWith('https://api.apify.com/'))throw new Error('QA prohibits real Apify calls');return original(input,init);};
