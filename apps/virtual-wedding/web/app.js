const API = '/rpc';
const WS = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
const PHASES = [
  ['lobby', 'Đón khách'], ['entrance', 'Đón dâu'], ['vows', 'Lời thề'],
  ['rings', 'Trao nhẫn'], ['celebration', 'Chung vui'], ['ended', 'Khép lễ']
];
let snapshot = null;
let requestId = 0;
let reconnectDelay = 500;
let socket;

function initials(name = '?') {
  return name.trim().split(/\s+/).slice(-2).map((part) => [...part][0] || '').join('').toLocaleUpperCase('vi');
}

function avatar(name, url, className = 'claim-avatar') {
  const node = document.createElement('span');
  node.className = className;
  node.textContent = initials(name);
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    const image = new Image();
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    image.src = url;
    image.addEventListener('load', () => { node.textContent = ''; node.append(image); }, { once: true });
  }
  return node;
}

function setText(id, value) { document.getElementById(id).textContent = value; }

function setNotice(message = '') {
  setText('notice', message);
  if (message) window.setTimeout(() => { if (document.getElementById('notice').textContent === message) setText('notice', ''); }, 6000);
}

async function rpc(method, params = {}) {
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params })
  });
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message || 'Yêu cầu chưa thực hiện được.');
  if (!response.ok) throw new Error(`Máy chủ trả về ${response.status}.`);
  return payload.result;
}

async function act(method, params = {}) {
  setNotice('');
  try {
    const result = await rpc(method, params);
    if (result?.wedding) render(result);
    else if (result?.state === 'connected' || result?.state === 'offline') refresh();
  } catch (error) {
    setNotice(error.message || 'Có lỗi khi thực hiện thao tác.');
  }
}

async function refresh() {
  try { render(await rpc('wedding.state.get')); }
  catch { setBackend(false); }
}

function setBackend(online) {
  document.getElementById('backend-state').dataset.online = String(online);
  document.querySelector('#backend-state span').textContent = online ? 'Sân khấu đã sẵn sàng' : 'Đang kết nối';
}

function renderPhase(wedding) {
  const currentIndex = PHASES.findIndex(([key]) => key === wedding.phase);
  const rail = document.getElementById('phase-track');
  rail.replaceChildren(...PHASES.map(([key, label], index) => {
    const stop = document.createElement('div');
    stop.className = 'phase-stop';
    stop.setAttribute('role', 'listitem');
    stop.dataset.done = String(index < currentIndex);
    stop.dataset.current = String(index === currentIndex);
    const marker = document.createElement('span');
    marker.textContent = index < currentIndex ? '✓' : String(index + 1).padStart(2, '0');
    const caption = document.createElement('small');
    caption.textContent = label;
    stop.append(marker, caption);
    return stop;
  }));
  setText('phase-index', `${String(currentIndex + 1).padStart(2, '0')} / 06`);
  const title = {
    lobby: 'Sảnh đang mở cửa', entrance: 'Đón dâu', vows: 'Trao lời thề',
    rings: 'Trao nhẫn', celebration: 'Cùng chung vui', ended: 'Lễ cưới đã khép lại'
  }[wedding.phase] || 'Sảnh đang mở cửa';
  setText('phase-title', title);
  const help = {
    lobby: wedding.couple.locked ? 'Đôi uyên ương đã sẵn sàng. Hãy bắt đầu nghi thức.' : 'Chọn cô dâu và chú rể trước khi bắt đầu.',
    entrance: 'Chào đón đôi uyên ương bước lên lễ đường.', vows: 'Mời đôi bạn trẻ trao lời thề nguyện.',
    rings: 'Cùng chứng kiến khoảnh khắc trao nhẫn.', celebration: 'Chúc mừng đôi uyên ương bên khách mời.', ended: 'Mở một lễ cưới mới khi bạn sẵn sàng.'
  }[wedding.phase];
  setText('phase-help', help);
}

