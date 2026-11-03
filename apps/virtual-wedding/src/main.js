import { createWeddingServer } from './server.js';

const application = createWeddingServer();
const address = await application.listen();
console.log(`Virtual Wedding Live backend listening at http://${address.host}:${address.port}`);

let stopping = false;
async function stop(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`Virtual Wedding Live backend stopping (${signal})`);
  await application.close();
}

process.once('SIGINT', () => void stop('SIGINT'));
process.once('SIGTERM', () => void stop('SIGTERM'));
