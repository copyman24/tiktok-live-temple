const MAX_CLAIMS = 12;
const MAX_WISHES = 12;
const MAX_GUESTS = 500;
const MAX_LIKE_TOTAL = 1_000_000_000;
const WISH_COOLDOWN_MS = 12_000;
const PHASES = ['lobby', 'entrance', 'vows', 'rings', 'celebration', 'ended'];
const CHANT_COOLDOWN_MS = 2500;
const TOSS_COOLDOWN_MS = 6000;
const MAX_TEAM_MEMBERS = 2000;
const MAX_BOUQUET_ENTRANTS = 300;
const MAX_GIFT_BOOK = 200;
const KISS_PHASES = ['vows', 'rings', 'celebration'];

export class WeddingRuleError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'WeddingRuleError';
    this.code = code;
  }
}

export function createWeddingState(now = Date.now()) {
  return {
    sessionId: crypto.randomUUID(),
    phase: 'lobby',
    couple: { bride: null, groom: null, locked: false },
    claims: [],
    wishes: [],
    guestIds: [],
    wishCooldowns: {},
    likes: { total: 0, goal: 1000 },
    social: { follows: 0, shares: 0, gifts: 0, members: 0 },
    teams: { groom: { score: 0, members: 0 }, bride: { score: 0, members: 0 } },
    teamOf: {},
    kiss: { count: 0, goal: 30, moments: 0 },
    cheers: { count: 0, goal: 20, rounds: 0 },
    petals: 0,
    bouquet: { open: false, entrants: [], winner: null },
    giftBook: {},
    chantCooldowns: {},
    updatedAt: now
  };
}

