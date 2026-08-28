import { NestFactory } from '@nestjs/core';
import { hash } from 'bcrypt';
import { DataSource, QueryRunner } from 'typeorm';
import { AppModule } from '../../app.module';

interface IdRow {
  id: string;
}

interface CategorySeed {
  id: string;
  name: string;
  slug: string;
  description: string;
  parentSlug?: string;
}

interface VariantSeed {
  id: string;
  name: string;
  value: string;
  sku?: string;
  unitPrice?: number;
  stock: number;
  sortOrder: number;
  parentId?: string;
}

interface ProductSeed {
  id: string;
  name: string;
  slug: string;
  description: string;
  sku: string;
  unitPrice: number;
  originalPrice?: number;
  categorySlug: string;
  stock: number;
  lowStockThreshold: number;
  variants?: VariantSeed[];
}

type SimpleProductDefinition = [
  name: string,
  slug: string,
  sku: string,
  unitPrice: number,
  originalPrice: number,
  categorySlug: string,
  stock: number,
  summary: string,
];

const PRODUCT_IMAGE_URL =
  'https://res.cloudinary.com/dq87endkv/image/upload/v1787802859/ecommerce/products/file_bob1p6.jpg';

const categorySeeds: CategorySeed[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Công nghệ',
    slug: 'cong-nghe',
    description: 'Danh mục gốc dành cho thiết bị công nghệ.',
  },
  {
    id: '10000000-0000-4000-8000-000000000012',
    name: 'Máy tính bảng',
    slug: 'may-tinh-bang',
    description: 'Máy tính bảng và thiết bị hỗ trợ học tập di động.',
    parentSlug: 'cong-nghe',
  },
  {
    id: '10000000-0000-4000-8000-000000000013',
    name: 'Thiết bị đeo',
    slug: 'thiet-bi-deo',
    description: 'Đồng hồ thông minh và vòng đeo theo dõi vận động.',
    parentSlug: 'cong-nghe',
  },
  {
    id: '10000000-0000-4000-8000-000000000014',
    name: 'Phụ kiện công nghệ',
    slug: 'phu-kien-cong-nghe',
    description: 'Cáp, sạc, pin dự phòng và phụ kiện thiết bị.',
    parentSlug: 'cong-nghe',
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    name: 'Điện thoại',
    slug: 'dien-thoai',
    description: 'Điện thoại thông minh và điện thoại di động.',
    parentSlug: 'cong-nghe',
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    name: 'Laptop',
    slug: 'laptop',
    description: 'Máy tính xách tay phục vụ học tập và làm việc.',
    parentSlug: 'cong-nghe',
  },
  {
    id: '10000000-0000-4000-8000-000000000004',
    name: 'Âm thanh',
    slug: 'am-thanh',
    description: 'Tai nghe và thiết bị âm thanh cá nhân.',
    parentSlug: 'cong-nghe',
  },
  {
    id: '10000000-0000-4000-8000-000000000010',
    name: 'Thời trang',
    slug: 'thoi-trang',
    description: 'Danh mục gốc dành cho sản phẩm thời trang.',
  },
  {
    id: '10000000-0000-4000-8000-000000000011',
    name: 'Giày',
    slug: 'giay',
    description: 'Giày thời trang và giày thể thao.',
    parentSlug: 'thoi-trang',
  },
  {
    id: '10000000-0000-4000-8000-000000000015',
    name: 'Quần áo',
    slug: 'quan-ao',
    description: 'Áo, quần, váy và trang phục mặc hằng ngày.',
    parentSlug: 'thoi-trang',
  },
  {
    id: '10000000-0000-4000-8000-000000000016',
    name: 'Túi và ví',
    slug: 'tui-va-vi',
    description: 'Túi xách, túi đeo và ví cá nhân.',
    parentSlug: 'thoi-trang',
  },
  {
    id: '10000000-0000-4000-8000-000000000017',
    name: 'Phụ kiện thời trang',
    slug: 'phu-kien-thoi-trang',
    description: 'Mũ, thắt lưng và phụ kiện phối trang phục.',
    parentSlug: 'thoi-trang',
  },
  {
    id: '10000000-0000-4000-8000-000000000020',
    name: 'Nhà cửa và đời sống',
    slug: 'nha-cua-doi-song',
    description: 'Đồ dùng phục vụ sinh hoạt trong gia đình.',
  },
  {
    id: '10000000-0000-4000-8000-000000000021',
    name: 'Đồ dùng nhà bếp',
    slug: 'do-dung-nha-bep',
    description: 'Thiết bị và dụng cụ dùng trong nhà bếp.',
    parentSlug: 'nha-cua-doi-song',
  },
  {
    id: '10000000-0000-4000-8000-000000000022',
    name: 'Vệ sinh nhà cửa',
    slug: 've-sinh-nha-cua',
    description: 'Dụng cụ hỗ trợ vệ sinh không gian sống.',
    parentSlug: 'nha-cua-doi-song',
  },
  {
    id: '10000000-0000-4000-8000-000000000023',
    name: 'Nội thất',
    slug: 'noi-that',
    description: 'Bàn, ghế, kệ và đồ dùng nội thất.',
    parentSlug: 'nha-cua-doi-song',
  },
  {
    id: '10000000-0000-4000-8000-000000000024',
    name: 'Trang trí nhà cửa',
    slug: 'trang-tri-nha-cua',
    description: 'Đèn và vật dụng trang trí không gian.',
    parentSlug: 'nha-cua-doi-song',
  },
  {
    id: '10000000-0000-4000-8000-000000000030',
    name: 'Làm đẹp',
    slug: 'lam-dep',
    description: 'Sản phẩm chăm sóc cá nhân và làm đẹp.',
  },
  {
    id: '10000000-0000-4000-8000-000000000031',
    name: 'Chăm sóc da',
    slug: 'cham-soc-da',
    description: 'Sản phẩm làm sạch, dưỡng và bảo vệ da.',
    parentSlug: 'lam-dep',
  },
  {
    id: '10000000-0000-4000-8000-000000000032',
    name: 'Chăm sóc tóc',
    slug: 'cham-soc-toc',
    description: 'Sản phẩm làm sạch và chăm sóc tóc.',
    parentSlug: 'lam-dep',
  },
  {
    id: '10000000-0000-4000-8000-000000000033',
    name: 'Trang điểm',
    slug: 'trang-diem',
    description: 'Sản phẩm trang điểm cá nhân.',
    parentSlug: 'lam-dep',
  },
  {
    id: '10000000-0000-4000-8000-000000000040',
    name: 'Thể thao và dã ngoại',
    slug: 'the-thao-da-ngoai',
    description: 'Dụng cụ luyện tập và hoạt động ngoài trời.',
  },
  {
    id: '10000000-0000-4000-8000-000000000041',
    name: 'Thể hình và yoga',
    slug: 'the-hinh-yoga',
    description: 'Dụng cụ tập luyện thể hình và yoga.',
    parentSlug: 'the-thao-da-ngoai',
  },
  {
    id: '10000000-0000-4000-8000-000000000042',
    name: 'Thể thao đồng đội',
    slug: 'the-thao-dong-doi',
    description: 'Dụng cụ cho các môn thể thao đồng đội.',
    parentSlug: 'the-thao-da-ngoai',
  },
  {
    id: '10000000-0000-4000-8000-000000000043',
    name: 'Dã ngoại',
    slug: 'da-ngoai',
    description: 'Vật dụng phục vụ chuyến đi và hoạt động ngoài trời.',
    parentSlug: 'the-thao-da-ngoai',
  },
  {
    id: '10000000-0000-4000-8000-000000000050',
    name: 'Sách',
    slug: 'sach',
    description: 'Sách đọc và tài liệu tham khảo.',
  },
  {
    id: '10000000-0000-4000-8000-000000000051',
    name: 'Văn học',
    slug: 'van-hoc',
    description: 'Tiểu thuyết và tác phẩm văn học.',
    parentSlug: 'sach',
  },
  {
    id: '10000000-0000-4000-8000-000000000052',
    name: 'Kinh tế và kỹ năng',
    slug: 'kinh-te-ky-nang',
    description: 'Sách kinh tế, tài chính và kỹ năng thực hành.',
    parentSlug: 'sach',
  },
  {
    id: '10000000-0000-4000-8000-000000000053',
    name: 'Ẩm thực',
    slug: 'am-thuc',
    description: 'Sách hướng dẫn nấu ăn và kiến thức ẩm thực.',
    parentSlug: 'sach',
  },
  {
    id: '10000000-0000-4000-8000-000000000060',
    name: 'Mẹ và bé',
    slug: 'me-va-be',
    description: 'Sản phẩm dành cho trẻ nhỏ và gia đình.',
  },
  {
    id: '10000000-0000-4000-8000-000000000061',
    name: 'Đồ chơi',
    slug: 'do-choi',
    description: 'Đồ chơi và dụng cụ hỗ trợ hoạt động của trẻ.',
    parentSlug: 'me-va-be',
  },
];

