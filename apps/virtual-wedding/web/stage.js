const API = '/rpc';
const WS = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
const slots = [...document.querySelectorAll('.wish-slot')];
const phases = {
  lobby: 'ĐANG MỞ VAI · bình luận #codau / #chure',
  entrance: 'ĐÓN DÂU · cùng chào đón đôi uyên ương',
  vows: 'TRAO LỜI THỀ · gửi lời chúc #loichuc',
  rings: 'TRAO NHẪN · cùng chứng kiến khoảnh khắc thiêng liêng',
  celebration: 'CHUNG VUI · chúc mừng đôi bạn trẻ',
  ended: 'LỄ THÀNH HÔN ĐÃ KHÉP LẠI'
};
let currentState = null;
let requestId = 0;
let reconnectDelay = 500;
let toastTimer;
let currentSessionId = null;
let lastLikeTotal = 0;

function initials(name = '?') {
  return name.trim().split(/\s+/).slice(-2).map((part) => [...part][0] || '').join('').toLocaleUpperCase('vi');
}

function avatarNode(name, url, className) {
  const node = document.createElement('span');
  node.className = `${className} avatar-fallback`;
  node.textContent = initials(name);
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return node;
  const image = new Image();
  image.alt = '';
  image.referrerPolicy = 'no-referrer';
  image.src = url;
  image.addEventListener('load', () => { node.textContent = ''; node.append(image); }, { once: true });
  return node;
}

function renderRoleAvatar(id, participant) {
  const node = document.getElementById(id);
  node.textContent = initials(participant?.name || '?');
  node.classList.add('avatar-fallback');
  const url = participant?.avatar;
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return;
  const image = new Image();
  image.alt = '';
  image.referrerPolicy = 'no-referrer';
  image.src = url;
  image.addEventListener('load', () => {
    node.classList.remove('avatar-fallback');
    node.replaceChildren(image);
  }, { once: true });
}

function showToast(text, timeout = 3500) {
  const toast = document.getElementById('event-toast');
  toast.textContent = text;
  toast.dataset.visible = 'true';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.dataset.visible = 'false'; }, timeout);
}

function showHearts(count = 3) {
  const layer = document.getElementById('heart-burst');
  const total = Math.min(12, Math.max(1, Number(count) || 1));
  for (let index = 0; index < total; index += 1) {
    const heart = document.createElement('span');
    heart.className = 'heart';
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    shape.setAttribute('d', 'M12 21s-8-4.7-8-11a4.6 4.6 0 0 1 8-3.1A4.6 4.6 0 0 1 20 10c0 6.3-8 11-8 11Z');
    icon.append(shape);
    heart.append(icon);
    heart.style.left = `${10 + Math.random() * 78}%`;
    heart.style.animationDelay = `${Math.random() * 650}ms`;
    layer.append(heart);
    setTimeout(() => heart.remove(), 3400);
  }
}

function wishMarkup(wish) {
  const bubble = document.createElement('div');
  bubble.className = 'wish-bubble';
  const avatar = avatarNode(wish.viewer?.name || 'Khách mời', wish.viewer?.avatar, 'wish-avatar');
  const copy = document.createElement('span');
  copy.className = 'wish-copy';
  const name = document.createElement('b');
  name.className = 'wish-name';
  name.textContent = wish.viewer?.name || 'Khách mời';
  const text = document.createElement('span');
  text.className = 'wish-text';
  text.textContent = wish.text;
  copy.append(name, text);
  bubble.append(avatar, copy);
  return bubble;
}

function renderWishes(wishes = []) {
  slots.forEach((slot, index) => {
    const wish = wishes[wishes.length - 1 - index];
    slot.replaceChildren();
    slot.dataset.visible = String(Boolean(wish));
    if (wish) slot.append(wishMarkup(wish));
  });
  document.getElementById('wish-count').textContent = `${wishes.length} lời chúc`;
}

function formatLikes(total = 0) {
  const number = Number(total) || 0;
  return number >= 10000 ? `${(number / 1000).toFixed(number >= 100000 ? 0 : 1)}K` : number.toLocaleString('vi-VN');
}

function render(snapshot) {
  if (!snapshot?.wedding) return;
  currentState = snapshot;
  const { wedding, stream } = snapshot;
  if (wedding.sessionId !== currentSessionId) {
    currentSessionId = wedding.sessionId;
    lastLikeTotal = wedding.likes.total;
  }
  const bride = wedding.couple.bride;
  const groom = wedding.couple.groom;
  document.getElementById('bride-name').textContent = bride?.name || 'Đang chờ';
  document.getElementById('groom-name').textContent = groom?.name || 'Đang chờ';
  document.getElementById('bride-title').textContent = bride?.name || 'Cô dâu';
  document.getElementById('groom-title').textContent = groom?.name || 'Chú rể';
  renderRoleAvatar('bride-avatar', bride);
  renderRoleAvatar('groom-avatar', groom);
  document.getElementById('live-label').textContent = stream.state === 'connected' ? 'TRỰC TIẾP' : 'SÂN KHẤU';
  document.querySelector('.live-badge').classList.toggle('is-offline', stream.state !== 'connected');
  document.getElementById('viewer-count').textContent = `${Number(stream.viewerCount || 0).toLocaleString('vi-VN')} đang xem`;
  document.getElementById('like-count').textContent = formatLikes(wedding.likes.total);
  document.getElementById('phase-label').textContent = phases[wedding.phase] || phases.lobby;
  document.getElementById('wedding-date').textContent = `HÔM NAY · ${new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date())}`;
  renderWishes(wedding.wishes);
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

function connect() {
  const socket = new WebSocket(WS);
  socket.addEventListener('open', () => { reconnectDelay = 500; });
  socket.addEventListener('message', (message) => {
    let payload;
    try { payload = JSON.parse(message.data); } catch { return; }
    if (payload.method === 'wedding.state') render(payload.params);
    if (payload.method === 'wedding.event') onEvent(payload.params?.event);
  });
  socket.addEventListener('close', () => {
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(8000, reconnectDelay * 1.7);
  });
  socket.addEventListener('error', () => socket.close());
}

function onEvent(event) {
  if (!event) return;
  if (event.type === 'wish_received') showToast(`Lời chúc mới từ ${event.wish.viewer.name}`);
  if (event.type === 'role_claimed') showToast(`${event.claim.viewer.name} muốn nhận vai ${event.claim.role === 'bride' ? 'cô dâu' : 'chú rể'}`);
  if (event.type === 'gift_celebration') {
    showToast(`${event.viewer.name} gửi ${event.count > 1 ? `${event.count} ` : ''}${event.name}`);
    showHearts(Math.min(8, event.count));
  }
  if (event.type === 'guest_cheered') {
    const action = event.source === 'follow' ? 'theo dõi' : event.source === 'share' ? 'chia sẻ' : 'tham gia hội viên';
    showToast(`${event.viewer.name} vừa ${action} lễ cưới`);
  }
  if (event.type === 'likes_changed') {
    if (Math.floor(event.total / 25) > Math.floor(lastLikeTotal / 25)) showHearts(2);
    lastLikeTotal = event.total;
  }
}

window.addEventListener('resize', () => {
  const frame = document.getElementById('stage-frame');
  frame.style.setProperty('--frame-scale', String(frame.clientWidth / 941));
});
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'f' && document.fullscreenEnabled) document.documentElement.requestFullscreen();
});

const frame = document.getElementById('stage-frame');
frame.style.setProperty('--frame-scale', String(frame.clientWidth / 941));
connect();
rpc('wedding.state.get').then(render).catch(() => showToast('Đang kết nối với máy chủ sân khấu…', 5000));
