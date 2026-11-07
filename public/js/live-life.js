/**
 * Sân khấu "sống" kể cả khi không ai tương tác (chống live tĩnh):
 *  - Camera chậm rãi đẩy vào / lia ngang.
 *  - Người trong sảnh thỉnh thoảng tự lạy; chim bay qua; Phật tử vãng lai đi lên thảm; đợt cánh sen rơi.
 *  - Lịch khóa lễ: mỗi 15 phút một khóa lễ 3 phút (chuông mở / đóng, chữ kinh chạy), đồng hồ đếm ngược.
 *  - Đồng hồ + ngày âm lịch, pháp ngữ đổi vài phút một lần, thanh mục tiêu thả tim thắp đèn hoa đăng.
 *  - Bình chọn bằng bình luận 1/2/3, bảng "Công đức giờ này", xin xăm đầu giờ, chào người mới.
 * Dùng lại hàm sân khấu qua window.TempleStage (live.js) và nghe tin qua sự kiện 'temple:message'.
 */
(function () {
  const T = window.TempleStage;
  if (!T || !T.stage) return;
  const stage = T.stage;
  const esc = T.escapeHtml;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pad = (n) => String(n).padStart(2, '0');
  const mmss = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
  };
  const el = (tag, cls, html) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html !== undefined) node.innerHTML = html;
    return node;
  };
  const idleFor = (ms) => Date.now() - T.lastEventAt() > ms;

  // ---------------------------------------------------------------------------
  // 1. CAMERA: gom các lớp cảnh vào một khung để đẩy vào / lia ngang cùng nhau.
  //    Tiêu đề, bảng xếp hạng, 3 ô dưới... (HUD) đứng yên bên ngoài khung.
  // ---------------------------------------------------------------------------
  const camera = el('div', 'scene-camera');
  const SCENE_SELECTORS = [
    '.sanctuary-bg-img', '#prayerSlip', '#buddhaHaloSystem', '#lotusHandHalo', '#sacredLightBeam',
    '#incenseBurnerZone', '.ritual-hotspot', '#centralWorshipper', '#vipCushionsLayer', '#congregationHall',
    '.hall-labels-layer', '#carpetWalkerLayer', '#skyLanternsLayer', '#templeCanvas'
  ];
  stage.insertBefore(camera, stage.firstChild);
  SCENE_SELECTORS.forEach((sel) => {
    stage.querySelectorAll(`:scope > ${sel}`).forEach((node) => camera.appendChild(node));
  });

  // ---------------------------------------------------------------------------
  // 3. SẢNH TỰ LẠY khi không có sự kiện thật; đợt cánh sen rơi.
  // ---------------------------------------------------------------------------
  setInterval(() => {
    if (document.hidden || ceremony.active) return;
    if (idleFor(6000) && Math.random() < 0.75) T.pulseHallBowing();
  }, 7000);

  function schedulePetals() {
    setTimeout(() => {
      if (!document.hidden && idleFor(8000)) T.petalShower(10);
      schedulePetals();
    }, rand(140, 230) * 1000);
  }
  schedulePetals();

  // ---------------------------------------------------------------------------
  // 4. CHIM BAY QUA phía trên chánh điện.
  // ---------------------------------------------------------------------------
  const BIRD_SVG = '<svg viewBox="0 0 40 20" aria-hidden="true"><path d="M2 12 Q11 1 20 11 Q29 1 38 12 Q29 7 20 15 Q11 7 2 12 Z"/></svg>';
  let birdsFromLeft = true;
  function flyBirds() {
    if (document.hidden) return;
    const flock = el('div', `bird-flock${birdsFromLeft ? '' : ' from-right'}`);
    birdsFromLeft = !birdsFromLeft;
    flock.style.top = `${Math.round(rand(250, 470))}px`;
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const bird = el('span', 'bird', BIRD_SVG);
      bird.style.left = `${Math.round(i * rand(34, 52))}px`;
      bird.style.top = `${Math.round((i % 2 ? 1 : -1) * i * rand(6, 12))}px`;
      bird.style.setProperty('--flap', `${rand(0.32, 0.46).toFixed(2)}s`);
      bird.style.animationDelay = `${(-Math.random()).toFixed(2)}s`;
      flock.appendChild(bird);
    }
    camera.appendChild(flock);
    flock.addEventListener('animationend', () => flock.remove(), { once: true });
  }
  function scheduleBirds() {
    setTimeout(() => {
      flyBirds();
      scheduleBirds();
    }, rand(90, 180) * 1000);
  }
  setTimeout(flyBirds, 12000);
  scheduleBirds();

  // ---------------------------------------------------------------------------
  // 5. PHẬT TỬ VÃNG LAI: một người đi lên thảm đỏ rồi khuất dần vào chánh điện (khi không ai tặng quà).
  // ---------------------------------------------------------------------------
  function walkPasserby() {
    if (document.hidden || ceremony.active || !idleFor(15000)) return;
    const variant = T.DEVOTEE_VARIANTS[Math.floor(Math.random() * T.DEVOTEE_VARIANTS.length)];
    const frames = T.framesOf(variant);
    const walker = el('div', 'passerby');
    const img = el('img', 'devotee-sprite');
    img.alt = '';
    img.src = frames.walk1;
    walker.appendChild(img);
    camera.appendChild(walker);
    let step = false;
    const stepper = setInterval(() => {
      step = !step;
      img.src = step ? frames.walk2 : frames.walk1;
    }, 320);
    walker.addEventListener('animationend', () => {
      clearInterval(stepper);
      walker.remove();
    }, { once: true });
  }
  function schedulePasserby() {
    setTimeout(() => {
      walkPasserby();
      schedulePasserby();
    }, rand(110, 200) * 1000);
  }
  schedulePasserby();

  // ---------------------------------------------------------------------------
  // 6. LỊCH KHÓA LỄ: mỗi 15 phút (:00 :15 :30 :45) một khóa lễ 3 phút theo đồng hồ thật.
  // ---------------------------------------------------------------------------
  const CEREMONY_EVERY_MS = 15 * 60 * 1000;
  const CEREMONY_LENGTH_MS = 3 * 60 * 1000;
  const VERSES = [
    'Nam mô Bổn Sư Thích Ca Mâu Ni Phật',
    'Quán Tự Tại Bồ Tát hành thâm Bát Nhã Ba La Mật Đa thời',
    'chiếu kiến ngũ uẩn giai không, độ nhất thiết khổ ách',
    'Xá Lợi Tử, sắc bất dị không, không bất dị sắc',
    'sắc tức thị không, không tức thị sắc',
    'thọ, tưởng, hành, thức diệc phục như thị',
    'Yết đế, yết đế, ba la yết đế, ba la tăng yết đế, bồ đề tát bà ha',
    'Nam mô A Di Đà Phật',
    'Nam mô Quán Thế Âm Bồ Tát',
    'Nguyện đem công đức này, hướng về khắp tất cả',
    'đệ tử và chúng sinh, đều trọn thành Phật đạo'
  ];

  const clockCard = el('div', 'life-card ceremony-clock');
  clockCard.innerHTML = '<span class="cc-label" id="ccLabel">Khóa lễ sau</span><strong class="cc-time" id="ccTime">--:--</strong><span class="cc-sub" id="ccSub"></span>';
  stage.appendChild(clockCard);

  const verseBar = el('div', 'ceremony-verse');
  verseBar.innerHTML = '<span class="verse-seal">Tụng kinh</span><span class="verse-text" id="verseText"></span>';
  stage.appendChild(verseBar);

  const ceremony = { active: false, startedAt: 0, verseTimer: null, bowTimer: null, verseIndex: 0 };

  function ceremonyWindow(now) {
    const start = Math.floor(now / CEREMONY_EVERY_MS) * CEREMONY_EVERY_MS;
    const tzStart = new Date(start);
    return { start, end: start + CEREMONY_LENGTH_MS, next: start + CEREMONY_EVERY_MS, onHour: tzStart.getMinutes() === 0 };
  }

  function showVerse() {
    const text = document.getElementById('verseText');
    if (!text) return;
    text.classList.remove('is-in');
    void text.offsetWidth;
    text.textContent = VERSES[ceremony.verseIndex % VERSES.length];
    text.classList.add('is-in');
    ceremony.verseIndex += 1;
  }

  function startCeremony(win, joinedLate) {
    ceremony.active = true;
    ceremony.startedAt = win.start;
    ceremony.verseIndex = joinedLate ? Math.floor((Date.now() - win.start) / 7000) : 0;
    stage.classList.add('ceremony-on');
    showVerse();
    ceremony.verseTimer = setInterval(showVerse, 7000);
    ceremony.bowTimer = setInterval(() => T.pulseHallBowing({ big: true }), 30000);
    if (!joinedLate) {
      const title = win.onHour ? 'ĐẠI LỄ ĐẦU GIỜ' : 'KHÓA LỄ';
      T.showTicker(title, 'Đạo tràng cùng tụng kinh cầu an', 5200);
      [0, 2600, 5200].forEach((d) => setTimeout(() => T.audio.playTempleBell(1.05), d));
      T.pulseHallBowing({ big: true });
      T.petalShower(win.onHour ? 20 : 10);
    }
  }

  function endCeremony() {
    ceremony.active = false;
    clearInterval(ceremony.verseTimer);
    clearInterval(ceremony.bowTimer);
    stage.classList.remove('ceremony-on');
    T.audio.playTempleBell(0.9);
    T.showTicker('HỒI HƯỚNG', 'Khóa lễ viên mãn · hồi hướng công đức đến tất cả thí chủ', 4200);
  }

  function tickCeremony() {
    const now = Date.now();
    const win = ceremonyWindow(now);
    const inside = now >= win.start && now < win.end;
    if (inside && !ceremony.active) startCeremony(win, now - win.start > 4000);
    if (!inside && ceremony.active) endCeremony();
    const label = document.getElementById('ccLabel');
    const time = document.getElementById('ccTime');
    const sub = document.getElementById('ccSub');
    const nextOnHour = new Date(win.next).getMinutes() === 0;
    if (inside) {
      label.textContent = win.onHour ? 'Đại lễ đầu giờ' : 'Đang tụng kinh';
      time.textContent = mmss(win.end - now);
      sub.textContent = 'cùng niệm Phật';
    } else {
      label.textContent = nextOnHour ? 'Đại lễ sau' : 'Khóa lễ sau';
      time.textContent = mmss(win.next - now);
      sub.textContent = `${pad(new Date(win.next).getHours())}:${pad(new Date(win.next).getMinutes())}`;
    }
    clockCard.classList.toggle('is-live', inside);
  }

  // ---------------------------------------------------------------------------
  // 7. ĐỒNG HỒ + ÂM LỊCH (thuật toán Hồ Ngọc Đức, múi giờ +7).
  // ---------------------------------------------------------------------------
  const lunar = (() => {
    const INT = Math.floor;
    const PI = Math.PI;
    const jdFromDate = (dd, mm, yy) => {
      const a = INT((14 - mm) / 12);
      const y = yy + 4800 - a;
      const m = mm + 12 * a - 3;
      let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
      if (jd < 2299161) jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
      return jd;
    };
    const newMoon = (k) => {
      const T1 = k / 1236.85;
      const T2 = T1 * T1;
      const T3 = T2 * T1;
      const dr = PI / 180;
      let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
      Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T1 - 0.009173 * T2) * dr);
      const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
      const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
      const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
      let C1 = (0.1734 - 0.000393 * T1) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
      C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
      C1 -= 0.0004 * Math.sin(dr * 3 * Mpr);
      C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
      C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
      C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
      C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
      const deltat = T1 < -11
        ? 0.001 + 0.000839 * T1 + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T1 * T3
        : -0.000278 + 0.000265 * T1 + 0.000262 * T2;
      return Jd1 + C1 - deltat;
    };
    const sunLongitude = (jdn) => {
      const T1 = (jdn - 2451545.0) / 36525;
      const T2 = T1 * T1;
      const dr = PI / 180;
      const M = 357.5291 + 35999.0503 * T1 - 0.0001559 * T2 - 0.00000048 * T1 * T2;
      const L0 = 280.46645 + 36000.76983 * T1 + 0.0003032 * T2;
      let DL = (1.9146 - 0.004817 * T1 - 0.000014 * T2) * Math.sin(dr * M);
      DL = DL + (0.019993 - 0.000101 * T1) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
      let L = (L0 + DL) * dr;
      L -= PI * 2 * INT(L / (PI * 2));
      return L;
    };
    const TZ = 7;
    const getNewMoonDay = (k) => INT(newMoon(k) + 0.5 + TZ / 24);
    const getSunLong = (day) => INT((sunLongitude(day - 0.5 - TZ / 24) / PI) * 6);
    const lunarMonth11 = (yy) => {
      const off = jdFromDate(31, 12, yy) - 2415021;
      const k = INT(off / 29.530588853);
      let nm = getNewMoonDay(k);
      if (getSunLong(nm) >= 9) nm = getNewMoonDay(k - 1);
      return nm;
    };
    const leapOffset = (a11) => {
      const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
      let last;
      let i = 1;
      let arc = getSunLong(getNewMoonDay(k + i));
      do {
        last = arc;
        i += 1;
        arc = getSunLong(getNewMoonDay(k + i));
      } while (arc !== last && i < 14);
      return i - 1;
    };
    return (date) => {
      const dd = date.getDate();
      const mm = date.getMonth() + 1;
      const yy = date.getFullYear();
      const dayNumber = jdFromDate(dd, mm, yy);
      const k = INT((dayNumber - 2415021.076998695) / 29.530588853);
      let monthStart = getNewMoonDay(k + 1);
      if (monthStart > dayNumber) monthStart = getNewMoonDay(k);
      let a11 = lunarMonth11(yy);
      let b11 = a11;
      let lunarYear;
      if (a11 >= monthStart) {
        lunarYear = yy;
        a11 = lunarMonth11(yy - 1);
      } else {
        lunarYear = yy + 1;
        b11 = lunarMonth11(yy + 1);
      }
      const lunarDay = dayNumber - monthStart + 1;
      const diff = INT((monthStart - a11) / 29);
      let lunarLeap = 0;
      let lunarMonth = diff + 11;
      if (b11 - a11 > 365) {
        const leapMonthDiff = leapOffset(a11);
        if (diff >= leapMonthDiff) {
          lunarMonth = diff + 10;
          if (diff === leapMonthDiff) lunarLeap = 1;
        }
      }
      if (lunarMonth > 12) lunarMonth -= 12;
      if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
      return { day: lunarDay, month: lunarMonth, year: lunarYear, leap: lunarLeap };
    };
  })();
  const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
  const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
  const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

  const dateCard = el('div', 'life-card temple-date');
  dateCard.innerHTML = '<strong class="td-time" id="tdTime">--:--</strong><span class="td-day" id="tdDay"></span><span class="td-lunar" id="tdLunar"></span>';
  stage.appendChild(dateCard);
  let lunarKey = '';
  function tickDate() {
    const now = new Date();
    document.getElementById('tdTime').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const key = now.toDateString();
    if (key === lunarKey) return;
    lunarKey = key;
    const l = lunar(now);
    const canChi = `${CAN[(l.year + 6) % 10]} ${CHI[(l.year + 8) % 12]}`;
    const special = l.day === 1 ? ' · Mùng Một' : l.day === 15 ? ' · Ngày Rằm' : '';
    document.getElementById('tdDay').textContent = `${WEEKDAYS[now.getDay()]} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}`;
    document.getElementById('tdLunar').textContent = `${l.day}/${l.month}${l.leap ? ' nhuận' : ''} ${canChi}${special}`;
    dateCard.classList.toggle('is-special', Boolean(special));
  }

  // ---------------------------------------------------------------------------
  // 8. PHÁP NGỮ đổi mỗi 3 phút.
  // ---------------------------------------------------------------------------
  const QUOTES = [
    ['Tâm bình thì thế giới bình.', 'Pháp ngữ'],
    ['Không làm các điều ác, siêng làm các việc lành, giữ tâm ý trong sạch: đó là lời chư Phật dạy.', 'Kinh Pháp Cú'],
    ['Hận thù không dập tắt được hận thù, chỉ có tình thương mới dập tắt được hận thù.', 'Kinh Pháp Cú'],
    ['Gieo nhân lành, ắt gặt quả lành.', 'Pháp ngữ'],
    ['Biết đủ là giàu, biết buông là an.', 'Pháp ngữ'],
    ['Lời nói dịu dàng là bông hoa đẹp nhất.', 'Pháp ngữ'],
    ['Một niệm thiện lành, muôn điều an vui.', 'Pháp ngữ'],
    ['Thắng ngàn quân không bằng tự thắng mình.', 'Kinh Pháp Cú']
  ];
  const quoteCard = el('div', 'life-card dharma-quote');
  quoteCard.innerHTML = '<span class="dq-source" id="dqSource"></span><p class="dq-text" id="dqText"></p>';
  stage.appendChild(quoteCard);
  let quoteIndex = Math.floor(Math.random() * QUOTES.length);
  function showQuote() {
    const [text, source] = QUOTES[quoteIndex % QUOTES.length];
    quoteIndex += 1;
    quoteCard.classList.remove('is-in');
    void quoteCard.offsetWidth;
    document.getElementById('dqText').textContent = `“${text}”`;
    document.getElementById('dqSource').textContent = source;
    quoteCard.classList.add('is-in');
  }
  showQuote();
  setInterval(showQuote, 3 * 60 * 1000);

  // ---------------------------------------------------------------------------
  // 9. MỤC TIÊU THẢ TIM: thắp đèn hoa đăng (dữ liệu lamp sẵn có trên server).
  // ---------------------------------------------------------------------------
  const goalCard = el('div', 'life-card like-goal');
  goalCard.innerHTML = '<div class="lg-head"><span class="lg-title">Thả tim thắp đèn</span><span class="lg-lit" id="lgLit"></span></div>'
    + '<div class="lg-bar"><i id="lgFill"></i></div><div class="lg-count" id="lgCount"></div>';
  stage.appendChild(goalCard);
  let lastLit = null;
  function renderGoal(lamp) {
    if (!lamp) return;
    const likes = Number(lamp.likes || 0);
    const goal = Math.max(1, Number(lamp.goal || 300));
    const lit = Number(lamp.lit || 0);
    document.getElementById('lgFill').style.width = `${Math.min(100, (likes / goal) * 100).toFixed(1)}%`;
    document.getElementById('lgCount').textContent = `${likes.toLocaleString('vi-VN')} / ${goal.toLocaleString('vi-VN')} tim`;
    document.getElementById('lgLit').textContent = `Đèn thứ ${lit + 1}`;
    if (lastLit !== null && lit > lastLit) {
      goalCard.classList.remove('is-done');
      void goalCard.offsetWidth;
      goalCard.classList.add('is-done');
    }
    lastLit = lit;
  }

  // ---------------------------------------------------------------------------
  // 10. BÌNH CHỌN 1 / 2 / 3 (server tính phiếu, vòng 5 phút).
  // ---------------------------------------------------------------------------
  const pollCard = el('div', 'life-card poll-card');
  pollCard.innerHTML = '<div class="pc-head"><span class="pc-seal">Bình chọn</span><span class="pc-left" id="pcLeft"></span></div>'
    + '<div class="pc-question" id="pcQuestion"></div><div class="pc-options" id="pcOptions"></div>'
    + '<div class="pc-foot">Bình luận <b>1</b>, <b>2</b> hoặc <b>3</b> để chọn</div>';
  stage.appendChild(pollCard);
  let poll = null;
  function renderPoll(p) {
    if (!p) return;
    poll = p;
    document.getElementById('pcQuestion').textContent = p.question;
    const max = Math.max(1, ...p.options.map((o) => o.votes));
    document.getElementById('pcOptions').innerHTML = p.options
      .map((o, i) => `<div class="pc-option"><span class="pc-num">${i + 1}</span><span class="pc-label">${esc(o.label)}</span>`
        + `<span class="pc-votes">${o.votes}</span><span class="pc-bar"><i style="width:${Math.round((o.votes / max) * 100)}%"></i></span></div>`)
      .join('');
  }
  function tickPoll() {
    if (!poll) return;
    document.getElementById('pcLeft').textContent = `còn ${mmss(poll.endsAt - Date.now())}`;
  }
  function onPollResult(r) {
    if (!r || !r.winner) return;
    T.showTicker('ĐẠO TRÀNG CHỌN', `<strong>${esc(r.winner)}</strong> · ${r.total} phiếu bình chọn`, 5200);
    T.petalShower(8);
    T.audio.enqueueTts(`Đạo tràng đã chọn ${r.winner}. Nam mô A Di Đà Phật.`, { voice: 'maichi' });
  }

  // ---------------------------------------------------------------------------
  // 11. "CÔNG ĐỨC GIỜ NÀY": luân phiên với bảng "Tấm lòng thành" mỗi 20 giây (khi giờ này đã có người).
  // ---------------------------------------------------------------------------
  const hourlyBoard = el('aside', 'hud-right-leaderboard hourly-board');
  hourlyBoard.setAttribute('aria-label', 'Công đức trong giờ');
  hourlyBoard.innerHTML = '<div class="hud-lb-header" id="hbHeader">Công đức giờ này</div><div class="hud-lb-list" id="hbList"></div>';
  stage.appendChild(hourlyBoard);
  let hourly = null;
  let showHourly = false;
  function renderHourly(h) {
    if (!h) return;
    hourly = h;
    document.getElementById('hbHeader').textContent = `Công đức ${h.hourLabel}`;
    const top = h.top || [];
    const best = Math.max(1, Number(top[0]?.merit || 0));
    document.getElementById('hbList').innerHTML = top
      .map((item) => `<div class="leader-item" data-rank="${item.rank}"><span class="leader-rank">${item.rank}</span>`
        + `<span class="leader-main"><span class="leader-line"><span class="leader-name">${esc(String(item.name).slice(0, 14))}</span>`
        + `<span class="leader-merit">${Number(item.merit).toLocaleString('vi-VN')}</span></span>`
        + `<span class="leader-bar"><i style="width:${Math.max(6, Math.round((item.merit / best) * 100))}%"></i></span></span></div>`)
      .join('');
    if (!top.length) setHourlyVisible(false);
  }
  function setHourlyVisible(on) {
    showHourly = on;
    hourlyBoard.classList.toggle('is-shown', on);
    stage.classList.toggle('hourly-shown', on);
  }
  setInterval(() => {
    if (hourly && hourly.top && hourly.top.length) setHourlyVisible(!showHourly);
    else setHourlyVisible(false);
  }, 20000);

  // ---------------------------------------------------------------------------
  // 12. XIN XĂM ĐẦU GIỜ (5 phút đầu mỗi giờ) + chào người mới bằng giọng đọc (tối đa 1 lần / 45 giây).
  // ---------------------------------------------------------------------------
  let lastFortuneCue = 0;
  function tickFortuneCue() {
    const now = new Date();
    if (now.getMinutes() < 5 && !ceremony.active && Date.now() - lastFortuneCue > 75000 && idleFor(5000)) {
      lastFortuneCue = Date.now();
      T.showTicker('XIN XĂM ĐẦU GIỜ', 'Bình luận <strong>“xin xăm”</strong> gieo quẻ cho giờ mới', 5000);
    }
  }
  let lastGreetAt = 0;
  function greet(user) {
    if (!user || Date.now() - lastGreetAt < 45000 || ceremony.active) return;
    lastGreetAt = Date.now();
    T.audio.enqueueTts(`Chào mừng ${user} đến chùa. Nam mô A Di Đà Phật.`, { voice: 'maichi' });
  }

  // ---------------------------------------------------------------------------
  // 13. HÌNH NỀN: chọn trong bảng điều khiển nhanh, lưu trên server, mọi màn hình (OBS) đổi theo.
  //     Thêm nền: thả ảnh 1080x1920 cùng bố cục vào public/assets/backgrounds/.
  // ---------------------------------------------------------------------------
  let backgrounds = [];
  let wantedBackground = '';
  const bgImg = stage.querySelector('.sanctuary-bg-img');
  function renderBackgroundChoices() {
    const box = document.getElementById('backgroundChoices');
    if (!box) return;
    box.replaceChildren(...backgrounds.map((bg) => {
      const btn = el('button', `dock-btn${bg.id === wantedBackground ? ' active-toggle' : ''}`);
      btn.type = 'button';
      btn.textContent = bg.name;
      btn.addEventListener('click', () => {
        applyBackground(bg.id);
        fetch('/rpc', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'temple.updateSettings', params: { background: bg.id } })
        }).catch(() => {});
      });
      return btn;
    }));
  }
  function applyBackground(id) {
    if (!id) return;
    wantedBackground = id;
    renderBackgroundChoices();
    const bg = backgrounds.find((b) => b.id === id);
    if (!bg || !bgImg || bgImg.getAttribute('src') === bg.src) return;
    const next = new Image();
    next.src = bg.src;
    const swap = () => {
      if (wantedBackground !== id) return;
      bgImg.src = bg.src;
      stage.dataset.bgLayout = bg.layout || 'default';
      if (T.refreshIncense) T.refreshIncense(); // lư hương có thể đổi chỗ theo nền
      bgImg.classList.remove('bg-swap-in');
      void bgImg.offsetWidth;
      bgImg.classList.add('bg-swap-in');
    };
    (next.decode ? next.decode() : Promise.resolve()).then(swap, swap);
  }
  fetch('/api/backgrounds')
    .then((r) => (r.ok ? r.json() : { backgrounds: [] }))
    .then((data) => {
      backgrounds = Array.isArray(data.backgrounds) ? data.backgrounds : [];
      applyBackground(wantedBackground || data.current);
    })
    .catch(() => {});

  // ---------------------------------------------------------------------------
  // Nghe tin từ server.
  // ---------------------------------------------------------------------------
  window.addEventListener('temple:message', (e) => {
    const msg = e.detail || {};
    const p = msg.params || {};
    switch (msg.method) {
      case 'temple.state':
        renderGoal(p.lamp);
        if (p.settings?.background) applyBackground(p.settings.background);
        if (p.engagement) {
          renderPoll(p.engagement.poll);
          renderHourly(p.engagement.hourly);
        }
        break;
      case 'temple.event':
        if (p.state) renderGoal(p.state.lamp);
        break;
      case 'temple.lamp':
        renderGoal(p);
        break;
      case 'temple.poll':
        renderPoll(p);
        break;
      case 'temple.pollResult':
        onPollResult(p);
        break;
      case 'temple.hourly':
        renderHourly(p);
        break;
      case 'temple.welcome':
        greet(p.user);
        break;
      default:
        break;
    }
  });

  // Đồng hồ chung 1 giây cho đếm ngược, giờ, bình chọn.
  function everySecond() {
    tickCeremony();
    tickDate();
    tickPoll();
    tickFortuneCue();
  }
  everySecond();
  setInterval(everySecond, 1000);

  // Gọi tay để thử (console): TempleLife.flyBirds(), TempleLife.walkPasserby(true)...
  window.TempleLife = {
    flyBirds,
    walkPasserby: (force) => (force ? walkPasserbyNow() : walkPasserby()),
    showQuote,
    ceremony
  };
  function walkPasserbyNow() {
    const saved = T.lastEventAt;
    T.lastEventAt = () => 0;
    try { walkPasserby(); } finally { T.lastEventAt = saved; }
  }
})();
