# 🪷 Chùa Linh Ứng Online — TikTok Live RPC (9:16 Interactive Buddhist Sanctuary)

Hệ thống phát trực tiếp tương tác (**Interactive TikTok Live Stream & JSON-RPC 2.0**) chuẩn khung dọc **9:16 (`1080×1920`)** dành cho **OBS Studio / TikTok Live Studio**, chạy siêu nhẹ trên **Bun.js** và tích hợp giọng đọc AI tiếng Việt **ZeroTTS (`zeroweight-ai/ZeroTTS`)**.

Người xem trên TikTok Live tương tác trực tiếp qua **Bình luận (Comment)**, **Thả tim (Like)**, **Chia sẻ / Follow** và **Tặng quà (Gift)** để thực hiện các nghi thức tâm linh trên màn hình Chánh Điện **Đức Phật A Di Đà**:
- 🔥 **Thắp hương & Đảnh lễ Tam Bái (8-Frame Walking & Prostration)**: Nhân vật Phật tử mặc áo lam bước đi từng bước dọc thảm đỏ hoa sen lên trước Lư Hương Đỉnh Đồng, hạ gối quỳ và thực hiện 3 lạy Ngũ thể đầu địa hướng về Đức Phật A Di Đà.
- 🏮 **Thả Đèn Hoa Đăng / Sớ Cầu Nguyện**: Bình luận lời khấn sẽ bay lên thành Đèn Hoa Đăng kèm giọng đọc AI đọc lời cầu nguyện.
- 🎋 **Xin Xăm / Gieo Quẻ Đầu Năm (Đồng bộ Giọng đọc & Tờ Giải Quẻ)**: Tự động lắc ống xăm và mở tờ Giải Quẻ (Thượng Thượng Cát, Đại Cát, Thượng Cát...) đúng thời điểm giọng đọc bắt đầu vang lên.
- 🪵 **Gõ Mõ & 🔔 Thỉnh Đại Hồng Chung**: Thả tim gõ mõ tích điểm Công Đức, chia sẻ/follow thỉnh chuông đồng lan tỏa sóng âm vàng và kích hoạt làn sóng vái lạy của 40+ Phật tử trong Đạo Tràng.
- 📜 **Bảng Vàng Công Đức (`TẤM LÒNG THÀNH` & 6 Đệm Quỳ VIP)**: Vinh danh trực tiếp người xem thật có điểm Công Đức cao nhất trên 6 đệm quỳ gấm đỏ trước bàn thờ Phật.

---

## 📸 Hình Ảnh Demo Giao Diện

### 1. Màn hình Chánh Điện 9:16 & Bảng Điều Khiển Nhanh (`http://localhost:3000`)
![Màn hình Chánh Điện và Điều Khiển Nhanh](docs/demo/demo-main-stage.png)

### 2. Chế độ OBS Browser Source 9:16 Sạch (`http://localhost:3000/?obs=1`) & Gieo Quẻ Linh Xăm
| Màn hình OBS 9:16 (`?obs=1`) | Tờ Giải Quẻ Linh Xăm (Đồng bộ Giọng Đọc) |
| :---: | :---: |
| ![OBS 9:16 Mode](docs/demo/demo-obs-9x16.png) | ![Fortune Oracle Modal](docs/demo/demo-fortune-oracle.png) |

### 3. Bảng Điều Khiển JSON-RPC 2.0 & Admin (`http://localhost:3000/admin`)
![Admin JSON-RPC Panel](docs/demo/demo-admin-panel.png)

---

## ⚡ Kiến Trúc & Tối Ưu Hóa Hiệu Suất (Siêu Nhẹ CPU/GPU)

