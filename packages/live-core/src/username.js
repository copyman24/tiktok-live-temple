// Turn what an operator types into a TikTok handle: "@user", "user", a profile or live URL,
// or a short share link (vt.tiktok.com / vm.tiktok.com) that redirects to the profile.

const HANDLE = /^[A-Za-z0-9._]{2,24}$/;
const PROFILE_IN_URL = /tiktok\.com\/@([A-Za-z0-9._]+)/i;
const SHORT_LINK = /^(?:https?:\/\/)?(?:vt|vm)\.tiktok\.com\//i;

export class UsernameError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsernameError';
    this.code = 'invalid_username';
  }
}

/** Synchronous part: handles, "@handle" and full profile URLs. Returns '' when a network lookup is needed. */
export function parseUsername(raw) {
  const input = String(raw ?? '').trim();
  if (!input) throw new UsernameError('Nhập @username hoặc link TikTok Live cần kết nối.');
  const fromUrl = input.match(PROFILE_IN_URL)?.[1];
  if (fromUrl) return validate(fromUrl);
  if (SHORT_LINK.test(input)) return '';
  if (/^https?:\/\//i.test(input) || input.includes('tiktok.com/')) {
    throw new UsernameError('Link này không chứa @username. Dán link hồ sơ hoặc link chia sẻ của buổi live.');
  }
  return validate(input.replace(/^@/, '').split(/[/?#]/, 1)[0]);
}

/** Full resolution, following short share links. `fetchImpl` is injectable for tests. */
export async function resolveUsername(raw, { fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
  const direct = parseUsername(raw);
  if (direct) return direct;
  const input = String(raw).trim();
  const url = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  let finalUrl = '';
  try {
    const response = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
    finalUrl = response?.url || '';
  } catch (error) {
    throw new UsernameError(`Không mở được link chia sẻ (${error?.message || error}). Nhập @username thay thế.`);
  }
  const resolved = finalUrl.match(PROFILE_IN_URL)?.[1];
  if (!resolved) throw new UsernameError('Link chia sẻ không dẫn tới hồ sơ TikTok nào. Nhập @username thay thế.');
  return validate(resolved);
}

function validate(handle) {
  if (!HANDLE.test(handle)) throw new UsernameError(`"${handle.slice(0, 40)}" không phải username TikTok hợp lệ.`);
  return handle;
}
