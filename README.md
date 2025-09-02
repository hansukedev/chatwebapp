# 🔒 Secure Chat Platform

Một ứng dụng **chat bảo mật** (End-to-End Encrypted) được xây dựng từ đầu với mục tiêu học tập & portfolio.  
Ứng dụng hỗ trợ **Private Chat** và **Group Chat** với giao diện hiện đại giống Messenger.

---

## 🚀 Các Phase đã hoàn thành

### ✅ Phase 1 – Khởi tạo Web App
- Tạo dự án web app với backend (Node.js/Express) + frontend (React).
- Tích hợp cơ sở dữ liệu (MongoDB/Postgres tuỳ chọn).
- Đăng ký/Đăng nhập người dùng.
- Bảo mật cơ bản: lưu mật khẩu bằng bcrypt, JWT cho session.

---

### ✅ Phase 2 – Cơ chế Bảo mật
- Triển khai mã hóa end-to-end (AES-256-GCM).
- Sinh khóa riêng cho mỗi cuộc trò chuyện.
- Tin nhắn lưu trong DB chỉ ở dạng **ciphertext**, không lưu plaintext.
- Mỗi phiên chat có IV (Initialization Vector) riêng cho an toàn.

---

### ✅ Phase 3.1 – Giao diện Chat cơ bản
- Tạo khung chat 1–1 (Private).
- Người dùng có thể chọn bạn bè và gửi tin nhắn.
- Tin nhắn gửi/nhận được lưu trữ trong DB, render real-time với WebSocket.

---

### ✅ Phase 3.2 – WebSocket Real-time
- Tin nhắn được truyền trực tiếp qua WebSocket (không cần reload).
- Kênh socket riêng cho từng cặp user.
- Tin nhắn hiển thị ngay khi gửi thành công.

---

### ✅ Phase 3.3 – Private Chat UI nâng cấp
- Tin nhắn của mình → hiển thị căn phải (bubble xanh).
- Tin nhắn của người khác → hiển thị căn trái (bubble xám, kèm avatar + tên).
- Hiển thị timestamp dưới mỗi tin.
- Header hiển thị avatar + tên đối phương + trạng thái online.
- Animation slide-in cho tin nhắn mới.
- **Typing Indicator**: hiện "... đang nhập" với animation 3 chấm khi user đang gõ.

---

### ✅ Phase 3.4 – Group Chat
- Cho phép tạo/join/leave room (giống Slack/Messenger group).
- Sidebar hiển thị danh sách room.
- Mỗi room có session key riêng để mã hoá end-to-end.
- Tin nhắn trong room:
  - Hiển thị avatar + tên + nội dung + timestamp.
  - Tin nhắn của mình căn phải (màu xanh).
  - Tin nhắn của người khác căn trái (màu xám).
- Typing indicator trong group: hiển thị "A và B đang nhập..." hoặc "N người đang nhập".
- Thông báo tin nhắn chưa đọc (badge notification) cho từng room.

---

## 📦 Công nghệ sử dụng
- **Frontend:** React + Tailwind CSS  
- **Backend:** Node.js + Express  
- **Database:** MongoDB / PostgreSQL  
- **Realtime:** WebSocket (Socket.IO)  
- **Bảo mật:** AES-256-GCM + bcrypt + JWT  

---

## 🎯 Roadmap (tương lai)
- Phase 3.5: Hỗ trợ gửi file/media (ảnh, PDF, video).  
- Phase 3.6: Tích hợp thông báo đẩy (push notification).  
- Phase 4.0: Triển khai production (Docker + CI/CD).  

---

## 📸 Demo (đang cập nhật)
coming soon...

---

## 👨‍💻 Tác giả
Dự án cá nhân bởi **Hansuke** – phục vụ portfolio & rèn luyện kỹ năng fullstack.

---

## 💵 Donate tui qua
- Momo + Zalopay: 0946039187
- Vietcombank: 
- MB Bank: 230804121105
- Paypal: Updating...
Mọi sự ủng hộ của các bạn sẽ là động lực để tôi có thể phát triển app có thêm nhiều tính năng hay hơn

---

## Nếu thấy repo hay đừng ngần ngại cho tớ 1 star nhé. Tớ cảm ơn rấc nhìuuuuuu <3
