// Standalone entry for Chùa Linh Ứng Online. The temple backend itself lives in
// src/temple/server.js so the combined Live Studio binary can host it as a session.
const path = require('path');
const { createTempleServer } = require('./src/temple/server');

const temple = createTempleServer({ resourceDir: process.env.APP_RESOURCE_DIR || __dirname });
temple.listen().catch((err) => {
  console.error('[Temple] Không khởi động được máy chủ:', err.message);
  process.exit(1);
});

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  temple.shutdown().finally(() => process.exit(0));
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

module.exports = { temple, resourceDir: path.resolve(__dirname) };
