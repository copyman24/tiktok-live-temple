/**
 * Live 9:16 Client Controller — Chánh Điện Đức Phật A Di Đà & Đạo Tràng Phật Tử Quỳ Lễ
 * - Hiển thị 6 Đệm Quỳ VIP (Top 6 Bảng Vàng Công Đức)
 * - Hiển thị 40 Phật Tử mặc áo lam quỳ hai bên thảm đỏ + thẻ tên người xem
 * - Hiệu ứng người xem bước dọc thảm đỏ lên trước Lư Hương Đồng dâng hương
 * - Giọng đọc ZeroTTS (Mai Chi) + Pháp khí Web Audio
 */
(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get('obs') === '1') {
    document.body.classList.add('obs-mode');
  }

  // 1. Tự động co giãn khung 1080x1920 vừa khít Stage Wrapper (9:16)
  const stageWrapper = document.getElementById('stageWrapper');
  const stage9x16 = document.getElementById('stage9x16');

  function fitStage() {
    if (!stageWrapper || !stage9x16) return;
    const rect = stageWrapper.getBoundingClientRect();
    const scale = rect.width / 1080;
    stage9x16.style.transform = `scale(${scale})`;
  }
  fitStage();

  // 2. Khởi tạo Particle Engine & Audio Engine (ZeroTTS Mai Chi)
  const canvas = document.getElementById('templeCanvas');
  const particles = new window.TempleParticleEngine(canvas);
  const audio = new window.TempleAudioEngine();
  const commentBubblesLayer = document.getElementById('commentBubblesLayer');
  // Bóng chat trên đầu nhân vật: mỗi người xem một bóng, tối đa MAX_COMMENT_BUBBLES bóng cùng lúc.
  // activeCommentBubble = bóng mới nhất (sớ cầu nguyện so với bóng này để không hiện trùng).
  const commentBubbles = new Map(); // viewerId -> record
  let activeCommentBubble = null;
  const MAX_COMMENT_BUBBLES = 4;
  const COMMENT_BUBBLE_DURATION_MS = 4800;
  const COMMENT_BUBBLE_EXIT_MS = 260;

  function unlockAudioOnce() {
    audio.ensureContext();
    const btnUnlock = document.getElementById('btnUnlockAudio');
    if (btnUnlock) {
      btnUnlock.textContent = 'Âm thanh đã sẵn sàng';
      btnUnlock.classList.remove('gold');
      btnUnlock.classList.add('active-toggle');
    }
  }
  window.addEventListener('pointerdown', unlockAudioOnce, { once: true });

  // 3. Vẽ các nén nhang đang cháy trong Lư Hương Đỉnh Đồng (x=540, y=895)
  const incenseHolder = document.getElementById('incenseSticksHolder');
  const incenseZone = document.getElementById('incenseBurnerZone');
  let renderedStickCount = 0;
  let lastIncenseCount = 9;
  // Chân que hương (y trên sân khấu): theo vị trí lư hương trong CSS (top 790 -> 895). Nền khác có thể dời lư hương.
  function incenseBaseY() {
    const top = parseFloat(incenseZone ? getComputedStyle(incenseZone).top : '');
    return (Number.isFinite(top) ? top : 790) + 105;
  }

  function renderIncenseSticks(count) {
    lastIncenseCount = count;
    const target = Math.max(3, Math.min(27, Number(count) || 9));
    if (target === renderedStickCount && incenseHolder.children.length > 0) return;
    renderedStickCount = target;
    incenseHolder.innerHTML = '';

    const tips = [];
    for (let i = 0; i < target; i++) {
      const stick = document.createElement('div');
      stick.className = 'incense-stick';

      const spread = target === 1 ? 0 : (i / (target - 1) - 0.5) * 2;
      const leftPx = 65 + spread * 28 + Math.sin(i * 2.1) * 2;
      const angleDeg = spread * 12 + Math.cos(i * 1.5) * 1.5;
      const heightPx = 76 + (i % 3) * 6;

      stick.style.left = `${leftPx}px`;
      stick.style.height = `${heightPx}px`;
      stick.style.transform = `rotate(${angleDeg}deg)`;

      const ember = document.createElement('div');
      ember.className = 'incense-ember ember-flicker';
      ember.style.animationDelay = `${i * 0.045}s`;
      stick.appendChild(ember);
      incenseHolder.appendChild(stick);

      const rad = (angleDeg * Math.PI) / 180;
      const tipX = 540 + (leftPx - 65) + Math.sin(rad) * heightPx;
      const tipY = incenseBaseY() - Math.cos(rad) * heightPx;
      tips.push({ x: tipX, y: tipY });
    }
    particles.setIncenseTips(tips);
  }

  // 3b. Bộ trang phục Phật tử: 4 màu áo tràng (lam, nâu, trắng, vàng) × tóc búi (nữ) / tóc ngắn (nam).
  // Vẽ bằng design/art-gen/devotees.mjs. Mỗi người xem luôn mặc CÙNG một bộ (băm theo uniqueId),
  // dù ngồi đạo tràng, lên đệm VIP hay đi dâng hương; ghế trống dùng bộ theo số ghế cho đạo tràng đa dạng.
  const DEVOTEE_VARIANTS = ['lam-nu', 'lam-nam', 'nau-nu', 'nau-nam', 'trang-nu', 'trang-nam', 'vang-nu', 'vang-nam'];
  const DEFAULT_VARIANT = 'lam-nu';
  const DEVOTEE_POSES = ['walk1', 'walk2', 'kneelDown', 'kneel', 'forehead', 'bowMid', 'prostrate', 'prostrateDeep'];
  const framesOf = (variant) => Object.fromEntries(
    DEVOTEE_POSES.map((pose) => [pose, `/assets/devotees/${DEVOTEE_VARIANTS.includes(variant) ? variant : DEFAULT_VARIANT}/${pose}.webp`])
  );
  function variantFor(key) {
    const text = String(key || '');
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return DEVOTEE_VARIANTS[(h >>> 0) % DEVOTEE_VARIANTS.length];
  }
  // Giải mã sẵn mọi khung hình của mọi bộ (64 ảnh WebP, ~1,2 MB): đổi áo / đổi tư thế không bao giờ nháy.
  const preloadedFrames = DEVOTEE_VARIANTS.flatMap((variant) => Object.values(framesOf(variant)).map((url) => {
    const img = new Image();
    img.src = url;
    img.decode?.().catch(() => {});
    return img;
  }));
  function dressSprite(img, variant, pose = 'kneel') {
    if (!img) return;
    const url = framesOf(variant)[pose];
    if (img.getAttribute('src') !== url) img.src = url;
  }

  // 4. Dựng Hàng 6 Đệm Quỳ VIP (Top 6 Thí Chủ trên bục gỗ y=1188)
  const VIP_CUSHION_COORDS = [
    { x: 140, y: 1188, rank: 1 },
    { x: 268, y: 1188, rank: 2 },
    { x: 392, y: 1188, rank: 3 },
    { x: 688, y: 1188, rank: 4 },
    { x: 812, y: 1188, rank: 5 },
    { x: 940, y: 1188, rank: 6 }
  ];

  // Six slots are created ONCE and only their name / viewer id change. Rebuilding them with innerHTML
  // on every state update (each like, gift, comment) re-created the sprites: the images reloaded, the
  // bow animation restarted and comment bubbles lost their anchor, so the stage flickered nonstop.
  let vipSlots = null;
  function renderVipCushions(leaderboard = []) {
    const layer = document.getElementById('vipCushionsLayer');
    if (!layer) return;

    if (!vipSlots) {
      layer.innerHTML = '';
      vipSlots = VIP_CUSHION_COORDS.map((slot, idx) => {
        const el = document.createElement('div');
        el.className = 'vip-devotee-slot';
        el.style.left = `${slot.x}px`;
        el.style.top = `${slot.y}px`;
        el.style.zIndex = String(12 + idx);
        el.style.display = 'none'; // .vip-devotee-slot is display:flex, which would override [hidden]
        const sprite = document.createElement('img');
        sprite.src = framesOf(DEFAULT_VARIANT).kneel;
        sprite.alt = 'VIP Devotee';
        sprite.className = 'devotee-sprite';
        const pill = document.createElement('div');
        pill.className = 'vip-rank-pill';
        const num = document.createElement('span');
        num.className = 'vip-rank-num';
        num.textContent = String(slot.rank);
        const name = document.createElement('span');
        name.className = 'vip-rank-name';
        pill.append(num, name);
        el.append(sprite, pill);
        layer.appendChild(el);
        return { el, sprite, name, sig: '' };
      });
    }

    vipSlots.forEach((slot, idx) => {
      const dev = leaderboard[idx];
      const id = dev ? String(dev.uniqueId || dev.name) : '';
      const label = dev ? shortenName(dev.name, 12) : '';
      const sig = `${id}|${label}`;
      if (sig === slot.sig) return;
      slot.sig = sig;
      slot.el.style.display = dev ? '' : 'none';
      if (dev) {
        slot.el.dataset.viewerId = id;
        slot.el.dataset.variant = variantFor(id);
        dressSprite(slot.sprite, slot.el.dataset.variant);
      } else delete slot.el.dataset.viewerId;
      slot.name.textContent = label;
    });
  }

  // 5. Dựng Đạo Tràng 40 Phật Tử Quỳ Lễ Hai Bên Thảm Đỏ (5 Hàng x 4 Cột mỗi bên)
  const congregationHall = document.getElementById('congregationHall');
  const HALL_SEAT_COORDS = [];

  // Đạo tràng đông kín hai bên thảm đỏ: 8 hàng × 5 người mỗi bên = 80 chỗ, từ sau đệm VIP xuống sát
  // 3 thẻ dưới đáy. Hàng xa nhỏ, hàng gần to; mép trong bám theo mép thảm đỏ (thảm rộng dần khi tới gần).
  (function buildHallGrid() {
    const rows = 8;
    const colsPerSide = 5;
    const yFar = 1245;
    const yNear = 1662; // chừa chỗ cho hàng người đứng phía trước (đầu + thân lộ trên 3 ô dưới)
    for (let r = 0; r < rows; r++) {
      const progress = r / (rows - 1); // 0 (xa) -> 1 (gần)
      const y = Math.round(yFar + progress * (yNear - yFar));
      const scale = +(0.6 + progress * 0.32).toFixed(2);
      const carpetEdge = Math.round(335 - (y - 1290) * 0.135); // mép thảm bên trái tại độ sâu này
      const outer = 40;

      // Cánh trái thảm đỏ
      for (let c = 0; c < colsPerSide; c++) {
        const t = c / (colsPerSide - 1);
        HALL_SEAT_COORDS.push({ side: 'L', row: r, col: c, x: Math.round(outer + t * (carpetEdge - outer)), y, scale });
      }
      // Cánh phải thảm đỏ (đối xứng qua giữa thảm, x = 540)
      for (let c = 0; c < colsPerSide; c++) {
        const t = c / (colsPerSide - 1);
        HALL_SEAT_COORDS.push({ side: 'R', row: r, col: c, x: Math.round(1080 - carpetEdge + t * (carpetEdge - outer)), y, scale });
      }
    }

    // Hàng người ĐỨNG gần người xem nhất (khoảng trống trên 3 ô dưới): một hàng dài kín bề ngang, đứng cả
    // trên thảm đỏ. Chân khuất sau 3 ô dưới, chỉ thấy đầu và thân. Cột 0 bên trái = ngoài cùng, bên phải = sát giữa
    // (giống quy ước các hàng quỳ).
    const yStand = 1840;
    const standScale = 1.12; // gần người xem nhất nên to hơn hàng quỳ; lộ ~100px đầu + thân trên 3 ô dưới
    const standCount = 16;
    const standLeft = 46;
    const standStep = (1080 - standLeft * 2) / (standCount - 1);
    const standPerSide = standCount / 2;
    for (let i = 0; i < standCount; i++) {
      const x = Math.round(standLeft + i * standStep);
      const side = i < standPerSide ? 'L' : 'R';
      const col = side === 'L' ? i : i - standPerSide;
      // Người đứng sát nhau (~66px) mà bảng tên rộng ~110px: chỉ cách một người mới nhận người bình luận có tên,
      // người còn lại là người đứng cho đông (không bảng tên), để tên không đè lên nhau.
      const decor = i % 2 === 1;
      HALL_SEAT_COORDS.push({ side, row: rows, col, x, y: yStand, scale: standScale, standing: true, perSide: standPerSide, decor });
    }
  })();

  // Hai hàng gần chính điện nhất (16 chỗ) dành cho người vừa tặng quà;
  // ba hàng sau (24 chỗ) là người bình luận được chọn ngẫu nhiên.
  const DONOR_ROWS = 2;
  const COMMENTER_MIN_STAY_MS = 20000;
  const hallSeats = [];
  let vipViewerIds = new Set();
  let hallHasSynced = false;

  // Tên + avatar người xem nằm DƯỚI chân nhân vật (nhìn thấy trọn nhân vật), trên một lớp riêng phía trên
  // cả đạo tràng: nếu đặt trong ghế thì hàng ngồi phía trước sẽ che mất bảng tên của hàng sau.
  let hallLabelsLayer = null;

  (function mountHallSeats() {
    if (!congregationHall) return;
    congregationHall.innerHTML = '';
    hallLabelsLayer = document.createElement('div');
    hallLabelsLayer.className = 'hall-labels-layer';
    hallLabelsLayer.setAttribute('aria-hidden', 'true');
    congregationHall.after(hallLabelsLayer);
    HALL_SEAT_COORDS.forEach((coord, idx) => {
      const kind = coord.decor ? 'decor' : coord.row < DONOR_ROWS ? 'donor' : 'commenter';
      const el = document.createElement('div');
      el.className = `hall-seat ${kind}-seat${coord.standing ? ' standing-seat' : ''}`;
      el.dataset.seatIdx = String(idx);
      const pose = coord.standing ? 'walk1' : 'kneel'; // hàng đứng: khung đứng (bước nhẹ), các hàng khác quỳ
      el.style.left = `${coord.x}px`;
      el.style.top = `${coord.y}px`;
      el.style.zIndex = String(20 + coord.row * 2);
      el.style.transform = `translate(-50%, -100%) scale(${coord.scale})`;
      // Ghế trống: bộ áo theo số ghế (idx × 5 đi hết 8 bộ, ghế cạnh nhau khác nhau).
      const baseVariant = DEVOTEE_VARIANTS[(idx * 5 + coord.row) % DEVOTEE_VARIANTS.length];
      el.dataset.variant = baseVariant;
      const sprite = document.createElement('img');
      sprite.src = framesOf(baseVariant)[pose];
      sprite.alt = '';
      sprite.className = 'devotee-sprite';
      sprite.style.animationDelay = `${((idx * 0.27) % 3.5).toFixed(2)}s`;
      el.appendChild(sprite);
      congregationHall.appendChild(el);
      // Bảng tên của ghế: neo ở chân nhân vật, co giãn theo hàng như nhân vật.
      const label = document.createElement('div');
      label.className = `hall-label ${kind}-label`;
      label.style.left = `${coord.x}px`;
      // Ghế cạnh nhau sát nhau: so le bảng tên (cột lẻ thấp hơn một chút) để tên không đè lên nhau.
      // Bảng tên thu nhỏ theo hàng nhưng ít hơn nhân vật: hàng xa nhất 74% (thay vì 60%) cho dễ đọc,
      // hàng gần gần như giữ nguyên. Ghế cạnh nhau sát nhau: cột lẻ thấp hơn một chút để tên không đè nhau.
      // Hàng đứng: bảng tên nhỏ (85%) sát mép 3 ô dưới, để đầu và vai người đứng không bị che.
      const labelScale = coord.standing ? 0.85 : +(coord.scale + (1 - coord.scale) * 0.35).toFixed(3);
      // So le QUANH chân nhân vật: cột chẵn nhích lên (che vạt áo), cột lẻ ngay dưới chân. Bảng tên luôn
      // dính với nhân vật của nó (so le xuống sâu thì bảng tên lọt vào hàng dưới, nhìn như của người khác).
      // Hàng đứng: chân khuất sau 3 ô dưới (top 1804) nên bảng tên nằm ngay trên mép 3 ô, trước thân người đó.
      label.style.top = coord.standing
        ? `${1774 + (coord.col % 2 ? 0 : -4)}px`
        : `${coord.y + Math.round((coord.col % 2 ? 6 : -30) * labelScale)}px`;
      label.style.transform = `translate(-50%, 0) scale(${labelScale})`;
      label.dataset.x = String(coord.x);
      label.dataset.scale = String(labelScale);
      hallLabelsLayer.appendChild(label);
      // Độ "gần thảm đỏ": 0 là ghế sát thảm, dễ nhìn nhất.
      const perSide = coord.perSide || 5; // hàng quỳ 5 người mỗi bên: cột 4 (trái) / 0 (phải) sát thảm
      const inner = coord.side === 'L' ? perSide - 1 - coord.col : coord.col;
      hallSeats.push({ el, sprite, label, baseVariant, kind, pose, standing: Boolean(coord.standing), row: coord.row, inner, side: coord.side, viewer: null, sig: '', lastActive: 0 });
    });
  })();

  // Ghế người tặng quà: hàng đầu trước, ghế sát thảm trước, xen kẽ trái/phải.
  const donorSeats = hallSeats
    .filter((s) => s.kind === 'donor')
    .sort((a, b) => a.row - b.row || a.inner - b.inner || (a.side === 'L' ? -1 : 1));
  const commenterSeats = hallSeats.filter((s) => s.kind === 'commenter');

  function normalizeViewer(raw) {
    if (!raw) return null;
    const id = String(raw.id || raw.uniqueId || raw.name || '').slice(0, 96);
    const name = String(raw.name || raw.user || '').trim();
    if (!id || !name) return null;
    const avatar = /^https?:\/\//i.test(String(raw.avatar || '')) ? String(raw.avatar) : '';
    return { id, name, avatar, giftName: raw.giftName || '' };
  }

  // Mặt AI cho nhân vật ảo: người xem không có ảnh TikTok thật (giả lập, thử nghiệm) được gán cố định một
  // ảnh trong public/assets/avatars/ai/ theo tài khoản. Thư mục trống thì vẫn hiện chữ cái như cũ.
  let aiFacePool = [];
  function aiFaceFor(key) {
    if (!aiFacePool.length) return '';
    let h = 2166136261;
    const s = String(key || '');
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return aiFacePool[(h >>> 0) % aiFacePool.length];
  }
  function faceUrlFor(avatar, key) {
    return avatar || aiFaceFor(key);
  }
  fetch('/api/ai-avatars')
    .then((r) => (r.ok ? r.json() : { urls: [] }))
    .then(({ urls }) => {
      if (!Array.isArray(urls) || !urls.length) return;
      aiFacePool = urls;
      urls.forEach((url) => { new Image().src = url; });
      // Ghế đã có người trước khi danh sách ảnh về: vẽ lại bảng tên của người chưa có ảnh.
      hallSeats.forEach((seat) => {
        if (seat.viewer && !seat.viewer.avatar) {
          const viewer = seat.viewer;
          seat.sig = '';
          setSeatOccupant(seat, viewer);
        }
      });
    })
    .catch(() => {});

  function buildSeatFace(viewer) {
    const face = document.createElement('span');
    face.className = 'seat-face';
    const initial = viewer.name.charAt(0).toUpperCase() || 'P';
    const src = faceUrlFor(viewer.avatar, viewer.id);
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => {
        img.remove();
        face.textContent = initial;
      };
      face.appendChild(img);
    } else {
      face.textContent = initial;
    }
    return face;
  }

  // Ghế sát mép sân khấu (x 40 / 1040): bảng tên đặt giữa nhân vật sẽ tràn ra ngoài và bị cắt chữ.
  // Dịch bảng tên vào trong vừa đủ để nằm trọn trong khung (cách mép 8px).
  function fitLabelInStage(label) {
    const x = Number(label.dataset.x);
    const scale = Number(label.dataset.scale) || 1;
    const half = (label.offsetWidth * scale) / 2;
    const shift = x - half < 8 ? 8 - (x - half) : x + half > 1072 ? 1072 - (x + half) : 0;
    label.style.transform = `translate(calc(-50% + ${Math.round(shift / scale)}px), 0) scale(${scale})`;
  }
  // Phông chữ tải xong thì tên rộng/hẹp đi một chút: đo lại các bảng tên đang có người.
  document.fonts?.ready.then(() => hallSeats.forEach((seat) => { if (seat.viewer) fitLabelInStage(seat.label); }));

  function setSeatOccupant(seat, viewer, { arriving = false } = {}) {
    const sig = viewer ? `${viewer.id}|${viewer.name}|${viewer.avatar}` : '';
    if (sig === seat.sig) return;
    seat.sig = sig;
    seat.viewer = viewer;
    seat.label.replaceChildren();
    seat.label.classList.remove('seat-arrive');
    // Người ngồi mặc bộ áo của mình; ghế trống trở lại bộ của ghế.
    seat.el.dataset.variant = viewer ? variantFor(viewer.id) : seat.baseVariant;
    dressSprite(seat.sprite, seat.el.dataset.variant, seat.pose || 'kneel');
    if (!viewer) {
      seat.el.removeAttribute('data-viewer-id');
      seat.el.classList.remove('is-occupied');
      return;
    }
    seat.el.dataset.viewerId = viewer.id;
    seat.el.classList.add('is-occupied');
    const occupant = document.createElement('div');
    occupant.className = 'seat-occupant';
    const name = document.createElement('span');
    name.className = 'seat-name';
    name.textContent = shortenName(viewer.name, 10);
    occupant.append(buildSeatFace(viewer), name);
    seat.label.appendChild(occupant);
    fitLabelInStage(seat.label);
    if (arriving) {
      void seat.label.offsetWidth;
      seat.label.classList.add('seat-arrive');
      setTimeout(() => seat.label.classList.remove('seat-arrive'), 1800);
    }
  }

  function syncDonorRows(recentDonors = []) {
    const donors = recentDonors.map(normalizeViewer).filter((d) => d && !vipViewerIds.has(d.id));
    const wanted = new Map(donors.map((d) => [d.id, d]));
    donorSeats.forEach((seat) => {
      if (seat.viewer && !wanted.has(seat.viewer.id)) setSeatOccupant(seat, null);
    });
    // Mới nhất trước: người vừa tặng quà nhận ghế trống đẹp nhất còn lại; người cũ giữ nguyên chỗ.
    donors.forEach((donor) => {
      const seated = donorSeats.find((s) => s.viewer?.id === donor.id);
      if (seated) {
        setSeatOccupant(seated, donor);
        return;
      }
      const free = donorSeats.find((s) => !s.viewer);
      if (!free) return;
      const asCommenter = commenterSeats.find((s) => s.viewer?.id === donor.id);
      if (asCommenter) setSeatOccupant(asCommenter, null);
      setSeatOccupant(free, donor, { arriving: hallHasSynced });
    });
  }

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  // Cho một người bình luận vào ngồi các hàng sau. Hết ghế thì (khi replace=true) mời một người
  // đã ngồi đủ lâu mà không bình luận thêm nhường chỗ, chọn ngẫu nhiên.
  function seatCommenter(raw, { replace = false, arriving = true } = {}) {
    const viewer = normalizeViewer(raw);
    if (!viewer || vipViewerIds.has(viewer.id)) return null;
    const existing = hallSeats.find((s) => s.viewer?.id === viewer.id);
    if (existing) {
      existing.lastActive = Date.now();
      return existing.el;
    }
    let target = pickRandom(commenterSeats.filter((s) => !s.viewer));
    if (!target && replace) {
      const now = Date.now();
      target = pickRandom(commenterSeats.filter((s) =>
        now - s.lastActive > COMMENTER_MIN_STAY_MS && !commentBubbles.has(s.viewer?.id)));
    }
    if (!target) return null;
    setSeatOccupant(target, viewer, { arriving });
    target.lastActive = Date.now();
    return target.el;
  }

  function fillCommenterRows(recentCommenters = []) {
    const pool = recentCommenters.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (const commenter of pool) {
      if (!commenterSeats.some((s) => !s.viewer)) break;
      seatCommenter(commenter, { arriving: hallHasSynced });
    }
  }

  function renderCongregationHall(st) {
    if (!congregationHall) return;
    const leaderboard = Array.isArray(st.leaderboard) ? st.leaderboard : [];
    vipViewerIds = new Set(leaderboard.slice(0, VIP_CUSHION_COORDS.length).map((d) => String(d.uniqueId || d.name)));
    // Ai đã lên đệm VIP thì rời ghế đạo tràng để không xuất hiện hai lần.
    hallSeats.forEach((seat) => {
      if (seat.viewer && vipViewerIds.has(seat.viewer.id)) setSeatOccupant(seat, null);
    });
    syncDonorRows(Array.isArray(st.recentDonors) ? st.recentDonors : []);
    fillCommenterRows(Array.isArray(st.recentCommenters) ? st.recentCommenters : []);
    hallHasSynced = true;
  }

  // (Mọi khung hình của mọi bộ áo đã được giải mã sẵn ở mục 3b.)

  // Đạo tràng cúi lạy theo nhịp mõ / chuông. Mỗi lượt thả tim đều gõ mõ, nên trong phòng live đông
  // tim tới liên tục: trước đây mỗi tim làm 1/4 đạo tràng lạy cùng lúc (100 lần đổi ảnh / tim), các lượt
  // chồng lên nhau và cả sảnh nháy liên tục. Giờ:
  //  - lượt thường (gõ mõ): tối đa 1 lượt / 3 giây, 8 người ngẫu nhiên;
  //  - lượt lớn (chuông, viên mãn, đại lễ): luôn chạy, cứ 2 người 1 người lạy;
  //  - người đang lạy dở thì bỏ qua (không bao giờ chồng khung hình);
  //  - lạy lan từ hàng sau ra hàng trước, mỗi người trễ 70 ms.
  const HALL_BOW_COOLDOWN_MS = 3000;
  const HALL_BOW_SMALL_COUNT = 8;
  let lastHallBowAt = 0;

  function pulseHallBowing({ big = false } = {}) {
    if (!congregationHall) return;
    const now = Date.now();
    if (!big && now - lastHallBowAt < HALL_BOW_COOLDOWN_MS) return;
    lastHallBowAt = now;

    // Hàng người đứng không quỳ lạy theo nhịp mõ.
    const idle = hallSeats.filter((seat) => !seat.bowing && seat.sprite && !seat.standing);
    let chosen;
    if (big) {
      chosen = idle.filter((_, i) => i % 2 === 0);
    } else {
      chosen = idle.slice();
      for (let i = chosen.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
      }
      chosen = chosen.slice(0, HALL_BOW_SMALL_COUNT);
    }
    chosen.sort((a, b) => a.row - b.row);

    chosen.forEach((seat, k) => {
      const el = seat.el;
      const img = seat.sprite;
      const delay = k * 70;
      seat.bowing = true;
      // Lạy bằng đúng bộ áo đang mặc (đọc lúc đổi khung, phòng khi người ngồi vừa đổi).
      const pose = (name) => () => dressSprite(img, el.dataset.variant, name);
      // Khuôn mặt (avatar) cúi theo thân khi lạy.
      setTimeout(() => el.classList.add('is-bowing'), delay + 140);
      setTimeout(() => el.classList.remove('is-bowing'), delay + 700);
      setTimeout(pose('forehead'), delay);
      setTimeout(pose('bowMid'), delay + 140);
      setTimeout(pose('prostrateDeep'), delay + 300);
      setTimeout(pose('bowMid'), delay + 620);
      setTimeout(() => { pose('kneel')(); seat.bowing = false; }, delay + 780);
    });
  }

  let prostrationTimers = [];
  function clearProstrationTimers() {
    while (prostrationTimers.length > 0) {
      clearTimeout(prostrationTimers.pop());
    }
  }

  // Người đang làm lễ ở giữa (uniqueId, hoặc tên khi không có): quyết định bộ áo của nhân vật đi dâng hương.
  let centralViewerKey = '';
  function dressCentralWorshipper(key) {
    const stack = document.getElementById('centralSpriteStack');
    if (!stack) return;
    const variant = variantFor(key);
    if (stack.dataset.variant === variant) return;
    stack.dataset.variant = variant;
    stack.querySelectorAll('.pose-frame').forEach((img) => dressSprite(img, variant, img.dataset.pose));
  }

  // Chuyển đổi tức thời giữa 8 khung hình đã giải mã sẵn trên GPU (KHÔNG BAO GIỜ BỊ MẤT HÌNH)
  function setCentralPose(poseKey) {
    const stack = document.getElementById('centralSpriteStack');
    if (!stack) return;
    const frames = stack.querySelectorAll('.pose-frame');
    frames.forEach((img) => {
      img.classList.toggle('active', img.getAttribute('data-pose') === poseKey);
    });
  }

  function schedulePose(ms, poseKey) {
    prostrationTimers.push(
      setTimeout(() => {
        setCentralPose(poseKey);
      }, ms)
    );
  }

  // Chuỗi 8 khung hình Đảnh lễ Tam Bái mượt mà (Hạ gối -> Chắp tay ngực -> Đưa lên trán -> Nghiêng 45° -> Chống tay -> Lạy sát đất -> Ngẩng lên)
  function playThreeBowsSequence(startDelayMs = 0) {
    schedulePose(startDelayMs, 'kneelDown');
    schedulePose(startDelayMs + 160, 'kneel');

    const bowOffsets = [startDelayMs + 320, startDelayMs + 1820, startDelayMs + 3320];
    bowOffsets.forEach((t0) => {
      schedulePose(t0, 'forehead');            // 1. Chắp tay đưa lên trán
      schedulePose(t0 + 170, 'bowMid');        // 2. Cúi gập lưng 45°
      schedulePose(t0 + 330, 'prostrate');     // 3. Vươn hai tay chống xuống đệm
      schedulePose(t0 + 490, 'prostrateDeep'); // 4. Lạy sát đất (Ngũ thể đầu địa)
      schedulePose(t0 + 860, 'prostrate');     // 5. Bắt đầu nâng đầu lên
      schedulePose(t0 + 1020, 'bowMid');       // 6. Nâng lưng lên góc 45°
      schedulePose(t0 + 1180, 'kneel');        // 7. Ngồi quỳ thẳng lưng
    });

    schedulePose(startDelayMs + 4800, 'forehead');
    schedulePose(startDelayMs + 5350, 'kneel');
  }

  // Mỗi lần đi lên thảm đỏ có một số thứ tự: sự kiện của lượt đi cũ (bị lượt mới thay) bị bỏ qua.
  let walkGeneration = 0;
  let onWalkEnd = () => {};
  // Combo quà của cùng một người (Rose thứ 2, 3...): nhân vật không đi lại từ đầu, chỉ đổi dòng chữ.
  const WALK_CONTINUE_MS = 6000;
  let lastWalk = { key: '', at: 0 };

  // Hiệu ứng thí chủ ĐỨNG ĐI BỘ từng bước dọc thảm đỏ rồi Hạ gối Quỳ Đảnh Lễ (trên cùng 1 nhân vật, không bao giờ mất hình)
  function animateWalkerOnCarpet(user, avatar, actionLabel, wish) {
    const centralEl = document.getElementById('centralWorshipper');
    if (!centralEl) return;

    const key = centralViewerKey || user;
    if (key && key === lastWalk.key && Date.now() - lastWalk.at < WALK_CONTINUE_MS) {
      updateCentralWorshipper(user, avatar, actionLabel, wish, false);
      lastWalk.at = Date.now();
      return;
    }
    lastWalk = { key, at: Date.now() };

    clearProstrationTimers();
    updateCentralWorshipper(user, avatar, actionLabel, wish, false);

    // Khởi động bước đi từ cuối thảm đỏ lên chính điện
    const walk = ++walkGeneration;
    centralEl.removeEventListener('animationend', onWalkEnd);
    centralEl.classList.remove('walking-up');
    void centralEl.offsetWidth;
    centralEl.classList.add('walking-up');

    // Bước chân đổi khung mỗi 185 ms cho tới khi THỰC SỰ tới lư hương.
    let stepFrame = 0;
    setCentralPose('walk1');
    prostrationTimers.push(setInterval(() => {
      stepFrame++;
      setCentralPose(stepFrame % 2 === 0 ? 'walk1' : 'walk2');
    }, 185));

    // Quỳ xuống khi CSS đi hết thảm đỏ (animationend), không theo đồng hồ cố định: trước đây hết 2,1 giây
    // là quỳ dù hình còn đang giữa thảm (máy bận, hoặc animation bị rút ngắn), nên nhân vật giật về
    // lư hương hoặc "đi tại chỗ". Dự phòng 3,5 giây phòng khi animationend không tới.
    function arrive() {
      if (walk !== walkGeneration || centralEl.dataset.arrived === String(walk)) return;
      centralEl.dataset.arrived = String(walk);
      centralEl.removeEventListener('animationend', onWalkEnd);
      clearProstrationTimers();
      centralEl.classList.remove('walking-up');
      playThreeBowsSequence(0);
    }
    onWalkEnd = (event) => {
      if (event.target === centralEl && event.animationName === 'centralWalkUpCarpet') arrive();
    };
    centralEl.addEventListener('animationend', onWalkEnd);
    prostrationTimers.push(setTimeout(arrive, 3500));
  }

  function updateCentralWorshipper(user, avatar, actionLabel, wish, doThreeBows = true) {
    const nameEl = document.getElementById('centralName');
    const actEl = document.getElementById('centralAction');
    const wishEl = document.getElementById('centralWishBubble');
    const avatarEl = document.getElementById('centralAvatar');
    const beam = document.getElementById('sacredLightBeam');

    dressCentralWorshipper(centralViewerKey || user);
    if (nameEl) nameEl.textContent = user || 'Thí Chủ Hữu Duyên';
    if (actEl) actEl.textContent = actionLabel || 'Dâng hương cầu an';
    if (wishEl) wishEl.textContent = `“${wish || 'Nam Mô A Di Đà Phật, cầu bình an cát tường'}”`;

    if (avatarEl) {
      const faceSrc = faceUrlFor(avatar, centralViewerKey || user);
      if (faceSrc) {
        if (avatarEl.dataset.src !== faceSrc || !avatarEl.querySelector('img')) {
          avatarEl.dataset.src = faceSrc;
          avatarEl.innerHTML = `<img src="${escapeHtml(faceSrc)}" alt="" />`;
        }
      } else {
        avatarEl.dataset.src = '';
        avatarEl.textContent = String(user || 'T').trim().charAt(0).toUpperCase();
      }
    }

    if (doThreeBows) {
      clearProstrationTimers();
      const centralEl = document.getElementById('centralWorshipper');
      if (centralEl) centralEl.classList.remove('walking-up');
      playThreeBowsSequence(0);
    }
    if (beam) {
      beam.classList.add('intense');
      setTimeout(() => beam.classList.remove('intense'), 4500);
    }

    const haloSys = document.getElementById('buddhaHaloSystem');
    const lotusHand = document.getElementById('lotusHandHalo');
    if (haloSys) {
      haloSys.classList.add('flare');
      setTimeout(() => haloSys.classList.remove('flare'), 3600);
    }
    if (lotusHand) {
      lotusHand.classList.add('flare');
      setTimeout(() => lotusHand.classList.remove('flare'), 3600);
    }
    particles.spawnBellWave(540, 260, 2);

    // Cập nhật dòng thông báo dưới thanh HUD
    const hudName = document.getElementById('devoteeNameLine');
    const hudAct = document.getElementById('devoteeActionTag');
    if (hudName) hudName.textContent = user || 'Thí Chủ';
    if (hudAct) hudAct.textContent = actionLabel || 'Dâng hương';
  }

  // 6. Cập nhật toàn bộ giao diện theo State từ Server
  let hasInitializedRealLeader = false;
  let autoSimState = false;

  function updateUIState(st) {
    if (!st) return;

    syncPrayerRoomState(st);

    document.getElementById('statIncense').textContent = Number(st.totalIncense || 0).toLocaleString('vi-VN');
    document.getElementById('statMerit').textContent = Number(st.totalMerit || 0).toLocaleString('vi-VN');
    document.getElementById('statWoodenFish').textContent = Number(st.woodenFishHits || 0).toLocaleString('vi-VN');

    renderIncenseSticks(st.activeIncenseSticks || 9);

    const lb = Array.isArray(st.leaderboard) ? st.leaderboard : [];
    renderVipCushions(lb);
    renderCongregationHall(st);
    refreshCommentBubbles();

    // Đồng bộ tên Chủ Lễ mặc định theo người dẫn đầu thực tế nếu chưa có sự kiện mới
    if (!hasInitializedRealLeader && lb.length > 0) {
      hasInitializedRealLeader = true;
      const topDev = lb[0];
      centralViewerKey = topDev.uniqueId || topDev.name;
      updateCentralWorshipper(
        topDev.name,
        topDev.avatar,
        `Đã dâng ${Number(topDev.coins || 0).toLocaleString('vi-VN')} xu`,
        topDev.lastWish || 'Nam Mô A Di Đà Phật, cầu bình an cát tường',
        false
      );
    }

    // Cập nhật bảng công đức Top 5 ở góc trên bên phải
    const lbList = document.getElementById('leaderboardList');
    const topLeaders = lb.slice(0, 5);
    const leadersSig = JSON.stringify(topLeaders.map((item) => [item.rank, item.name, item.coins]));
    // Only rebuild when the top 5 actually changed (state arrives on every like/comment).
    if (lbList && lbList.dataset.sig !== leadersSig) {
      lbList.dataset.sig = leadersSig;
      // Mỗi hàng: huy chương (1 vàng, 2 bạc, 3 đồng), tên, số xu, thanh tiến độ so với người dẫn đầu.
      const topCoins = Math.max(1, Number(topLeaders[0]?.coins || 0));
      lbList.innerHTML = topLeaders.length
        ? topLeaders
            .map(
              (item) => `
          <div class="leader-item" data-rank="${item.rank}">
            <span class="leader-rank">${item.rank}</span>
            <span class="leader-main">
              <span class="leader-line">
                <span class="leader-name">${escapeHtml(shortenName(item.name, 14))}</span>
                <span class="leader-merit">${Number(item.coins || 0).toLocaleString('vi-VN')}</span>
              </span>
              <span class="leader-bar"><i style="width:${Math.max(6, Math.round((Number(item.coins || 0) / topCoins) * 100))}%"></i></span>
            </span>
          </div>
        `
            )
            .join('')
        : '<p class="leader-empty">Chưa có người dâng lễ</p>';
    }

    // "N thí chủ đang có mặt": số người xem phòng live (ẩn khi chưa kết nối)
    const presenceLine = document.getElementById('presenceLine');
    const viewers = Number(st.tiktok?.viewerCount || 0);
    if (presenceLine) {
      presenceLine.hidden = !(st.tiktok?.connected && viewers > 0);
      document.getElementById('presenceCount').textContent = viewers.toLocaleString('vi-VN');
    }

    // Trạng thái kết nối TikTok Live
    const liveDot = document.getElementById('liveDot');
    const liveText = document.getElementById('liveStatusText');
    if (st.tiktok?.connected) {
      liveDot.classList.add('connected');
      liveText.textContent = `LIVE @${st.tiktok.username} · ${st.tiktok.viewerCount || 0} người xem`;
    } else if (st.tiktok?.connecting) {
      liveDot.classList.remove('connected');
      liveText.textContent = `Đang kết nối @${st.tiktok.username}...`;
    } else {
      liveDot.classList.remove('connected');
      liveText.textContent = 'Chưa kết nối · Chùa Linh Ứng';
    }

    renderCommunityMeters(st);

    const btnAutoSim = document.getElementById('btnToggleAutoSim');
    if (st.settings) autoSimState = Boolean(st.settings.autoSim);
    if (btnAutoSim && st.settings) {
      btnAutoSim.textContent = st.settings.autoSim
        ? 'Giả lập người xem: Đang bật'
        : 'Giả lập người xem: Tắt';
      btnAutoSim.classList.toggle('active-toggle', Boolean(st.settings.autoSim));
    }
    if (st.settings) {
      if (typeof st.settings.musicVolume === 'number') {
        audio.setMusicVolume(st.settings.musicVolume);
        const sMus = document.getElementById('sliderMusicVol');
        const vMus = document.getElementById('valMusicVol');
        const pct = Math.round(st.settings.musicVolume * 100);
        if (sMus) sMus.value = String(pct);
        if (vMus) vMus.textContent = `${pct}%`;
      }
      if (typeof st.settings.ttsVolume === 'number') {
        audio.setTtsVolume(st.settings.ttsVolume);
        const sTts = document.getElementById('sliderTtsVol');
        const vTts = document.getElementById('valTtsVol');
        const pct = Math.round(st.settings.ttsVolume * 100);
        if (sTts) sTts.value = String(pct);
        if (vTts) vTts.textContent = `${pct}%`;
      }
    }


    const feed = document.getElementById('eventFeed');
    if (feed && Array.isArray(st.recentEvents)) {
      const recentEvents = st.recentEvents.slice(0, 8);
      feed.innerHTML = recentEvents.length
        ? recentEvents.map((ev) => `<div class="event-feed-item">${formatEventSummary(ev)}</div>`).join('')
        : '<p class="event-feed-empty">Chưa có hoạt động mới.</p>';
    }
  }

  // Thanh tiến trình niệm Phật & đèn công đức (cả phòng cùng góp)
  let renderedLampCount = -1;
  function setMeter(fillId, value, goal) {
    const fill = document.getElementById(fillId);
    if (!fill) return;
    const pct = Math.max(0, Math.min(100, (Number(value) / Math.max(1, Number(goal))) * 100));
    fill.style.width = `${pct}%`;
  }

  function bumpMeter(fillId) {
    const meter = document.getElementById(fillId)?.parentElement;
    if (!meter) return;
    meter.classList.remove('is-bumped');
    void meter.offsetWidth;
    meter.classList.add('is-bumped');
  }

  // Niệm Phật / đèn công đức vẫn chạy (viên mãn, đèn sáng, mục tiêu tự co giãn) nhưng không còn hiện trên
  // thẻ dưới đáy: phần tử nào không có trên trang thì bỏ qua.
  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function renderChant(chant) {
    if (!chant) return;
    setText('chantCount', Number(chant.count || 0).toLocaleString('vi-VN'));
    setText('chantGoal', Number(chant.goal || 108).toLocaleString('vi-VN'));
    setText('chantRounds', Number(chant.rounds || 0).toLocaleString('vi-VN'));
    setMeter('chantMeterFill', chant.count, chant.goal);
  }

  // 3 thẻ dưới đáy: số lượt mỗi mức quà trong buổi live (máy chủ đẩy temple.liveStats mỗi lần đổi)
  function renderLiveStats(stats) {
    if (!stats) return;
    for (const [id, value] of [['statTierHoa', stats.hoa], ['statTierHuong', stats.huong], ['statTierCongduc', stats.congduc]]) {
      const el = document.getElementById(id);
      if (!el) continue;
      const text = Number(value || 0).toLocaleString('vi-VN');
      if (el.textContent === text) continue;
      el.textContent = text;
      el.classList.remove('stat-bump');
      void el.offsetWidth;
      el.classList.add('stat-bump');
    }
  }

  function renderLamp(lamp, animateNew = false) {
    if (!lamp) return;
    setText('lampLikes', Number(lamp.likes || 0).toLocaleString('vi-VN'));
    setText('lampGoal', Number(lamp.goal || 300).toLocaleString('vi-VN'));
    setText('lampLit', Number(lamp.lit || 0).toLocaleString('vi-VN'));
    setMeter('lampMeterFill', lamp.likes, lamp.goal);
    const row = document.getElementById('meritLampRow');
    const shown = Math.min(5, Number(lamp.lit) || 0);
    if (!row || shown === renderedLampCount) return;
    const previous = renderedLampCount;
    renderedLampCount = shown;
    row.replaceChildren(...Array.from({ length: shown }, (_, index) => {
      const img = document.createElement('img');
      img.src = '/assets/ritual/lamp.svg';
      img.alt = '';
      if (animateNew && index >= Math.max(0, previous)) img.className = 'is-new';
      return img;
    }));
  }

  function renderCommunityMeters(st) {
    renderChant(st.chant);
    renderLamp(st.lamp, renderedLampCount >= 0);
    renderLiveStats(st.liveStats);
  }

  let tickerTimer = null;
  function showTicker(seal, html, holdMs = 3600) {
    const ticker = document.getElementById('welcomeTicker');
    if (!ticker) return;
    ticker.innerHTML = `<span class="ticker-seal">${escapeHtml(seal)}</span><span>${html}</span>`;
    ticker.classList.add('is-visible');
    clearTimeout(tickerTimer);
    tickerTimer = setTimeout(() => ticker.classList.remove('is-visible'), holdMs);
  }

  function strikeHotspot(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('is-struck');
    void el.offsetWidth;
    el.classList.add('is-struck');
  }

  let koiFromRight = false;
  function releaseKoi(user, wish) {
    const layer = document.getElementById('koiPondLayer');
    if (!layer) return;
    while (layer.children.length >= 3) layer.firstElementChild.remove();
    const swimmer = document.createElement('div');
    swimmer.className = `koi-swimmer${koiFromRight ? ' from-right' : ''}`;
    koiFromRight = !koiFromRight;
    const img = document.createElement('img');
    img.src = '/assets/ritual/koi.svg';
    img.alt = '';
    const tag = document.createElement('div');
    tag.className = 'koi-tag';
    tag.textContent = user;
    const em = document.createElement('em');
    em.textContent = wish;
    tag.appendChild(em);
    swimmer.append(img, tag);
    layer.appendChild(swimmer);
    const ripple = (x, y, delay) => setTimeout(() => {
      const r = document.createElement('span');
      r.className = 'koi-ripple';
      r.style.left = `${x}px`;
      r.style.top = `${y}px`;
      layer.appendChild(r);
      setTimeout(() => r.remove(), 1700);
    }, delay);
    ripple(koiFromRight ? 160 : 920, 1560, 6800);
    ripple(540, 1500, 3400);
    setTimeout(() => swimmer.remove(), 7700);
  }

  function petalShower(count = 10) {
    for (let i = 0; i < count; i++) particles.lotusPetals.push(particles.createLotusPetal(false));
  }

  function formatEventSummary(ev) {
    switch (ev.type) {
      case 'releaseFish':
        return `<strong>${escapeHtml(ev.user)}</strong> phóng sinh cá chép (+${ev.merit} CĐ)`;
      case 'checkIn':
        return `<strong>${escapeHtml(ev.user)}</strong> điểm danh ngày thứ ${ev.streak} (+${ev.merit} CĐ)`;
      case 'shareBlessing':
        return `<strong>${escapeHtml(ev.user)}</strong> chia sẻ buổi lễ (+${ev.merit} CĐ)`;
      case 'chantComplete':
        return `Đạo tràng viên mãn ${ev.goal} biến niệm Phật (lần ${ev.rounds}, ${ev.participants} người)`;
      case 'lampsLit':
        return `Cả phòng thắp sáng ngọn đèn công đức thứ ${ev.lit}`;
      case 'burnIncense':
        return `<strong>${escapeHtml(ev.user)}</strong> dâng ${ev.count} nén nhang (+${ev.merit} CĐ)`;
      case 'strikeWoodenFish':
        return `<strong>${escapeHtml(ev.user)}</strong> gõ mõ ${ev.count} nhịp (+${ev.merit} CĐ)`;
      case 'ringBell':
        return `<strong>${escapeHtml(ev.user)}</strong> thỉnh Đại Hồng Chung (+${ev.merit} CĐ)`;
      case 'sendPrayer':
        return `<strong>${escapeHtml(ev.user)}</strong> cầu phúc: “${escapeHtml(ev.wish)}”`;
      case 'offerGift':
      case 'grandCeremony':
        return `<strong>${escapeHtml(ev.user)}</strong> dâng <em>${escapeHtml(formatGiftDescription(ev))}</em> (+${ev.merit} CĐ)`;
      case 'drawFortune':
        return `<strong>${escapeHtml(ev.user)}</strong> gieo được quẻ số ${ev.fortune?.number} (${ev.fortune?.rank})`;
      default:
        return `<strong>${escapeHtml(ev.user || 'Thí chủ')}</strong> tương tác`;
    }
  }

  // 7. Xử lý hiệu ứng khi có Nghi Thức mới
  let fortuneTimer = null;
  let grandTimer = null;

  let lastRitualEventAt = 0; // live-life.js: chỉ cho sảnh tự lạy khi không có sự kiện thật vừa xảy ra
  function triggerRitualVisuals(ev) {
    if (!ev) return;
    lastRitualEventAt = Date.now();
    // Nghi thức đến từ bình luận (xin xăm, phóng sinh, cầu nguyện...): người bình luận ở yên ghế của họ,
    // lời bình luận hiện trên nhân vật đó; nhân vật giữa thảm đỏ dành cho người tặng quà.
    const byComment = Boolean(ev.fromComment);
    const central = (...args) => { if (!byComment) updateCentralWorshipper(...args); };
    // Cùng một người: cùng bộ áo với ghế của họ trong đạo tràng / đệm VIP.
    if (ev.user && !byComment) centralViewerKey = ev.uniqueId || ev.user;

    if (ev.type === 'offerGift' || ev.type === 'grandCeremony') {
      showGiftHistory(ev);
    }

    if (ev.ttsText && ev.type !== 'drawFortune') {
      audio.enqueueTts(ev.ttsText, { voice: ev.ttsVoice || 'maichi' });
    }

    switch (ev.type) {
      case 'releaseFish': {
        audio.playIncenseChime();
        strikeHotspot('fishStation');
        releaseKoi(ev.user, ev.wish);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 540, 1380, '#ffd9b0');
        central(ev.user, ev.avatar, `Phóng sinh cá chép (+${ev.merit} CĐ)`, ev.wish, true);
        break;
      }

      case 'checkIn': {
        audio.playWoodenFish(1.25);
        showTicker('ĐIỂM DANH', `<strong>${escapeHtml(ev.user)}</strong> lễ Phật ngày thứ <strong>${ev.streak}</strong> liên tiếp · +${ev.merit} công đức`, 4200);
        break;
      }

      case 'shareBlessing': {
        petalShower(8);
        showTicker('LAN TỎA', `<strong>${escapeHtml(ev.user)}</strong> chia sẻ buổi lễ, lan tỏa phước lành`);
        break;
      }

      case 'chantComplete': {
        audio.playTempleBell(1.15);
        setTimeout(() => audio.playWoodenFish(), 600);
        particles.spawnGrandCeremonyRain();
        pulseHallBowing({ big: true });
        showGrandCeremonyBanner(
          (ev.top && ev.top[0]) || 'Đạo tràng',
          `Viên mãn ${ev.goal} biến niệm Phật`,
          ev.merit,
          `${ev.participants} thí chủ cùng niệm · hồi hướng công đức lần ${ev.rounds}`
        );
        bumpMeter('chantMeterFill');
        break;
      }

      case 'lampsLit': {
        audio.playIncenseChime();
        audio.playTempleBell(0.7);
        stage9x16.classList.remove('lamps-flash');
        void stage9x16.offsetWidth;
        stage9x16.classList.add('lamps-flash');
        particles.spawnFloatingMerit(`Ngọn đèn thứ ${ev.lit}`, 540, 1000, '#ffe9a8');
        showTicker('ĐÈN CÔNG ĐỨC', `Cả phòng thả tim thắp sáng <strong>ngọn đèn thứ ${ev.lit}</strong>`, 4200);
        bumpMeter('lampMeterFill');
        break;
      }

      case 'burnIncense': {
        audio.playIncenseChime();
        particles.spawnIncenseBurst(540, 895);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 540, 860, '#ffe082');
        if (!byComment) animateWalkerOnCarpet(ev.user, ev.avatar, `Dâng ${ev.count} nén hương (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'strikeWoodenFish': {
        audio.playWoodenFish();
        strikeHotspot('woodenFishStation');
        pulseHallBowing();
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 890, 935, '#ffd54f');
        break;
      }

      case 'ringBell': {
        audio.playTempleBell(1.0);
        strikeHotspot('bellStation');
        pulseHallBowing({ big: true });
        particles.spawnBellWave(540, 510, 4);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 190, 935, '#fff3b0');
        central(ev.user, ev.avatar, `Thỉnh đại hồng chung (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'sendPrayer': {
        audio.playIncenseChime();
        spawnSkyLantern(ev.user, ev.wish);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 540, 920, '#ffb74d');
        if (!byComment) animateWalkerOnCarpet(ev.user, ev.avatar, `Cầu phúc (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'offerGift': {
        // Mỗi mức quà một tương tác riêng; người tặng luôn đi lên thảm đỏ.
        //   hoa (dưới 5 xu)     : dâng hoa, cánh hoa rơi
        //   huong (5–9 xu)      : thắp hương, khói hương bùng lên
        //   congduc (từ 10 xu)  : bùng nổ công đức, chuông ngân, cả đạo tràng lạy
        // tierUp = lượt mới / vừa lên mức: hiệu ứng lớn; bông tiếp theo trong combo: hiệu ứng nhẹ.
        const tier = ev.tier || (ev.coins >= 10 ? 'congduc' : ev.coins >= 5 ? 'huong' : 'hoa');
        const big = ev.tierUp !== false;
        const gift = formatGiftDescription(ev);
        let label;
        if (tier === 'hoa') {
          audio.playIncenseChime();
          petalShower(big ? 16 : 6);
          particles.spawnFloatingMerit(`Dâng hoa +${ev.merit} CĐ`, 540, 840, '#ffc1d6');
          label = `Dâng hoa · ${gift}`;
        } else if (tier === 'huong') {
          audio.playIncenseChime();
          particles.spawnIncenseBurst(540, 895);
          if (big) petalShower(8);
          particles.spawnFloatingMerit(`Thắp hương +${ev.merit} CĐ`, 540, 840, '#ffe082');
          label = `Thắp hương · ${gift}`;
        } else {
          particles.spawnIncenseBurst(540, 895);
          particles.spawnFloatingMerit(`Bùng nổ công đức +${ev.merit}`, 540, 820, '#fff3b0');
          if (big) {
            audio.playTempleBell(1.0);
            strikeHotspot('bellStation');
            particles.spawnBellWave(540, 510, 4);
            petalShower(22);
            pulseHallBowing({ big: true });
            showTicker('CÔNG ĐỨC', `<strong>${escapeHtml(ev.user)}</strong> dâng ${escapeHtml(gift)} · bùng nổ công đức`, 4200);
          } else {
            audio.playIncenseChime();
            petalShower(6);
          }
          label = `Bùng nổ công đức · ${gift}`;
        }
        animateWalkerOnCarpet(ev.user, ev.avatar, `${label} (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'grandCeremony': {
        audio.playTempleBell(1.2);
        setTimeout(() => audio.playTempleBell(1.1), 900);
        particles.spawnGrandCeremonyRain();
        pulseHallBowing({ big: true });
        showGrandCeremonyBanner(ev.user, formatGiftDescription(ev), ev.merit);
        animateWalkerOnCarpet(ev.user, ev.avatar, `${formatGiftDescription(ev)} (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'drawFortune': {
        audio.playFortuneShake();
        strikeHotspot('fortuneCylinder');
        central(
          ev.user,
          ev.avatar,
          'Đang xin xăm…',
          `Thí chủ ${ev.user} đang thành tâm xin quẻ...`,
          false
        );
        // Chỉ hiển thị tờ Quẻ Xăm đúng thời điểm giọng đọc bắt đầu vang lên!
        audio.enqueueTts(ev.ttsText || '', {
          voice: ev.ttsVoice || 'maichi',
          onStart: () => {
            audio.playIncenseChime();
            showFortuneModal(ev.user, ev.fortune);
            central(
              ev.user,
              ev.avatar,
              `Quẻ số ${ev.fortune?.number} (${ev.fortune?.rank})`,
              ev.fortune?.meaning || '',
              true
            );
          },
          onEnd: () => {
            clearTimeout(fortuneTimer);
            fortuneTimer = setTimeout(() => {
              document.getElementById('fortuneModal')?.classList.remove('visible');
            }, 1800);
          }
        });
        break;
      }
    }
  }

  function spawnSkyLantern(user, wish) {
    const layer = document.getElementById('skyLanternsLayer');
    if (!layer) return;
    // Giữ tối đa 3 sớ cùng lúc để sân khấu không bị phủ kín khi phòng đông.
    while (layer.childElementCount >= 3) layer.firstElementChild.remove();
    const lantern = document.createElement('div');
    lantern.className = 'sky-lantern';
    const leftPos = 80 + Math.floor(Math.random() * 640);
    lantern.style.left = `${leftPos}px`;
    lantern.innerHTML = `
      <div class="sky-lantern-user">${escapeHtml(user)}</div>
      <div class="sky-lantern-wish">“${escapeHtml(wish)}”</div>
    `;
    layer.appendChild(lantern);
    setTimeout(() => {
      lantern.remove();
    }, 10600);
  }

  // Quẻ xăm xếp hàng: mỗi quẻ hiện trọn 9 giây, quẻ mới không cắt ngang quẻ đang đọc.
  const FORTUNE_HOLD_MS = 9000;
  const FORTUNE_GAP_MS = 700;
  const fortuneQueue = [];
  let fortuneShowing = false;

  function showFortuneModal(user, fortune) {
    if (!fortune) return;
    fortuneQueue.push({ user, fortune });
    while (fortuneQueue.length > 3) fortuneQueue.shift();
    if (!fortuneShowing) showNextFortune();
  }

  function hideFortune() {
    clearTimeout(fortuneTimer);
    document.getElementById('fortuneModal').classList.remove('visible');
    fortuneTimer = setTimeout(() => {
      fortuneShowing = false;
      if (fortuneQueue.length) showNextFortune();
    }, FORTUNE_GAP_MS);
  }

  function showNextFortune() {
    const next = fortuneQueue.shift();
    if (!next) return;
    fortuneShowing = true;
    const { user, fortune } = next;
    const modal = document.getElementById('fortuneModal');
    document.getElementById('fortuneRankBadge').textContent = fortune.rank.toUpperCase();
    document.getElementById('fortuneTitle').textContent = `Quẻ Số ${fortune.number} — ${fortune.title}`;
    document.getElementById('fortuneDevotee').textContent = `Thí chủ cầu quẻ: ${user}`;
    document.getElementById('fortunePoem').textContent = fortune.poem;
    document.getElementById('fortuneMeaning').textContent = `Lời bàn: ${fortune.meaning}`;

    modal.classList.add('visible');
    clearTimeout(fortuneTimer);
    fortuneTimer = setTimeout(hideFortune, FORTUNE_HOLD_MS);
  }

  document.getElementById('fortuneModal')?.addEventListener('click', hideFortune);

  function showGrandCeremonyBanner(user, giftName, merit, subtitle) {
    const banner = document.getElementById('grandCeremonyBanner');
    document.getElementById('grandTitle').textContent = giftName.toUpperCase();
    document.getElementById('grandSub').textContent = subtitle || `Đại Thí Chủ ${user} • Công Đức Vô Lượng (+${merit} CĐ)`;
    banner.classList.add('visible');
    clearTimeout(grandTimer);
    grandTimer = setTimeout(() => {
      banner.classList.remove('visible');
    }, 6800);
  }

  function giftDetails(event) {
    const rawName = String(event?.giftName || 'Quà tặng').trim();
    const legacyCount = rawName.match(/^(\d+)\s*[x×]\s*(.+)$/i);
    const count = Math.max(1, Number(event?.giftCount) || Number(legacyCount?.[1]) || 1);
    const name = legacyCount && Number(legacyCount[1]) === count ? legacyCount[2] : rawName;
    return { count, name };
  }

  function formatGiftDescription(event) {
    const { count, name } = giftDetails(event);
    return count > 1 ? `${count}x ${name}` : name;
  }

  function showGiftHistory(event) {
    const history = document.getElementById('giftHistory');
    if (!history) return;

    const user = String(event.user || 'Thí chủ').trim();
    const avatar = document.createElement('span');
    avatar.className = 'gift-history-avatar';
    avatar.textContent = user.charAt(0).toUpperCase() || 'T';
    const giftFace = faceUrlFor(/^https?:\/\//i.test(String(event.avatar || '')) ? event.avatar : '', event.uniqueId || user);
    if (giftFace) {
      const image = document.createElement('img');
      image.src = giftFace;
      image.alt = '';
      image.onerror = () => {
        image.remove();
        avatar.textContent = user.charAt(0).toUpperCase() || 'T';
      };
      avatar.textContent = '';
      avatar.appendChild(image);
    }

    const { count, name } = giftDetails(event);
    const copy = document.createElement('span');
    copy.className = 'gift-history-copy';
    const donor = document.createElement('span');
    donor.className = 'gift-history-user';
    donor.textContent = user;
    const gift = document.createElement('span');
    gift.className = 'gift-history-gift';
    const giftName = document.createElement('span');
    giftName.className = 'gift-history-name';
    giftName.textContent = `dâng ${name}`;
    const giftCount = document.createElement('span');
    giftCount.className = 'gift-history-count';
    giftCount.textContent = `× ${count}`;
    gift.append(giftName, giftCount);
    copy.append(donor, gift);

    const notice = document.createElement('li');
    notice.className = 'gift-history-item';
    notice.append(avatar, copy);
    while (history.children.length >= 4) history.lastElementChild.remove();
    history.prepend(notice);

    setTimeout(() => {
      if (!notice.isConnected) return;
      notice.classList.add('is-leaving');
      setTimeout(() => notice.remove(), 280);
    }, 5000);
  }

  // Nhân vật của người xem: đang dâng hương giữa chánh điện > đệm VIP > ghế đạo tràng.
  // Trả về phần tử "đầu" để bóng chat bám vào (avatar trên ghế, hoặc cả nhân vật).
  function findCommentCharacter(viewerId) {
    const central = document.getElementById('centralWorshipper');
    if (central && viewerId && viewerId === centralViewerKey) {
      // Nhân vật giữa đã có bóng lời khấn trên đầu: bóng chat đặt trên bóng lời khấn, không che nó.
      const wish = document.getElementById('centralWishBubble');
      if (wish && wish.offsetHeight && wish.textContent.trim() && getComputedStyle(wish).display !== 'none') return wish;
      return document.getElementById('centralSpriteStack') || central;
    }
    for (const character of document.querySelectorAll('.vip-devotee-slot, .hall-seat')) {
      if (character.dataset.viewerId === viewerId) {
        // Bóng chat trên đầu nhân vật (bảng tên + avatar giờ nằm dưới chân).
        return character.querySelector('.devotee-sprite') || character;
      }
    }
    return null;
  }

  const BUBBLE_GAP = 10; // khoảng trống giữa hai bóng chồng nhau / giữa bóng và đầu
  const STAGE_TOP_LIMIT = 88; // không đè thanh trạng thái trên cùng

  // Đặt mọi bóng lên đầu nhân vật của mình; bóng mới đè lên bóng cũ thì đẩy bóng mới lên trên.
  function layoutCommentBubbles() {
    if (!commentBubblesLayer || !commentBubbles.size) return;
    const stageRect = stage9x16.getBoundingClientRect();
    const scale = stageRect.width / 1080;
    if (!scale) return;
    const placed = [];
    for (const record of commentBubbles.values()) { // Map giữ thứ tự: bóng cũ trước
      const head = findCommentCharacter(record.viewerId);
      if (!head) {
        record.bubble.style.display = 'none';
        continue;
      }
      const r = head.getBoundingClientRect();
      const x = (r.left + r.width / 2 - stageRect.left) / scale;
      const headTop = (r.top - stageRect.top) / scale;
      record.bubble.style.display = '';
      const w = record.bubble.offsetWidth;
      const h = record.bubble.offsetHeight;
      // Sát mép sân khấu thì bóng lệch vào trong, đuôi vẫn chỉ đúng đầu nhân vật.
      const side = x - w / 2 < 16 ? 'left' : x + w / 2 > 1064 ? 'right' : 'center';
      const left = side === 'left' ? x - 26 : side === 'right' ? x - w + 26 : x - w / 2;
      let bottom = headTop - BUBBLE_GAP;
      for (let pass = 0; pass < placed.length; pass++) {
        const hit = placed.find((p) => left < p.right + 6 && left + w > p.left - 6 && bottom > p.top - BUBBLE_GAP && bottom - h < p.bottom + BUBBLE_GAP);
        if (!hit) break;
        bottom = hit.top - BUBBLE_GAP;
      }
      bottom = Math.max(STAGE_TOP_LIMIT + h, bottom);
      record.bubble.dataset.side = side;
      record.bubble.style.left = `${Math.round(side === 'left' ? x - 26 : side === 'right' ? x + 26 : x)}px`;
      record.bubble.style.top = `${Math.round(bottom)}px`;
      placed.push({ left, right: left + w, top: bottom - h, bottom });
    }
  }

  // Nhân vật có thể đang di chuyển (đi lên thảm đỏ, cúi lạy): bám theo mỗi khung hình khi còn bóng.
  let bubbleFrame = 0;
  function followCommentBubbles() {
    if (bubbleFrame) return;
    const step = () => {
      layoutCommentBubbles();
      bubbleFrame = commentBubbles.size ? requestAnimationFrame(step) : 0;
    };
    bubbleFrame = requestAnimationFrame(step);
  }

  function refreshCommentBubbles() {
    layoutCommentBubbles();
  }

  function dismissCommentBubble(record, immediate = false, resumePrayerQueue = true) {
    if (!record || commentBubbles.get(record.viewerId) !== record) return;
    clearTimeout(record.expiryTimer);
    clearTimeout(record.removeTimer);
    if (!immediate) {
      record.bubble.classList.add('is-leaving');
      record.removeTimer = setTimeout(() => dismissCommentBubble(record, true, resumePrayerQueue), COMMENT_BUBBLE_EXIT_MS);
      return;
    }
    record.bubble.remove();
    commentBubbles.delete(record.viewerId);
    activeCommentBubble = [...commentBubbles.values()].pop() || null;
    if (resumePrayerQueue && !commentBubbles.size) schedulePrayerSelection();
  }

  function showCommentBubble(params) {
    const user = typeof params?.user === 'string' ? params.user.trim() : '';
    const comment = typeof params?.comment === 'string' ? params.comment.trim() : '';
    if (!user || !comment || !commentBubblesLayer) return;

    const viewerId = String(params.uniqueId || user).slice(0, 96);
    // Người bình luận vào ngồi các hàng sau (hoặc đổi chỗ với người đã im lặng lâu) để bóng chat có chỗ bám.
    seatCommenter({ id: viewerId, name: user, avatar: params.avatar }, { replace: true });
    pausePrayerSlipForLiveComment({ viewerId, user, text: { textContent: comment } });

    let record = commentBubbles.get(viewerId);
    if (record) {
      commentBubbles.delete(viewerId); // bình luận tiếp: thành bóng mới nhất (xếp sau cùng)
    } else {
      // Đủ chỗ: bóng cũ nhất nhường chỗ.
      while (commentBubbles.size >= MAX_COMMENT_BUBBLES) {
        dismissCommentBubble(commentBubbles.values().next().value, true, false);
      }
      const bubble = document.createElement('div');
      bubble.className = 'comment-bubble';
      bubble.dataset.side = 'center';
      bubble.dataset.viewerId = viewerId;
      const name = document.createElement('span');
      name.className = 'comment-bubble-name';
      const text = document.createElement('span');
      text.className = 'comment-bubble-text';
      bubble.append(name, text);
      commentBubblesLayer.appendChild(bubble);
      record = { viewerId, bubble, name, text, user, avatar: '', expiryTimer: null, removeTimer: null };
    }
    commentBubbles.set(viewerId, record);
    activeCommentBubble = record;

    clearTimeout(record.expiryTimer);
    clearTimeout(record.removeTimer);
    record.user = user;
    record.avatar = /^https?:\/\//i.test(String(params.avatar || '')) ? params.avatar : '';
    record.name.textContent = user;
    record.text.textContent = comment;
    record.bubble.classList.remove('is-leaving');
    layoutCommentBubbles();
    followCommentBubbles();
    record.expiryTimer = setTimeout(() => dismissCommentBubble(record), COMMENT_BUBBLE_DURATION_MS);
  }

  window.addEventListener('resize', () => {
    fitStage();
    refreshCommentBubbles();
  });

  // 8. Kết nối JSON-RPC 2.0 WebSocket & Gửi Lệnh RPC
  let ws = null;
  let rpcId = 1;
  const prayerSlip = document.getElementById('prayerSlip');
  const prayerSlipHandle = document.getElementById('prayerSlipHandle');
  const prayerSlipComment = document.getElementById('prayerSlipComment');
  const pendingPrayerComments = [];
  const PRAYER_QUEUE_LIMIT = 12;
  const PRAYER_FRESHNESS_MS = 60000;
  const PRAYER_GATHER_MS = 650;
  const PRAYER_HOLD_MS = 4600;
  const PRAYER_EXIT_MS = 360;
  const PRAYER_GAP_MS = 420;
  let activePrayerRoom = null;
  let activePrayerComment = null;
  let prayerVisible = false;
  let prayerGatherTimer = null;
  let prayerHoldTimer = null;
  let prayerExitTimer = null;
  let prayerGapTimer = null;

  function expirePendingPrayerComments(now = Date.now()) {
    for (let index = pendingPrayerComments.length - 1; index >= 0; index--) {
      if (now - pendingPrayerComments[index].receivedAt > PRAYER_FRESHNESS_MS) {
        pendingPrayerComments.splice(index, 1);
      }
    }
  }

  function clearPrayerTimers() {
    clearTimeout(prayerGatherTimer);
    clearTimeout(prayerHoldTimer);
    clearTimeout(prayerExitTimer);
    clearTimeout(prayerGapTimer);
    prayerGatherTimer = null;
    prayerHoldTimer = null;
    prayerExitTimer = null;
    prayerGapTimer = null;
  }

  function clearPrayerComments() {
    clearPrayerTimers();
    pendingPrayerComments.length = 0;
    activePrayerComment = null;
    prayerVisible = false;
    prayerSlip?.classList.remove('is-visible', 'is-leaving');
    prayerSlip?.setAttribute('aria-hidden', 'true');
  }

  function syncPrayerRoomState(st) {
    const tiktok = st?.tiktok;
    if (!tiktok?.connected) {
      activePrayerRoom = null;
      clearPrayerComments();
      return;
    }

    const room = String(tiktok.roomId || tiktok.username || '');
    if (activePrayerRoom && room && activePrayerRoom !== room) {
      clearPrayerComments();
    }
    if (room) activePrayerRoom = room;
  }

  function schedulePrayerSelection() {
    expirePendingPrayerComments();
    if (!pendingPrayerComments.length || prayerVisible || commentBubbles.size || prayerGatherTimer || prayerGapTimer) return;
    prayerGatherTimer = setTimeout(showNextPrayerComment, PRAYER_GATHER_MS);
  }

  function normalizedCommentText(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLocaleLowerCase('vi')
      .replace(/[^\p{L}\p{N}]/gu, '');
  }

  function samePrayerAndLiveComment(prayer, live) {
    if (!prayer?.uniqueId || !live?.viewerId || prayer.uniqueId !== live.viewerId) return false;
    const prayerText = normalizedCommentText(prayer.comment);
    const liveText = normalizedCommentText(live.text?.textContent);
    return prayerText && liveText && (prayerText.startsWith(liveText) || liveText.startsWith(prayerText));
  }

  function pausePrayerSlipForLiveComment(live) {
    clearTimeout(prayerGatherTimer);
    clearTimeout(prayerGapTimer);
    prayerGatherTimer = null;
    prayerGapTimer = null;
    if (!prayerVisible) return;

    const currentPrayer = activePrayerComment;
    if (currentPrayer && !samePrayerAndLiveComment(currentPrayer, live)) {
      pendingPrayerComments.unshift(currentPrayer);
    }
    clearTimeout(prayerHoldTimer);
    clearTimeout(prayerExitTimer);
    prayerHoldTimer = null;
    prayerExitTimer = null;
    prayerSlip?.classList.remove('is-visible', 'is-leaving');
    prayerSlip?.setAttribute('aria-hidden', 'true');
    prayerVisible = false;
    activePrayerComment = null;
  }

  function showNextPrayerComment() {
    prayerGatherTimer = null;
    prayerGapTimer = null;
    expirePendingPrayerComments();
    // Bóng chat đang hiện: chờ (bóng cuối cùng tắt sẽ gọi lại schedulePrayerSelection).
    if (!pendingPrayerComments.length || prayerVisible || !prayerSlip || commentBubbles.size) return;

    const index = Math.floor(Math.random() * pendingPrayerComments.length);
    const [item] = pendingPrayerComments.splice(index, 1);
    activePrayerComment = item;
    prayerSlipHandle.textContent = item.username;
    prayerSlipComment.textContent = item.comment;
    prayerSlip.classList.remove('is-leaving');
    prayerSlip.classList.add('is-visible');
    prayerSlip.setAttribute('aria-hidden', 'false');
    prayerVisible = true;

    prayerHoldTimer = setTimeout(() => {
      prayerHoldTimer = null;
      prayerSlip.classList.remove('is-visible');
      prayerSlip.classList.add('is-leaving');
      prayerExitTimer = setTimeout(() => {
        prayerExitTimer = null;
        prayerSlip.classList.remove('is-leaving');
        prayerSlip.setAttribute('aria-hidden', 'true');
        prayerVisible = false;
        activePrayerComment = null;
        prayerGapTimer = setTimeout(() => {
          prayerGapTimer = null;
          showNextPrayerComment();
        }, PRAYER_GAP_MS);
      }, PRAYER_EXIT_MS);
    }, PRAYER_HOLD_MS);
  }

  function queuePrayerComment(params) {
    const username = typeof params?.username === 'string' ? params.username.trim() : '';
    const comment = typeof params?.comment === 'string' ? params.comment.trim() : '';
    if (!username || !comment) return;
    const item = {
      uniqueId: typeof params.uniqueId === 'string' ? params.uniqueId : '',
      username,
      comment,
      receivedAt: Date.now()
    };
    // Đang hiện trong bóng chat của chính người đó (bất kỳ bóng nào): không hiện thêm sớ trùng lời.
    if ([...commentBubbles.values()].some((bubble) => samePrayerAndLiveComment(item, bubble))) return;
    if (pendingPrayerComments.some((pending) => pending.username === username && pending.comment === comment)) return;

    if (pendingPrayerComments.length >= PRAYER_QUEUE_LIMIT) pendingPrayerComments.shift();
    pendingPrayerComments.push(item);
    schedulePrayerSelection();
  }

  function connectWebSocket() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${proto}//${window.location.host}/ws`);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        // Cho live-life.js (khóa lễ, bình chọn, top giờ, mục tiêu đèn) nghe cùng luồng tin.
        window.dispatchEvent(new CustomEvent('temple:message', { detail: msg }));
        if (msg.method === 'temple.state') {
          updateUIState(msg.params);
        } else if (msg.method === 'temple.event') {
          if (msg.params?.state) updateUIState(msg.params.state);
          if (msg.params?.event) triggerRitualVisuals(msg.params.event);
        } else if (msg.method === 'temple.prayerComment') {
          queuePrayerComment(msg.params);
        } else if (msg.method === 'temple.liveComment') {
          showCommentBubble(msg.params);
        } else if (msg.method === 'temple.chant') {
          renderChant(msg.params);
          bumpMeter('chantMeterFill');
        } else if (msg.method === 'temple.liveStats') {
          renderLiveStats(msg.params);
        } else if (msg.method === 'temple.lamp') {
          renderLamp(msg.params);
        } else if (msg.method === 'temple.welcome') {
          const others = Number(msg.params?.others) || 0;
          showTicker('CHÀO MỪNG', `<strong>${escapeHtml(msg.params?.user || 'Thí chủ')}</strong>${others > 0 ? ` và ${others} người khác` : ''} vừa bước vào chánh điện`, 3000);
        } else if (msg.method === 'tts.play') {
          if (msg.params?.url) {
            audio.enqueueTts(msg.params.text || 'Nam mô A Di Đà Phật', {
              voice: msg.params.voice || 'maichi',
              url: msg.params.url
            });
          }
        }
      } catch (_) {}
    };

    ws.onopen = () => {
      expirePendingPrayerComments();
      schedulePrayerSelection();
    };

    ws.onclose = () => {
      expirePendingPrayerComments();
      setTimeout(connectWebSocket, 2000);
    };
  }
  connectWebSocket();

  async function callRpc(method, params = {}) {
    audio.ensureContext();
    const payload = {
      jsonrpc: '2.0',
      id: rpcId++,
      method,
      params
    };
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return;
    }
    const res = await fetch('/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data?.result?.state) updateUIState(data.result.state);
    if (data?.result?.event) triggerRitualVisuals(data.result.event);
    return data;
  }

  function getFormInput() {
    const user = document.getElementById('inputDevoteeName')?.value.trim() || 'Minh Lê';
    const wish =
      document.getElementById('inputDevoteeWish')?.value.trim() ||
      'Cầu cho gia đình bình an, tài lộc hanh thông';
    return { user, wish };
  }

  // Gắn sự kiện tương tác trực tiếp trên màn hình 9:16 & Thanh HUD dưới đáy
  document.getElementById('incenseBurnerZone')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.burnIncense', { user, count: 3, wish });
  });

  // Bấm ô ở trang điều khiển: gửi thử đúng mức quà của ô (tập dượt trước khi live)
  const demoGift = (coins, giftName, giftCount) => {
    const { user, wish } = getFormInput();
    callRpc('temple.offerGift', { user, uniqueId: `demo:${user}`, coins, giftName, giftCount, wish });
  };
  document.getElementById('cardIncense')?.addEventListener('click', () => demoGift(1, 'Rose', 1));
  document.getElementById('cardBlessing')?.addEventListener('click', () => demoGift(5, 'Rose', 5));
  document.getElementById('cardLotus')?.addEventListener('click', () => demoGift(10, 'Rose', 10));

  document.getElementById('fishStation')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.releaseFish', { user, wish });
  });

  document.getElementById('btnRpcFish')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.releaseFish', { user, wish });
  });

  document.getElementById('btnRpcCheckIn')?.addEventListener('click', () => {
    const { user } = getFormInput();
    callRpc('temple.checkIn', { user, uniqueId: `demo:${user}` });
  });

  document.getElementById('btnRpcChant')?.addEventListener('click', () => {
    const { user } = getFormInput();
    callRpc('temple.comment', { comment: 'Nam mô A Di Đà Phật', user, uniqueId: `demo:${user}:${Date.now()}` });
  });

  document.getElementById('btnRpcLikes')?.addEventListener('click', () => {
    const { user } = getFormInput();
    callRpc('temple.like', { user, count: 50 });
  });

  document.getElementById('woodenFishStation')?.addEventListener('click', () => {
    const { user } = getFormInput();
    callRpc('temple.strikeWoodenFish', { user, count: 1 });
  });

  document.getElementById('bellStation')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.ringBell', { user, count: 1, wish, readTts: true });
  });

  document.getElementById('fortuneCylinder')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.drawFortune', { user, topic: wish });
  });

  // Các nút trên Quick RPC Dock bên phải
  document.getElementById('btnRpcIncense')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.burnIncense', { user, count: 3, wish });
  });

  document.getElementById('btnRpcLantern')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.sendPrayer', { user, wish });
  });

  document.getElementById('btnRpcWoodenFish')?.addEventListener('click', () => {
    const { user } = getFormInput();
    callRpc('temple.strikeWoodenFish', { user, count: 5 });
  });

  document.getElementById('btnRpcBell')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.ringBell', { user, count: 1, wish, readTts: true });
  });

  document.getElementById('btnRpcFortune')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.drawFortune', { user, topic: wish });
  });

  document.getElementById('btnRpcGiftLotus')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.offerGift', {
      user,
      giftType: 'lotus',
      coins: 20,
      giftName: 'Đài Hoa Sen Vàng',
      wish
    });
  });

  document.getElementById('btnRpcGrandCeremony')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.grandCeremony', {
      user,
      coins: 299,
      giftName: 'Đại Lễ Kim Long Chầu Phật',
      wish
    });
  });

  document.getElementById('btnConnectTikTok')?.addEventListener('click', () => {
    const username = document.getElementById('inputTikTokUser')?.value.trim();
    if (!username) return;
    callRpc('live.connect', { username });
  });

  // Xác nhận bằng 2 lần bấm ngay trên nút (confirm() bị chặn trong dock OBS / khung xem trước)
  const btnResetLeaderboard = document.getElementById('btnResetLeaderboard');
  let resetArmTimer = null;
  btnResetLeaderboard?.addEventListener('click', async () => {
    if (!resetArmTimer) {
      btnResetLeaderboard.classList.add('armed');
      btnResetLeaderboard.textContent = 'Bấm lần nữa để xoá';
      resetArmTimer = setTimeout(() => {
        resetArmTimer = null;
        btnResetLeaderboard.classList.remove('armed');
        btnResetLeaderboard.textContent = 'Reset bảng xếp hạng';
      }, 4000);
      return;
    }
    clearTimeout(resetArmTimer);
    resetArmTimer = null;
    btnResetLeaderboard.classList.remove('armed');
    btnResetLeaderboard.textContent = 'Đang xoá…';
    await callRpc('temple.resetLeaderboard');
    btnResetLeaderboard.textContent = 'Đã xoá ✓';
    setTimeout(() => { btnResetLeaderboard.textContent = 'Reset bảng xếp hạng'; }, 2000);
  });

  document.getElementById('btnToggleAutoSim')?.addEventListener('click', () => {
    autoSimState = !autoSimState;
    callRpc('live.setAutoSim', { enabled: autoSimState });
  });

  document.getElementById('btnToggleTts')?.addEventListener('click', (e) => {
    audio.ttsEnabled = !audio.ttsEnabled;
    const btn = e.currentTarget;
    btn.textContent = `Giọng đọc: ${audio.ttsEnabled ? 'Bật' : 'Tắt'}`;
    btn.classList.toggle('active-toggle', audio.ttsEnabled);
  });

  document.getElementById('btnToggleMusic')?.addEventListener('click', (e) => {
    audio.bgMusicEnabled = !audio.bgMusicEnabled;
    if (audio.bgMusicEnabled) {
      audio.startZenAmbience();
    } else {
      audio.stopZenAmbience();
    }
    const btn = e.currentTarget;
    btn.textContent = `Nhạc nền: ${audio.bgMusicEnabled ? 'Bật' : 'Tắt'}`;
    btn.classList.toggle('active-toggle', audio.bgMusicEnabled);
  });

  // Khởi tạo và gắn sự kiện thanh trượt chỉnh âm lượng Nhạc nền & Giọng đọc
  const sliderMusicVol = document.getElementById('sliderMusicVol');
  const valMusicVol = document.getElementById('valMusicVol');
  if (sliderMusicVol && valMusicVol) {
    const initMusPct = Math.round(audio.bgBaseVolume * 100);
    sliderMusicVol.value = String(initMusPct);
    valMusicVol.textContent = `${initMusPct}%`;
    sliderMusicVol.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      valMusicVol.textContent = `${pct}%`;
      audio.ensureContext();
      audio.setMusicVolume(pct / 100);
    });
    sliderMusicVol.addEventListener('change', (e) => {
      const pct = Number(e.target.value);
      callRpc('temple.updateSettings', { musicVolume: +(pct / 100).toFixed(2) });
    });
  }

  const sliderTtsVol = document.getElementById('sliderTtsVol');
  const valTtsVol = document.getElementById('valTtsVol');
  if (sliderTtsVol && valTtsVol) {
    const initTtsPct = Math.round(audio.ttsVolume * 100);
    sliderTtsVol.value = String(initTtsPct);
    valTtsVol.textContent = `${initTtsPct}%`;
    sliderTtsVol.addEventListener('input', (e) => {
      const pct = Number(e.target.value);
      valTtsVol.textContent = `${pct}%`;
      audio.setTtsVolume(pct / 100);
    });
    sliderTtsVol.addEventListener('change', (e) => {
      const pct = Number(e.target.value);
      callRpc('temple.updateSettings', { ttsVolume: +(pct / 100).toFixed(2) });
    });
  }

  function shortenName(name, maxLen = 13) {
    const str = String(name || '');
    return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Các hàm sân khấu dùng chung cho live-life.js (sân khấu tự chuyển động khi không ai tương tác).
  window.TempleStage = {
    stage: stage9x16,
    audio,
    particles,
    framesOf,
    DEVOTEE_VARIANTS,
    pulseHallBowing,
    petalShower,
    showTicker,
    escapeHtml,
    lastEventAt: () => lastRitualEventAt,
    // Đổi nền làm lư hương đổi chỗ: vẽ lại que hương để khói bốc đúng đầu que.
    refreshIncense: () => {
      renderedStickCount = 0;
      renderIncenseSticks(lastIncenseCount);
    }
  };
})();
