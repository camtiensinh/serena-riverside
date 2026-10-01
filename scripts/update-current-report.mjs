import fs from 'node:fs';
const api='src/app/api/[...path]/route.ts';let s=fs.readFileSync(api,'utf8');
s=s.replace('      return json({\n        settings: s,',`      const entries = await sql\`SELECT id,name,team,author,avatar,content,media,facebook_url,post_url,likes,reactions,comments,shares,posted_at,created_at FROM submissions WHERE status='valid' AND deleted_at IS NULL\`;
      const visible = s.display_mode !== 'waiting' && !!s.display_started_at;
      return json({
        settings: {...s,published:null},`);
s=s.replace('s.published ? s.published.slice(0, 5) : []','visible ? rank(entries as any,s.metric).slice(0,5) : []').replace('s.published ? s.published.length : 0','visible ? entries.length : 0');
s=s.replace('        s.published ||\n','').replaceAll(' AND published IS NULL','').replaceAll(" AND NOT EXISTS(SELECT 1 FROM settings WHERE published IS NOT NULL)",'');
s=s.replace(/      const \[s\] = await sql`SELECT published FROM settings WHERE id=1`;\s*if \(s.published\)\s*return json\([^;]+;/,'');
s=s.replace('state.published || state.busy','state.busy').replaceAll('hoặc đã chốt giải','').replaceAll('đã chốt giải, ','');
const start=s.indexOf('    if (path === "presentation"');const end=s.indexOf('    return json({ error: "Không tìm thấy"',start);
s=s.slice(0,start)+`    if ((path === "presentation" || path === "publish") && req.method === "POST") {
      const {mode}=path === "publish" ? {mode:"auto"} : z.object({mode:z.enum(['waiting','auto','results'])}).parse(await req.json());
      await sql\`UPDATE settings SET display_mode=\${mode},display_started_at=now() WHERE id=1\`;
      return json({ok:true});
    }
`+s.slice(end);fs.writeFileSync(api,s);
let p='src/lib/scanner.ts';s=fs.readFileSync(p,'utf8').replace('WHERE NOT EXISTS(SELECT 1 FROM settings WHERE published IS NOT NULL) AND','WHERE').replace('Không còn nhận lượt quét sau khi chốt kết quả','Danh sách bài đã thay đổi. Vui lòng thử lại.');fs.writeFileSync(p,s);
p='src/app/admin/page.tsx';s=fs.readFileSync(p,'utf8').replace('published = !!data.settings.published','published = true').replaceAll(' || published','').replace('disabled={!!busy || !!s.published}','disabled={!!busy}');
s=s.replace('{published ? "ĐÃ CHỐT" : "LIVE"}','{"DỮ LIỆU HIỆN TẠI"}').replace('{published ? "Đã công bố kết quả" : "Đang tiếp nhận bài dự thi"}','{"Đang tiếp nhận bài dự thi"}').replace('Quét dữ liệu mới nhất, chốt kết quả và mở màn trao giải đầy','Đọc dữ liệu hiện tại và mở màn trao giải đầy').replace('{published ? "Xem kết quả đã chốt" : "Công bố giải thưởng"}','{"Điều khiển trình chiếu"}').replace('Kết quả được khóa tại thời điểm','Bảng xếp hạng theo dữ liệu hiện tại ·').replace('Dữ liệu làm mới mỗi 5 giây','Nhấn Làm mới dữ liệu để cập nhật');
s=s.replace(/\{published\s*\? "Kết quả đã được khóa"\s*: "Chốt bảng xếp hạng chính thức"\}/,'{"Điều khiển màn báo cáo"}');
s=s.replace(/Chỉ chốt khi mọi bài còn trong danh sách[\s\S]*?Hãy mở màn báo cáo trước khi nhấn công bố\./,'Báo cáo lấy top 5 bài hợp lệ từ dữ liệu hiện tại trong CMS. Không chốt hoặc khóa kết quả. Các nút bên dưới chỉ chuyển màn hình; không gọi Apify.');
s=s.replace('Điều khiển màn báo cáo đang mở. Phát lại dùng kết quả đã chốt, không quét Apify.','Điều khiển màn báo cáo đang mở. Bài mới hoặc chỉ số mới sẽ được cập nhật từ DB.');fs.writeFileSync(p,s);
p='src/app/live/page.tsx';s=fs.readFileSync(p,'utf8').replace(/!!data\?\.settings.published &&\s*!!data\?\.settings.published_at &&/,'!!data?.settings.display_started_at &&');
fs.writeFileSync(p,s);
