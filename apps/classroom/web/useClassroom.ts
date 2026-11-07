// Page state. The lesson runs on the server (src/host.ts); every page draws the latest view.
// The stage page that the server picks as speaker also plays the teacher's voice and the sound
// effects, and reports when each line starts and ends so the server can pace the lesson.
import { useEffect, useState } from 'react';
import { createVoicePlayer } from '../../../packages/live-core/browser/voice.js';
import type { GiftShown, StageView } from '../src/host';
import { GAME } from '../src/game/config';
import { IS_STAGE, MUTED } from './page';
import { notify, on, rpc } from './rpc';
import { sfx } from './sfx';

export type { StageView } from '../src/host';
export type LiveStatus = { state: 'offline' | 'connecting' | 'live' | 'reconnecting' | 'error'; username: string; roomId: string | null; viewerCount: number; totalLikes: number; error: string | null; retryInMs: number | null };
export type GiftEvent = GiftShown;

type ServerState = { view: StageView; lastGift: GiftShown | null; status: LiveStatus; channelName: string; rate: number };

/** The teacher's voice. Only the speaking stage enables it. */
export const voice = createVoicePlayer({
  urlOf: (part: { who: string; hype: boolean; text: string }, rate: number) =>
    `/api/tts?rate=${rate}${part.hype ? '&hype=1' : ''}${part.who === 'E' ? '&v=en' : '&v=f'}&text=${encodeURIComponent(part.text)}`,
  defaultWho: 'F',
});
voice.enabled = false;

export function useClassroom() {
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [view, setView] = useState<StageView | null>(null);
  const [lastGift, setLastGift] = useState<GiftShown | null>(null);
  const [stageCount, setStageCount] = useState(0);
  const [channelName, setChannelName] = useState(GAME.defaultChannelName);
  const [speaker, setSpeaker] = useState(false);

  useEffect(() => {
    let prev: StageView | null = null;
    let latest: StageView | null = null;
    let isSpeaker = false;
    let myId: string | null = null;
    if (MUTED) {
      voice.volume = 0;
      sfx.volume = 0;
    }
    if (IS_STAGE) sfx.loadFiles();

    const apply = (s: Partial<ServerState>) => {
      if (s.status) setStatus(s.status);
      if (s.channelName) setChannelName(s.channelName);
      if (typeof s.rate === 'number') voice.rate = s.rate;
      if (s.lastGift !== undefined) setLastGift(s.lastGift);
      if (s.view) {
        if (IS_STAGE && isSpeaker && prev) sfx.watch(prev, s.view);
        prev = s.view;
        latest = s.view;
        setView(s.view);
      }
    };

    const offs = [
      on('$open', () => { rpc<ServerState>('classroom.state').then(apply).catch(() => {}); }),
      on('classroom.state', apply),
      on('classroom.view', (p: { view: StageView; lastGift: GiftShown | null }) => apply(p)),
      on('classroom.settings', (p: { channelName: string; rate: number }) => apply(p)),
      on('live.status', (p: LiveStatus) => setStatus(p)),
      on('stage.hello', (p: { clientId: string }) => { myId = p.clientId; }),
      on('stage.speaker', (p: { speakerId: string | null; stages: number }) => {
        setStageCount(p.stages);
        if (!IS_STAGE) return;
        const mine = !!myId && p.speakerId === myId;
        if (!mine && isSpeaker) voice.stop();
        isSpeaker = mine;
        voice.enabled = mine;
        setSpeaker(mine);
        if (!mine) sfx.music(null, 0);
      }),
      on('voice.say', (line: { id: string; text: string; priority: boolean }) => {
        voice.say(line.text, {
          priority: line.priority,
          start: () => notify('voice.started', { id: line.id }),
          done: () => notify('voice.done', { id: line.id }),
        });
      }),
      on('voice.stop', () => voice.stop()),
    ];

    // Sound effects follow the clock between server views (ticking, music intensity).
    const timer = IS_STAGE
      ? setInterval(() => {
          if (!isSpeaker || !latest) return;
          const now = Date.now();
          sfx.clock(latest.audio.clockPhase, latest.boardShown, latest.endsAt, now);
          sfx.music(latest.audio.musicKind, latest.audio.musicLevel);
        }, 200)
      : undefined;

    return () => {
      offs.forEach((off) => off());
      clearInterval(timer);
    };
  }, []);

  return { status, view, lastGift, stageCount, channelName, speaker };
}

export type GameState = ReturnType<typeof useClassroom>;
