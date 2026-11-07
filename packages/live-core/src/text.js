// Text safety for anything a viewer typed that may be shown on stream or read aloud.
// Runs on the server for every app. Names and comments go through here before any app logic.
//
// - Strange-character spam (cuneiform, Braille, block art, Zalgo stacks) is refused outright (from the prayer app).
// - Fancy Unicode names ("𝓛𝓪𝓷") are folded to plain Vietnamese letters with NFKC (from the prayer app).
// - Banned words match whole tokens on the accented text, so "lớn", "buổi", "vlog" are not caught
//   (from the classroom app); the list is the union of both apps' lists.

const WEIRD_SPAM_RE = /[\u{12000}-\u{1254F}﷽⠀-⣿▀-▟]|[̀-ͯ]{3,}/u;
const BRACKET_EMOTE_RE = /\[[^\]]{1,24}\]/g;
const VI = '0-9a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ';
const NOT_VI_TEXT_RE = new RegExp(`[^${VI}\\s.,!?]`, 'g');
const NOT_VI_NAME_RE = new RegExp(`[^${VI}\\s._-]`, 'g');
const VI_LETTER_RE = /[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠ-ỹ]/g;
const CONTROL_RE = /[\u0000-\u001F\u007F-\u009F]/g;

const BANNED_TOKENS = new Set([
  // Vietnamese vulgar (accented) and unambiguous teen-code
  'lồn', 'lìn', 'cặc', 'buồi', 'đéo', 'địt', 'đụ', 'đĩ', 'cứt', 'đm', 'đmm', 'đcm', 'đkm', 'vl', 'vcl', 'vkl', 'vcc',
  'dm', 'dmm', 'dcm', 'dkm', 'clgt', 'loz', 'dit', 'ditme', 'dume', 'cmm', 'yamate',
  // English
  'fuck', 'fck', 'fuk', 'shit', 'bitch', 'dick', 'pussy', 'sex', 'sexy', 'porn', 'nude', 'xxx', 'cave',
  // Violence, gambling, scams
  'giết', 'chém', 'casino', 'scam', 'telegram'
]);
const BANNED_PHRASES = [
  'địt mẹ', 'đụ má', 'đù má', 'đéo mẹ', 'con đĩ', 'dit me', 'du ma', 'đá dái', 'i cư',
  'ma túy', 'ma tuý', 'thuốc lắc', 'cần sa', 'cá độ', 'lô đề', 'cờ bạc', 'chuyển khoản', 'lừa đảo', 'lừa à',
  'te le gram', 'bố là trùm'
];

const tokensOf = (text) => String(text).normalize('NFC').toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);

/** True when the text contains a banned word or phrase. */
export function containsBanned(text) {
  if (!text) return false;
  const tokens = tokensOf(text);
  if (tokens.some((t) => BANNED_TOKENS.has(t))) return true;
  const joined = ` ${tokens.join(' ')} `;
  return BANNED_PHRASES.some((p) => joined.includes(` ${p} `));
}

/** For text shown on screen: banned words become ***. */
export function maskBanned(text) {
  if (!containsBanned(text)) return text;
  let out = String(text).replace(/[\p{L}\p{M}\p{N}]+/gu, (w) => (BANNED_TOKENS.has(w.normalize('NFC').toLowerCase()) ? '***' : w));
  for (const p of BANNED_PHRASES) out = out.replace(new RegExp(p.replace(/ /g, '[\\s\\p{P}]+'), 'giu'), '***');
  return out;
}

/** Cuneiform, Braille, block art and Zalgo: refuse the whole message. */
export function isStrangeSpam(text) {
  return WEIRD_SPAM_RE.test(String(text || ''));
}

/**
 * A display/speech-safe viewer name, or `fallback` when nothing readable is left
 * (fewer than 2 letters, banned word, spam characters).
 */
export function cleanName(raw, { max = 26, fallback = 'Bạn' } = {}) {
  const name = String(raw || '')
    .normalize('NFKC').normalize('NFC')
    .replace(BRACKET_EMOTE_RE, ' ')
    .replace(NOT_VI_NAME_RE, ' ')
    .replace(/(.)\1{3,}/gi, '$1$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
  if (!name || containsBanned(name) || (name.match(VI_LETTER_RE) || []).length < 2) return fallback;
  return name;
}

/** A wish or prayer to read aloud: Vietnamese letters and basic punctuation only, '' when unusable. */
export function cleanSpeech(raw, { max = 120 } = {}) {
  if (!raw) return '';
  const text = String(raw)
    .normalize('NFKC').normalize('NFC')
    .replace(BRACKET_EMOTE_RE, ' ')
    .replace(NOT_VI_TEXT_RE, ' ')
    .replace(/([.,!?])\1+/g, '$1')
    .replace(/(.)\1{2,}/gi, '$1$1')
    .replace(/\s+/g, ' ')
    .replace(/^[.,!?\s-]+|[.,!?\s-]+$/g, '')
    .slice(0, max);
  if (!text || containsBanned(text) || (text.match(VI_LETTER_RE) || []).length < 2) return '';
  return text;
}

/**
 * A raw comment for game logic (answers, keywords). Keeps emoji and punctuation, drops control
 * characters. Returns { text, safe }: `safe` is false for banned words (logic may still read the
 * text, e.g. to count an answer, but must not show or speak it). Spam returns text ''.
 */
export function cleanComment(raw, { max = 300 } = {}) {
  const text = String(raw || '').normalize('NFKC').normalize('NFC').replace(CONTROL_RE, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  if (!text || isStrangeSpam(text)) return { text: '', safe: false };
  return { text, safe: !containsBanned(text) };
}
