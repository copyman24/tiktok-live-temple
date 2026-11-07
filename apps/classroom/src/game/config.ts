// =====================================================
//  CẤU HÌNH LỚP HỌC CHỮ: số liệu. Câu cô đọc nằm ở loi-thoai.ts, câu hỏi ở cau-hoi/*.txt
// =====================================================

export const GAME = {
  // Tên lớp mặc định (hiện trên bảng hiệu). Chủ kênh đổi ở ô "Tên lớp" trang điều khiển.
  defaultChannelName: 'Lớp Học Chữ',

  // ---------- Một tiết học ----------
  questionsPerRound: 20,
  // 10 câu chữ (4 dễ, 2 vừa, 4 khó) + 4 câu toán nhẩm khó dần ở câu 5, 10, 15, 19
  // + 2 câu tiếng Anh ở câu 3, 12 + 2 câu đố mẹo ở câu 7, 13 + 2 câu lịch sử ở câu 9, 17 (chủ kênh chốt 2026-11-04).
  // Câu 20 là câu hỏi vàng nhân đôi điểm.
  // bản riêng (2026-11-04): thêm 5 câu đuổi hình bắt chữ (emoji) -> còn 5 câu chữ thường
  // 2026-11-05: đố mẹo thành tiết mục giữa tiết, 2 câu liền ở câu 11, 12 (ngay sau điểm danh câu 10), cô dẫn hài trước câu 11;
  // vẫn là câu hỏi bình thường (tính điểm, phạt đứng), không phải giờ nghỉ.
  // Đuổi hình ở câu 2, 6, 9, 14, 18; tiếng Anh 3, 13; lịch sử 8, 17
  roundPlan: [
    'easy', 'dh', 'anh', 'easy', 'math1',
    'dh', 'medium', 'su', 'dh', 'math2',
    'meo', 'meo', 'anh', 'dh', 'math3',
    'hard', 'su', 'dh', 'math4', 'hard',
  ] as const,
  introSec: 5, // cô giới thiệu đầu tiết (giảm từ 8, chế độ nhanh 2026-11-04)
  // ---------- Chế độ nhanh (chủ kênh duyệt 2026-11-04): khách vào chơi giờ nghỉ, cần câu nối câu ----------
  // true: cô đọc ngắn ("Câu 3. Một món ăn. <gợi ý>"), không hô bắt đầu; đọc XONG là hiện bảng chữ, nhận đáp án, chạy giờ.
  // false: như cũ (đọc đề xong, hô bắt đầu mới hiện chữ, đồng hồ dừng lúc cô đọc)
  quickRead: true,
  closeAfterTopN: 5, // đủ chừng này bạn đúng (top có điểm cao) thì chốt câu sau closeAfterTopSec giây. 0 = tắt
  closeAfterTopSec: 3,
  earlySendGraceMs: 500, // đáp án gửi sớm hơn lúc bảng hiện quá chừng này ms (theo giờ gửi TikTok) thì không tính
  dhFirstLetters: true, // đuổi hình bắt chữ: hiện sẵn chữ cái đầu mỗi chữ trong ô đáp án (hình emoji đôi khi trừu tượng)
  praiseShort: true, // điểm danh giữa tiết chỉ 1 câu đọc top 3
  questionSec: 20, // thời gian trả lời (chủ kênh chốt 20 giây, 2026-11-04)
  endAfterFirstSec: 0, // 0 = luôn đủ giờ cho cả lớp. Đặt vd 10: có người đúng thì 10 giây sau chốt luôn (hợp lúc phòng vắng)
  // Tự đổi nhịp: dưới 5 bạn đang chơi (bình luận trong 2 phút) thì có người đúng là 8 giây sau chốt câu
  smallRoomPlayers: 5,
  smallRoomEndAfterSec: 8,
  activeWindowMs: 120_000,
  // Lớp vắng: 5 phút không ai bình luận / tặng quà / thả tim thì tiết sau là "ôn bài" (hỏi lại câu cũ, để dành câu mới).
  // Có bạn vào lại thì từ câu kế tiếp đổi sang câu mới.
  emptyRoomMs: 5 * 60_000,
  timeGreetEvery: 4, // ngoài lúc đổi buổi, cứ chừng này tiết cô chào theo giờ một lần
  // Lấp khoảng im lặng lúc chờ trả lời câu chữ: cứ chừng này cô làm 1 việc, xoay vòng
  // rủ "ai yêu cô gõ số 1" -> kể chuyện vui / mẹo tiếng Anh -> hỏi bình chọn (miền Bắc gõ B...) -> kể chuyện
  engageEveryMs: 180_000, // giảm từ 100 giây (chủ kênh thấy cô nói quá nhiều, 2026-11-04)
  engageOrder: ['love', 'story', 'poll', 'sleep'] as const, // 'sleep': gọi 1 bạn ngủ gật dậy (không ai ngủ thì kể chuyện)
  loveWindowMs: 15_000, // đếm ai gõ trong chừng này rồi cảm ơn / đọc kết quả

  // ---------- Học sinh tương tác trên màn hình ----------
  walkMs: 6000, // tặng hoa: bạn nhỏ đi lên bục đưa hoa cho cô rồi về chỗ
  bubbleMs: 5000, // bong bóng chat trên đầu (không hiện câu trả lời, không hiện câu có từ cấm)
  sleepAfterMs: 5 * 60_000, // ngồi im chừng này thì ngủ gật 💤, thỉnh thoảng cô gọi dậy
  // gõ sai: lên đứng cạnh cô (học sinh cá biệt) chừng này câu rồi về chỗ; tối đa standMax bạn cùng lúc, ai sai trước lên trước
  standQuestions: 3,
  standMax: 6, // 6 chỗ đứng trên sàn giữa cô và dãy bàn đầu
  bonusSec: 10, // hết giờ chưa ai đúng: mở 1 chữ, thêm chừng này giây
  praiseEvery: 10, // cứ chừng này câu cô dừng lại điểm danh top 3, tặng quà (chế độ nhanh: chỉ sau câu 10; trước là 5)
  praiseSec: 3, // đọc xong còn dừng chừng này giây để các bạn nhỏ chào cô, thả tim rồi mới ra câu tiếp
  giftChance: 0.4, // tỉ lệ cô thưởng quà cho bạn đúng đầu tiên / đạt mốc chuỗi câu liền
  deskGifts: 4, // mỗi bàn bày tối đa chừng này món quà (mới nhất)
  warnLeftSec: 5, // còn chừng này giây thì cô nhắc "chuẩn bị hết giờ" (đồng hồ không dừng)
  revealSec: 5,
  resultsSec: 8,
  superFastSec: 4, // đúng trong 4 giây đầu: cô nghi "quay cóp"

  // ---------- Điểm ----------
  // top 5 nhanh nhất: 10, 7, 5, 3, 3; chậm hơn top 5 đều +1 (chủ kênh chốt 2026-11-04). Câu hỏi vàng x2
  rankPoints: [10, 7, 5, 3, 3],
  latePoints: 1, // đúng sau top 5 (thường là chép đáp án trên khung chat)
  fastestShown: 5, // bảng Top nhanh nhất lúc hiện đáp án
  // khen + thưởng khi đúng liền đủ 5, 12, 17 câu (chủ kênh chốt 2026-11-04, trước cứ 3 câu là khen, dễ quá)
  streakMilestones: [5, 12, 17],
  streakBonus: 5, // thưởng thêm
  streakNamesRead: 3, // nhiều bạn cùng đủ chuỗi 1 lúc: cô gộp 1 câu, đọc tối đa chừng này tên (còn lại "và N bạn nữa")
  requireDiacritics: true, // phải gõ đủ dấu mới tính đúng ("phan" không ăn "phấn"); dấu kiểu cũ/mới đều được
  keepHiddenLetters: 2, // gợi ý không bao giờ mở quá (số chữ - 2)
  roastChance: 0.2, // tỉ lệ cô cà khịa 1 bạn trả lời sai lúc hiện đáp án (giảm từ 0.6, 2026-11-04)
  monitorEveryQ: 4, // lớp trưởng đổi người: cách ít nhất chừng này câu cô mới báo lại

  // ---------- Giờ ra chơi (sau mỗi tiết) ----------
  recessPlaySec: { rps: 15, callup: 12, pick: 15, roll: 10, heart: 20 }, // chế độ nhanh: ra chơi + bình chọn ~35 giây
  recessResultSec: 5,
  recessBoardSec: 5, // bảng "học sinh giỏi hôm nay"
  rpsPoints: 2, // oẳn tù tì thắng cô
  callUpPoints: 5, // kiểm tra miệng trả lời đúng
  rollPoints: 3, // điểm danh nhanh
  rollWinners: 10,
  heartTarget: 300, // thử thách thả tim trong 30 giây
  heartBoost: 5, // mỗi tim thật tính thành 5 tim (300 tim chỉ cần 60 tim thật) cho cả lớp dễ thắng; cũng áp cho vỗ tay

  // ---------- Sau giờ ra chơi: cả lớp chọn chủ đề tiết sau ----------
  voteSec: 10, // gõ 1 hoặc 2
  voteTopicQuestions: 5, // chủ đề thắng chiếm chừng này câu chữ thường của tiết sau
  // bản riêng (2026-11-04): khán giả Gen Z + người đi làm, nên phần lớn câu chữ thường lấy từ các bộ này
  hotTopics: ['16-gen-z', '32-cong-so', '33-gen-z-trend', '34-an-uong-tinh-yeu'],
  hotShare: 0.5, // tỉ lệ câu chữ thường bốc từ hotTopics (giảm từ 0.75, 2026-11-05: trộn thêm chủ đề đời thường gần gũi); chủ đề cả lớp bình chọn vẫn ưu tiên trước

  // ---------- Chia tổ (bản riêng cô Ngân) ----------
  // Trước mỗi tiết có chừng này giây chọn tổ (gõ "tổ 1".."tổ 4", "t2", "3", "tổ ba"). Ai chưa chọn thì máy xếp vào tổ ít người nhất.
  // Bạn vào lớp giữa tiết cũng được xếp ngay. 0 = tắt phần chọn tổ (test cũ dùng).
  teamPickSec: 20,
  teamPickEvery: 4, // chỉ tiết 1, 5, 9... mới có pha chọn tổ (giữ tổ qua các tiết, bạn mới vào tự xếp)
  teamCount: 4,
  teamRemindLeftSec: 15, // còn chừng này giây thì cô nhắc chọn tổ

  // ---------- Trang phục cô Ngân (bản riêng 2026-11-04) ----------
  // hết 20 câu (tổng kết tiết) thì cô thay 1 bộ khác, bốc ngẫu nhiên; ảnh ở public/assets/nv/co-ngan/<bộ>/
  outfits: ['trang', 'so-mi', 'ao-dai-xanh-ngoc'] as const,

  // ---------- 2 game lớn (bản riêng 2026-11-04): Đường lên đỉnh Everest, Rung Chuông Đồng ----------
  // cứ chừng này tiết thì thay giờ ra chơi bằng 1 game (xen kẽ 2 game), xong game thì bình chọn chủ đề như thường.
  // Gõ A/B/C/D; ai đúng trong giờ đều được điểm, không xét nhanh chậm. Câu ở src/game/cau-hoi-show/.
  showEvery: 4, // chế độ nhanh: 4 tiết mới có 1 game lớn (trước 2)
  show: {
    gatherSec: 30, // tập hợp / mời vào sàn
    revealSec: 5, // hiện đáp án mỗi câu
    tieSec: 10, // câu phụ phân định khi top đầu đồng điểm
    honorSec: 30, // vinh danh
    topShown: 10,
    everest: {
      warm: { n: 4, sec: 8, pts: 10 }, // Bước chân đầu tiên
      code: { hintSec: 15, pts: [30, 20, 10], rescueSec: 10, rescuePts: 5 }, // Mật mã trạm: 3 gợi ý + 10 giây cứu trợ
      storm: { n: 4, sec: 8, pts: 15 }, // Bão tốc độ
      peak: { n: 3, stakeSec: 8, sec: 12, stakes: [10, 20] }, // Chạm đỉnh: chọn mức điểm trước khi xem câu
    },
    chuong: {
      warm: { n: 4, sec: 8, pts: 10 }, // Làm nóng
      hold: { n: 6, sec: 10, pts: 10 }, // Trụ vững
      rescue: { sec: 10 }, // Cứu trợ cả phòng: đúng thì có 1 phiếu gợi ý
      final: { n: 3, sec: 15, pts: 20 }, // Thử thách cuối: gõ "gợi ý" dùng phiếu, bỏ 2 đáp án sai cho cả phòng
      bell: { sec: 15, pts: 30 }, // Câu Chuông Đồng
    },
  },

  // ---------- Chuyên cần, sinh nhật ----------
  attendMilestones: [3, 5, 7, 10, 14, 21, 30], // đi học liền đủ chừng này ngày thì cô khen to + tặng quà
  birthdayCooldownMs: 60_000, // 2 lần chúc sinh nhật cách nhau ít nhất 1 phút (chống spam)
  birthdayBannerSec: 10,
  goodbyeBannerSec: 25, // nút "Chào tạm biệt": biểu ngữ tan lớp hiện chừng này giây

  championsKept: 50, // nhớ lớp trưởng của chừng này tiết gần nhất (đếm ai làm lớp trưởng nhiều lần)

  seatActiveMs: 10 * 60_000, // cùng điểm: bạn im quá chừng này (thường đã rời live) nhường ghế cho bạn đang tương tác

  // ---------- Học bạ cả đời: điểm cộng dồn mãi mãi -> lên lớp ----------
  // điểm cần để lên lớp 1, 2, ... 12, rồi tốt nghiệp (13). Người chơi giỏi được khoảng 150-250 điểm mỗi tiết.
  gradePoints: [0, 200, 500, 1000, 1700, 2600, 3700, 5000, 6500, 8200, 10000, 12000, 15000],
  // bảng Top tương tác hôm nay: 1 bình luận = 1 (mỗi bạn tối đa 1 lần / 2 giây), 1 món quà = 10. Không hiện cách tính trên màn hình.
  talkGapMs: 2000,
  talkPerGift: 10,
  // chịu tải: bạn im quá chừng này thì xoá khỏi lớp lúc sang tiết mới (điểm đã lưu server)
  forgetAfterMs: 2 * 60 * 60_000,

  // ---------- Lớp ----------
  seats: 30, // 4 dãy bàn dài trên cùng (7, 7, 8, 8 bạn); dãy cuối nằm dưới giao diện TikTok nên để trống
  rowSeats: [7, 7, 8, 8], // số bạn mỗi dãy, cộng lại = seats (chủ kênh chốt 2026-11-04: bàn dài, các bạn nhỏ lại)
  // hết ghế: không vẽ đám đông đứng 2 bên cửa nữa (chủ kênh bỏ 2026-11-04), các bạn vẫn chơi, tính điểm,
  // hiện ở bảng "Sĩ số · Đang chờ vào lớp"
  standing: 0,
  joinKeywords: ['vaolop'],

  // ---------- Quà: chia bậc bó hoa + quỹ hoa của cô (bản riêng, chủ kênh chốt 2026-11-04) ----------
  // bậc theo số xu của món quà (kim cương x số lượng). Mỗi xu = 1 bông vào quỹ hoa.
  // Bảng "🎁 Gửi tặng cô Ngân" (chủ kênh 2026-11-05): vài món quà TikTok hay gặp, viết kiểu gửi tặng, KHÔNG giục, KHÔNG hứa
  // lợi thế (TikTok cấm khuyến khích tặng quà, nhất là với trẻ em). match = tên quà TikTok (không phân biệt hoa thường),
  // say = tên món cô đọc ("... tặng cô chiếc bánh donut"), icon = món bạn nhỏ cầm lên bục và bày sau lưng cô,
  // thanks = nhóm lời đáp riêng của món trong loi-thoai.ts (bắn tim: "Uii bắn trúng tim cô rồi...").
  giftMenu: [
    { match: ['rose'], icon: '🌹', label: 'Hoa hồng', say: 'bông hồng', caption: 'Tặng cô hoa', thanks: 'thankRose' as const },
    { match: ['finger heart'], icon: '🫰', label: 'Bắn tim', say: 'cái bắn tim', caption: 'Bắn tim cho cô', thanks: 'thankHeart' as const },
    { match: ['doughnut', 'donut'], icon: '🍩', label: 'Bánh donut', say: 'chiếc bánh donut', caption: 'Mời cô ăn bánh', thanks: 'thankDonut' as const },
  ],
  giftTiers: [
    { min: 1, name: 'một bông hoa', label: '🌹 1 bông hoa', icon: '🌹', size: 1 },
    { min: 10, name: 'một bó hoa nhỏ', label: '💐 Bó hoa nhỏ', icon: '💐', size: 1.4 },
    { min: 99, name: 'một bó hoa thật to', label: '💐 Bó hoa lớn', icon: '💐', size: 2 },
    { min: 500, name: 'cả một xe hoa', label: '🌸 Xe hoa', icon: '🌸', size: 2.6 },
  ],
  // mục tiêu quỹ hoa trong ngày (số bông), đạt mốc nào thì cô cảm ơn cả lớp + pháo hoa, rồi tới mốc kế
  flowerGoals: [50, 100, 200, 500, 1000, 2000, 5000, 10000],
  giftPileMax: 18, // bàn quà sau lưng cô bày tối đa chừng này món (mới nhất)

  // ---------- Quà / tim ----------
  // 0 = quà KHÔNG cho lợi thế trong game (chủ kênh chốt 2026-11-04): TikTok cấm khuyến khích trẻ em tặng quà,
  // quà chỉ để cảm ơn. Đặt vd 30 thì quà từ 30 xu lúc chưa ai đúng sẽ mở thêm 1 chữ như trước.
  hintGiftCoins: 0,
  likesPerClap: 300, // đủ 300 tim: cả lớp vỗ tay
  clapSec: 5,
  giftThanksCooldownMs: 30_000,
  bigGiftCoins: 99,

  // ---------- Nói chuyện ----------
  greetEveryMs: 8000,
  namesPerGreeting: 3,
  shareReminderEveryMs: 6 * 60_000,
  idleAfterSec: 75, // không ai comment chừng này giây thì cô nhắc
  // Nhịp giọng: câu chính (đề, đáp án, tổng kết) đọc theo chương trình, đồng hồ dừng trong lúc cô đọc.
  // Câu nói thêm (chào, cảm ơn, cà khịa) chỉ nói lúc đang chờ học sinh trả lời và còn hơn 5 giây.
  chatterMinLeftMs: 5000,
  // trần câu nói thêm thường (chào, khen người đúng đầu, nhận ra bạn đi học lại, rủ tương tác...) mỗi câu hỏi / mỗi phần.
  // Cảm ơn quà, sinh nhật, lên lớp không tính trần. Chủ kênh thấy cô nói quá nhiều (2026-11-04).
  chatterPerPhase: 1,
  chatterMaxWaitMs: 35_000, // câu chào chờ được qua 1 vòng câu hỏi, quá thì bỏ
  giftLineMaxWaitMs: 45_000, // cảm ơn quà chờ lâu hơn
  maxHoldMs: 25_000, // mỗi phần dừng đồng hồ tối đa chừng này (phòng giọng bị kẹt)
};
