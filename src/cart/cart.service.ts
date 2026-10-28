import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from './entities/cart.entity.js';
import { CartItem } from './entities/cart-item.entity.js';
import { ProductVariant } from '../product/entities/product_variant.entity.js';
import {
  ProductStatus,
  ProductVariantStatus,
} from '../product/entities/enum/product.enum.js';

type CartItemResponse = {
  id: string;
  variant_id: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
  variant: {
    sku: string;
    name: string | null;
    image_url: string | null;
  };
  product: {
    id: string;
    name: string;
    thumbnail_url: string | null;
  };
};

type CartResponse = {
  id: string;
  items: CartItemResponse[];
  total_quantity: number;
  total_amount: string;
};

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
  ) {}

  /** Lấy giỏ hàng của user, kèm giá hiện tại và tổng tiền từng dòng. */
  async getCart(userId: string): Promise<CartResponse> {
    const cart = await this.getOrCreateCart(userId);
    return this.toCartResponse(await this.loadCart(cart.id));
  }

  /** Thêm variant vào giỏ; nếu đã có thì cộng quantity vào dòng hiện có. */
  async addItem(
    userId: string,
    variantId: string,
    quantity = 1,
  ): Promise<CartResponse> {
    this.validateQuantity(quantity);
    const variant = await this.findAvailableVariant(variantId);
    const cart = await this.getOrCreateCart(userId);
    const item = await this.cartItemRepository.findOneBy({
      cart_id: cart.id,
      variant_id: variant.id,
    });
    const nextQuantity = (item?.quantity ?? 0) + quantity;

    this.validateStock(variant, nextQuantity);

    if (item) {
      item.quantity = nextQuantity;
      await this.cartItemRepository.save(item);
    } else {
      await this.cartItemRepository.save(
        this.cartItemRepository.create({
          cart_id: cart.id,
          variant_id: variant.id,
          quantity,
        }),
      );
    }

    return this.toCartResponse(await this.loadCart(cart.id));
  }

  /** Đặt quantity mới cho variant đã có trong giỏ và trả giá hiện tại. */
  async updateItemQuantity(
    userId: string,
    variantId: string,
    quantity: number,
  ): Promise<CartResponse> {
    this.validateQuantity(quantity);
    const cart = await this.findCart(userId);
    if (!cart) throw new NotFoundException('Giỏ hàng không tồn tại.');

    const item = await this.cartItemRepository.findOne({
      where: { cart_id: cart.id, variant_id: variantId },
      relations: { variant: true },
    });
    if (!item) {
      throw new NotFoundException('Sản phẩm không có trong giỏ hàng.');
    }

    const variant = await this.findAvailableVariant(variantId);
    this.validateStock(variant, quantity);

    item.quantity = quantity;
    await this.cartItemRepository.save(item);
    return this.toCartResponse(await this.loadCart(cart.id));
  }

  /** Xóa toàn bộ số lượng của một variant khỏi giỏ hàng. */
  async removeItem(userId: string, variantId: string): Promise<CartResponse> {
    const cart = await this.findCart(userId);
    if (!cart) throw new NotFoundException('Giỏ hàng không tồn tại.');

    const result = await this.cartItemRepository.delete({
      cart_id: cart.id,
      variant_id: variantId,
    });
    if (!result.affected) {
      throw new NotFoundException('Sản phẩm không có trong giỏ hàng.');
    }

    return this.toCartResponse(await this.loadCart(cart.id));
  }

  /** Xóa tất cả dòng sản phẩm trong giỏ nhưng vẫn giữ cart của user. */
  async clearCart(userId: string): Promise<CartResponse> {
    const cart = await this.getOrCreateCart(userId);

    await this.cartItemRepository.delete({ cart_id: cart.id });
    return this.toCartResponse(await this.loadCart(cart.id));
  }

  /** Tìm cart hiện có của user mà không tự tạo cart mới. */
  private async findCart(userId: string): Promise<Cart | null> {
    return this.cartRepository.findOneBy({ user_id: userId });
  }

  /** Tạo cart nếu chưa có; insert bỏ qua xung đột để an toàn khi request đồng thời. */
  private async getOrCreateCart(userId: string): Promise<Cart> {
    await this.cartRepository
      .createQueryBuilder()
      .insert()
      .values({ user_id: userId })
      .orIgnore()
      .execute();

    const cart = await this.findCart(userId);
    if (!cart) throw new NotFoundException('Không thể khởi tạo giỏ hàng.');
    return cart;
  }

  /** Tải cart cùng variant và product để dựng thông tin giỏ hàng trả về. */
  private async loadCart(cartId: string): Promise<Cart> {
    const cart = await this.cartRepository.findOne({
      where: { id: cartId },
      relations: { items: { variant: { product: true } } },
      order: { items: { created_at: 'ASC' } },
    });
    if (!cart) throw new NotFoundException('Giỏ hàng không tồn tại.');
    return cart;
  }

  /** Chỉ cho phép thêm sản phẩm đang ACTIVE với variant đang bán. */
  private async findAvailableVariant(variantId: string): Promise<ProductVariant> {
    const variant = await this.variantRepository.findOne({
      where: {
        id: variantId,
        status: ProductVariantStatus.ACTIVE,
        product: { status: ProductStatus.ACTIVE, is_deleted: 0 },
      },
      relations: { product: true },
    });
    if (!variant) {
      throw new NotFoundException(
        'Không tìm thấy biến thể đang được kinh doanh.',
      );
    }
    return variant;
  }

  /** Chặn quantity không hợp lệ hoặc vượt quá tồn kho của variant. */
  private validateStock(variant: ProductVariant, quantity: number): void {
    if (quantity > variant.stock) {
      throw new BadRequestException(
        `Số lượng vượt quá tồn kho. Hiện chỉ còn ${variant.stock} sản phẩm.`,
      );
    }
  }

  /** Đảm bảo quantity là số nguyên dương trước khi ghi vào database. */
  private validateQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestException('Số lượng phải là số nguyên lớn hơn 0.');
    }
  }

  /** Đổi giá decimal sang số cent để cộng tiền không bị sai số float. */
  private toCents(price: string): bigint {
    const [whole, fraction = ''] = price.split('.');
    const normalizedFraction = fraction.padEnd(2, '0').slice(0, 2);
    return BigInt(`${whole}${normalizedFraction}`);
  }

  /** Định dạng tổng cent thành chuỗi tiền tệ có hai chữ số thập phân. */
  private fromCents(amount: bigint): string {
    const whole = amount / 100n;
    const fraction = (amount % 100n).toString().padStart(2, '0');
    return `${whole}.${fraction}`;
  }

  /** Tạo response chi tiết; unit_price luôn đọc từ giá mới nhất của variant. */
  private toCartResponse(cart: Cart): CartResponse {
    let totalAmount = 0n;
    let totalQuantity = 0;

    const items = (cart.items ?? []).map((item): CartItemResponse => {
      const unitPrice = this.toCents(item.variant.price);
      const subtotal = unitPrice * BigInt(item.quantity);
      totalAmount += subtotal;
      totalQuantity += item.quantity;

      return {
        id: item.id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price: this.fromCents(unitPrice),
        subtotal: this.fromCents(subtotal),
        variant: {
          sku: item.variant.sku,
          name: item.variant.name,
          image_url: item.variant.image_url,
        },
        product: {
          id: item.variant.product.id,
          name: item.variant.product.name,
          thumbnail_url: item.variant.product.thumbnail_url,
        },
      };
    });

    return {
      id: cart.id,
      items,
      total_quantity: totalQuantity,
      total_amount: this.fromCents(totalAmount),
    };
  }
}