- **Runtime**: Chạy trực tiếp trên **Bun.js** (`~0.1% CPU` khi chờ).
- **Canvas Particle Engine (`public/js/particles.js`)**:
  - Khóa tốc độ vẽ ở **30 FPS** ổn định, tự động tạm dừng khi ẩn tab (`document.hidden`).
  - Pre-render toàn bộ Khói hương, Hạt vàng và Cánh hoa sen ra Offscreen Canvas 1 lần duy nhất lúc khởi tạo (`drawImage`), không gọi `createRadialGradient` hay `shadowBlur` trong vòng lặp frame.
- **Zero-Flicker 8-Frame Sprite Stack (`public/js/live.js` & `public/css/live.css`)**:
  - Nạp sẵn cả 8 khung hình chuyển động (`walk1`, `walk2`, `kneelDown`, `kneel`, `forehead`, `bowMid`, `prostrate`, `prostrateDeep`) vào GPU với bóng đổ (drop-shadow) đã bake sẵn trong PNG, loại bỏ hoàn toàn hiện tượng nháy/mất hình khi chuyển tư thế.
- **ZeroTTS Worker (`tts_worker.py`)**:
  - Tiến trình Python thường trú nạp sẵn model `zeroweight-ai/ZeroTTS` (`intra_op_num_threads=3`, `OMP_WAIT_POLICY=PASSIVE` → **`0.0% CPU` khi chờ**).
  - Tổng hợp nguyên câu trong 1 lần gọi (`single-pass synthesis`), khử DC offset, chuẩn hóa đỉnh âm lượng (`peak <= 0.90`) và làm mượt 2 đầu sóng âm (`cosine fade-in/out`) chống xước/rè tiếng.
- **Bộ Lọc Chặn Ký Tự Lạ & Spam (`server.js` & `tts_worker.py`)**:
  - Chặn tự động các ký tự Cuneiform (`𒐫`), chữ Ả Rập gây lag, Braille, Zalgo, bình luận chỉ toàn dấu chấm (`...`) hoặc từ ngữ phản cảm.
  - Tự động chuẩn hóa Unicode (`NFKC` → `NFC`) chuyển tên kiểu chữ toán học về tiếng Việt sạch trước khi đọc TTS.

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Nhanh