const featuredProductSeeds: ProductSeed[] = [
  {
    id: '40000000-0000-4000-8000-000000000001',
    name: 'iPhone 15 Pro Max',
    slug: 'iphone-15-pro-max',
    sku: 'IP15PM-BASE',
    unitPrice: 29_990_000,
    originalPrice: 32_990_000,
    categorySlug: 'dien-thoai',
    stock: 24,
    lowStockThreshold: 5,
    description:
      '<h2>iPhone 15 Pro Max</h2><p>Máy sử dụng khung titan, chip A17 Pro, nút Tác vụ và cổng USB-C. Hệ thống camera có camera chính 48 MP; camera telephoto 5x là trang bị của phiên bản Pro Max.</p>',
    variants: [
      {
        id: '50000000-0000-4000-8000-000000000001',
        name: 'Màu sắc',
        value: 'Titan đen',
        stock: 0,
        sortOrder: 0,
      },
      {
        id: '50000000-0000-4000-8000-000000000002',
        name: 'Dung lượng',
        value: '256 GB',
        sku: 'IP15PM-BLK-256',
        unitPrice: 29_990_000,
        stock: 10,
        sortOrder: 0,
        parentId: '50000000-0000-4000-8000-000000000001',
      },
      {
        id: '50000000-0000-4000-8000-000000000003',
        name: 'Dung lượng',
        value: '512 GB',
        sku: 'IP15PM-BLK-512',
        unitPrice: 35_990_000,
        stock: 6,
        sortOrder: 1,
        parentId: '50000000-0000-4000-8000-000000000001',
      },
      {
        id: '50000000-0000-4000-8000-000000000004',
        name: 'Màu sắc',
        value: 'Titan trắng',
        stock: 0,
        sortOrder: 1,
      },
      {
        id: '50000000-0000-4000-8000-000000000005',
        name: 'Dung lượng',
        value: '256 GB',
        sku: 'IP15PM-WHT-256',
        unitPrice: 29_990_000,
        stock: 5,
        sortOrder: 0,
        parentId: '50000000-0000-4000-8000-000000000004',
      },
      {
        id: '50000000-0000-4000-8000-000000000006',
        name: 'Dung lượng',
        value: '512 GB',
        sku: 'IP15PM-WHT-512',
        unitPrice: 35_990_000,
        stock: 3,
        sortOrder: 1,
        parentId: '50000000-0000-4000-8000-000000000004',
      },
    ],
  },
  {
    id: '40000000-0000-4000-8000-000000000002',
    name: 'MacBook Air 13 inch M3',
    slug: 'macbook-air-13-inch-m3',
    sku: 'MBA13-M3-BASE',
    unitPrice: 27_990_000,
    originalPrice: 28_990_000,
    categorySlug: 'laptop',
    stock: 18,
    lowStockThreshold: 4,
    description:
      '<h2>MacBook Air 13 inch M3</h2><p>Phiên bản được giới thiệu năm 2024, sử dụng chip Apple M3 và màn hình Liquid Retina 13,6 inch độ phân giải 2560 × 1664. Máy có cổng sạc MagSafe 3 cùng hai cổng Thunderbolt/USB 4.</p>',
    variants: [
      {
        id: '50000000-0000-4000-8000-000000000011',
        name: 'Màu sắc',
        value: 'Midnight',
        stock: 0,
        sortOrder: 0,
      },
      {
        id: '50000000-0000-4000-8000-000000000012',
        name: 'Bộ nhớ',
        value: '256 GB',
        sku: 'MBA13-M3-MID-256',
        unitPrice: 27_990_000,
        stock: 7,
        sortOrder: 0,
        parentId: '50000000-0000-4000-8000-000000000011',
      },
      {
        id: '50000000-0000-4000-8000-000000000013',
        name: 'Bộ nhớ',
        value: '512 GB',
        sku: 'MBA13-M3-MID-512',
        unitPrice: 32_990_000,
        stock: 5,
        sortOrder: 1,
        parentId: '50000000-0000-4000-8000-000000000011',
      },
      {
        id: '50000000-0000-4000-8000-000000000014',
        name: 'Màu sắc',
        value: 'Silver',
        stock: 0,
        sortOrder: 1,
      },
      {
        id: '50000000-0000-4000-8000-000000000015',
        name: 'Bộ nhớ',
        value: '256 GB',
        sku: 'MBA13-M3-SLV-256',
        unitPrice: 27_990_000,
        stock: 6,
        sortOrder: 0,
        parentId: '50000000-0000-4000-8000-000000000014',
      },
    ],
  },
  {
    id: '40000000-0000-4000-8000-000000000003',
    name: 'AirPods Pro thế hệ 2 với hộp sạc USB-C',
    slug: 'airpods-pro-2-usb-c',
    sku: 'AIRPODS-PRO2-USBC',
    unitPrice: 5_990_000,
    originalPrice: 6_199_000,
    categorySlug: 'am-thanh',
    stock: 45,
    lowStockThreshold: 8,
    description:
      '<h2>AirPods Pro thế hệ 2</h2><p>Tai nghe hỗ trợ Chủ động khử tiếng ồn và chế độ Xuyên âm. Phiên bản dữ liệu mẫu đi kèm hộp sạc MagSafe sử dụng cổng USB-C.</p>',
  },
  {
    id: '40000000-0000-4000-8000-000000000004',
    name: 'Nike Air Max Pulse',
    slug: 'nike-air-max-pulse',
    sku: 'NIKE-AMP-BASE',
    unitPrice: 4_690_000,
    categorySlug: 'giay',
    stock: 29,
    lowStockThreshold: 6,
    description:
      '<h2>Nike Air Max Pulse</h2><p>Mẫu giày sử dụng đệm Air phân bổ lực theo điểm. Thân giày bằng vải dệt với lớp phủ da và vật liệu tổng hợp, đế giữa bằng foam và đế ngoài cao su kiểu Waffle.</p>',
    variants: [
      {
        id: '50000000-0000-4000-8000-000000000021',
        name: 'Màu sắc',
        value: 'Đen',
        stock: 0,
        sortOrder: 0,
      },
      {
        id: '50000000-0000-4000-8000-000000000022',
        name: 'Kích thước',
        value: '40',
        sku: 'NIKE-AMP-BLK-40',
        unitPrice: 4_690_000,
        stock: 10,
        sortOrder: 0,
        parentId: '50000000-0000-4000-8000-000000000021',
      },
      {
        id: '50000000-0000-4000-8000-000000000023',
        name: 'Kích thước',
        value: '41',
        sku: 'NIKE-AMP-BLK-41',
        unitPrice: 4_690_000,
        stock: 11,
        sortOrder: 1,
        parentId: '50000000-0000-4000-8000-000000000021',
      },
      {
        id: '50000000-0000-4000-8000-000000000024',
        name: 'Kích thước',
        value: '42',
        sku: 'NIKE-AMP-BLK-42',
        unitPrice: 4_690_000,
        stock: 8,
        sortOrder: 2,
        parentId: '50000000-0000-4000-8000-000000000021',
      },
    ],
  },
];

