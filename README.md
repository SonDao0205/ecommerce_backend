# Chức năng cơ bản của hệ thống Ecommerce Marketplace

Hệ thống ecommerce dạng **marketplace** (nhiều shop), gồm 3 phân hệ chính: trang bán hàng, quản lý shop và quản trị hệ thống.

---

## 1. Trang bán hàng (Customer / Storefront)

### Tài khoản & xác thực
- [ ] Đăng ký, đăng nhập (email/SĐT, Google/Facebook), quên mật khẩu
- [ ] Quản lý hồ sơ cá nhân, sổ địa chỉ giao hàng

### Duyệt & tìm sản phẩm
- [ ] Trang chủ (banner, danh mục nổi bật, flash sale, gợi ý)
- [ ] Danh mục sản phẩm, tìm kiếm, lọc (giá, thương hiệu, đánh giá, shop), sắp xếp
- [ ] Trang chi tiết sản phẩm (ảnh, mô tả, biến thể size/màu, tồn kho, đánh giá)
- [ ] Trang shop (xem sản phẩm của từng shop, theo dõi shop)

### Mua hàng
- [ ] Giỏ hàng (thêm/sửa/xóa, gộp theo shop)
- [ ] Wishlist / yêu thích
- [ ] Checkout: chọn địa chỉ, phương thức vận chuyển, thanh toán
- [ ] Áp mã giảm giá (voucher của sàn và của shop)
- [ ] Thanh toán: COD, chuyển khoản, ví điện tử, thẻ (VNPay, MoMo, Stripe...)

### Sau mua hàng
- [ ] Lịch sử đơn hàng, theo dõi trạng thái đơn
- [ ] Hủy đơn, yêu cầu đổi/trả/hoàn tiền
- [ ] Đánh giá & bình luận sản phẩm
- [ ] Thông báo (email, push, in-app)
- [ ] Chat với shop

---

## 2. Quản lý shop (Seller / Vendor)

- [ ] Đăng ký mở shop, chờ admin duyệt
- [ ] Quản lý thông tin shop (logo, banner, mô tả, địa chỉ kho)
- [ ] **Quản lý sản phẩm:** thêm/sửa/xóa, biến thể (SKU), ảnh, giá, tồn kho
- [ ] **Quản lý đơn hàng:** xác nhận, đóng gói, giao cho đơn vị vận chuyển, xử lý hủy/trả
- [ ] Quản lý khuyến mãi, voucher riêng của shop
- [ ] Trả lời chat, đánh giá của khách
- [ ] Thống kê: doanh thu, đơn hàng, sản phẩm bán chạy
- [ ] Đối soát & rút tiền (xem số dư, hoa hồng đã trừ, yêu cầu rút)

---

## 3. Quản trị hệ thống (Admin)

- [ ] **Quản lý người dùng:** khách hàng, seller, khóa/mở tài khoản
- [ ] **Phân quyền (RBAC):** super admin, nhân viên, CSKH...
- [ ] **Duyệt shop** và duyệt sản phẩm (nếu cần)
- [ ] **Quản lý danh mục, thương hiệu, thuộc tính** sản phẩm dùng chung
- [ ] **Quản lý đơn hàng toàn sàn**, xử lý tranh chấp
- [ ] **Khuyến mãi toàn sàn:** voucher, flash sale, banner, chiến dịch
- [ ] **Tài chính:** cấu hình % hoa hồng, đối soát, duyệt yêu cầu rút tiền của shop
- [ ] **Cấu hình vận chuyển & thanh toán**
- [ ] **Quản lý nội dung:** banner, trang tĩnh, FAQ, chính sách
- [ ] **Báo cáo & dashboard:** doanh thu, GMV, số user, top shop/sản phẩm
- [ ] Quản lý đánh giá/báo cáo vi phạm, kiểm duyệt nội dung
- [ ] Nhật ký hoạt động (audit log)

---

## 4. Chức năng nền tảng (Cross-cutting)

- [ ] Upload & lưu trữ ảnh (S3/Cloudinary...)
- [ ] Gửi email/SMS/push notification
- [ ] Tìm kiếm (Elasticsearch hoặc full-text của DB khi lớn)
- [ ] Cache (Redis), queue cho tác vụ nặng (gửi mail, xử lý đơn)
- [ ] Real-time chat (WebSocket)
- [ ] Quản lý tồn kho, chống oversell khi nhiều người mua cùng lúc
- [ ] Tích hợp vận chuyển (GHN, GHTK, Viettel Post...)

---

## Gợi ý lộ trình làm (MVP trước)

| Giai đoạn | Nội dung |
|-----------|----------|
| 1 | Auth + sản phẩm + giỏ hàng + đặt hàng (COD) + admin cơ bản |
| 2 | Multi-shop (seller portal), voucher, thanh toán online |
| 3 | Chat, đánh giá, đối soát/hoa hồng, thống kê |
| 4 | Tối ưu (cache, search, queue), tích hợp vận chuyển |