### 1. Yêu cầu hệ thống
- [Bun.js](https://bun.sh/) (`>= 1.1`)
- Python `3.10+` & [`uv`](https://github.com/astral-sh/uv) (để tạo môi trường `.venv` chạy `zerotts`)

### 2. Cài đặt thư viện
```bash
# Cài đặt dependencies cho Bun / Node
bun install

# Tạo môi trường Python .venv và cài đặt ZeroTTS
uv venv .venv
uv pip install --python .venv/bin/python zerotts pillow
```

### 3. Khởi chạy Server
```bash
bun start
# Hoặc chế độ tự động reload khi sửa code:
bun run dev
```

Mặc định server chạy tại cổng `3000`:
- **Màn hình Live + Điều khiển nhanh**: [http://localhost:3000](http://localhost:3000)
- **Màn hình OBS Browser Source (Sạch 9:16)**: [http://localhost:3000/?obs=1](http://localhost:3000/?obs=1) *(Đặt kích thước Browser Source trong OBS là `1080 × 1920`)*
- **Bảng điều khiển Admin & RPC**: [http://localhost:3000/admin](http://localhost:3000/admin)

---

## Windows Tauri app

The desktop app does not ask for an account or TikTok login. Start TikTok Live in TikTok Live Studio, then enter the public handle or Live URL in the admin panel. The app starts the local backend and ZeroTTS worker. OBS keeps using `http://localhost:3000/?obs=1`.

### Build the Windows app

Build the Windows installer from a native Windows terminal. WSL can cross-compile the Bun backend, but it cannot build the MSVC desktop app or the Windows ZeroTTS executable. The packaging script stops if run outside Windows. Tauri's Windows setup needs the Microsoft C++ Build Tools and WebView2. See the [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/) for the current installer options.

Install Bun, `uv`, and Python 3.11 on the build machine, then run:

```powershell
bun install
bun run tauri:dev
```

For development, create the ZeroTTS environment before starting the app:

```powershell
uv venv .venv --python 3.11
uv pip install --python .venv/Scripts/python.exe zerotts pillow
```

Build the installer with:

```powershell
bun run tauri:build
```

The build compiles the Bun backend, packages the ZeroTTS worker with PyInstaller, and runs the Tauri Windows build. Find the NSIS installer under `src-tauri/target/release/bundle/nsis/`. The installed app does not require Bun or Python. ZeroTTS downloads its model into the app's local data folder the first time it starts.

Open the app before OBS. Add `http://localhost:3000/?obs=1` as a Browser Source with a size of `1080 × 1920`. The Tauri window and OBS share the same local server, so TikTok events continue through the existing `/ws` connection.

The backend listens on loopback port `3000` without account authentication. The app reports a startup error if another process already uses that port. Closing the app asks the backend to disconnect TikTok and stop the ZeroTTS worker.

---

## 🎛️ TikTok Live Studio — một ứng dụng, ba phiên

`apps/live-studio/` gộp Chùa Linh Ứng Online, Virtual Wedding Live và **Lớp Học Chữ** vào **một** backend và **một** ứng dụng desktop. Mở `http://127.0.0.1:3200/studio` rồi chọn phiên. Dữ liệu của các phiên kia được giữ nguyên: lễ cưới và tiết học tạm dừng trong bộ nhớ, công đức và điểm lớp học lưu ra file. OBS chỉ cần một nguồn `http://127.0.0.1:3200/obs`, nguồn này tự chuyển sang sân khấu của phiên đang mở.

Studio giữ **một** kết nối TikTok chung cho cả ba phiên. Đổi phiên không làm rớt phòng live. Kết nối tự nối lại khi rớt mạng hoặc hết phiên live (15 giây, gấp đôi tới 2 phút), cho tới khi bấm Ngắt. Báo cáo người xem tăng/giảm theo từng phần của mọi phiên ở `/studio/bao-cao`.

```sh
bun run classroom:build     # build giao diện Lớp Học Chữ (React)
bun run studio:start        # chạy Studio từ mã nguồn (cổng 3200)
bun run studio:tauri:dev    # cửa sổ desktop khi phát triển
bun run studio:build        # đóng gói (Windows: NSIS kèm ZeroTTS; Linux: deb/rpm/AppImage)
```

Xem thêm `apps/live-studio/README.md`, `apps/classroom/README.md` và `packages/live-core/README.md`.

### Lõi dùng chung `packages/live-core`

Ba phiên dùng chung: kết nối TikTok (tự nối lại, nhận link chia sẻ `vt.tiktok.com`, giờ gửi bình luận chuẩn để xếp ai nhanh nhất), giọng đọc (Edge → Google → ZeroTTS offline), bộ lọc tên và bình luận, lưu trữ `bun:sqlite`, JSON-RPC qua `/ws`, và luật "chỉ một trang sân khấu đọc giọng" (mở thêm nguồn OBS không còn bị hai giọng đè nhau). Kiểm tra: `bun run test`.

---

## 🎮 Bảng Quy Tắc Tương Tác TikTok Live

| Sự kiện TikTok Live | Điều kiện / Từ khóa | Nghi thức trên Chánh Điện | Điểm Công Đức |
| :--- | :--- | :--- | :---: |
| **Thả tim (Like)** | Mỗi đợt thả tim | Gõ mõ gỗ tụng kinh + Làn sóng Phật tử vái lạy; tim của cả phòng đổ đầy **Đèn công đức** (mặc định 300 tim/ngọn) | `+1` / tim |
| **Follow** | Theo dõi kênh | Thỉnh Đại Hồng Chung ngân vang + Sóng âm vàng | `+10` |
| **Share** | Chia sẻ buổi live | Lan tỏa phước lành: mưa cánh sen + dải thông báo | `+5` |
| **Vào phòng** | Người xem mới vào live | Dải “… vừa bước vào chánh điện” (gộp nhiều người) | `+1` |
| **Bình luận Niệm Phật** | `nam mô`, `a di đà phật` | Mỗi bình luận góp 1 biến niệm chung; đủ 108 biến → **Viên mãn**, mưa hoa sen, cả đạo tràng lạy, đọc tên người niệm nhiều nhất | `+5` mỗi người khi viên mãn |
| **Bình luận Phóng sinh** | `phóng sinh`, `thả cá` | Cá chép bơi qua thảm đỏ mang tên + lời nguyện, đọc lời khấn | `+15` |
| **Bình luận Điểm danh** | `điểm danh` | Mỗi ngày một lần; ghi chuỗi ngày lễ Phật liên tiếp (giờ Việt Nam) | `+5` + 2/ngày liên tiếp (tối đa 30) |
| **Bình luận Thắp hương** | `thắp hương`, `dâng hương`, `bái phật`, `lạy phật` | Phật tử bước dọc thảm đỏ lên trước Lư Hương, quỳ đảnh lễ 3 lạy + Đọc tên khấn | `+15` |
| **Bình luận Cầu nguyện** | `cầu ...`, `nguyện ...`, `nam mô`, `a di đà phật`, `bình an`, `chúc ...` | Bước lên đảnh lễ + Thả Đèn Hoa Đăng mang lời khấn bay lên trời + Đọc lời cầu nguyện | `+10` |
| **Bình luận Xin xăm** | `xin xăm`, `gieo quẻ`, `rút quẻ`, `quẻ` (không còn bắt nhầm chữ “quen”, “que”) | Lắc ống xăm + Mở tờ Giải Quẻ đồng bộ đúng lúc giọng đọc bắt đầu vang lên | `+10` |
| **Tặng quà Nhỏ (1–4 xu)** | Hoa hồng (Rose), Heart Me... | Bước lên dâng Đài Hoa Sen Vàng + Thắp 3 nén hương + Đọc lời cảm tạ | `+20` / xu |
| **Tặng quà Vừa (5–99 xu)** | Đèn lưu ly, Mâm ngũ quả... | Dâng Đèn Lưu Ly / Mâm Ngũ Quả + Thỉnh Chuông + Đọc lời chúc phúc | `+30` / xu |
| **Tặng quà Lớn (≥ 100 xu)** | Quà ≥ 100 xu | **Đại Lễ Kim Long Chầu Phật**: Mưa hoa sen vàng, Hào quang vạn trượng, Chuông đồng ngân vang | `+50` / xu |

---

## 🔌 Giao Thức JSON-RPC 2.0 (`POST /rpc` & `ws://localhost:3000/ws`)

Bạn có thể gọi trực tiếp từ **TikFinity**, **Streamer.bot**, webhook hoặc `curl`:

```bash
# 1. Thắp hương cầu an
curl -X POST http://localhost:3000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "temple.burnIncense",
    "params": {
      "user": "Thí Chủ Minh Tâm",
      "count": 3,
      "wish": "Cầu gia đình bình an, vạn sự cát tường như ý"
    }
  }'

# 2. Xin xăm / Gieo quẻ đầu năm
curl -X POST http://localhost:3000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "temple.drawFortune",
    "params": {
      "user": "Thí Chủ Minh Tâm",
      "topic": "Cầu tài lộc và gia đạo bình an"
    }
  }'

# 3. Kết nối tới phòng TikTok Live (@username hoặc link vt.tiktok.com)
curl -X POST http://localhost:3000/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "live.connect",
    "params": {
      "username": "@zenfacts_vn"
    }
  }'
```

### Danh sách JSON-RPC Methods hỗ trợ:
- `temple.getState`: Lấy toàn bộ trạng thái Chánh Điện và Bảng Vàng Công Đức.
- `temple.burnIncense`: Thắp nhang & bước lên đảnh lễ (`user`, `avatar`, `count`, `wish`).
- `temple.sendPrayer`: Thả đèn hoa đăng cầu nguyện (`user`, `avatar`, `wish`).
- `temple.drawFortune`: Lắc ống xăm & gieo quẻ (`user`, `avatar`, `topic`).
- `temple.strikeWoodenFish`: Gõ mõ tích công đức (`user`, `count`).
- `temple.ringBell`: Thỉnh Đại Hồng Chung (`user`, `count`, `wish`).
- `temple.offerGift`: Dâng lễ vật (`user`, `giftType`: `lotus` | `fruit` | `lamp` | `dragon`, `coins`, `giftName`).
- `temple.grandCeremony`: Kích hoạt Đại Lễ Kim Long Chầu Phật (`user`, `coins`, `giftName`).
- `temple.updateSettings`: Cập nhật âm lượng nhạc nền (`musicVolume`), giọng đọc (`ttsVolume`), bật/tắt TTS.
- `temple.resetMerit`: Đặt lại bảng thống kê Công Đức.
- `temple.releaseFish`: Phóng sinh cá chép (`user`, `wish`).
- `temple.checkIn`: Điểm danh lễ Phật hằng ngày (`user`, `uniqueId`).
- `temple.shareBlessing`: Hiệu ứng chia sẻ buổi lễ (`user`).
- `temple.like`: Giả lập thả tim (`user`, `count`) — gõ mõ và góp vào đèn công đức.
- `temple.join`: Giả lập người xem vào phòng (`user`).
- `temple.setGoals`: Đặt mục tiêu cộng đồng (`chantGoal`, `lampGoal`).
- `live.connect` / `live.disconnect`: Kết nối / Ngắt kết nối phòng TikTok Live.

---

## 📁 Cấu Trúc Thư Mục

```text
├── server.js                  # Điểm chạy độc lập của Chùa Linh Ứng (gọi src/temple/server.js)
├── src/temple/server.js       # Backend chùa dạng factory: HTTP + WebSocket JSON-RPC 2.0 & TikTok Live Connector
├── apps/virtual-wedding/      # Ứng dụng lễ cưới độc lập (backend, giao diện, Tauri riêng)
├── apps/classroom/            # Lớp Học Chữ: trò chơi đố chữ (lõi chạy trên server, giao diện React)
├── apps/live-studio/          # Studio gộp ba phiên vào một binary
├── packages/live-core/        # Lõi dùng chung: TikTok, giọng đọc, lọc chữ, lưu trữ, RPC, báo cáo
├── design/source-art/         # Ảnh gốc độ phân giải cao (không đóng gói vào ứng dụng)
├── tts_worker.py              # Tiến trình Python ZeroTTS thường trú (48kHz, chống rè/clipping, lọc ký tự lạ)
├── data/
│   ├── merit-state.json       # Lưu trữ bền vững Bảng Vàng Công Đức của người xem thật
│   └── tts-cache/             # Bộ đệm file âm thanh WAV đã tổng hợp
├── public/
│   ├── index.html             # Giao diện Chánh Điện 9:16 + Bảng điều khiển nhanh
│   ├── admin.html             # Trang quản trị JSON-RPC 2.0 đầy đủ
│   ├── css/live.css           # Stylesheet tối ưu GPU Compositor
│   ├── js/
│   │   ├── live.js            # Điều phối 8-frame prostration, Đạo Tràng 40 chỗ ngồi & WebSocket RPC
│   │   ├── particles.js       # 30 FPS Offscreen-Sprite Particle Engine (Khói hương, Hoa sen, Sóng âm)
│   │   └── audio.js           # Quản lý nhạc nền auto-ducking, Pháp khí Web Audio & hàng đợi đồng bộ TTS
│   └── assets/                # Hình nền Đức Phật A Di Đà, 8 frame Phật tử áo lam & nhạc nền
└── docs/
    ├── demo/                  # Hình ảnh chụp màn hình demo thực tế
    └── superpowers/specs/     # Tài liệu thiết kế kỹ thuật (Design Spec)
```