const simpleProductDefinitions: SimpleProductDefinition[] = [
  [
    'Điện thoại Android 5G 128 GB',
    'dien-thoai-android-5g-128gb',
    'PHONE-5G-128',
    6_490_000,
    6_990_000,
    'dien-thoai',
    32,
    'Điện thoại dữ liệu mẫu thuộc nhóm Android 5G, dung lượng lưu trữ được đặt là 128 GB.',
  ],
  [
    'Điện thoại Android 5G 256 GB',
    'dien-thoai-android-5g-256gb',
    'PHONE-5G-256',
    8_490_000,
    8_990_000,
    'dien-thoai',
    27,
    'Điện thoại dữ liệu mẫu thuộc nhóm Android 5G, dung lượng lưu trữ được đặt là 256 GB.',
  ],
  [
    'Điện thoại phổ thông bàn phím lớn',
    'dien-thoai-pho-thong-ban-phim-lon',
    'PHONE-KEYPAD-01',
    690_000,
    790_000,
    'dien-thoai',
    50,
    'Điện thoại phổ thông dạng phím bấm, được tạo để minh họa nhóm sản phẩm cơ bản.',
  ],
  [
    'Máy tính bảng 10.9 inch 128 GB',
    'may-tinh-bang-10-9-inch-128gb',
    'TABLET-109-128',
    9_990_000,
    10_990_000,
    'may-tinh-bang',
    21,
    'Máy tính bảng dữ liệu mẫu với kích thước màn hình và dung lượng được thể hiện ngay trong tên.',
  ],
  [
    'Máy tính bảng nhỏ gọn 8 inch',
    'may-tinh-bang-nho-gon-8-inch',
    'TABLET-8-64',
    5_490_000,
    5_990_000,
    'may-tinh-bang',
    18,
    'Máy tính bảng dữ liệu mẫu thuộc nhóm thiết bị màn hình 8 inch nhỏ gọn.',
  ],
  [
    'Bút cảm ứng cho máy tính bảng',
    'but-cam-ung-cho-may-tinh-bang',
    'TABLET-PEN-01',
    890_000,
    990_000,
    'may-tinh-bang',
    44,
    'Bút cảm ứng dữ liệu mẫu dùng để minh họa phụ kiện nhập liệu cho máy tính bảng.',
  ],
  [
    'Laptop văn phòng 14 inch',
    'laptop-van-phong-14-inch',
    'LAPTOP-OFFICE-14',
    15_990_000,
    16_990_000,
    'laptop',
    16,
    'Laptop dữ liệu mẫu thuộc nhóm máy tính xách tay phục vụ công việc văn phòng.',
  ],
  [
    'Laptop gaming 15.6 inch',
    'laptop-gaming-15-6-inch',
    'LAPTOP-GAME-156',
    25_990_000,
    27_990_000,
    'laptop',
    13,
    'Laptop dữ liệu mẫu thuộc nhóm máy tính xách tay hướng đến nhu cầu chơi game.',
  ],
  [
    'Laptop mỏng nhẹ 13 inch',
    'laptop-mong-nhe-13-inch',
    'LAPTOP-SLIM-13',
    19_490_000,
    20_490_000,
    'laptop',
    20,
    'Laptop dữ liệu mẫu thuộc nhóm máy tính xách tay 13 inch ưu tiên tính di động.',
  ],
  [
    'Tai nghe Bluetooth nhét tai',
    'tai-nghe-bluetooth-nhet-tai',
    'AUDIO-TWS-01',
    1_290_000,
    1_490_000,
    'am-thanh',
    38,
    'Tai nghe không dây dạng nhét tai, được tạo để minh họa nhóm thiết bị âm thanh cá nhân.',
  ],
  [
    'Tai nghe chụp tai không dây',
    'tai-nghe-chup-tai-khong-day',
    'AUDIO-OVER-EAR-01',
    2_190_000,
    2_490_000,
    'am-thanh',
    25,
    'Tai nghe không dây dạng chụp tai, phù hợp để trình bày danh mục âm thanh trong dữ liệu mẫu.',
  ],
  [
    'Loa Bluetooth di động',
    'loa-bluetooth-di-dong',
    'AUDIO-SPEAKER-01',
    1_590_000,
    1_790_000,
    'am-thanh',
    31,
    'Loa không dây di động dữ liệu mẫu dùng cho giao diện danh sách sản phẩm âm thanh.',
  ],
  [
    'Đồng hồ thông minh màn hình AMOLED',
    'dong-ho-thong-minh-amoled',
    'WEAR-WATCH-01',
    3_490_000,
    3_990_000,
    'thiet-bi-deo',
    22,
    'Đồng hồ thông minh dữ liệu mẫu; loại màn hình được mô tả trong tên sản phẩm là AMOLED.',
  ],
  [
    'Vòng đeo theo dõi vận động',
    'vong-deo-theo-doi-van-dong',
    'WEAR-BAND-01',
    990_000,
    1_190_000,
    'thiet-bi-deo',
    35,
    'Vòng đeo dữ liệu mẫu thuộc nhóm thiết bị hỗ trợ theo dõi hoạt động vận động.',
  ],
  [
    'Củ sạc USB-C 65 W',
    'cu-sac-usb-c-65w',
    'ACCESSORY-CHARGER-65W',
    690_000,
    790_000,
    'phu-kien-cong-nghe',
    60,
    'Củ sạc dữ liệu mẫu có cổng USB-C và công suất danh định được đặt là 65 W.',
  ],
  [
    'Pin dự phòng 10.000 mAh',
    'pin-du-phong-10000mah',
    'ACCESSORY-POWER-10K',
    590_000,
    690_000,
    'phu-kien-cong-nghe',
    55,
    'Pin dự phòng dữ liệu mẫu có dung lượng danh định được đặt là 10.000 mAh.',
  ],
  [
    'Cáp USB-C dài 1 mét',
    'cap-usb-c-dai-1-met',
    'ACCESSORY-CABLE-C1',
    190_000,
    250_000,
    'phu-kien-cong-nghe',
    80,
    'Cáp kết nối USB-C dữ liệu mẫu với chiều dài được đặt là 1 mét.',
  ],
  [
    'Áo thun cotton màu trắng',
    'ao-thun-cotton-mau-trang',
    'FASHION-TSHIRT-WHT',
    249_000,
    299_000,
    'quan-ao',
    42,
    'Áo thun dữ liệu mẫu, màu trắng và thành phần chính được khai báo là cotton.',
  ],
  [
    'Áo polo màu xanh navy',
    'ao-polo-mau-xanh-navy',
    'FASHION-POLO-NAVY',
    399_000,
    459_000,
    'quan-ao',
    36,
    'Áo polo dữ liệu mẫu với màu sản phẩm được khai báo là xanh navy.',
  ],
  [
    'Quần jeans dáng suông',
    'quan-jeans-dang-suong',
    'FASHION-JEANS-STRAIGHT',
    649_000,
    749_000,
    'quan-ao',
    28,
    'Quần jeans dữ liệu mẫu được phân loại theo kiểu dáng suông.',
  ],
  [
    'Áo khoác gió có mũ',
    'ao-khoac-gio-co-mu',
    'FASHION-JACKET-HOOD',
    799_000,
    899_000,
    'quan-ao',
    24,
    'Áo khoác gió dữ liệu mẫu có thiết kế kèm mũ.',
  ],
  [
    'Váy midi dáng chữ A',
    'vay-midi-dang-chu-a',
    'FASHION-DRESS-MIDI',
    699_000,
    799_000,
    'quan-ao',
    19,
    'Váy dữ liệu mẫu có chiều dài midi và được phân loại theo dáng chữ A.',
  ],
  [
    'Túi tote vải canvas',
    'tui-tote-vai-canvas',
    'BAG-TOTE-CANVAS',
    289_000,
    349_000,
    'tui-va-vi',
    48,
    'Túi tote dữ liệu mẫu, chất liệu sản phẩm được khai báo là vải canvas.',
  ],
  [
    'Túi đeo chéo nhỏ gọn',
    'tui-deo-cheo-nho-gon',
    'BAG-CROSSBODY-01',
    459_000,
    529_000,
    'tui-va-vi',
    33,
    'Túi đeo chéo dữ liệu mẫu thuộc nhóm túi kích thước nhỏ.',
  ],
  [
    'Ví gập chất liệu PU',
    'vi-gap-chat-lieu-pu',
    'WALLET-PU-01',
    329_000,
    389_000,
    'tui-va-vi',
    41,
    'Ví gập dữ liệu mẫu, chất liệu được khai báo là PU.',
  ],
  [
    'Giày chạy bộ đế foam',
    'giay-chay-bo-de-foam',
    'SHOE-RUN-FOAM',
    1_290_000,
    1_490_000,
    'giay',
    26,
    'Giày chạy bộ dữ liệu mẫu sử dụng đế giữa được mô tả là foam.',
  ],
  [
    'Dép quai ngang chống trượt',
    'dep-quai-ngang-chong-truot',
    'SHOE-SANDAL-01',
    349_000,
    399_000,
    'giay',
    39,
    'Dép quai ngang dữ liệu mẫu với bề mặt đế được khai báo có thiết kế hỗ trợ chống trượt.',
  ],
  [
    'Mũ lưỡi trai điều chỉnh vòng đầu',
    'mu-luoi-trai-dieu-chinh-vong-dau',
    'FASHION-CAP-01',
    259_000,
    299_000,
    'phu-kien-thoi-trang',
    52,
    'Mũ lưỡi trai dữ liệu mẫu có khóa điều chỉnh kích thước vòng đầu.',
  ],
  [
    'Thắt lưng khóa kim',
    'that-lung-khoa-kim',
    'FASHION-BELT-01',
    379_000,
    429_000,
    'phu-kien-thoi-trang',
    34,
    'Thắt lưng dữ liệu mẫu sử dụng kiểu khóa kim.',
  ],
  [
    'Nồi cơm điện dung tích 1.8 lít',
    'noi-com-dien-1-8-lit',
    'HOME-RICE-18',
    1_290_000,
    1_490_000,
    'do-dung-nha-bep',
    23,
    'Nồi cơm điện dữ liệu mẫu có dung tích danh định được đặt là 1,8 lít.',
  ],
  [
    'Ấm đun nước điện 1.7 lít',
    'am-dun-nuoc-dien-1-7-lit',
    'HOME-KETTLE-17',
    590_000,
    690_000,
    'do-dung-nha-bep',
    37,
    'Ấm đun nước bằng điện dữ liệu mẫu có dung tích danh định 1,7 lít.',
  ],
  [
    'Chảo chống dính 28 cm',
    'chao-chong-dinh-28cm',
    'HOME-PAN-28',
    449_000,
    529_000,
    'do-dung-nha-bep',
    45,
    'Chảo dữ liệu mẫu có đường kính danh định 28 cm và bề mặt được mô tả là chống dính.',
  ],
  [
    'Bộ dao bếp 3 món',
    'bo-dao-bep-3-mon',
    'HOME-KNIFE-3',
    699_000,
    799_000,
    'do-dung-nha-bep',
    29,
    'Bộ dao bếp dữ liệu mẫu gồm ba món theo cấu hình sản phẩm.',
  ],
  [
    'Cốc sứ có quai 350 ml',
    'coc-su-co-quai-350ml',
    'HOME-MUG-350',
    129_000,
    159_000,
    'do-dung-nha-bep',
    70,
    'Cốc dữ liệu mẫu làm từ sứ, có quai cầm và dung tích danh định 350 ml.',
  ],
  [
    'Máy hút bụi cầm tay',
    'may-hut-bui-cam-tay',
    'HOME-VACUUM-HAND',
    1_790_000,
    1_990_000,
    've-sinh-nha-cua',
    20,
    'Máy hút bụi dữ liệu mẫu thuộc kiểu thiết bị cầm tay.',
  ],
  [
    'Bộ lau nhà xoay 360 độ',
    'bo-lau-nha-xoay-360-do',
    'HOME-MOP-360',
    499_000,
    579_000,
    've-sinh-nha-cua',
    31,
    'Bộ lau nhà dữ liệu mẫu sử dụng cơ cấu vắt xoay được mô tả là 360 độ.',
  ],
  [
    'Kệ lưu trữ 4 tầng',
    'ke-luu-tru-4-tang',
    'HOME-SHELF-4',
    899_000,
    999_000,
    'noi-that',
    17,
    'Kệ lưu trữ dữ liệu mẫu có cấu hình bốn tầng.',
  ],
  [
    'Ghế làm việc tựa lưng lưới',
    'ghe-lam-viec-tua-lung-luoi',
    'HOME-CHAIR-MESH',
    2_390_000,
    2_690_000,
    'noi-that',
    15,
    'Ghế làm việc dữ liệu mẫu có phần tựa lưng bằng vật liệu lưới.',
  ],
  [
    'Đèn ngủ để bàn ánh sáng ấm',
    'den-ngu-de-ban-anh-sang-am',
    'HOME-LAMP-WARM',
    399_000,
    459_000,
    'trang-tri-nha-cua',
    43,
    'Đèn để bàn dữ liệu mẫu được phân loại theo ánh sáng màu ấm.',
  ],
  [
    'Gối nằm sợi microfiber',
    'goi-nam-soi-microfiber',
    'HOME-PILLOW-MICRO',
    289_000,
    339_000,
    'noi-that',
    46,
    'Gối nằm dữ liệu mẫu, vật liệu ruột gối được khai báo là sợi microfiber.',
  ],
  [
    'Bộ ga giường cotton 1.6 mét',
    'bo-ga-giuong-cotton-1-6-met',
    'HOME-BEDSHEET-16',
    899_000,
    1_050_000,
    'noi-that',
    22,
    'Bộ ga giường dữ liệu mẫu cho kích thước giường 1,6 mét, chất liệu được khai báo là cotton.',
  ],
  [
    'Sữa rửa mặt dịu nhẹ',
    'sua-rua-mat-diu-nhe',
    'BEAUTY-CLEANSER-01',
    249_000,
    289_000,
    'cham-soc-da',
    54,
    'Sản phẩm làm sạch da dữ liệu mẫu, được phân loại là sữa rửa mặt dịu nhẹ.',
  ],
  [
    'Kem chống nắng SPF 50',
    'kem-chong-nang-spf-50',
    'BEAUTY-SUN-SPF50',
    359_000,
    419_000,
    'cham-soc-da',
    47,
    'Kem chống nắng dữ liệu mẫu có chỉ số SPF được khai báo là 50.',
  ],
  [
    'Serum dưỡng ẩm 30 ml',
    'serum-duong-am-30ml',
    'BEAUTY-SERUM-30',
    429_000,
    489_000,
    'cham-soc-da',
    40,
    'Serum dưỡng ẩm dữ liệu mẫu có dung tích danh định 30 ml.',
  ],
  [
    'Kem dưỡng ẩm 50 ml',
    'kem-duong-am-50ml',
    'BEAUTY-CREAM-50',
    389_000,
    449_000,
    'cham-soc-da',
    38,
    'Kem dưỡng ẩm dữ liệu mẫu có dung tích danh định 50 ml.',
  ],
  [
    'Dầu gội chăm sóc tóc 500 ml',
    'dau-goi-cham-soc-toc-500ml',
    'BEAUTY-SHAMPOO-500',
    299_000,
    349_000,
    'cham-soc-toc',
    49,
    'Dầu gội dữ liệu mẫu có dung tích danh định 500 ml.',
  ],
  [
    'Son tint màu đỏ đất',
    'son-tint-mau-do-dat',
    'BEAUTY-LIP-TINT-RED',
    279_000,
    329_000,
    'trang-diem',
    44,
    'Son tint dữ liệu mẫu với màu sản phẩm được khai báo là đỏ đất.',
  ],
  [
    'Thảm yoga dày 6 mm',
    'tham-yoga-day-6mm',
    'SPORT-YOGA-6',
    399_000,
    459_000,
    'the-hinh-yoga',
    36,
    'Thảm yoga dữ liệu mẫu có độ dày danh định 6 mm.',
  ],
  [
    'Bộ tạ tay 2 x 5 kg',
    'bo-ta-tay-2-x-5kg',
    'SPORT-DUMBBELL-10',
    899_000,
    999_000,
    'the-hinh-yoga',
    25,
    'Bộ tạ tay dữ liệu mẫu gồm hai quả, khối lượng danh định mỗi quả là 5 kg.',
  ],
  [
    'Bộ dây kháng lực 5 mức',
    'bo-day-khang-luc-5-muc',
    'SPORT-BAND-5',
    329_000,
    389_000,
    'the-hinh-yoga',
    42,
    'Bộ dây kháng lực dữ liệu mẫu gồm năm mức được phân biệt trong bộ sản phẩm.',
  ],
  [
    'Bóng đá kích thước số 5',
    'bong-da-kich-thuoc-so-5',
    'SPORT-FOOTBALL-5',
    459_000,
    529_000,
    'the-thao-dong-doi',
    33,
    'Bóng đá dữ liệu mẫu có kích thước được khai báo là số 5.',
  ],
  [
    'Bình nước dã ngoại 1 lít',
    'binh-nuoc-da-ngoai-1-lit',
    'OUTDOOR-BOTTLE-1L',
    289_000,
    339_000,
    'da-ngoai',
    51,
    'Bình nước dữ liệu mẫu dành cho hoạt động ngoài trời, dung tích danh định 1 lít.',
  ],
  [
    'Tuyển tập truyện ngắn Việt Nam',
    'tuyen-tap-truyen-ngan-viet-nam',
    'BOOK-LITERATURE-01',
    159_000,
    189_000,
    'van-hoc',
    62,
    'Ấn phẩm dữ liệu mẫu được phân loại là tuyển tập truyện ngắn Việt Nam.',
  ],
  [
    'Cẩm nang quản lý tài chính cá nhân',
    'cam-nang-quan-ly-tai-chinh-ca-nhan',
    'BOOK-FINANCE-01',
    179_000,
    209_000,
    'kinh-te-ky-nang',
    57,
    'Ấn phẩm dữ liệu mẫu được phân loại là cẩm nang về quản lý tài chính cá nhân.',
  ],
  [
    'Sổ tay món ngon gia đình',
    'so-tay-mon-ngon-gia-dinh',
    'BOOK-COOKING-01',
    149_000,
    179_000,
    'am-thuc',
    53,
    'Ấn phẩm dữ liệu mẫu được phân loại là sổ tay công thức món ăn gia đình.',
  ],
  [
    'Bộ khối xếp hình 100 chi tiết',
    'bo-khoi-xep-hinh-100-chi-tiet',
    'TOY-BLOCK-100',
    499_000,
    579_000,
    'do-choi',
    30,
    'Bộ đồ chơi dữ liệu mẫu gồm 100 chi tiết xếp hình theo cấu hình sản phẩm.',
  ],
];

