// Tương tác theo thời gian cho chùa: bình chọn lời nguyện bằng bình luận 1 / 2 / 3, và top công đức trong giờ.
// Mỗi vòng bình chọn dài `pollMs` (mặc định 5 phút), tính theo đồng hồ thật nên mọi màn hình đều khớp nhau.

const POLL_SETS = [
  { question: 'Giờ này đạo tràng cùng cầu điều gì?', options: ['Cầu bình an', 'Cầu tài lộc', 'Cầu sức khỏe'] },
  { question: 'Cùng hồi hướng công đức đến ai?', options: ['Cha mẹ', 'Con cái', 'Chúng sinh'] },
  { question: 'Lời nguyện chung của giờ này?', options: ['Gia đạo êm ấm', 'Công việc hanh thông', 'Thi cử đỗ đạt'] },
  { question: 'Thắp đèn cầu nguyện cho điều gì?', options: ['Bình an đi xa', 'Tình duyên viên mãn', 'Tâm an giấc ngủ'] }
];

const VOTE_RE = /^\s*([1-3])\s*[.!]*\s*$/;

function createEngagement({ broadcast, now = () => Date.now(), pollMs = 5 * 60 * 1000, tickMs = 1000 } = {}) {
  let round = -1;
  let poll = null;
  let votes = new Map(); // viewerId -> option index (phiếu đầu tiên được tính)
  let pollPushTimer = null;

  let hourKey = '';
  let hourly = new Map(); // key -> { name, uniqueId, avatar, merit }
  let hourlyPushTimer = null;

  function currentHourKey() {
    const d = new Date(now());
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}`;
  }

  function pollState() {
    if (!poll) return null;
    const counts = [0, 0, 0];
    for (const choice of votes.values()) counts[choice] += 1;
    return {
      id: poll.id,
      question: poll.question,
      options: poll.options.map((label, i) => ({ label, votes: counts[i] })),
      total: votes.size,
      endsAt: poll.endsAt
    };
  }

  function hourlyState() {
    const top = [...hourly.values()]
      .filter((d) => d.merit > 0)
      .sort((a, b) => b.merit - a.merit)
      .slice(0, 5)
      .map((d, i) => ({ rank: i + 1, name: d.name, uniqueId: d.uniqueId, avatar: d.avatar, merit: d.merit }));
    const hour = new Date(now()).getHours();
    return { hourLabel: `${hour}h–${(hour + 1) % 24}h`, top };
  }

  function startRound(index) {
    const set = POLL_SETS[((index % POLL_SETS.length) + POLL_SETS.length) % POLL_SETS.length];
    round = index;
    votes = new Map();
    poll = { id: index, question: set.question, options: set.options, endsAt: (index + 1) * pollMs };
    broadcast('temple.poll', pollState());
  }

  function finishRound() {
    const result = pollState();
    if (result && result.total > 0) {
      const best = Math.max(...result.options.map((o) => o.votes));
      const winners = result.options.filter((o) => o.votes === best).map((o) => o.label);
      broadcast('temple.pollResult', { question: result.question, winner: winners[0], tied: winners.length > 1, options: result.options, total: result.total });
    }
  }

  function tick() {
    const index = Math.floor(now() / pollMs);
    if (index !== round) {
      if (round !== -1) finishRound();
      startRound(index);
    }
    const key = currentHourKey();
    if (key !== hourKey) {
      hourKey = key;
      hourly = new Map();
      broadcast('temple.hourly', hourlyState());
    }
  }

  function schedulePollPush() {
    if (pollPushTimer) return;
    pollPushTimer = setTimeout(() => {
      pollPushTimer = null;
      broadcast('temple.poll', pollState());
    }, 400);
  }

  function scheduleHourlyPush() {
    if (hourlyPushTimer) return;
    hourlyPushTimer = setTimeout(() => {
      hourlyPushTimer = null;
      broadcast('temple.hourly', hourlyState());
    }, 1500);
  }

  // Bình luận đúng "1", "2" hoặc "3" là một phiếu. Mỗi người một phiếu mỗi vòng. Trả về true nếu là phiếu.
  function handleComment(viewerId, text) {
    const m = VOTE_RE.exec(String(text || ''));
    if (!m || !viewerId) return false;
    tick();
    if (!votes.has(viewerId)) {
      votes.set(viewerId, Number(m[1]) - 1);
      schedulePollPush();
    }
    return true;
  }

  function addMerit({ key, name, uniqueId, avatar, merit }) {
    if (!key || !(merit > 0)) return;
    tick();
    const entry = hourly.get(key) || { name, uniqueId, avatar: avatar || '', merit: 0 };
    entry.name = name || entry.name;
    if (avatar) entry.avatar = avatar;
    entry.merit += merit;
    hourly.set(key, entry);
    scheduleHourlyPush();
  }

  tick();
  const timer = setInterval(tick, tickMs);
  if (typeof timer.unref === 'function') timer.unref();

  return {
    handleComment,
    addMerit,
    getState: () => {
      tick();
      return { poll: pollState(), hourly: hourlyState() };
    },
    tick,
    resetHourly() {
      hourly = new Map();
      broadcast('temple.hourly', hourlyState());
    },
    stop() {
      clearInterval(timer);
      clearTimeout(pollPushTimer);
      clearTimeout(hourlyPushTimer);
    }
  };
}

module.exports = { createEngagement, POLL_SETS };