export function reduceWedding(state, input, now = Date.now()) {
  const events = [];
  let next = state;

  if (input.type === 'wedding.open') {
    if (state.phase === 'lobby') return { state, events };
    if (state.phase !== 'ended') {
      throw new WeddingRuleError('already_open', 'The ceremony is already in progress.');
    }
    next = createWeddingState(now);
    events.push({ type: 'phase_changed', phase: 'lobby' });
  } else if (input.type === 'wedding.assignRole') {
    requireLobby(state);
    if (state.couple.locked) throw lockedError();
    const participant = {
      viewer: { id: `host:${input.role}`, name: cleanName(input.name), avatar: '' },
      source: 'host',
      confirmedAt: now
    };
    next = { ...state, couple: { ...state.couple, [input.role]: participant } };
    next = removeRoleClaims(next, input.role);
    events.push({ type: 'role_assigned', role: input.role, participant: publicParticipant(participant) });
  } else if (input.type === 'wedding.claimConfirm') {
    requireLobby(state);
    if (state.couple.locked) throw lockedError();
    const claim = state.claims.find((item) => item.id === input.claimId);
    if (!claim) throw new WeddingRuleError('claim_missing', 'That role request is no longer waiting.');
    if (state.couple[claim.role]) {
      throw new WeddingRuleError('role_filled', 'That role has already been assigned.');
    }
    const participant = { viewer: claim.viewer, source: 'viewer', confirmedAt: now };
    next = {
      ...state,
      couple: { ...state.couple, [claim.role]: participant }
    };
    next = removeRoleClaims(next, claim.role);
    events.push({ type: 'role_assigned', role: claim.role, participant: publicParticipant(participant) });
  } else if (input.type === 'wedding.claimDecline') {
    next = { ...state, claims: state.claims.filter((item) => item.id !== input.claimId) };
  } else if (input.type === 'wedding.lockCouple') {
    requireLobby(state);
    if (state.couple.locked) throw lockedError();
    if (!state.couple.bride || !state.couple.groom) {
      throw new WeddingRuleError('couple_incomplete', 'Assign both the bride and groom before starting.');
    }
    next = { ...state, couple: { ...state.couple, locked: true } };
    events.push({ type: 'couple_locked' });
  } else if (input.type === 'wedding.advance') {
    if (!state.couple.locked) {
      throw new WeddingRuleError('couple_not_locked', 'Confirm both participants before starting the ceremony.');
    }
    if (state.phase === 'ended') {
      throw new WeddingRuleError('ceremony_ended', 'Open a new ceremony to continue.');
    }
    const nextPhase = state.phase === 'lobby' ? 'entrance' : PHASES[PHASES.indexOf(state.phase) + 1];
    next = { ...state, phase: nextPhase };
    if (nextPhase === 'celebration') next = { ...next, bouquet: { open: true, entrants: [], winner: null } };
    if (nextPhase === 'ended') next = { ...next, bouquet: { ...next.bouquet, open: false } };
    events.push({ type: 'phase_changed', phase: nextPhase });
  } else if (input.type === 'wedding.end') {
    if (state.phase === 'ended') return { state, events };
    next = { ...state, phase: 'ended' };
    events.push({ type: 'phase_changed', phase: 'ended' });
  } else if (input.type === 'wedding.bouquetOpen') {
    if (state.phase === 'ended' || state.phase === 'lobby') {
      throw new WeddingRuleError('bouquet_closed', 'Open the bouquet toss after the ceremony starts.');
    }
    next = { ...state, bouquet: { open: true, entrants: [], winner: null } };
    events.push({ type: 'bouquet_opened' });
  } else if (input.type === 'wedding.bouquetToss') {
    const entrants = state.bouquet.entrants;
    if (!entrants.length) throw new WeddingRuleError('bouquet_empty', 'No guest has joined the bouquet toss yet.');
    const pick = Math.min(entrants.length - 1, Math.floor((Number(input.random ?? Math.random())) * entrants.length));
    const winner = entrants[pick];
    next = { ...state, bouquet: { open: false, entrants: [], winner } };
    events.push({ type: 'bouquet_caught', viewer: publicViewer(winner), entrants: entrants.length });
  } else if (input.type === 'wedding.setGoals') {
    const kissGoal = input.kissGoal === undefined ? state.kiss.goal : clampInteger(input.kissGoal, 5, 10_000);
    const cheersGoal = input.cheersGoal === undefined ? state.cheers.goal : clampInteger(input.cheersGoal, 5, 10_000);
    next = { ...state, kiss: { ...state.kiss, goal: kissGoal }, cheers: { ...state.cheers, goal: cheersGoal } };
  } else if (input.type === 'wedding.setLikeGoal') {
    const goal = clampInteger(input.goal, 100, 1_000_000);
    next = { ...state, likes: { ...state.likes, goal } };
    events.push({ type: 'like_goal_changed', goal });
  } else if (input.type === 'interaction') {
    const transition = reduceInteraction(state, input.interaction, now);
    next = transition.state;
    events.push(...transition.events);
  }

  if (next !== state) next = { ...next, updatedAt: now };
  return { state: next, events };
}

