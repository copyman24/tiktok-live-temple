const grid = document.getElementById('session-grid');
const template = document.getElementById('session-card');
const notice = document.getElementById('studio-notice');
const carry = document.getElementById('carry-live');
let busy = false;

try { carry.checked = localStorage.getItem('studio.carryLive') !== 'false'; } catch {}
carry.addEventListener('change', () => { try { localStorage.setItem('studio.carryLive', String(carry.checked)); } catch {} });

async function load() {
  const response = await fetch('/studio/api/session', { cache: 'no-store' });
  if (!response.ok) throw new Error('Không đọc được trạng thái Studio.');
  return response.json();
}

function render(state) {
  document.getElementById('obs-url').textContent = state.obsUrl;
  const lastRoom = document.getElementById('last-room');
  lastRoom.hidden = !state.lastUsername;
  lastRoom.textContent = state.lastUsername ? `Phòng TikTok gần nhất: @${state.lastUsername}` : '';
  grid.replaceChildren(...state.sessions.map((session) => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.dataset.id = session.id;
    card.dataset.active = String(session.active);
    card.dataset.live = String(Boolean(session.live));
    card.querySelector('img').src = session.art;
    card.querySelector('.session-kicker').textContent = session.kicker;
    card.querySelector('.session-title').textContent = session.title;
    card.querySelector('.session-desc').textContent = session.description;
    const lines = card.querySelector('.session-lines');
    lines.replaceChildren(...(session.lines || []).map((line) => {
      const item = document.createElement('li');
      item.textContent = line;
      return item;
    }));
    card.querySelector('.status-text').textContent = session.live
      ? `Đang phát @${session.live}`
      : session.active ? 'Đang mở' : session.running ? 'Đang tạm dừng · dữ liệu được giữ' : 'Chưa khởi động';
    const button = card.querySelector('.primary-button');
    button.textContent = session.active ? 'Vào phòng điều khiển' : 'Mở phiên này';
    button.addEventListener('click', () => open(session));
    const stage = card.querySelector('.stage-link');
    stage.href = '/obs';
    stage.hidden = !session.active;
    return card;
  }));
  grid.setAttribute('aria-busy', 'false');
}

async function open(session) {
  if (busy) return;
  if (session.active) { location.href = session.operatorPath; return; }
  busy = true;
  grid.querySelectorAll('button').forEach((button) => { button.disabled = true; });
  notice.textContent = `Đang chuyển sang ${session.title}…`;
  try {
    const response = await fetch('/studio/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: session.id, carryLive: carry.checked })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Không chuyển được phiên.');
    if (result.carried) sessionStorage.setItem('studio.carried', result.carried);
    location.href = session.operatorPath;
  } catch (error) {
    notice.textContent = error.message;
    busy = false;
    grid.querySelectorAll('button').forEach((button) => { button.disabled = false; });
  }
}

document.getElementById('copy-obs').addEventListener('click', async () => {
  const url = document.getElementById('obs-url').textContent;
  try {
    await navigator.clipboard.writeText(url);
    notice.textContent = 'Đã sao chép địa chỉ OBS.';
  } catch {
    notice.textContent = `Địa chỉ OBS: ${url}`;
  }
});

async function refresh() {
  try { render(await load()); } catch (error) { notice.textContent = error.message; }
}
refresh();
setInterval(() => { if (!busy && document.visibilityState === 'visible') refresh(); }, 5000);
