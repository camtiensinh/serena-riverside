import test from "node:test";
import assert from "node:assert/strict";
import writeXlsxFile from "write-excel-file/node";
import { parseSubmissionWorkbook } from "../src/lib/import-submissions";
const book = (rows: string[][], sheet: string) =>
  writeXlsxFile(
    rows.map((row) => row.map((value) => ({ value, type: String }))),
    { sheet },
  ).toBuffer();
test("Excel import recognizes Google Forms headers and rejects duplicate or invalid rows", async () => {
  const data = await book(
    [
      [
        "Dấu thời gian",
        "Họ và tên",
        "Đại lý phân phối",
        "Đường dẫn bài viết Facebook",
      ],
      [
        "10/09",
        "Nguyễn Văn A",
        "DAT XANH SERVICES",
        "https://www.facebook.com/share/p/ABC123/",
      ],
      [
        "10/09",
        "Nguyễn Văn B",
        "HỆ THỐNG PHÂN PHỐI MAPLELAND",
        "https://m.facebook.com/share/p/ABC123/?mibextid=x",
      ],
      [
        "10/09",
        "Nguyễn Văn C",
        "Không có trong danh sách",
        "https://www.facebook.com/reel/123/",
      ],
      ["10/09", "Nguyễn Văn D", "PICOLAND", "https://www.facebook.com/profile"],
    ],
    "Form Responses 1",
  );
  const parsed = await parseSubmissionWorkbook(Buffer.from(data));
  assert.equal(parsed.sheet, "Form Responses 1");
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].team, "HỆ THỐNG PHÂN PHỐI DAT XANH SERVICES");
  assert.equal(parsed.issues.length, 3);
  assert.match(parsed.issues[0].reason, /Trùng link với dòng 2/);
  assert.match(parsed.issues[1].reason, /Đại lý không đúng/);
  assert.match(parsed.issues[2].reason, /link bài viết cụ thể/i);
});
test("Excel import recognizes alternate headers", async () => {
  const data = await book(
    [
      ["Họ tên", "Đơn vị / Sàn giao dịch", "Link Facebook"],
      ["Trần Thị B", "HUNTERLAND", "https://www.facebook.com/reel/456/"],
    ],
    "Bài dự thi",
  );
  const parsed = await parseSubmissionWorkbook(Buffer.from(data));
  assert.equal(parsed.rows[0].facebookUrl, "https://www.facebook.com/reel/456");
});