function reduceInteraction(state, interaction, now) {
  const viewer = sanitizeViewer(interaction.viewer);
  if (interaction.kind === 'comment') return reduceComment(state, viewer, interaction.text, now);

  if (interaction.kind === 'like') {
    const count = clampInteger(interaction.count, 1, 100);
    const total = Math.min(MAX_LIKE_TOTAL, state.likes.total + count);
    const events = [{ type: 'likes_changed', total, progress: total % state.likes.goal, goal: state.likes.goal }];
    const reached = Math.floor(total / state.likes.goal);
    if (reached > Math.floor(state.likes.total / state.likes.goal)) {
      events.push({ type: 'like_goal_reached', total, goal: state.likes.goal, times: reached });
    }
    const teamed = addTeamScore(state, viewer.id, count);
    if (teamed !== state) events.push(teamEvent(teamed));
    return { state: { ...teamed, likes: { ...state.likes, total } }, events };
  }

  if (interaction.kind === 'follow' || interaction.kind === 'share' || interaction.kind === 'member') {
    const seen = state.guestIds.includes(viewer.id);
    const guestIds = seen ? state.guestIds : [...state.guestIds, viewer.id].slice(-MAX_GUESTS);
    const socialKey = interaction.kind === 'member' ? 'members' : `${interaction.kind}s`;
    const social = { ...state.social, [socialKey]: Math.min(MAX_LIKE_TOTAL, state.social[socialKey] + 1) };
    return {
      state: { ...state, social, guestIds },
      events: [{
        type: 'guest_cheered',
        source: interaction.kind,
        viewer: publicViewer(viewer),
        guestCount: guestIds.length
      }]
    };
  }

  if (interaction.kind === 'gift') {
    const count = clampInteger(interaction.count, 1, 1000);
    const coins = clampInteger(interaction.coins, 1, 10_000_000);
    const name = cleanName(interaction.name, 48);
    const grand = coins >= 500 || /wedding|cưới|cuoi|nhẫn|ring|lâu đài|castle/i.test(name);
    const book = { ...state.giftBook };
    const entry = book[viewer.id] || { viewer, coins: 0, count: 0 };
    book[viewer.id] = { viewer, coins: entry.coins + coins, count: entry.count + count };
    const bookIds = Object.keys(book);
    if (bookIds.length > MAX_GIFT_BOOK) {
      const smallest = bookIds.sort((a, b) => book[a].coins - book[b].coins)[0];
      if (smallest !== viewer.id) delete book[smallest];
    }
    let next = { ...state, giftBook: book, social: { ...state.social, gifts: Math.min(MAX_LIKE_TOTAL, state.social.gifts + count) } };
    const events = [{
      type: 'gift_celebration',
      viewer: publicViewer(viewer),
      name,
      count,
      coins,
      grand
    }];
    const teamed = addTeamScore(next, viewer.id, coins * 10);
    if (teamed !== next) events.push(teamEvent(teamed));
    next = teamed;
    return { state: next, events };
  }

  return { state, events: [] };
}

