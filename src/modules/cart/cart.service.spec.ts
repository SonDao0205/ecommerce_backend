import { CartService } from './cart.service';
import { CartRepository } from './cart.repository';
import type { Cart, CartItem, Product, ProductVariant } from '@entities';

describe('CartService', () => {
  const cart = { id: 'cart-id', userId: 'user-id' } as Cart;
  const product = {
    id: 'product-id',
    name: 'iPhone',
    slug: 'iphone',
    sku: 'PHONE-BASE',
    unitPrice: 100,
    isActive: true,
  } as Product;
  const variant = {
    id: 'variant-id',
    productId: 'product-id',
    name: 'Dung lượng',
    value: '256GB',
    sku: 'PHONE-256',
    unitPrice: 120,
    stock: 10,
    isActive: true,
  } as ProductVariant;

  function createRepository() {
    return {
      findCartByUserId: jest.fn().mockResolvedValue(cart),
      createCart: jest.fn(),
      findItems: jest.fn().mockResolvedValue([]),
      findItem: jest.fn(),
      findItemForUser: jest.fn(),
      findProduct: jest.fn().mockResolvedValue(product),
      findVariant: jest.fn().mockResolvedValue(variant),
      countActiveVariants: jest.fn().mockResolvedValue(2),
      countActiveVariantChildren: jest.fn().mockResolvedValue(0),
      findInventory: jest.fn(),
      addItemAtomic: jest.fn(),
      saveItem: jest.fn(),
      createItem: jest.fn(),
      removeItem: jest.fn(),
      clearCart: jest.fn(),
    };
  }

  it('không thay đổi số lượng khi merge sản phẩm đã có trong database', async () => {
    const repository = createRepository();
    const existing = {
      id: 'item-id',
      cartId: cart.id,
      productId: product.id,
      variantId: variant.id,
      product,
      variant,
      quantity: 2,
    } as CartItem;
    repository.addItemAtomic.mockResolvedValue({ status: 'skipped' });
    repository.findItems.mockResolvedValue([existing]);
    const service = new CartService(repository as unknown as CartRepository);

    const result = await service.mergeCart('user-id', {
      items: [
        { productSku: 'PHONE-BASE', variantSku: 'PHONE-256', quantity: 5 },
      ],
    });

    expect(result.mergedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(result.items[0].quantity).toBe(2);
    expect(repository.saveItem).not.toHaveBeenCalled();
  });

  it('thêm sản phẩm mới khi merge và giữ đúng số lượng giỏ khách', async () => {
    const repository = createRepository();
    const newItem = {
      cartId: cart.id,
      productId: product.id,
      variantId: variant.id,
    } as CartItem;
    repository.addItemAtomic.mockResolvedValue({
      status: 'saved',
      item: { ...newItem, id: 'item-id', quantity: 3 },
    });
    repository.findItems.mockImplementation(() =>
      Promise.resolve([
        { ...newItem, id: 'item-id', product, variant, quantity: 3 },
      ]),
    );
    const service = new CartService(repository as unknown as CartRepository);

    const result = await service.mergeCart('user-id', {
      items: [
        { productSku: 'PHONE-BASE', variantSku: 'PHONE-256', quantity: 3 },
      ],
    });

    expect(result.mergedCount).toBe(1);
    expect(result.items[0].quantity).toBe(3);
    expect(repository.addItemAtomic).toHaveBeenCalledWith(
      cart.id,
      product.id,
      variant.id,
      3,
      10,
      true,
    );
  });
});
