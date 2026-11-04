import { createStudioServer } from './studio.js';

const studio = createStudioServer();
const address = await studio.listen();
console.log(`TikTok Live Studio listening at http://${address.host}:${address.port}/studio`);
console.log(`OBS browser source (follows the active session): http://${address.host}:${address.port}/obs`);

let stopping = false;
async function stop(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`TikTok Live Studio stopping (${signal})`);
  await studio.close();
  process.exit(0);
}
process.once('SIGINT', () => void stop('SIGINT'));
// When launched by the desktop shell, exit if the shell dies without a graceful shutdown request.
if (process.env.STUDIO_SHUTDOWN_TOKEN) {
  const parentPid = process.ppid;
  setInterval(() => {
    if (process.ppid !== parentPid) void stop('parent-exit');
  }, 2000).unref();
}
process.once('SIGTERM', () => void stop('SIGTERM'));