function reduceComment(state, viewer, text, now) {
  const comment = String(text || '').trim();
  const lower = comment.toLocaleLowerCase('vi');
  const folded = foldVi(lower);
  const isWish = /^#loichuc\s/i.test(comment);

  const team = /(^|\s)#?nha ?trai\b/.test(folded) ? 'groom' : /(^|\s)#?nha ?gai\b/.test(folded) ? 'bride' : null;
  if (!isWish && team && state.phase !== 'ended') {
    if (state.teamOf[viewer.id]) return { state, events: [] };
    const teamOf = { ...state.teamOf, [viewer.id]: team };
    const ids = Object.keys(teamOf);
    if (ids.length > MAX_TEAM_MEMBERS) delete teamOf[ids[0]];
    const teams = { ...state.teams, [team]: { ...state.teams[team], members: state.teams[team].members + 1, score: state.teams[team].score + 5 } };
    const next = { ...state, teamOf, teams };
    return { state: next, events: [{ type: 'team_joined', team, viewer: publicViewer(viewer), teams: publicTeams(next) }] };
  }

  if (!isWish && (/h[oô]n đi|hun đi|hôn nhau|#hondi|#hôn/.test(lower) || /\bhon di\b|#hondi/.test(folded))) {
    if (!KISS_PHASES.includes(state.phase) || onCooldown(state, `kiss:${viewer.id}`, now, CHANT_COOLDOWN_MS)) return { state, events: [] };
    const cooled = withCooldown(state, `kiss:${viewer.id}`, now);
    const count = state.kiss.count + 1;
    if (count < state.kiss.goal) {
      return { state: { ...cooled, kiss: { ...state.kiss, count } }, events: [{ type: 'kiss_chant', count, goal: state.kiss.goal, viewer: publicViewer(viewer) }] };
    }
    const moments = state.kiss.moments + 1;
    return {
      state: { ...cooled, kiss: { ...state.kiss, count: 0, moments } },
      events: [{ type: 'kiss_moment', moments, goal: state.kiss.goal, viewer: publicViewer(viewer) }]
    };
  }

  if (!isWish && /(^|[\s!])(dô|zô|dzô|zo{2,}|dôoo+)([\s!.]|$)|#nangly|nâng ly|trăm phần trăm|100%/.test(lower)) {
    if (state.phase === 'ended' || onCooldown(state, `cheer:${viewer.id}`, now, CHANT_COOLDOWN_MS)) return { state, events: [] };
    const cooled = withCooldown(state, `cheer:${viewer.id}`, now);
    const count = state.cheers.count + 1;
    if (count < state.cheers.goal) {
      return { state: { ...cooled, cheers: { ...state.cheers, count } }, events: [{ type: 'cheers_chant', count, goal: state.cheers.goal, viewer: publicViewer(viewer) }] };
    }
    const rounds = state.cheers.rounds + 1;
    return {
      state: { ...cooled, cheers: { ...state.cheers, count: 0, rounds } },
      events: [{ type: 'cheers_burst', rounds, viewer: publicViewer(viewer) }]
    };
  }

  if (!isWish && /#tunghoa|tung hoa|rắc hoa|ném hoa/.test(lower)) {
    if (state.phase === 'ended' || onCooldown(state, `toss:${viewer.id}`, now, TOSS_COOLDOWN_MS)) return { state, events: [] };
    const cooled = withCooldown(state, `toss:${viewer.id}`, now);
    return { state: { ...cooled, petals: state.petals + 1 }, events: [{ type: 'petals_tossed', viewer: publicViewer(viewer), total: state.petals + 1 }] };
  }

  if (!isWish && /#bathoa|bắt hoa/.test(lower)) {
    if (!state.bouquet.open) return { state, events: [] };
    if (state.bouquet.entrants.some((item) => item.id === viewer.id)) return { state, events: [] };
    if (state.bouquet.entrants.length >= MAX_BOUQUET_ENTRANTS) return { state, events: [] };
    const entrants = [...state.bouquet.entrants, viewer];
    return {
      state: { ...state, bouquet: { ...state.bouquet, entrants } },
      events: [{ type: 'bouquet_entered', viewer: publicViewer(viewer), entrants: entrants.length }]
    };
  }
  const role = comment.toLowerCase() === '#codau' ? 'bride' : comment.toLowerCase() === '#chure' ? 'groom' : null;
  if (role && state.phase === 'lobby' && !state.couple.locked && !state.couple[role]) {
    if (state.claims.some((claim) => claim.viewer.id === viewer.id)) return { state, events: [] };
    if (state.claims.length >= MAX_CLAIMS) return { state, events: [] };
    const claim = { id: crypto.randomUUID(), role, viewer, requestedAt: now };
    return { state: { ...state, claims: [...state.claims, claim] }, events: [{ type: 'role_claimed', claim: publicClaim(claim) }] };
  }

  const wishMatch = comment.match(/^#loichuc\s+(.+)$/i);
  if (!wishMatch || state.phase === 'ended') return { state, events: [] };
  const lastAt = Object.hasOwn(state.wishCooldowns, viewer.id) ? state.wishCooldowns[viewer.id] : 0;
  if (now - lastAt < WISH_COOLDOWN_MS) return { state, events: [] };
  const textValue = cleanName(wishMatch[1], 240);
  if (!textValue) return { state, events: [] };
  const wish = { id: crypto.randomUUID(), viewer, text: textValue, at: now };
  const cooldowns = { ...state.wishCooldowns, [viewer.id]: now };
  for (const [id, at] of Object.entries(cooldowns)) {
    if (now - at > WISH_COOLDOWN_MS * 5) delete cooldowns[id];
  }
  const cooldownEntries = Object.entries(cooldowns);
  if (cooldownEntries.length > MAX_GUESTS) {
    cooldownEntries.sort((a, b) => a[1] - b[1]);
    for (const [id] of cooldownEntries.slice(0, cooldownEntries.length - MAX_GUESTS)) delete cooldowns[id];
  }
  const wishes = [...state.wishes, wish].slice(-MAX_WISHES);
  const withWish = { ...state, wishes, wishCooldowns: cooldowns };
  const teamed = addTeamScore(withWish, viewer.id, 20);
  const events = [{ type: 'wish_received', wish: publicWish(wish) }];
  if (teamed !== withWish) events.push(teamEvent(teamed));
  return { state: teamed, events };
}

export function publicWeddingState(state) {
  return {
    sessionId: state.sessionId,
    phase: state.phase,
    couple: {
      bride: publicParticipant(state.couple.bride),
      groom: publicParticipant(state.couple.groom),
      locked: state.couple.locked
    },
    claims: state.claims.map(publicClaim),
    wishes: state.wishes.map(publicWish),
    guestCount: state.guestIds.length,
    likes: { ...state.likes, progress: state.likes.total % state.likes.goal },
    social: { ...state.social },
    teams: publicTeams(state),
    kiss: { ...state.kiss },
    cheers: { ...state.cheers },
    petals: state.petals,
    bouquet: {
      open: state.bouquet.open,
      entrantCount: state.bouquet.entrants.length,
      winner: state.bouquet.winner ? publicViewer(state.bouquet.winner) : null
    },
    giftBook: Object.values(state.giftBook)
      .sort((a, b) => b.coins - a.coins)
      .slice(0, 5)
      .map((entry) => ({ viewer: publicViewer(entry.viewer), coins: entry.coins, count: entry.count })),
    updatedAt: state.updatedAt
  };
}

function publicTeams(state) {
  return {
    groom: { ...state.teams.groom },
    bride: { ...state.teams.bride }
  };
}

function addTeamScore(state, viewerId, points) {
  const team = Object.hasOwn(state.teamOf, viewerId) ? state.teamOf[viewerId] : null;
  if (!team || state.phase === 'ended') return state;
  return {
    ...state,
    teams: { ...state.teams, [team]: { ...state.teams[team], score: Math.min(MAX_LIKE_TOTAL, state.teams[team].score + points) } }
  };
}

function teamEvent(state) {
  return { type: 'teams_changed', teams: publicTeams(state) };
}

function onCooldown(state, key, now, ms) {
  const last = Object.hasOwn(state.chantCooldowns, key) ? state.chantCooldowns[key] : 0;
  return now - last < ms;
}

function withCooldown(state, key, now) {
  const chantCooldowns = { ...state.chantCooldowns, [key]: now };
  const keys = Object.keys(chantCooldowns);
  if (keys.length > MAX_GUESTS * 2) {
    for (const old of keys.slice(0, keys.length - MAX_GUESTS * 2)) delete chantCooldowns[old];
  }
  return { ...state, chantCooldowns };
}

function foldVi(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

function requireLobby(state) {
  if (state.phase !== 'lobby') throw new WeddingRuleError('lobby_closed', 'This action is only available in the lobby.');
}

function lockedError() {
  return new WeddingRuleError('couple_locked', 'The couple is already locked for this ceremony.');
}

function removeRoleClaims(state, role) {
  return { ...state, claims: state.claims.filter((claim) => claim.role !== role) };
}

function sanitizeViewer(viewer = {}) {
  const id = cleanName(viewer.id, 96) || 'viewer';
  const name = cleanName(viewer.name, 32) || 'Khách mời';
  const avatar = typeof viewer.avatar === 'string' && /^https?:\/\//i.test(viewer.avatar) ? viewer.avatar.slice(0, 512) : '';
  return { id, name, avatar };
}

function publicViewer(viewer) {
  return { name: viewer.name, avatar: viewer.avatar };
}

function publicParticipant(participant) {
  return participant ? { ...publicViewer(participant.viewer), source: participant.source } : null;
}

function publicClaim(claim) {
  return { id: claim.id, role: claim.role, viewer: publicViewer(claim.viewer), requestedAt: claim.requestedAt };
}

function publicWish(wish) {
  return { id: wish.id, viewer: publicViewer(wish.viewer), text: wish.text, at: wish.at };
}

function cleanName(value, max = 48) {
  return String(value || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, max);
}

function clampInteger(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.floor(number))) : min;
}
