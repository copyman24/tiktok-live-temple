const MAX_CLAIMS = 12;
const MAX_WISHES = 12;
const MAX_GUESTS = 500;
const MAX_LIKE_TOTAL = 1_000_000_000;
const WISH_COOLDOWN_MS = 12_000;
const PHASES = ['lobby', 'entrance', 'vows', 'rings', 'celebration', 'ended'];

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
    events.push({ type: 'phase_changed', phase: nextPhase });
  } else if (input.type === 'wedding.end') {
    if (state.phase === 'ended') return { state, events };
    next = { ...state, phase: 'ended' };
    events.push({ type: 'phase_changed', phase: 'ended' });
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
    return {
      state: { ...state, likes: { ...state.likes, total } },
      events: [{ type: 'likes_changed', total, progress: total % state.likes.goal, goal: state.likes.goal }]
    };
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
    return {
      state: { ...state, social: { ...state.social, gifts: Math.min(MAX_LIKE_TOTAL, state.social.gifts + count) } },
      events: [{
        type: 'gift_celebration',
        viewer: publicViewer(viewer),
        name: cleanName(interaction.name, 48),
        count
      }]
    };
  }

  return { state, events: [] };
}

function reduceComment(state, viewer, text, now) {
  const comment = String(text || '').trim();
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
  return {
    state: { ...state, wishes, wishCooldowns: cooldowns },
    events: [{ type: 'wish_received', wish: publicWish(wish) }]
  };
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
    updatedAt: state.updatedAt
  };
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
