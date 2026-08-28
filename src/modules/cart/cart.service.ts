import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cart, CartItem, Inventory, Product, ProductVariant } from '@entities';
import { CartRepository } from './cart.repository';
import { CartItemDto, UpdateCartItemDto } from './dto/cart-item.dto';
import { MergeCartDto } from './dto/merge-cart.dto';

export interface CartItemView {
  id: string;
  quantity: number;
  unitPrice: number;
  product: {
    id: string;
    name?: string;
    slug?: string;
    sku?: string;
    thumbnailUrl?: string;
    isActive?: boolean;
  };
  variant?: {
    id: string;
    name: string;
    value: string;
    sku?: string | null;
    stock: number;
  };
}

export interface CartView {
  id?: string;
  items: CartItemView[];
  totalQuantity: number;
  totalAmount: number;
}

@Injectable()
export class CartService {
  constructor(private readonly cartRepository: CartRepository) {}

  async getCart(userId: string): Promise<CartView> {
    const cart = await this.cartRepository.findCartByUserId(userId);
    if (!cart?.id) return this.emptyCart();
    return this.buildCartView(cart);
  }

  async addItem(userId: string, dto: CartItemDto): Promise<CartView> {
    await this.persistItem(userId, dto, false);
    return this.getCart(userId);
  }

  async mergeCart(
    userId: string,
    dto: MergeCartDto,
  ): Promise<CartView & { mergedCount: number; skippedCount: number }> {
    let mergedCount = 0;
    let skippedCount = 0;

    for (const item of dto.items) {
      try {
        const inserted = await this.persistItem(userId, item, true);
        if (inserted) mergedCount++;
        else skippedCount++;
      } catch (error) {
        if (error instanceof HttpException) skippedCount++;
        else throw error;
      }
    }

    return {
      ...(await this.getCart(userId)),
      mergedCount,
      skippedCount,
    };
  }

  async updateItem(
    userId: string,
    itemId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartView> {
    const item = await this.cartRepository.findItemForUser(itemId, userId);
    if (!item?.product) {
      throw new NotFoundException('Không tìm thấy sản phẩm trong giỏ hàng!');
    }
    await this.assertStock(
      item.product,
      item.variant ?? undefined,
      dto.quantity,
    );
    item.quantity = dto.quantity;
    await this.cartRepository.saveItem(item);
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string): Promise<CartView> {
    const item = await this.cartRepository.findItemForUser(itemId, userId);
    if (!item) {
      throw new NotFoundException('Không tìm thấy sản phẩm trong giỏ hàng!');
    }
    await this.cartRepository.removeItem(item);
    return this.getCart(userId);
  }

  async clearCart(userId: string): Promise<CartView> {
    const cart = await this.cartRepository.findCartByUserId(userId);
    if (cart?.id) await this.cartRepository.clearCart(cart.id);
    return this.emptyCart(cart?.id);
  }

  private async persistItem(
    userId: string,
    dto: CartItemDto,
    ignoreExisting: boolean,
  ): Promise<boolean> {
    if (!dto.productId && !dto.productSku?.trim()) {
      throw new BadRequestException('Cần cung cấp productId hoặc productSku!');
    }

    const product = await this.cartRepository.findProduct(
      dto.productId,
      dto.productSku?.trim(),
    );
    if (!product?.id) {
      throw new NotFoundException('Sản phẩm không tồn tại hoặc đã bị ẩn!');
    }

    const variant =
      dto.variantId || dto.variantSku
        ? await this.cartRepository.findVariant(
            dto.variantId,
            dto.variantSku?.trim(),
          )
        : undefined;
    const selectedVariant = variant ?? undefined;

    await this.validateVariant(product, selectedVariant);

    const cart = await this.getOrCreateCart(userId);
    const existing = await this.cartRepository.findItem(
      cart.id!,
      product.id,
      selectedVariant?.id,
    );
    if (existing && ignoreExisting) return false;

    const nextQuantity = (existing?.quantity ?? 0) + dto.quantity;
    await this.assertStock(product, selectedVariant, nextQuantity);

    const item =
      existing ??
      this.cartRepository.createItem({
        cartId: cart.id,
        productId: product.id,
        variantId: selectedVariant?.id ?? null,
      });
    item.quantity = nextQuantity;
    await this.cartRepository.saveItem(item);
    return true;
  }

  private async getOrCreateCart(userId: string): Promise<Cart> {
    return (
      (await this.cartRepository.findCartByUserId(userId)) ??
      this.cartRepository.createCart(userId)
    );
  }

  private async validateVariant(
    product: Product,
    variant?: ProductVariant | null,
  ): Promise<void> {
    const variantCount = await this.cartRepository.countActiveVariants(
      product.id!,
    );
    if (!variant) {
      if (variantCount > 0) {
        throw new BadRequestException(
          'Vui lòng chọn đầy đủ biến thể sản phẩm!',
        );
      }
      return;
    }
    if (variant.productId !== product.id) {
      throw new BadRequestException('Biến thể không thuộc sản phẩm đã chọn!');
    }
    const childCount = await this.cartRepository.countActiveVariantChildren(
      variant.id!,
    );
    if (childCount > 0) {
      throw new BadRequestException(
        'Chỉ được thêm biến thể cuối vào giỏ hàng!',
      );
    }
  }

  private async assertStock(
    product: Product,
    variant: ProductVariant | undefined,
    quantity: number,
  ): Promise<void> {
    if (variant && variant.stock < quantity) {
      throw new BadRequestException('Số lượng vượt quá tồn kho biến thể!');
    }
    if (!variant) {
      const inventory = await this.cartRepository.findInventory(product.id!);
      if (inventory && this.availableStock(inventory) < quantity) {
        throw new BadRequestException('Số lượng vượt quá tồn kho sản phẩm!');
      }
    }
  }

  private availableStock(inventory: Inventory): number {
    return Math.max(0, (inventory.stock ?? 0) - (inventory.reservedStock ?? 0));
  }

  private async buildCartView(cart: Cart): Promise<CartView> {
    const items = await this.cartRepository.findItems(cart.id!);
    const viewItems = items.flatMap((item) => this.toItemView(item));
    return {
      id: cart.id,
      items: viewItems,
      totalQuantity: viewItems.reduce((sum, item) => sum + item.quantity, 0),
      totalAmount: viewItems.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0,
      ),
    };
  }

  private toItemView(item: CartItem): CartItemView[] {
    if (!item.id || !item.product?.id || !item.product.isActive) return [];
    const unitPrice = Number(
      item.variant?.unitPrice ?? item.product.unitPrice ?? 0,
    );
    return [
      {
        id: item.id,
        quantity: item.quantity ?? 1,
        unitPrice,
        product: {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          sku: item.product.sku,
          thumbnailUrl: item.product.thumbnailUrl,
          isActive: item.product.isActive,
        },
        ...(item.variant?.id && {
          variant: {
            id: item.variant.id,
            name: item.variant.name,
            value: item.variant.value,
            sku: item.variant.sku,
            stock: item.variant.stock,
          },
        }),
      },
    ];
  }

  private emptyCart(id?: string): CartView {
    return { id, items: [], totalQuantity: 0, totalAmount: 0 };
  }
}
