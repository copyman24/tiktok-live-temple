// Standalone Lớp Học Chữ: bun run classroom:start  →  http://localhost:3006
import { createClassroomServer } from './server';

const classroom = createClassroomServer();
await classroom.listen();

let closing = false;
const shutdown = async () => {
  if (closing) return;
  closing = true;
  await classroom.close().catch((error) => console.warn(`[Lớp học] Lỗi khi tắt: ${error.message}`));
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