const simpleProductSeeds: ProductSeed[] = simpleProductDefinitions.map(
  (
    [name, slug, sku, unitPrice, originalPrice, categorySlug, stock, summary],
    index,
  ) => ({
    id: `40000000-0000-4000-8000-${String(index + 5).padStart(12, '0')}`,
    name,
    slug,
    sku,
    unitPrice,
    originalPrice,
    categorySlug,
    stock,
    lowStockThreshold: Math.max(5, Math.ceil(stock * 0.15)),
    description: `<h2>${name}</h2><p>${summary}</p><p>Đây là sản phẩm dữ liệu mẫu; ảnh đang dùng là ảnh minh họa chung và cần được thay bằng ảnh đúng của sản phẩm trước khi kinh doanh.</p>`,
  }),
);

const productSeeds: ProductSeed[] = [
  ...featuredProductSeeds,
  ...simpleProductSeeds,
];

async function returningId(
  queryRunner: QueryRunner,
  sql: string,
  parameters: unknown[],
): Promise<string> {
  const result: unknown = await queryRunner.query(sql, parameters);
  if (!Array.isArray(result) || result.length === 0) {
    throw new Error('Câu lệnh seed không trả về id.');
  }

  const row = result[0] as IdRow;
  return row.id;
}

async function seedRoles(
  queryRunner: QueryRunner,
): Promise<Map<string, string>> {
  const roleSeeds = [
    [
      '30000000-0000-4000-8000-000000000001',
      'admin',
      'Toàn quyền quản trị hệ thống',
    ],
    ['30000000-0000-4000-8000-000000000002', 'customer', 'Khách hàng mua sắm'],
    ['30000000-0000-4000-8000-000000000003', 'staff', 'Nhân viên vận hành'],
    [
      '30000000-0000-4000-8000-000000000004',
      'warehouse',
      'Nhân viên quản lý kho',
    ],
  ];
  const roleIds = new Map<string, string>();

  for (const [id, name, description] of roleSeeds) {
    const roleId = await returningId(
      queryRunner,
      `INSERT INTO roles (id, name, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (name) DO UPDATE
       SET description = EXCLUDED.description, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [id, name, description],
    );
    roleIds.set(name, roleId);
  }

  return roleIds;
}

async function seedUsers(
  queryRunner: QueryRunner,
  roleIds: Map<string, string>,
): Promise<void> {
  const password = await hash('ShopNow@123', 10);
  const userSeeds = [
    [
      '20000000-0000-4000-8000-000000000001',
      'admin@shopnow.local',
      'Quản trị viên ShopNow',
      '0900000001',
      'admin',
    ],
    [
      '20000000-0000-4000-8000-000000000002',
      'customer@shopnow.local',
      'Nguyễn Minh Anh',
      '0900000002',
      'customer',
    ],
    [
      '20000000-0000-4000-8000-000000000003',
      'staff@shopnow.local',
      'Trần Hoàng Nam',
      '0900000003',
      'staff',
    ],
    [
      '20000000-0000-4000-8000-000000000004',
      'warehouse@shopnow.local',
      'Lê Thu Hà',
      '0900000004',
      'warehouse',
    ],
  ];

  for (const [id, email, fullName, phone, roleName] of userSeeds) {
    const userId = await returningId(
      queryRunner,
      `INSERT INTO users (id, email, password, full_name, phone, is_active, avatar_url, refresh_token)
       VALUES ($1, $2, $3, $4, $5, TRUE, NULL, NULL)
       ON CONFLICT (email) DO UPDATE
       SET password = EXCLUDED.password, full_name = EXCLUDED.full_name,
           phone = EXCLUDED.phone, is_active = TRUE, deleted_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [id, email, password, fullName, phone],
    );
    const roleId = roleIds.get(roleName);
    if (!roleId) {
      throw new Error(`Không tìm thấy role ${roleName}.`);
    }

    await queryRunner.query(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, role_id) DO UPDATE
       SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP`,
      [userId, roleId],
    );
  }
}

async function seedCategories(
  queryRunner: QueryRunner,
): Promise<Map<string, string>> {
  const categoryIds = new Map<string, string>();

  for (const category of categorySeeds) {
    const parentId = category.parentSlug
      ? categoryIds.get(category.parentSlug)
      : null;
    if (category.parentSlug && !parentId) {
      throw new Error(`Không tìm thấy danh mục cha ${category.parentSlug}.`);
    }

    const categoryId = await returningId(
      queryRunner,
      `INSERT INTO categories (id, name, slug, description, is_active, parent_id)
       VALUES ($1, $2, $3, $4, TRUE, $5)
       ON CONFLICT (slug) DO UPDATE
       SET name = EXCLUDED.name, description = EXCLUDED.description,
           is_active = TRUE, parent_id = EXCLUDED.parent_id,
           deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [
        category.id,
        category.name,
        category.slug,
        category.description,
        parentId,
      ],
    );
    categoryIds.set(category.slug, categoryId);
  }

  return categoryIds;
}

