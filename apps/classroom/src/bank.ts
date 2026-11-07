// Question banks, read from disk at startup (the original app used Vite's import.meta.glob).
// Add a .txt file to src/game/cau-hoi/ and restart: it is picked up automatically.
import fs from 'node:fs';
import path from 'node:path';
import { parseBank, type Question } from './game/questions';
import { parseCodes, parseMc, type ShowBank } from './game/show';

export function loadBank(gameDir: string, errors: string[] = []): { questions: Question[]; showBank: ShowBank } {
  const read = (dir: string) =>
    Object.fromEntries(
      fs.readdirSync(dir)
        .filter((name) => name.endsWith('.txt'))
        .sort()
        .map((name) => [`./${path.basename(dir)}/${name}`, fs.readFileSync(path.join(dir, name), 'utf8')]),
    );
  const questions = parseBank(read(path.join(gameDir, 'cau-hoi')), errors);
  const show = read(path.join(gameDir, 'cau-hoi-show'));
  const showFile = (name: string) => Object.entries(show).find(([p]) => p.endsWith(`/${name}`))?.[1] ?? '';
  return { questions, showBank: { mc: parseMc(showFile('trac-nghiem.txt'), errors), codes: parseCodes(showFile('mat-ma.txt'), errors) } };
}
