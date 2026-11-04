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
  let activeCommentBubble = null;
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
  let renderedStickCount = 0;

  function renderIncenseSticks(count) {
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
      const tipY = 895 - Math.cos(rad) * heightPx;
      tips.push({ x: tipX, y: tipY });
    }
    particles.setIncenseTips(tips);
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

  function renderVipCushions(leaderboard = []) {
    const layer = document.getElementById('vipCushionsLayer');
    if (!layer) return;

    layer.innerHTML = VIP_CUSHION_COORDS.map((slot, idx) => {
      const dev = leaderboard[idx];
      if (!dev) return '';
      return `
        <div class="vip-devotee-slot" data-viewer-id="${escapeHtml(dev.uniqueId || dev.name)}" style="left: ${slot.x}px; top: ${slot.y}px; z-index: ${12 + idx};">
          <img src="/assets/devotee.png" alt="VIP Devotee" class="devotee-sprite" />
          <div class="vip-rank-pill">
            <span class="vip-rank-num">${slot.rank}</span>
            <span class="vip-rank-name">${escapeHtml(shortenName(dev.name, 12))}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // 5. Dựng Đạo Tràng 40 Phật Tử Quỳ Lễ Hai Bên Thảm Đỏ (5 Hàng x 4 Cột mỗi bên)
  const congregationHall = document.getElementById('congregationHall');
  const HALL_SEAT_COORDS = [];

  (function buildHallGrid() {
    const rows = 5;
    const colsPerSide = 4;
    for (let r = 0; r < rows; r++) {
      const progress = r / (rows - 1); // 0 (xa) -> 1 (gần)
      const y = Math.round(1290 + progress * 355); // 1290 -> 1645
      const scale = +(0.76 + progress * 0.28).toFixed(2);

      // Cánh trái thảm đỏ
      const leftInnerX = Math.round(335 - progress * 48); // mép thảm mở rộng dần
      const leftOuterX = 48;
      for (let c = 0; c < colsPerSide; c++) {
        const t = c / (colsPerSide - 1);
        const x = Math.round(leftOuterX + t * (leftInnerX - leftOuterX));
        HALL_SEAT_COORDS.push({ side: 'L', row: r, col: c, x, y, scale });
      }

      // Cánh phải thảm đỏ
      const rightInnerX = Math.round(745 + progress * 48);
      const rightOuterX = 1032;
      for (let c = 0; c < colsPerSide; c++) {
        const t = c / (colsPerSide - 1);
        const x = Math.round(rightInnerX + t * (rightOuterX - rightInnerX));
        HALL_SEAT_COORDS.push({ side: 'R', row: r, col: c, x, y, scale });
      }
    }
  })();

  let lastRenderedLeaderboardJson = '';

  function renderCongregationHall(leaderboard = []) {
    if (!congregationHall) return;
    // Những người xếp từ hạng 7 trở đi ngồi ở các vị trí đầu tiên cạnh thảm đỏ
    const hallViewers = leaderboard.slice(6);
    const sig = JSON.stringify(hallViewers.map((d) => [d.uniqueId, d.name, d.avatar, d.merit]));
    if (sig === lastRenderedLeaderboardJson && congregationHall.children.length > 0) return;
    lastRenderedLeaderboardJson = sig;

    // Ưu tiên gắn thẻ tên vào các ghế gần thảm đỏ dễ nhìn nhất
    const labeledSeatIndices = [
      3, 4, 11, 12, 19, 20, 27, 28, 35, 36, 2, 5, 10, 13, 18, 21, 26, 29
    ];
    const seatViewerMap = new Map();
    hallViewers.forEach((viewer, idx) => {
      if (idx < labeledSeatIndices.length) {
        seatViewerMap.set(labeledSeatIndices[idx], viewer);
      }
    });

    congregationHall.innerHTML = HALL_SEAT_COORDS.map((seat, idx) => {
      const viewer = seatViewerMap.get(idx);
      const badgeHtml = viewer
        ? `
          <div class="seat-badge">
            <span class="seat-avatar">${
              viewer.avatar
                ? `<img src="${escapeHtml(viewer.avatar)}" alt="" />`
                : escapeHtml(String(viewer.name || 'P').charAt(0).toUpperCase())
            }</span>
            <span class="seat-username">${escapeHtml(shortenName(viewer.name, 11))}</span>
          </div>
        `
        : '';

      return `
        <div
          class="hall-seat"
          data-seat-idx="${idx}"
          ${viewer ? `data-viewer-id="${escapeHtml(viewer.uniqueId || viewer.name)}"` : ''}
          style="left: ${seat.x}px; top: ${seat.y}px; z-index: ${20 + seat.row * 2}; transform: translate(-50%, -100%) scale(${seat.scale});"
        >
          <img
            src="/assets/devotee.png"
            alt="Phật tử"
            class="devotee-sprite"
            style="animation-delay: ${((idx * 0.27) % 3.5).toFixed(2)}s;"
          />
          ${badgeHtml}
        </div>
      `;
    }).join('');
  }

  // Preload toàn bộ 8 frame nhân vật vào bộ nhớ để chuyển frame mượt 0ms
  const SPRITE_FRAMES = {
    walk1: '/assets/devotee_walk.png',
    walk2: '/assets/devotee_walk_2.png',
    kneelDown: '/assets/devotee_kneel_down.png',
    kneel: '/assets/devotee.png',
    forehead: '/assets/devotee_bow.png',
    bowMid: '/assets/devotee_bow_mid.png',
    prostrate: '/assets/devotee_prostrate.png',
    prostrateDeep: '/assets/devotee_prostrate_deep.png'
  };
  Object.values(SPRITE_FRAMES).forEach((url) => {
    const img = new Image();
    img.src = url;
  });

  function pulseHallBowing() {
    if (!congregationHall) return;
    const seats = congregationHall.querySelectorAll('.hall-seat');
    seats.forEach((el, i) => {
      if (i % 4 !== 0) return;
      const img = el.querySelector('.devotee-sprite');
      if (!img) return;
      const delay = (i % 4) * 80;
      setTimeout(() => { img.src = SPRITE_FRAMES.forehead; }, delay);
      setTimeout(() => { img.src = SPRITE_FRAMES.bowMid; }, delay + 140);
      setTimeout(() => { img.src = SPRITE_FRAMES.prostrateDeep; }, delay + 300);
      setTimeout(() => { img.src = SPRITE_FRAMES.bowMid; }, delay + 620);
      setTimeout(() => { img.src = SPRITE_FRAMES.kneel; }, delay + 780);
    });
  }

  let prostrationTimers = [];
  function clearProstrationTimers() {
    while (prostrationTimers.length > 0) {
      clearTimeout(prostrationTimers.pop());
    }
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

  // Hiệu ứng thí chủ ĐỨNG ĐI BỘ từng bước dọc thảm đỏ rồi Hạ gối Quỳ Đảnh Lễ (trên cùng 1 nhân vật, không bao giờ mất hình)
  function animateWalkerOnCarpet(user, avatar, actionLabel, wish) {
    const centralEl = document.getElementById('centralWorshipper');
    if (!centralEl) return;

    clearProstrationTimers();
    updateCentralWorshipper(user, avatar, actionLabel, wish, false);

    // Khởi động bước đi từ cuối thảm đỏ lên chính điện
    centralEl.classList.remove('walking-up');
    void centralEl.offsetWidth;
    centralEl.classList.add('walking-up');

    setCentralPose('walk1');
    for (let step = 1; step <= 10; step++) {
      schedulePose(step * 185, step % 2 === 0 ? 'walk1' : 'walk2');
    }

    // Khi bước tới trước Lư Hương (2.05s): dừng bước, hạ gối quỳ xuống đệm và bắt đầu Đảnh lễ 3 lạy
    prostrationTimers.push(
      setTimeout(() => {
        centralEl.classList.remove('walking-up');
      }, 2100)
    );
    playThreeBowsSequence(2050);
  }

  function updateCentralWorshipper(user, avatar, actionLabel, wish, doThreeBows = true) {
    const nameEl = document.getElementById('centralName');
    const actEl = document.getElementById('centralAction');
    const wishEl = document.getElementById('centralWishBubble');
    const avatarEl = document.getElementById('centralAvatar');
    const beam = document.getElementById('sacredLightBeam');

    if (nameEl) nameEl.textContent = user || 'Thí Chủ Hữu Duyên';
    if (actEl) actEl.textContent = actionLabel || 'Dâng hương cầu an';
    if (wishEl) wishEl.textContent = `“${wish || 'Nam Mô A Di Đà Phật, cầu bình an cát tường'}”`;

    if (avatarEl) {
      if (avatar) {
        avatarEl.innerHTML = `<img src="${escapeHtml(avatar)}" alt="" />`;
      } else {
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
    renderCongregationHall(lb);
    refreshCommentBubbles();

    // Đồng bộ tên Chủ Lễ mặc định theo người dẫn đầu thực tế nếu chưa có sự kiện mới
    if (!hasInitializedRealLeader && lb.length > 0) {
      hasInitializedRealLeader = true;
      const topDev = lb[0];
      updateCentralWorshipper(
        topDev.name,
        topDev.avatar,
        `Công đức: ${Number(topDev.merit).toLocaleString('vi-VN')} CĐ`,
        topDev.lastWish || 'Nam Mô A Di Đà Phật, cầu bình an cát tường',
        false
      );
    }

    // Cập nhật bảng công đức Top 5 ở góc trên bên phải
    const lbList = document.getElementById('leaderboardList');
    if (lbList) {
      const topLeaders = lb.slice(0, 5);
      lbList.innerHTML = topLeaders.length
        ? topLeaders
            .map(
              (item) => `
          <div class="leader-item">
            <span class="leader-rank">${item.rank}</span>
            <span class="leader-name">${escapeHtml(shortenName(item.name, 14))}</span>
            <span class="leader-merit">${Number(item.merit).toLocaleString('vi-VN')}</span>
          </div>
        `
            )
            .join('')
        : '<p class="leader-empty">Chưa có người đóng góp</p>';
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

  function renderChant(chant) {
    if (!chant) return;
    document.getElementById('chantCount').textContent = Number(chant.count || 0).toLocaleString('vi-VN');
    document.getElementById('chantGoal').textContent = Number(chant.goal || 108).toLocaleString('vi-VN');
    document.getElementById('chantRounds').textContent = Number(chant.rounds || 0).toLocaleString('vi-VN');
    setMeter('chantMeterFill', chant.count, chant.goal);
  }

  function renderLamp(lamp, animateNew = false) {
    if (!lamp) return;
    document.getElementById('lampLikes').textContent = Number(lamp.likes || 0).toLocaleString('vi-VN');
    document.getElementById('lampGoal').textContent = Number(lamp.goal || 300).toLocaleString('vi-VN');
    document.getElementById('lampLit').textContent = Number(lamp.lit || 0).toLocaleString('vi-VN');
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

  function triggerRitualVisuals(ev) {
    if (!ev) return;

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
        updateCentralWorshipper(ev.user, ev.avatar, `Phóng sinh cá chép (+${ev.merit} CĐ)`, ev.wish, true);
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
        pulseHallBowing();
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
        animateWalkerOnCarpet(ev.user, ev.avatar, `Dâng ${ev.count} nén hương (+${ev.merit} CĐ)`, ev.wish);
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
        pulseHallBowing();
        particles.spawnBellWave(540, 510, 4);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 190, 935, '#fff3b0');
        updateCentralWorshipper(ev.user, ev.avatar, `Thỉnh đại hồng chung (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'sendPrayer': {
        audio.playIncenseChime();
        spawnSkyLantern(ev.user, ev.wish);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 540, 920, '#ffb74d');
        animateWalkerOnCarpet(ev.user, ev.avatar, `Cầu phúc (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'offerGift': {
        audio.playIncenseChime();
        audio.playTempleBell(0.85);
        particles.spawnIncenseBurst(540, 895);
        particles.spawnFloatingMerit(`+${ev.merit} Công Đức`, 540, 840, '#fff3b0');
        animateWalkerOnCarpet(ev.user, ev.avatar, `Dâng ${formatGiftDescription(ev)} (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'grandCeremony': {
        audio.playTempleBell(1.2);
        setTimeout(() => audio.playTempleBell(1.1), 900);
        particles.spawnGrandCeremonyRain();
        pulseHallBowing();
        showGrandCeremonyBanner(ev.user, formatGiftDescription(ev), ev.merit);
        animateWalkerOnCarpet(ev.user, ev.avatar, `${formatGiftDescription(ev)} (+${ev.merit} CĐ)`, ev.wish);
        break;
      }

      case 'drawFortune': {
        audio.playFortuneShake();
        strikeHotspot('fortuneCylinder');
        updateCentralWorshipper(
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
            updateCentralWorshipper(
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
    if (/^https?:\/\//i.test(String(event.avatar || ''))) {
      const image = document.createElement('img');
      image.src = event.avatar;
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
    giftName.textContent = name;
    const giftCount = document.createElement('span');
    giftCount.className = 'gift-history-count';
    giftCount.textContent = `× ${count}`;
    gift.append(giftName, giftCount);
    copy.append(donor, gift);

    const notice = document.createElement('li');
    notice.className = 'gift-history-item';
    notice.append(avatar, copy);
    while (history.children.length >= 3) history.lastElementChild.remove();
    history.prepend(notice);

    setTimeout(() => {
      if (!notice.isConnected) return;
      notice.classList.add('is-leaving');
      setTimeout(() => notice.remove(), 280);
    }, 5000);
  }

  function findCommentCharacter(viewerId) {
    const characters = document.querySelectorAll('.vip-devotee-slot, .hall-seat');
    for (const character of characters) {
      if (character.dataset.viewerId === viewerId || character.dataset.commentViewerId === viewerId) {
        return character;
      }
    }
    return null;
  }

  function claimCommentCharacter(record) {
    const seats = document.querySelectorAll('.hall-seat');
    const seat = [...seats].find((item) => !item.dataset.viewerId && !item.dataset.commentViewerId);
    if (!seat) return null;

    seat.dataset.commentViewerId = record.viewerId;
    const badge = document.createElement('div');
    badge.className = 'seat-badge commenter-seat-badge';
    const avatar = document.createElement('span');
    avatar.className = 'seat-avatar';
    avatar.textContent = record.user.charAt(0).toUpperCase() || 'T';
    if (/^https?:\/\//i.test(record.avatar)) {
      const image = document.createElement('img');
      image.src = record.avatar;
      image.alt = '';
      image.onerror = () => {
        image.remove();
        avatar.textContent = record.user.charAt(0).toUpperCase() || 'T';
      };
      avatar.textContent = '';
      avatar.appendChild(image);
    }
    const name = document.createElement('span');
    name.className = 'seat-username';
    name.textContent = shortenName(record.user, 11);
    badge.append(avatar, name);
    seat.appendChild(badge);
    return seat;
  }

  function releaseCommentCharacter(record) {
    const seat = [...document.querySelectorAll('.hall-seat')]
      .find((item) => item.dataset.commentViewerId === record.viewerId);
    if (!seat) return;
    seat.removeAttribute('data-comment-viewer-id');
    seat.querySelector('.commenter-seat-badge')?.remove();
  }

  function positionCommentBubble(record) {
    const character = findCommentCharacter(record.viewerId) || claimCommentCharacter(record);
    if (!character || !commentBubblesLayer) {
      record.bubble.style.display = 'none';
      return;
    }

    const stageRect = stage9x16.getBoundingClientRect();
    const characterRect = character.getBoundingClientRect();
    const scale = stageRect.width / 1080;
    if (!scale) return;
    const x = (characterRect.left + characterRect.width / 2 - stageRect.left) / scale;
    const y = (characterRect.top - stageRect.top) / scale;
    record.bubble.style.display = '';
    record.bubble.style.left = `${x}px`;
    record.bubble.style.top = `${Math.max(88, y - 12)}px`;
    record.bubble.dataset.side = x < 220 ? 'left' : x > 860 ? 'right' : 'center';
  }

  function refreshCommentBubbles() {
    if (activeCommentBubble) positionCommentBubble(activeCommentBubble);
  }

  function dismissCommentBubble(record, immediate = false, resumePrayerQueue = true) {
    if (!record || activeCommentBubble !== record) return;
    clearTimeout(record.expiryTimer);
    clearTimeout(record.removeTimer);
    if (!immediate) {
      record.bubble.classList.add('is-leaving');
      record.removeTimer = setTimeout(() => dismissCommentBubble(record, true), COMMENT_BUBBLE_EXIT_MS);
      return;
    }
    releaseCommentCharacter(record);
    record.bubble.remove();
    activeCommentBubble = null;
    if (resumePrayerQueue) schedulePrayerSelection();
  }

  function showCommentBubble(params) {
    const user = typeof params?.user === 'string' ? params.user.trim() : '';
    const comment = typeof params?.comment === 'string' ? params.comment.trim() : '';
    if (!user || !comment || !commentBubblesLayer) return;

    const viewerId = String(params.uniqueId || user).slice(0, 96);
    pausePrayerSlipForLiveComment({ viewerId, user, text: { textContent: comment } });
    let record = activeCommentBubble;
    if (record && record.viewerId !== viewerId) {
      dismissCommentBubble(record, true, false);
      record = null;
    }
    if (!record) {
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
      activeCommentBubble = record;
    }

    clearTimeout(record.expiryTimer);
    clearTimeout(record.removeTimer);
    record.user = user;
    record.avatar = /^https?:\/\//i.test(String(params.avatar || '')) ? params.avatar : '';
    record.name.textContent = user;
    record.text.textContent = comment;
    record.bubble.classList.remove('is-leaving');
    positionCommentBubble(record);
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
    if (!pendingPrayerComments.length || prayerVisible || activeCommentBubble || prayerGatherTimer || prayerGapTimer) return;
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
    if (!pendingPrayerComments.length || prayerVisible || !prayerSlip) return;

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
    if (samePrayerAndLiveComment(item, activeCommentBubble)) return;
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
    const user = document.getElementById('inputDevoteeName')?.value.trim() || 'Quỳnh_Finn';
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

  document.getElementById('cardIncense')?.addEventListener('click', () => {
    const { user } = getFormInput();
    callRpc('temple.comment', { comment: 'Nam mô A Di Đà Phật', user, uniqueId: `demo:${user}:${Date.now()}` });
  });

  document.getElementById('cardBlessing')?.addEventListener('click', () => {
    const { user } = getFormInput();
    callRpc('temple.like', { user, count: 25 });
  });

  document.getElementById('cardLotus')?.addEventListener('click', () => {
    const { user, wish } = getFormInput();
    callRpc('temple.offerGift', {
      user,
      giftType: 'lotus',
      coins: 20,
      giftName: 'Đài Hoa Sen Vàng',
      wish
    });
  });

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
})();
