import readXlsxFile from "read-excel-file/node";
import { DISTRIBUTORS } from "./distributors";
import { facebookUrl } from "./rules";

type ImportRow = {
  row: number;
  name: string;
  team: string;
  facebookUrl: string;
};
type ImportIssue = { row: number; reason: string };
const cellText = (value: unknown) => String(value ?? "").trim();
const plain = (value: unknown) =>
  cellText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const column = (headers: string[], candidates: string[]) =>
  headers.findIndex((header) =>
    candidates.some(
      (candidate) => header === candidate || header.includes(candidate),
    ),
  );
function distributor(value: string) {
  const normalized = plain(value);
  if (!normalized) return undefined;
  return DISTRIBUTORS.find((item) => {
    const full = plain(item),
      short = full.replace(/^he thong phan phoi /, "");
    return normalized === full || normalized === short;
  });
}

export async function parseSubmissionWorkbook(buffer: Buffer) {
  const [sheet] = await readXlsxFile(buffer);
  if (!sheet) throw new Error("File Excel không có worksheet");
  const data = sheet.data;
  let headerRow = 0,
    indexes = { name: -1, team: -1, url: -1 };
  for (let rowNumber = 1; rowNumber <= Math.min(15, data.length); rowNumber++) {
    const values = (data[rowNumber - 1] || []).map(plain);
    const found = {
      name: column(values, ["ho va ten", "ho ten", "ten nguoi tham du"]),
      team: column(values, [
        "dai ly phan phoi",
        "don vi san giao dich",
        "san giao dich",
        "don vi",
        "dai ly",
      ]),
      url: column(values, [
        "duong dan bai viet facebook",
        "link bai viet facebook",
        "facebook url",
        "link facebook",
        "bai viet facebook",
      ]),
    };
    if (found.name >= 0 && found.team >= 0 && found.url >= 0) {
      headerRow = rowNumber;
      indexes = found;
      break;
    }
  }
  if (!headerRow)
    throw new Error(
      "Không tìm thấy đủ 3 cột: Họ và tên, Đại lý phân phối/Sàn giao dịch, Đường dẫn bài viết Facebook",
    );
  const rows: ImportRow[] = [],
    issues: ImportIssue[] = [],
    seen = new Map<string, number>();
  for (let rowNumber = headerRow + 1; rowNumber <= data.length; rowNumber++) {
    const row = data[rowNumber - 1] || [];
    const name = cellText(row[indexes.name]),
      teamText = cellText(row[indexes.team]),
      rawUrl = cellText(row[indexes.url]);
    if (!name && !teamText && !rawUrl) continue;
    if (name.length < 2 || name.length > 100) {
      issues.push({ row: rowNumber, reason: "Họ và tên không hợp lệ" });
      continue;
    }
    const team = distributor(teamText);
    if (!team) {
      issues.push({
        row: rowNumber,
        reason: `Đại lý không đúng danh sách: ${teamText || "trống"}`,
      });
      continue;
    }
    let url: string;
    try {
      url = facebookUrl(rawUrl);
    } catch (error) {
      issues.push({ row: rowNumber, reason: (error as Error).message });
      continue;
    }
    const duplicateRow = seen.get(url);
    if (duplicateRow) {
      issues.push({
        row: rowNumber,
        reason: `Trùng link với dòng ${duplicateRow} trong file`,
      });
      continue;
    }
    seen.set(url, rowNumber);
    rows.push({ row: rowNumber, name, team, facebookUrl: url });
  }
  if (rows.length + issues.length > 5000)
    throw new Error("Mỗi lần chỉ import tối đa 5.000 dòng");
  return { sheet: sheet.sheet, rows, issues };
}
