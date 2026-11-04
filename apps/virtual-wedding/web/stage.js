const API = '/rpc';
const WS = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`;
const slots = [...document.querySelectorAll('.wish-slot')];
const phases = {
  lobby: 'ĐANG MỞ VAI · bình luận #codau / #chure',
  entrance: 'ĐÓN DÂU · bình luận #tunghoa để rắc hoa',
  vows: 'TRAO LỜI THỀ · cả phòng hô “hôn đi”',
  rings: 'TRAO NHẪN · cùng chứng kiến khoảnh khắc thiêng liêng',
  celebration: 'CHUNG VUI · bình luận #bathoa để bắt hoa cưới',
  ended: 'LỄ THÀNH HÔN ĐÃ KHÉP LẠI · cảm ơn quý khách'
};
const ART = {
  bride: '/assets/art/bride.svg',
  groom: '/assets/art/groom.svg',
  wish: '/assets/art/envelope.svg',
  kiss: '/assets/art/kiss.svg',
  glasses: '/assets/art/glasses.svg',
  bouquet: '/assets/art/bouquet.svg',
  rings: '/assets/art/rings.svg',
  petal: '/assets/art/petal.svg'
};
// Bốn ô hướng dẫn người xem đổi theo từng nghi thức.
const TILES = {
  lobby: [
    { art: 'bride', small: 'BÌNH LUẬN', label: '#codau' },
    { art: 'groom', small: 'BÌNH LUẬN', label: '#chure' },
    { art: 'wish', small: 'CHỌN PHE', label: '#nhatrai · #nhagai', meter: 'teams' },
    { art: 'bouquet', small: 'GỬI LỜI CHÚC', label: '#loichuc …' }
  ],
  entrance: [
    { art: 'petal', small: 'RẮC HOA', label: '#tunghoa' },
    { art: 'glasses', small: 'NÂNG LY', label: 'dô!', meter: 'cheers' },
    { art: 'wish', small: 'GỬI LỜI CHÚC', label: '#loichuc …', meter: 'wishes' },
    { art: 'bouquet', small: 'TẶNG QUÀ', label: 'Mừng cưới' }
  ],
  vows: [
    { art: 'kiss', small: 'CẢ PHÒNG HÔ', label: 'hôn đi', meter: 'kiss' },
    { art: 'petal', small: 'RẮC HOA', label: '#tunghoa' },
    { art: 'wish', small: 'GỬI LỜI CHÚC', label: '#loichuc …', meter: 'wishes' },
    { art: 'bouquet', small: 'TẶNG QUÀ', label: 'Mừng cưới' }
  ],
  rings: [
    { art: 'rings', small: 'CHỨNG KIẾN', label: 'thả tim', meter: 'likes' },
    { art: 'kiss', small: 'CẢ PHÒNG HÔ', label: 'hôn đi', meter: 'kiss' },
    { art: 'wish', small: 'GỬI LỜI CHÚC', label: '#loichuc …', meter: 'wishes' },
    { art: 'bouquet', small: 'TẶNG QUÀ', label: 'Mừng cưới' }
  ],
  celebration: [
    { art: 'bouquet', small: 'BẮT HOA CƯỚI', label: '#bathoa', meter: 'bouquet' },
    { art: 'glasses', small: 'NÂNG LY', label: 'dô!', meter: 'cheers' },
    { art: 'kiss', small: 'CẢ PHÒNG HÔ', label: 'hôn đi', meter: 'kiss' },
    { art: 'wish', small: 'GỬI LỜI CHÚC', label: '#loichuc …', meter: 'wishes' }
  ],
  ended: [
    { art: 'wish', small: 'CẢM ƠN', label: 'quý khách' },
    { art: 'rings', small: 'TRĂM NĂM', label: 'hạnh phúc' },
    { art: 'glasses', small: 'HẸN GẶP', label: 'lễ sau' },
    { art: 'bouquet', small: 'THEO DÕI', label: 'kênh live' }
  ]
};
let requestId = 0;
let reconnectDelay = 500;
let toastTimer;
let momentTimer;
let currentSessionId = null;
let currentPhase = null;
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
  image.addEventListener('load', () => { node.textContent = ''; node.classList.remove('avatar-fallback'); node.append(image); }, { once: true });
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

function showMoment(art, title, sub, timeout = 4200, tone = 'rose') {
  const card = document.getElementById('moment-card');
  document.getElementById('moment-art').src = ART[art] || art;
  document.getElementById('moment-title').textContent = title;
  document.getElementById('moment-sub').textContent = sub || '';
  card.dataset.tone = tone;
  card.dataset.visible = 'false';
  void card.offsetWidth;
  card.dataset.visible = 'true';
  clearTimeout(momentTimer);
  momentTimer = setTimeout(() => { card.dataset.visible = 'false'; }, timeout);
}

function showHearts(count = 3) {
  const layer = document.getElementById('heart-burst');
  const total = Math.min(14, Math.max(1, Number(count) || 1));
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

function petalShower(count = 18) {
  const layer = document.getElementById('petal-layer');
  if (layer.childElementCount > 80) return;
  for (let index = 0; index < count; index += 1) {
    const petal = document.createElement('img');
    petal.src = ART.petal;
    petal.alt = '';
    petal.className = 'falling-petal';
    petal.style.left = `${Math.random() * 100}%`;
    petal.style.setProperty('--drift', `${(Math.random() - 0.5) * 30}cqw`);
    petal.style.setProperty('--spin', `${(Math.random() - 0.5) * 720}deg`);
    petal.style.animationDuration = `${4.2 + Math.random() * 2.6}s`;
    petal.style.animationDelay = `${Math.random() * 1.4}s`;
    petal.style.width = `${2.2 + Math.random() * 2}%`;
    layer.append(petal);
    setTimeout(() => petal.remove(), 8600);
  }
}

// Pháo hoa & giấy kim tuyến vẽ trên canvas (không cần thư viện ngoài).
const fx = (() => {
  const canvas = document.getElementById('fx-canvas');
  const context = canvas.getContext('2d');
  const particles = [];
  let running = false;
  const colors = ['#ffd36e', '#ff5a7a', '#ffffff', '#f7a8c4', '#ffe9b0', '#d72a48'];
  function resize() {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(canvas.clientWidth * ratio);
    canvas.height = Math.round(canvas.clientHeight * ratio);
  }
  function loop() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const p = particles[index];
      p.life -= 1;
      p.vy += p.gravity;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.spin;
      if (p.life <= 0 || p.y > canvas.height + 40) { particles.splice(index, 1); continue; }
      context.globalAlpha = Math.min(1, p.life / 40);
      context.fillStyle = p.color;
      if (p.kind === 'confetti') {
        context.save();
        context.translate(p.x, p.y);
        context.rotate(p.rotation);
        context.fillRect(-p.size, -p.size / 2.4, p.size * 2, p.size / 1.2);
        context.restore();
      } else {
        context.beginPath();
        context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.globalAlpha = 1;
    if (particles.length) requestAnimationFrame(loop);
    else running = false;
  }
  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(loop);
  }
  function confetti(amount = 120) {
    resize();
    const w = canvas.width;
    for (let index = 0; index < amount; index += 1) {
      particles.push({
        kind: 'confetti',
        x: w * (0.1 + Math.random() * 0.8),
        y: -20 - Math.random() * canvas.height * 0.3,
        vx: (Math.random() - 0.5) * w * 0.004,
        vy: Math.random() * w * 0.004,
        gravity: w * 0.00012,
        drag: 0.992,
        size: w * (0.006 + Math.random() * 0.006),
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.3,
        life: 260 + Math.random() * 120,
        color: colors[index % colors.length]
      });
    }
    start();
  }
  function firework(bursts = 3) {
    resize();
    const w = canvas.width;
    const h = canvas.height;
    for (let burst = 0; burst < bursts; burst += 1) {
      setTimeout(() => {
        const cx = w * (0.2 + Math.random() * 0.6);
        const cy = h * (0.12 + Math.random() * 0.2);
        const color = colors[Math.floor(Math.random() * colors.length)];
        for (let index = 0; index < 70; index += 1) {
          const angle = (Math.PI * 2 * index) / 70;
          const speed = w * (0.004 + Math.random() * 0.007);
          particles.push({
            kind: 'spark', x: cx, y: cy,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            gravity: w * 0.00008, drag: 0.965, size: w * 0.0035,
            rotation: 0, spin: 0, life: 70 + Math.random() * 40,
            color: index % 4 === 0 ? '#ffffff' : color
          });
        }
        start();
      }, burst * 420);
    }
  }
  window.addEventListener('resize', resize);
  return { confetti, firework };
})();

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
    const key = wish?.id || '';
    if (slot.dataset.wishId === key) return;
    slot.dataset.wishId = key;
    slot.replaceChildren();
    slot.dataset.visible = String(Boolean(wish));
    if (wish) slot.append(wishMarkup(wish));
  });
  document.getElementById('wish-count').textContent = `${wishes.length} lời chúc`;
}

function formatCount(total = 0) {
  const number = Number(total) || 0;
  return number >= 10000 ? `${(number / 1000).toFixed(number >= 100000 ? 0 : 1)}K` : number.toLocaleString('vi-VN');
}

function renderTiles(phase) {
  if (phase === currentPhase) return;
  currentPhase = phase;
  const tiles = TILES[phase] || TILES.lobby;
  document.querySelectorAll('.action-tile').forEach((tile, index) => {
    const config = tiles[index];
    tile.querySelector('img').src = ART[config.art];
    tile.querySelector('small').textContent = config.small;
    tile.querySelector('b').textContent = config.label;
    tile.dataset.long = String(config.label.length > 12);
    tile.dataset.art = config.art;
    tile.dataset.meter = config.meter || '';
  });
}

function renderTeams(teams) {
  if (!teams) return;
  const groom = Number(teams.groom?.score) || 0;
  const bride = Number(teams.bride?.score) || 0;
  document.getElementById('team-groom-score').textContent = formatCount(groom);
  document.getElementById('team-bride-score').textContent = formatCount(bride);
  document.getElementById('team-groom-members').textContent = `${formatCount(teams.groom?.members)} người`;
  document.getElementById('team-bride-members').textContent = `${formatCount(teams.bride?.members)} người`;
  document.querySelector('.team-bar').dataset.active = String((teams.groom?.members || 0) + (teams.bride?.members || 0) > 0);
  const share = groom + bride > 0 ? (groom / (groom + bride)) * 100 : 50;
  document.getElementById('team-groom-fill').style.width = `${Math.max(6, Math.min(94, share))}%`;
}

// Ô hành động có đồng hồ tiến độ cho các hoạt động cả phòng cùng làm.
function meterValue(kind, wedding) {
  switch (kind) {
    case 'kiss': return { ratio: wedding.kiss.count / Math.max(1, wedding.kiss.goal), text: `${wedding.kiss.count}/${wedding.kiss.goal}` };
    case 'cheers': return { ratio: wedding.cheers.count / Math.max(1, wedding.cheers.goal), text: `${wedding.cheers.count}/${wedding.cheers.goal}` };
    case 'likes': return { ratio: (wedding.likes.total % 100) / 100, text: `${formatCount(wedding.likes.total)} tim` };
    case 'wishes': return { ratio: null, text: `${wedding.wishes.length} lời chúc` };
    case 'teams': {
      const members = (wedding.teams?.groom?.members || 0) + (wedding.teams?.bride?.members || 0);
      return { ratio: null, text: members ? `${members} người đã chọn` : '' };
    }
    case 'bouquet': {
      const bouquet = wedding.bouquet || {};
      if (bouquet.winner) return { ratio: 1, text: bouquet.winner.name };
      return { ratio: null, text: bouquet.open ? `${bouquet.entrantCount || 0} người chờ` : '' };
    }
    default: return null;
  }
}

function renderTileMeters(wedding) {
  document.querySelectorAll('.action-tile').forEach((tile) => {
    const value = meterValue(tile.dataset.meter, wedding);
    const meter = tile.querySelector('.tile-meter');
    const count = tile.querySelector('.tile-count');
    meter.hidden = !value || value.ratio === null;
    count.hidden = !value?.text;
    if (!value) return;
    if (value.ratio !== null) meter.firstElementChild.style.width = `${Math.min(100, Math.max(0, value.ratio * 100))}%`;
    count.textContent = value.text;
  });
}

function pulseTile(kind) {
  const tile = document.querySelector(`.action-tile[data-meter="${kind}"]`);
  if (!tile) return;
  tile.classList.remove('is-pulse');
  void tile.offsetWidth;
  tile.classList.add('is-pulse');
}

function renderGiftBook(entries = []) {
  const list = document.getElementById('gift-book-list');
  const signature = JSON.stringify(entries.map((entry) => [entry.viewer?.name, entry.coins]));
  if (list.dataset.signature === signature) return;
  list.dataset.signature = signature;
  document.querySelector('.gift-book').dataset.active = String(entries.length > 0);
  if (!entries.length) {
    const empty = document.createElement('li');
    empty.className = 'gift-book-empty';
    empty.textContent = 'Tặng quà để ghi tên mừng cưới';
    list.replaceChildren(empty);
    return;
  }
  list.replaceChildren(...entries.slice(0, 3).map((entry, index) => {
    const row = document.createElement('li');
    const rank = document.createElement('span');
    rank.className = 'book-rank';
    rank.textContent = String(index + 1);
    const avatar = avatarNode(entry.viewer?.name || 'Khách', entry.viewer?.avatar, 'book-avatar');
    const name = document.createElement('span');
    name.className = 'book-name';
    name.textContent = entry.viewer?.name || 'Khách mời';
    const coins = document.createElement('b');
    coins.textContent = formatCount(entry.coins);
    row.append(rank, avatar, name, coins);
    return row;
  }));
}

function render(snapshot) {
  if (!snapshot?.wedding) return;
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
  const live = stream.state === 'live';
  document.getElementById('live-label').textContent = live ? 'TRỰC TIẾP' : 'SÂN KHẤU';
  document.querySelector('.live-badge').classList.toggle('is-offline', !live);
  document.getElementById('viewer-count').textContent = `${Number(stream.viewerCount || 0).toLocaleString('vi-VN')} đang xem`;
  document.getElementById('like-count').textContent = formatCount(wedding.likes.total);
  let phaseText = phases[wedding.phase] || phases.lobby;
  if (wedding.phase === 'celebration' && wedding.bouquet?.open) {
    phaseText = `BẮT HOA CƯỚI · bình luận #bathoa · ${wedding.bouquet.entrantCount} người tham gia`;
  } else if (wedding.bouquet?.winner && wedding.phase === 'celebration') {
    phaseText = `${wedding.bouquet.winner.name} đã bắt được hoa cưới!`;
  }
  document.getElementById('phase-label').textContent = phaseText;
  document.getElementById('stage-frame').dataset.phase = wedding.phase;
  document.getElementById('wedding-date').textContent = `HÔM NAY · ${new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date())}`;
  renderTiles(wedding.phase);
  renderTeams(wedding.teams);
  renderTileMeters(wedding);
  renderGiftBook(wedding.giftBook);
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

