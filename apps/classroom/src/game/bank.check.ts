// Kiểm tra bộ câu hỏi: npx tsx src/game/bank.check.ts
import fs from 'node:fs';
import path from 'node:path';
import { parseBank } from './questions';
import { compactVi, normVi } from './quiz';
import { parseCodes, parseMc } from './show';

const dir = path.join(import.meta.dirname, 'cau-hoi');
const files = Object.fromEntries(fs.readdirSync(dir).filter((f) => f.endsWith('.txt')).map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]));
const errors: string[] = [];
const bank = parseBank(files, errors);
const MAX_LETTERS = 14; // nhiều hơn thì miếng chữ trên bảng quá nhỏ
const MAX_LETTERS_DH = 16; // đuổi hình bắt chữ không xáo chữ, chỉ có ô đáp án nên dài hơn được

const seen = new Map<string, string>();
for (const q of bank) {
  const n = compactVi(q.answer).length;
  const max = q.slot === 'dh' ? MAX_LETTERS_DH : MAX_LETTERS;
  if (n < 2 || n > max) errors.push(`${q.id}: đáp án ${n} chữ (cho phép 2-${max})`);
  if (seen.has(q.id)) errors.push(`${q.id}: trùng trong cùng chủ đề`);
  seen.set(q.id, q.clue);
  // gợi ý lộ nguyên đáp án (so cả từ, có dấu)
  const words = ` ${normVi(q.clue).replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  if (words.includes(` ${normVi(q.answer)} `)) errors.push(`${q.id}: gợi ý lộ đáp án: ${q.clue}`);
  // cách viết khác chỉ khác dấu cũ/mới hoặc khoảng trắng thì game đã tự hiểu, khỏi ghi
  for (const a of q.acceptedAnswers ?? []) if (compactVi(a) === compactVi(q.answer)) errors.push(`${q.id}: cách viết khác thừa (${a})`);
  if (!q.kind) errors.push(`${q.id}: chủ đề thiếu câu "Đây là..." (dòng bắt đầu bằng >)`);
}
const byAnswer = new Map<string, string[]>();
for (const q of bank) byAnswer.set(compactVi(q.answer), [...(byAnswer.get(compactVi(q.answer)) ?? []), q.id]);
const dup = [...byAnswer.values()].filter((v) => v.length > 1);

const count = (d: string) => bank.filter((q) => q.difficulty === d).length;
const cats = new Set(bank.map((q) => q.category));
console.log(`${bank.length} câu, ${cats.size} chủ đề · dễ ${count('easy')} · vừa ${count('medium')} · khó ${count('hard')}`);
if (dup.length) console.log(`Cùng đáp án ở 2 chủ đề (gợi ý khác nhau, vẫn cho phép): ${dup.length} cặp, vd ${dup.slice(0, 5).map((d) => d.join(' / ')).join('; ')}`);
// ---------- 2 game lớn (bản riêng): trắc nghiệm + mật mã ----------
{
  const sdir = path.join(import.meta.dirname, 'cau-hoi-show');
  const mc = parseMc(fs.readFileSync(path.join(sdir, 'trac-nghiem.txt'), 'utf8'), errors);
  const codes = parseCodes(fs.readFileSync(path.join(sdir, 'mat-ma.txt'), 'utf8'), errors);
  const ids = new Set<string>();
  for (const q of mc) {
    if (ids.has(q.id)) errors.push(`${q.id}: câu trắc nghiệm trùng`);
    ids.add(q.id);
    const opts = [q.right, ...q.wrong].map((o) => compactVi(o));
    if (new Set(opts).size < 4) errors.push(`${q.id}: 2 đáp án giống nhau`);
    // đáp án dài quá thì ô A B C D trên bảng không vừa
    for (const o of [q.right, ...q.wrong]) if (o.length > 28) errors.push(`${q.id}: đáp án dài quá 28 ký tự: ${o}`);
    if (q.q.length > 110) errors.push(`${q.id}: câu hỏi dài quá 110 ký tự`);
  }
  for (const c of codes) {
    const n = compactVi(c.answer).length;
    if (n < 3 || n > 14) errors.push(`${c.id}: mật mã ${n} chữ (cho phép 3-14)`);
    for (const h of c.hints) if (` ${normVi(h).replace(/[^\p{L}\p{N}]+/gu, ' ')} `.includes(` ${normVi(c.answer)} `)) errors.push(`${c.id}: gợi ý lộ mật mã: ${h}`);
  }
  // mỗi game cần: Everest de 4, vua 4, kho 3, phu 1; Rung Chuông de 4, vua 7, kho 3, chuong 1, phu 1
  const by = (l: string) => mc.filter((q) => q.level === l).length;
  console.log(`game lớn: ${mc.length} câu trắc nghiệm (de ${by('de')} · vua ${by('vua')} · kho ${by('kho')} · chuong ${by('chuong')} · phu ${by('phu')}), ${codes.length} mật mã`);
}

if (errors.length) {
  console.log(`LỖI ${errors.length}:\n` + errors.join('\n'));
  process.exit(1);
}
console.log('bank.check: ổn');