async function seedVariant(
  queryRunner: QueryRunner,
  productId: string,
  variant: VariantSeed,
): Promise<void> {
  if (variant.sku) {
    await queryRunner.query(
      `INSERT INTO product_variants
         (id, product_id, parent_id, name, value, sku, unit_price, stock, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
       ON CONFLICT (sku) DO UPDATE
       SET product_id = EXCLUDED.product_id, parent_id = EXCLUDED.parent_id,
           name = EXCLUDED.name, value = EXCLUDED.value,
           unit_price = EXCLUDED.unit_price, stock = EXCLUDED.stock,
           sort_order = EXCLUDED.sort_order, is_active = TRUE,
           deleted_at = NULL, updated_at = CURRENT_TIMESTAMP`,
      [
        variant.id,
        productId,
        variant.parentId ?? null,
        variant.name,
        variant.value,
        variant.sku,
        variant.unitPrice ?? null,
        variant.stock,
        variant.sortOrder,
      ],
    );
    return;
  }

  await queryRunner.query(
    `INSERT INTO product_variants
       (id, product_id, parent_id, name, value, sku, unit_price, stock, sort_order, is_active)
     VALUES ($1, $2, NULL, $3, $4, NULL, NULL, $5, $6, TRUE)
     ON CONFLICT (id) DO UPDATE
     SET product_id = EXCLUDED.product_id, parent_id = NULL,
         name = EXCLUDED.name, value = EXCLUDED.value,
         stock = EXCLUDED.stock, sort_order = EXCLUDED.sort_order,
         is_active = TRUE, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP`,
    [
      variant.id,
      productId,
      variant.name,
      variant.value,
      variant.stock,
      variant.sortOrder,
    ],
  );
}

