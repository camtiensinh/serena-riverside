import { neon } from '@neondatabase/serverless';
import { writeFile } from 'node:fs/promises';
const sql=neon(process.env.DATABASE_URL);
const marker='serena-demo-six-20260909';
const teams=['MAPLELAND','DAT XANH SERVICES','ĐẠI TRƯỜNG SƠN','PICOLAND','HUNTERLAND','VẠN XUÂN SERVICE'];
const [settings]=await sql`SELECT hashtags,starts_at,time_filter_enabled FROM settings WHERE id=1`;
const rows=teams.map((team,i)=>{
 const media=Array.from({length:i+1},(_,j)=>({photo_image:{uri:`https://picsum.photos/seed/serena-demo-${i}-${j}/900/650`}}));
 const name=`TEST ${String(i+1).padStart(2,'0')} - ${team}`;
 const content=`[DỮ LIỆU TEST - KHÔNG PHẢI BÀI DỰ THI THẬT]\nKhơi dòng Serena Riverside. Bài mẫu kiểm tra giao diện trao giải, hình ảnh và bảng xếp hạng.\n${settings.hashtags.map(t=>'#'+t).join(' ')}`;
 return {name,team:'HỆ THỐNG PHÂN PHỐI '+team,facebook_url:`https://www.facebook.com/serena-demo-test/posts/${marker}-${i+1}`,post_id:`${marker}-${i+1}`,author:name,content,media,likes:[1680,1420,1250,980,760,540][i],reactions:[1820,1550,1380,1090,850,610][i],comments:[168,142,125,98,76,54][i],shares:[86,72,64,49,38,27][i]};
});
const results=await sql.transaction([
 sql`LOCK TABLE submissions IN SHARE ROW EXCLUSIVE MODE`,
 ...rows.map(r=>sql`INSERT INTO submissions(name,phone,team,facebook_url,post_id,author,content,media,raw,posted_at,likes,reactions,comments,shares,hashtag_ok,time_ok,status,checked_at)
 SELECT ${r.name},'',${r.team},${r.facebook_url},${r.post_id},${r.author},${r.content},${JSON.stringify(r.media)}::jsonb,${JSON.stringify({demo:true,seed:marker,text:r.content,media:r.media})}::jsonb,${settings.time_filter_enabled?settings.starts_at:new Date().toISOString()},${r.likes},${r.reactions},${r.comments},${r.shares},true,true,'valid',now()
 WHERE NOT EXISTS(SELECT 1 FROM submissions WHERE post_id=${r.post_id} AND deleted_at IS NULL)
 RETURNING id,name,likes,jsonb_array_length(media) images`)
]);
const created=results.slice(1).flat();
await writeFile('artifacts/test-six-created.json',JSON.stringify({marker,created},null,2));
console.log(JSON.stringify({created:created.length,entries:created},null,2));