function renderClaims(claims = [], wedding) {
  setText('claim-count', String(claims.length));
  const list = document.getElementById('claims-list');
  if (!claims.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-line';
    empty.append('Chưa có yêu cầu. Khán giả bình luận ');
    const bride = document.createElement('b'); bride.textContent = '#codau';
    const groom = document.createElement('b'); groom.textContent = '#chure';
    empty.append(bride, ' hoặc ', groom, ' để xin vai.');
    list.replaceChildren(empty);
    return;
  }
  list.replaceChildren(...claims.map((claim) => {
    const row = document.createElement('div'); row.className = 'claim-row';
    const person = avatar(claim.viewer.name, claim.viewer.avatar);
    const copy = document.createElement('div'); copy.className = 'claim-copy';
    const name = document.createElement('b'); name.textContent = claim.viewer.name;
    const role = document.createElement('span'); role.className = 'claim-role'; role.textContent = claim.role === 'bride' ? 'xin làm cô dâu' : 'xin làm chú rể';
    copy.append(name, role);
    const actions = document.createElement('div'); actions.className = 'claim-actions';
    const approve = document.createElement('button'); approve.type = 'button'; approve.textContent = 'Chọn vai'; approve.disabled = Boolean(wedding.couple.locked || wedding.couple[claim.role]);
    approve.addEventListener('click', () => act('wedding.claim.confirm', { claimId: claim.id }));
    const decline = document.createElement('button'); decline.type = 'button'; decline.textContent = 'Bỏ qua';
    decline.addEventListener('click', () => act('wedding.claim.decline', { claimId: claim.id }));
    actions.append(approve, decline); row.append(person, copy, actions); return row;
  }));
}

function renderWishes(wishes = []) {
  setText('wish-total', String(wishes.length));
  const list = document.getElementById('wish-list');
  if (!wishes.length) {
    const empty = document.createElement('div'); empty.className = 'empty-line'; empty.textContent = 'Lời chúc mới sẽ xuất hiện tại đây.';
    list.replaceChildren(empty); return;
  }
  list.replaceChildren(...[...wishes].reverse().map((wish) => {
    const row = document.createElement('div'); row.className = 'wish-row';
    const person = avatar(wish.viewer.name, wish.viewer.avatar);
    const text = document.createElement('p');
    const name = document.createElement('b'); name.textContent = wish.viewer.name;
    text.append(name, document.createElement('br'), document.createTextNode(wish.text));
    row.append(person, text); return row;
  }));
}

function render(snapshotValue) {
  if (!snapshotValue?.wedding) return;
  snapshot = snapshotValue;
  setBackend(true);
  const { wedding, stream } = snapshot;
  const phase = wedding.phase;
  const connected = stream.state === 'connected';
  document.getElementById('room-pill').dataset.connected = String(connected);
  document.getElementById('room-state-label').textContent = connected ? `Đang phát · @${stream.username}` : stream.state === 'connecting' ? 'Đang kết nối TikTok Live…' : 'Chưa kết nối TikTok';
  document.getElementById('connect-light').dataset.connected = String(connected);
  document.getElementById('tiktok-username').value = connected ? stream.username : document.getElementById('tiktok-username').value;
  document.getElementById('connect-button').disabled = stream.state === 'connecting';
  document.getElementById('disconnect-button').hidden = !connected;
  document.getElementById('connect-help').textContent = stream.error || (connected ? `${Number(stream.viewerCount || 0).toLocaleString('vi-VN')} khán giả đang xem.` : 'Nhập tên tài khoản đang livestream công khai.');
  document.querySelector('.connect-form').hidden = connected;
  setText('groom-display', wedding.couple.groom?.name || 'Đang chờ khán giả chọn');
  setText('bride-display', wedding.couple.bride?.name || 'Đang chờ khán giả chọn');
  document.querySelectorAll('.role-form').forEach((form) => {
    const role = form.dataset.role;
    form.querySelector('input').disabled = wedding.couple.locked || phase !== 'lobby';
    form.querySelector('button').disabled = wedding.couple.locked || phase !== 'lobby';
  });
  document.getElementById('couple-lock-state').textContent = wedding.couple.locked ? 'Đôi đã xác nhận' : 'Chưa khóa đôi';
  document.getElementById('couple-lock-state').dataset.locked = String(wedding.couple.locked);
  renderPhase(wedding);
  renderClaims(wedding.claims, wedding);
  renderWishes(wedding.wishes);
  const both = Boolean(wedding.couple.bride && wedding.couple.groom);
  const advance = document.getElementById('advance-phase');
  const advanceLabel = phase === 'lobby' ? (wedding.couple.locked ? 'Bắt đầu lễ cưới' : 'Xác nhận đôi uyên ương') : phase === 'celebration' ? 'Khép lại nghi thức' : 'Chuyển nghi thức';
  setText('advance-label', advanceLabel);
  advance.disabled = phase === 'ended' || (phase === 'lobby' && !both);
  document.getElementById('end-ceremony').hidden = phase === 'ended' || phase === 'lobby';
  document.getElementById('open-ceremony').hidden = phase !== 'ended';
  const ratio = Math.min(100, Math.round((wedding.likes.progress / Math.max(100, wedding.likes.goal)) * 100));
  setText('like-total', Number(wedding.likes.total || 0).toLocaleString('vi-VN'));
  document.getElementById('like-progress').style.width = `${ratio}%`;
  document.getElementById('like-goal').value = wedding.likes.goal;
  setText('follow-total', Number(wedding.social.follows || 0).toLocaleString('vi-VN'));
  setText('share-total', Number(wedding.social.shares || 0).toLocaleString('vi-VN'));
  setText('gift-total', Number(wedding.social.gifts || 0).toLocaleString('vi-VN'));
  setText('member-total', Number(wedding.social.members || 0).toLocaleString('vi-VN'));
}

