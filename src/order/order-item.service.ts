import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ProductVariant } from '../product/entities/product_variant.entity.js';
import { OrderItem } from './entities/order_item.entity.js';

@Injectable()
export class OrderItemService {
  /** Tạo snapshot các mặt hàng của shop_order trong transaction của order. */
  async createItems(
    manager: EntityManager,
    shopOrderId: string,
    variants: ProductVariant[],
    quantities: Map<string, number>,
    calculateLineTotal: (price: string, quantity: number) => string,
  ): Promise<OrderItem[]> {
    const repository = manager.getRepository(OrderItem);
    const items = variants.map((variant) => {
      const quantity = quantities.get(variant.id)!;
      return repository.create({
        shop_order_id: shopOrderId,
        product_id: variant.product_id,
        variant_id: variant.id,
        product_name: variant.product.name,
        variant_name: variant.name,
        sku: variant.sku,
        unit_price: variant.price,
        quantity,
        line_total: calculateLineTotal(variant.price, quantity),
      });
    });
    return repository.save(items);
  }
}
