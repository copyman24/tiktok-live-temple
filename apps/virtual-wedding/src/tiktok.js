import { ControlEvent, TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';

const MAX_GIFT_GROUPS = 500;

export function createTikTokAdapter({ onInteraction, onStatus }) {
  let connection = null;
  let generation = 0;
  let status = { state: 'offline', username: '', viewerCount: 0, roomId: null, error: null };
  const giftGroups = new Map();

  const updateStatus = (next) => {
    status = { ...status, ...next };
    onStatus({ ...status });
  };

  async function disconnect() {
    generation += 1;
    const active = connection;
    connection = null;
    giftGroups.clear();
    if (active) {
      try { await active.disconnect(); } catch {}
    }
    updateStatus({ state: 'offline', username: '', viewerCount: 0, roomId: null, error: null });
    return { ...status };
  }

  async function connect(rawUsername) {
    const username = normalizeUsername(rawUsername);
    await disconnect();
    const ownGeneration = generation;
    const live = new TikTokLiveConnection(username, {
      processInitialData: true,
      fetchRoomInfoOnConnect: false,
      enableExtendedGiftInfo: false
    });
    connection = live;
    updateStatus({ state: 'connecting', username, viewerCount: 0, roomId: null, error: null });

    live.on(ControlEvent.CONNECTED, (roomState) => {
      if (ownGeneration !== generation) return;
      updateStatus({ state: 'live', roomId: String(roomState?.roomId || live.roomId || ''), error: null });
    });
    live.on(ControlEvent.DISCONNECTED, () => {
      if (ownGeneration !== generation) return;
      updateStatus({ state: 'offline', viewerCount: 0 });
    });
    live.on(ControlEvent.ERROR, (error) => {
      if (ownGeneration !== generation) return;
      updateStatus({
        state: status.state === 'connecting' ? 'error' : status.state,
        error: String(error?.message || error).slice(0, 240)
      });
    });

    live.on(WebcastEvent.ROOM_USER, (data) => {
      if (ownGeneration !== generation) return;
      const viewerCount = toBoundedInteger(data?.total ?? data?.viewerCount, 0, 10_000_000);
      updateStatus({ viewerCount });
    });
    live.on(WebcastEvent.CHAT, (data) => {
      if (ownGeneration !== generation) return;
      onInteraction({ kind: 'comment', viewer: viewerFrom(data), text: data?.content || data?.comment || '' });
    });
    live.on(WebcastEvent.LIKE, (data) => {
      if (ownGeneration !== generation) return;
      onInteraction({ kind: 'like', viewer: viewerFrom(data), count: toBoundedInteger(data?.count ?? data?.likeCount, 1, 100) });
    });
    live.on(WebcastEvent.FOLLOW, (data) => emitSocial('follow', data));
    live.on(WebcastEvent.SHARE, (data) => emitSocial('share', data));
    live.on(WebcastEvent.MEMBER, (data) => emitSocial('member', data));
    live.on(WebcastEvent.GIFT, (data) => emitGift(data));

    function emitSocial(kind, data) {
      if (ownGeneration !== generation) return;
      onInteraction({ kind, viewer: viewerFrom(data) });
    }

    function emitGift(data) {
      if (ownGeneration !== generation) return;
      const gift = data?.gift || data?.giftDetails || {};
      const viewer = viewerFrom(data);
      const giftId = String(data?.giftId || gift?.id || gift?.name || 'gift');
      const groupId = String(data?.groupId || `${viewer.id}:${giftId}`);
      const repeatCount = toBoundedInteger(data?.repeatCount ?? data?.comboCount, 1, 1000);
      const previous = giftGroups.get(groupId) || 0;
      if (repeatCount <= previous) {
        if (data?.repeatEnd) giftGroups.delete(groupId);
        return;
      }
      const delta = repeatCount - previous;
      if (data?.repeatEnd) giftGroups.delete(groupId);
      else rememberGiftGroup(groupId, repeatCount);
      const diamondCount = toBoundedInteger(gift?.diamondCount ?? data?.diamondCount, 1, 1_000_000);
      onInteraction({
        kind: 'gift',
        viewer,
        name: String(gift?.name || data?.giftName || gift?.describe || 'Hoa chúc mừng').slice(0, 48),
        count: delta,
        coins: diamondCount * delta
      });
    }

    try {
      const room = await live.connect();
      if (ownGeneration === generation) {
        updateStatus({ state: 'live', roomId: String(room?.roomId || live.roomId || ''), error: null });
      }
      return { ...status };
    } catch (error) {
      const message = String(error?.message || error).slice(0, 240);
      if (ownGeneration === generation) {
        try { await live.disconnect(); } catch {}
        connection = null;
        updateStatus({ state: 'error', error: message });
      }
      throw new Error(message);
    }
  }

  return {
    connect,
    disconnect,
    getStatus: () => ({ ...status })
  };

  function rememberGiftGroup(groupId, repeatCount) {
    giftGroups.set(groupId, repeatCount);
    if (giftGroups.size > MAX_GIFT_GROUPS) giftGroups.delete(giftGroups.keys().next().value);
  }
}

export function normalizeUsername(raw) {
  const input = String(raw || '').trim();
  const profileUrl = input.match(/tiktok\.com\/@([A-Za-z0-9._]+)/i);
  const username = (profileUrl?.[1] || input.replace(/^@/, '').split(/[/?#]/, 1)[0]);
  if (!/^[A-Za-z0-9._]{2,24}$/.test(username)) {
    throw new Error('Enter a TikTok username, such as @wedding_live.');
  }
  return username;
}

function viewerFrom(data) {
  const user = data?.user || data || {};
  const id = String(user?.uniqueId || user?.displayId || user?.userId || data?.uniqueId || user?.nickname || 'viewer').slice(0, 96);
  const name = String(user?.nickname || user?.uniqueId || data?.nickname || 'Khách mời').slice(0, 32);
  const avatar = user?.profilePictureUrl
    || user?.avatarLarge?.urlList?.[0]
    || user?.avatarThumb?.urlList?.[0]
    || user?.avatarMedium?.urlList?.[0]
    || data?.profilePictureUrl
    || '';
  return { id, name, avatar: /^https?:\/\//i.test(avatar) ? String(avatar).slice(0, 512) : '' };
}

function toBoundedInteger(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.floor(number))) : min;
}
