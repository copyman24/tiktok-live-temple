// Bộ câu cho 2 game lớn (bản riêng cô Ngân): Đường lên đỉnh Everest và Rung Chuông Đồng.
// Câu trắc nghiệm ở src/game/cau-hoi-show/trac-nghiem.txt, mật mã (3 gợi ý) ở mat-ma.txt.
// Kiểm tra: npx tsx src/game/bank.check.ts
import { plain } from './quiz';

export type ShowKind = 'everest' | 'chuong';
/** de: làm nóng · vua: phổ thông · kho: thử thách / chạm đỉnh · chuong: câu Chuông Đồng · phu: câu phụ phân định */
export const MC_LEVELS = ['de', 'vua', 'kho', 'chuong', 'phu'] as const;
export type McLevel = (typeof MC_LEVELS)[number];

export interface McQ {
  id: string;
  q: string;
  /** đáp án đúng đứng đầu (game tự xáo vị trí A B C D lúc hỏi) */
  right: string;
  wrong: [string, string, string];
  level: McLevel;
}
export interface CodeQ {
  id: string;
  answer: string;
  hints: [string, string, string];
}
export interface ShowBank {
  mc: McQ[];
  codes: CodeQ[];
}

/** Đọc file trắc nghiệm: dòng "[de]" đổi nhóm; mỗi dòng "câu hỏi | đúng | sai | sai | sai" */
export function parseMc(text: string, errors: string[] = []): McQ[] {
  const out: McQ[] = [];
  let level: McLevel | '' = '';
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const sec = /^\[(\w+)\]$/.exec(line);
    if (sec) {
      level = (MC_LEVELS as readonly string[]).includes(sec[1]) ? (sec[1] as McLevel) : '';
      if (!level) errors.push(`trac-nghiem:${i + 1} nhóm lạ: ${line}`);
      return;
    }
    const parts = line.split('|').map((s) => s.trim());
    if (!level || parts.length !== 5 || parts.some((p) => !p)) {
      errors.push(`trac-nghiem:${i + 1} sai cú pháp: ${line}`);
      return;
    }
    const [q, right, ...wrong] = parts;
    out.push({ id: `tn:${q}|${right}`, q, right, wrong: wrong as McQ['wrong'], level });
  });
  return out;
}

/** Đọc file mật mã: "ĐÁP ÁN | gợi ý 1 | gợi ý 2 | gợi ý 3" (gợi ý khó tới dễ) */
export function parseCodes(text: string, errors: string[] = []): CodeQ[] {
  const out: CodeQ[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const parts = line.split('|').map((s) => s.trim());
    if (parts.length !== 4 || parts.some((p) => !p)) {
      errors.push(`mat-ma:${i + 1} sai cú pháp: ${line}`);
      return;
    }
    out.push({ id: `mm:${parts[0]}`, answer: parts[0], hints: parts.slice(1) as CodeQ['hints'] });
  });
  return out;
}

export const LETTERS = ['A', 'B', 'C', 'D'] as const;

/** Bình luận chọn đáp án: "a", "B", "đáp án c", "chọn d", "c." -> 0..3; không phải thì -1 */
export function choiceOf(comment: string): number {
  const m = /^(?:dapan|chon|cau)?([abcd])$/.exec(plain(comment));
  return m ? 'abcd'.indexOf(m[1]) : -1;
}
