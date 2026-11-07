import type { Question } from './questions';

// Câu toán nhẩm: game tự sinh lúc vào tiết nên không bao giờ hết câu, không ghi vào sổ lớp.
// Bản riêng (chủ kênh chốt 2026-11-04): nhân chia nhiều hơn, phép cộng trừ luôn là số 3 chữ số với số 2 chữ số
// (không cộng kiểu 6 + 4 nữa).
// Cấp 1 nhân bảng cửu chương / cộng 3 với 2 chữ số · 2 nhân, chia số 2 chữ số / trừ 3 với 2 chữ số
// · 3 nhân 2 chữ số với nhau, chia số 3 chữ số · 4 phép tính hai bước có nhân chia.
// Đáp án luôn là số tự nhiên, người xem gõ số (vd "183").

export type MathLevel = 1 | 2 | 3 | 4;

const DIFF = { 1: 'easy', 2: 'medium', 3: 'hard', 4: 'hard' } as const;

export function makeMath(level: MathLevel, rand = Math.random): Question {
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  let show: string;
  let say: string;
  let n: number;
  const kind = int(0, 2);
  if (level === 1) {
    if (kind === 0) {
      const a = int(6, 9), b = int(6, 9);
      [show, say, n] = [`${a} × ${b}`, `${a} nhân ${b}`, a * b];
    } else if (kind === 1) {
      const b = int(6, 9), a = int(6, 12);
      [show, say, n] = [`${a * b} : ${b}`, `${a * b} chia ${b}`, a];
    } else {
      const a = int(105, 489), b = int(16, 89);
      [show, say, n] = [`${a} + ${b}`, `${a} cộng ${b}`, a + b];
    }
  } else if (level === 2) {
    if (kind === 0) {
      const a = int(13, 29), b = int(3, 9);
      [show, say, n] = [`${a} × ${b}`, `${a} nhân ${b}`, a * b];
    } else if (kind === 1) {
      const b = int(3, 9), a = int(13, 29);
      [show, say, n] = [`${a * b} : ${b}`, `${a * b} chia ${b}`, a];
    } else {
      const a = int(203, 699), b = int(17, 89);
      [show, say, n] = [`${a} − ${b}`, `${a} trừ ${b}`, a - b];
    }
  } else if (level === 3) {
    if (kind === 0) {
      const a = int(12, 25), b = int(11, 15);
      [show, say, n] = [`${a} × ${b}`, `${a} nhân ${b}`, a * b];
    } else if (kind === 1) {
      const b = int(6, 9), a = int(21, 79);
      [show, say, n] = [`${a * b} : ${b}`, `${a * b} chia ${b}`, a];
    } else {
      const a = int(345, 899), b = int(57, 99);
      [show, say, n] = [`${a} + ${b}`, `${a} cộng ${b}`, a + b];
    }
  } else {
    if (kind === 0) {
      const a = int(12, 25), b = int(4, 9), c = int(105, 399);
      [show, say, n] = [`${a} × ${b} + ${c}`, `${a} nhân ${b} cộng ${c}`, a * b + c];
    } else if (kind === 1) {
      const b = int(6, 12), q = int(6, 15), c = int(3, 9);
      [show, say, n] = [`${b * q} : ${b} × ${c}`, `${b * q} chia ${b} nhân ${c}`, q * c];
    } else {
      const c = int(3, 9), sum = c * int(12, 30), a = int(Math.ceil(sum / 3), sum - 11);
      [show, say, n] = [`(${a} + ${sum - a}) : ${c}`, `${a} cộng ${sum - a}, tất cả chia ${c}`, sum / c];
    }
  }
  return {
    id: `toan:${show}`,
    answer: String(n),
    clue: `${say} bằng mấy?`,
    category: 'Toán nhẩm',
    kind: 'Câu toán nhẩm.',
    difficulty: DIFF[level],
    math: { show: `${show} = ?`, say },
  };
}