function connectSocket() {
  socket = new WebSocket(WS);
  socket.addEventListener('open', () => { reconnectDelay = 500; setBackend(true); });
  socket.addEventListener('message', (message) => {
    let payload; try { payload = JSON.parse(message.data); } catch { return; }
    if (payload.method === 'wedding.state') render(payload.params);
    if (payload.method === 'wedding.event') announce(payload.params?.event);
  });
  socket.addEventListener('close', () => {
    setBackend(false);
    window.setTimeout(connectSocket, reconnectDelay);
    reconnectDelay = Math.min(8000, reconnectDelay * 1.7);
  });
  socket.addEventListener('error', () => socket.close());
}

function announce(event) {
  if (!event) return;
  if (event.type === 'role_claimed') setNotice(`${event.claim.viewer.name} vừa xin nhận vai ${event.claim.role === 'bride' ? 'cô dâu' : 'chú rể'}.`);
  if (event.type === 'wish_received') setNotice(`Đã nhận lời chúc từ ${event.wish.viewer.name}.`);
  if (event.type === 'gift_celebration') setNotice(`${event.viewer.name} vừa gửi ${event.count > 1 ? `${event.count} ` : ''}${event.name}.`);
}

document.querySelectorAll('.role-form').forEach((form) => form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = form.elements.name.value.trim();
  if (!name) { setNotice('Hãy nhập tên người tham gia.'); return; }
  const role = form.dataset.role;
  await act('wedding.assignRole', { role, name });
  form.elements.name.value = '';
}));

document.getElementById('advance-phase').addEventListener('click', async () => {
  if (snapshot?.wedding.phase === 'lobby' && !snapshot.wedding.couple.locked) await act('wedding.couple.lock');
  else await act('wedding.phase.advance');
});
document.getElementById('end-ceremony').addEventListener('click', () => act('wedding.end'));
document.getElementById('open-ceremony').addEventListener('click', () => act('wedding.open'));
document.getElementById('save-goal').addEventListener('click', () => act('wedding.likeGoal.set', { goal: document.getElementById('like-goal').value }));
document.getElementById('connect-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = document.getElementById('tiktok-username').value.trim();
  if (!username) { setNotice('Nhập tên tài khoản TikTok trước.'); return; }
  document.getElementById('connect-button').disabled = true;
  await act('tiktok.connect', { username });
  document.getElementById('connect-button').disabled = false;
  await refresh();
});
document.getElementById('disconnect-button').addEventListener('click', () => act('tiktok.disconnect'));

const kind = document.getElementById('sim-kind');
kind.addEventListener('change', () => {
  const comment = kind.value === 'comment';
  document.getElementById('sim-content-wrap').hidden = !comment;
  document.getElementById('sim-count-wrap').hidden = comment || ['follow', 'share', 'member'].includes(kind.value);
});
document.getElementById('simulate-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = document.getElementById('sim-name').value.trim() || 'Khách mời';
  const selected = kind.value;
  const interaction = { kind: selected, viewer: { id: `demo:${name.toLocaleLowerCase('vi')}`, name } };
  if (selected === 'comment') interaction.text = document.getElementById('sim-content').value;
  if (selected === 'like') interaction.count = document.getElementById('sim-count').value || 1;
  if (selected === 'gift') { interaction.count = document.getElementById('sim-count').value || 1; interaction.name = 'Hoa chúc mừng'; }
  act('wedding.simulate', { interaction });
});
document.querySelectorAll('[data-comment]').forEach((button) => button.addEventListener('click', () => {
  act('wedding.simulate', { interaction: { kind: 'comment', viewer: { id: `demo:${crypto.randomUUID()}`, name: document.getElementById('sim-name').value || 'Khách mời' }, text: button.dataset.comment } });
}));

connectSocket();
refresh();
