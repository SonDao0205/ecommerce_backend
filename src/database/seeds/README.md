# Dữ liệu mẫu backend

Chạy seed từ thư mục `backend`:

```bash
npm run seed
```

Seed có thể chạy lại nhiều lần. Dữ liệu mẫu được cập nhật theo `email`, `slug`,
`SKU` và các khóa duy nhất thay vì tạo thêm bản ghi trùng.

## Tài khoản mẫu

Tất cả tài khoản sử dụng mật khẩu `ShopNow@123`:

| Email                     | Vai trò   |
| ------------------------- | --------- |
| `admin@shopnow.local`     | admin     |
| `customer@shopnow.local`  | customer  |
| `staff@shopnow.local`     | staff     |
| `warehouse@shopnow.local` | warehouse |

Các địa chỉ `.local` chỉ dùng trong môi trường phát triển. Seed không tạo avatar.

Seed tạo 60 sản phẩm và gán cùng một URL Cloudinary vào `thumbnail_url` và phần
tử đầu tiên của `images`. Chạy lại seed sẽ tiếp tục đồng bộ ảnh sản phẩm mẫu về
URL này.

Giá bán trong seed là dữ liệu minh họa cho giao diện, không phải báo giá hiện hành.