const TEAM_LABEL = { groom: 'nhà trai', bride: 'nhà gái' };

function onEvent(event) {
  if (!event) return;
  switch (event.type) {
    case 'wish_received':
      showToast(`Lời chúc mới từ ${event.wish.viewer.name}`);
      break;
    case 'role_claimed':
      showToast(`${event.claim.viewer.name} muốn nhận vai ${event.claim.role === 'bride' ? 'cô dâu' : 'chú rể'}`);
      break;
    case 'role_assigned':
      showToast(`${event.participant.name} sẽ là ${event.role === 'bride' ? 'cô dâu' : 'chú rể'} hôm nay`);
      showHearts(5);
      break;
    case 'couple_locked':
      showMoment('rings', 'Đôi uyên ương đã sẵn sàng', 'Lễ thành hôn sắp bắt đầu', 3800, 'gold');
      break;
    case 'phase_changed':
      if (event.phase === 'entrance') { petalShower(26); showMoment('bouquet', 'Đón dâu', 'Bình luận #tunghoa để rắc hoa', 3600); }
      if (event.phase === 'vows') showMoment('kiss', 'Trao lời thề', 'Cả phòng cùng hô “hôn đi”', 3600);
      if (event.phase === 'rings') { showMoment('rings', 'Trao nhẫn cưới', 'Thả tim chứng kiến khoảnh khắc này', 4200, 'gold'); fx.confetti(80); }
      if (event.phase === 'celebration') { fx.firework(4); fx.confetti(140); showMoment('bouquet', 'Chung vui', 'Bình luận #bathoa để bắt hoa cưới', 4200, 'gold'); }
      if (event.phase === 'ended') showMoment('rings', 'Trăm năm hạnh phúc', 'Cảm ơn quý khách đã đến chung vui', 5200, 'gold');
      break;
    case 'gift_celebration':
      showToast(`${event.viewer.name} mừng cưới ${event.count > 1 ? `${event.count} ` : ''}${event.name}`);
      showHearts(Math.min(10, event.count + 2));
      if (event.grand) {
        fx.firework(5);
        fx.confetti(160);
        showMoment('wish', `${event.viewer.name} mừng cưới`, `${event.count > 1 ? `${event.count} × ` : ''}${event.name}`, 5200, 'gold');
      }
      break;
    case 'guest_cheered': {
      const action = event.source === 'follow' ? 'theo dõi kênh' : event.source === 'share' ? 'chia sẻ lễ cưới' : 'vừa đến dự tiệc';
      showToast(`${event.viewer.name} ${action}`, 2600);
      if (event.source === 'share') petalShower(10);
      break;
    }
    case 'likes_changed':
      if (Math.floor(event.total / 25) > Math.floor(lastLikeTotal / 25)) showHearts(2);
      lastLikeTotal = event.total;
      break;
    case 'like_goal_reached':
      fx.firework(3);
      showMoment('kiss', `${formatCount(event.total)} tim cho đôi uyên ương!`, 'Cả phòng đã đạt mục tiêu thả tim', 4200);
      break;
    case 'team_joined':
      showToast(`${event.viewer.name} về phe ${TEAM_LABEL[event.team]}`, 2400);
      break;
    case 'kiss_chant':
      pulseTile('kiss');
      break;
    case 'kiss_moment':
      showHearts(14);
      setTimeout(() => showHearts(12), 700);
      fx.confetti(90);
      showMoment('kiss', 'Hôn đi! Hôn đi!', `Cả phòng đã hô đủ ${event.goal} lần · nụ hôn thứ ${event.moments}`, 4800);
      break;
    case 'cheers_chant':
      pulseTile('cheers');
      break;
    case 'cheers_burst':
      fx.confetti(110);
      showMoment('glasses', 'Một, hai, ba… DÔ!', `Cả phòng cùng nâng ly lần thứ ${event.rounds}`, 4000, 'gold');
      break;
    case 'petals_tossed':
      petalShower(16);
      showToast(`${event.viewer.name} rắc hoa chúc mừng`, 2200);
      break;
    case 'bouquet_opened':
      showMoment('bouquet', 'Sắp tung hoa cưới', 'Bình luận #bathoa để tham gia', 4000);
      break;
    case 'bouquet_entered':
      showToast(`${event.viewer.name} chờ bắt hoa · ${event.entrants} người`, 1800);
      break;
    case 'bouquet_caught':
      fx.confetti(140);
      petalShower(20);
      showMoment('bouquet', `${event.viewer.name} bắt được hoa cưới!`, `Giữa ${event.entrants} khách mời · chúc sớm tới lượt mình`, 6500, 'gold');
      break;
    default:
      break;
  }
}

function fitFrame() {
  const frame = document.getElementById('stage-frame');
  frame.style.setProperty('--frame-scale', String(frame.clientWidth / 941));
}
window.addEventListener('resize', fitFrame);
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'f' && document.fullscreenEnabled) document.documentElement.requestFullscreen();
});

fitFrame();
renderTiles('lobby');
connect();
rpc('wedding.state.get').then(render).catch(() => showToast('Đang kết nối với máy chủ sân khấu…', 5000));
