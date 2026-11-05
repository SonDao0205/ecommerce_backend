# ╔══════════════════════════════════════════════════════════╗
# ║              STAGE 1 — Builder                          ║
# ║  Cài dependencies + build TypeScript → JavaScript       ║
# ╚══════════════════════════════════════════════════════════╝

# Dùng Node.js 22 trên Alpine Linux (hệ điều hành nhỏ gọn ~5MB)
# "AS builder" đặt tên cho stage này để stage sau có thể tham chiếu
FROM node:22-alpine AS builder

# Đặt thư mục làm việc trong container là /app
# Tất cả lệnh RUN/COPY/CMD sau đây đều thực thi trong /app
WORKDIR /app

# Chép package.json và package-lock.json vào TRƯỚC
# Mục đích: Docker cache layer này riêng — nếu code thay đổi nhưng
# package.json không đổi thì bước npm ci bên dưới được dùng từ cache,
# không cần cài lại → build nhanh hơn nhiều
COPY package*.json ./

# Cài dependencies dựa theo package-lock.json
# npm ci (clean install): nhanh hơn, nhất quán hơn npm install
# Sự khác biệt: npm ci xóa node_modules cũ rồi cài chính xác theo lock file
RUN npm ci

# Chép toàn bộ source code vào container
# Lệnh này đứng SAU npm ci để tận dụng Docker layer cache ở bước trên
COPY . .

# Chạy lệnh build: nest build → biên dịch TypeScript → /app/dist
RUN npm run build


# ╔══════════════════════════════════════════════════════════╗
# ║              STAGE 2 — Production                       ║
# ║  Image sạch, chỉ chứa những gì cần để CHẠY app         ║
# ╚══════════════════════════════════════════════════════════╝

# Bắt đầu lại từ image sạch (không kế thừa layer từ builder)
# Giúp image production nhỏ hơn: không có source .ts, không có devDependencies
FROM node:22-alpine AS production

WORKDIR /app

COPY package*.json ./

# --omit=dev: bỏ qua devDependencies, chỉ cài production dependencies
# Ví dụ: @types/*, vitest, eslint... sẽ không được cài vào image này
RUN npm ci --omit=dev

# Chép thư mục /app/dist từ stage "builder" sang image hiện tại
# --from=builder: chỉ định lấy từ stage nào
COPY --from=builder /app/dist ./dist

# Khai báo container sẽ lắng nghe trên port 8080
# Đây chỉ là tài liệu (metadata), không tự động mở port
# Port thực sự được mở khi chạy docker run -p hoặc khai báo trong compose
EXPOSE 8080

# Lệnh mặc định khi container khởi động
# Dùng array form (exec form) thay vì string để tránh shell wrapper
# → process Node.js nhận signal SIGTERM trực tiếp (graceful shutdown)
CMD ["node", "dist/main.js"]