async function seedProducts(
  queryRunner: QueryRunner,
  categoryIds: Map<string, string>,
): Promise<void> {
  for (const product of productSeeds) {
    const categoryId = categoryIds.get(product.categorySlug);
    if (!categoryId) {
      throw new Error(`Không tìm thấy danh mục ${product.categorySlug}.`);
    }

    const productId = await returningId(
      queryRunner,
      `INSERT INTO products
         (id, name, slug, description, sku, unit_price, original_price,
          thumbnail_url, images, is_active, category_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, jsonb_build_array($8::text), TRUE, $9)
       ON CONFLICT (sku) DO UPDATE
       SET name = EXCLUDED.name, slug = EXCLUDED.slug,
           description = EXCLUDED.description, unit_price = EXCLUDED.unit_price,
           original_price = EXCLUDED.original_price, category_id = EXCLUDED.category_id,
           thumbnail_url = EXCLUDED.thumbnail_url, images = EXCLUDED.images,
           is_active = TRUE, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [
        product.id,
        product.name,
        product.slug,
        product.description,
        product.sku,
        product.unitPrice,
        product.originalPrice ?? null,
        PRODUCT_IMAGE_URL,
        categoryId,
      ],
    );

    for (const variant of product.variants ?? []) {
      await seedVariant(queryRunner, productId, variant);
    }

    await queryRunner.query(
      `INSERT INTO inventories
         (product_id, stock, reserved_stock, low_stock_threshold)
       VALUES ($1, $2, 0, $3)
       ON CONFLICT (product_id) DO UPDATE
       SET stock = EXCLUDED.stock, low_stock_threshold = EXCLUDED.low_stock_threshold,
           deleted_at = NULL, updated_at = CURRENT_TIMESTAMP`,
      [productId, product.stock, product.lowStockThreshold],
    );
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const dataSource = app.get(DataSource);
  const queryRunner = dataSource.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const roleIds = await seedRoles(queryRunner);
    await seedUsers(queryRunner, roleIds);
    const categoryIds = await seedCategories(queryRunner);
    await seedProducts(queryRunner, categoryIds);

    await queryRunner.commitTransaction();
    console.log(
      `Seed thành công: 4 tài khoản, ${categorySeeds.length} danh mục và ${productSeeds.length} sản phẩm.`,
    );
    console.log('Mật khẩu dùng chung cho tài khoản mẫu: ShopNow@123');
  } catch (error: unknown) {
    await queryRunner.rollbackTransaction();
    console.error('Seed thất bại:', error);
    process.exitCode = 1;
  } finally {
    await queryRunner.release();
    await app.close();
  }
}

void bootstrap();
