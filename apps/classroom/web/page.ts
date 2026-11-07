// Which page is open?
//   /?view=stage  -> the page for TikTok LIVE Studio / OBS (1080x1920); the ONLY page that speaks
//   /             -> operator dashboard, silent, open as many tabs as you like
import { rpc } from './rpc';

const params = new URLSearchParams(window.location.search);
export const IS_STAGE = params.get('view') === 'stage';
/** ?view=stage&mute=1: watch the stage without sound (for testing) */
export const MUTED = params.get('mute') === '1';

// Stage design size. Everything is drawn on a 1080x1920 frame and scaled to fit.
export const STAGE_W = 1080;
export const STAGE_H = 1920;

/**
 * Operator commands, kept in the original app's (action, text) shape so GameControls is unchanged:
 * 'speak' | 'setRate' | 'setName' | 'reset' | 'custom' with text 'skip' | 'newRound' | 'ban' |
 * 'goodbye' | 'birthday:<name>' | 'recess:<game>' | 'show:<kind>'.
 */
export async function sendControl(action: string, text = ''): Promise<{ success: boolean; error?: string; pages?: number }> {
  try {
    if (action === 'setName') {
      await rpc('classroom.setName', { name: text });
    } else if (action === 'setRate') {
      await rpc('classroom.setRate', { rate: Number(text) || 1 });
    } else if (action === 'custom') {
      const [cmd, ...rest] = text.split(':');
      const arg = rest.join(':');
      await rpc('classroom.control', { action: cmd, text: arg });
    } else {
      const r = await rpc<{ stages: number }>('classroom.control', { action, text });
      return { success: true, pages: r?.stages };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Fake viewer events for rehearsal (same path on the server as real TikTok events). */
export async function emitTest(type: string, data: Record<string, unknown>) {
  await rpc('classroom.simulate', { type, data });
}
