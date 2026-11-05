import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { PaymentService } from '../payment/payment.service.js';
import { ProductVariantService } from '../product/product-variant.service.js';
import { ShippingService } from '../shipping/shipping.service.js';
import { ShopService } from '../shop/shop.service.js';
import { UserService } from '../user/user.service.js';
import { UserRole } from '../user/entities/enums/user.enum.js';
import { VoucherActor, VoucherService } from '../voucher/voucher.service.js';
import { CreateOrderDto } from './dto/create_order.dto.js';
import { Order } from './entities/order.entity.js';
import { OrderItemService } from './order-item.service.js';

@Injectable()
export class OrderService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly voucherService: VoucherService,
    private readonly userService: UserService,
    private readonly paymentService: PaymentService,
    private readonly shippingService: ShippingService,
    private readonly productVariantService: ProductVariantService,
    private readonly shopService: ShopService,
    private readonly orderItemService: OrderItemService,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  /** Tạo order cho một shop; mọi giá tiền đều được tính từ dữ liệu DB. */
  createOrder = async (user_id: string, input: CreateOrderDto) => {
    // 1. Kiểm tra payload và xác nhận địa chỉ thuộc đúng user đang đặt hàng.
    if (!input.items?.length) {
      throw new BadRequestException('Đơn hàng phải có ít nhất một sản phẩm.');
    }
    const quantities = new Map<string, number>();
    for (const item of input.items) {
      if (
        !item.product_variant_id ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
      ) {
        throw new BadRequestException(
          'Sản phẩm và số lượng đặt hàng không hợp lệ.',
        );
      }
      quantities.set(
        item.product_variant_id,
        (quantities.get(item.product_variant_id) ?? 0) + item.quantity,
      );
    }
    const address = await this.userService.getAddressForUser(
      input.address_id,
      user_id,
    );

    // 2. Kiểm tra phương thức thanh toán và giao hàng đang được kích hoạt.
    const [paymentMethod, shippingMethod] = await Promise.all([
      this.paymentService.getActiveMethod(input.payment_method_id),
      this.shippingService.getActiveMethod(input.shipping_method_id),
    ]);

    const requestedVariantIds = [...quantities.keys()];
    const variants =
      await this.productVariantService.getOrderableVariants(
        requestedVariantIds,
      );

    // TODO hiện chỉ nhận một shipping_method_id, nên các item trong order phải
    // thuộc cùng một shop để không gán nhầm phương thức giao hàng cho shop khác.
    const shopIds = new Set(variants.map((variant) => variant.product.shop_id));
    if (shopIds.size !== 1) {
      throw new BadRequestException(
        'Mỗi order chỉ được chứa sản phẩm từ một shop.',
      );
    }
    const shopId = variants[0]!.product.shop_id;
    const amountByVariant = variants.map((variant) =>
      this.multiplyMoney(variant.price, quantities.get(variant.id)!),
    );
    const subtotal = this.sumMoney(amountByVariant);

    // 3. Voucher người dùng nhập được validate trong applyVouchers. Nếu có
    // voucher sàn hợp lệ, tự thêm mã đó để apply cùng lúc với các mã người dùng.
    const voucherCodes = [...(input.voucher_codes ?? [])];
    const platformVoucher =
      await this.voucherService.findAutomaticPlatformVoucher(subtotal, user_id);
    if (
      platformVoucher &&
      !voucherCodes.some(
        (code) => code.trim().toUpperCase() === platformVoucher.code,
      )
    ) {
      voucherCodes.push(platformVoucher.code);
    }
    const priced = await this.calculateOrderPrice(
      amountByVariant,
      voucherCodes,
      shopId,
      { id: user_id, role: UserRole.CLIENT },
    );
    const discountAmount = this.subtractMoney(subtotal, priced.final_amount);
    const shippingFee = shippingMethod.base_fee;
    const totalAmount = this.addMoney(priced.final_amount, shippingFee);

    // 4. Transaction khóa tồn kho, tạo order và shop_order, trừ kho, rồi tạo
    // order_item. Bất kỳ lỗi nào cũng rollback toàn bộ thay đổi trong transaction.
    return this.dataSource.transaction(async (manager) => {
      const lockedVariants =
        await this.productVariantService.lockOrderableVariants(
          manager,
          quantities,
          variants,
        );

      const order = await this.orderRepository.save(
        this.orderRepository.create({
          order_number: `ORD-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`,
          user_id,
          address_id: address.id,
          payment_method_id: paymentMethod.id,
          subtotal,
          discount_amount: discountAmount,
          shipping_fee: shippingFee,
          total_amount: totalAmount,
          customer_note: input.customer_note?.trim() || null,
        }),
      );
      const shopOrder = await this.shopService.createShopOrder(manager, {
        order_id: order.id,
        shop_id: shopId,
        shipping_method_id: shippingMethod.id,
        subtotal,
        discount_amount: discountAmount,
        shipping_fee: shippingFee,
        total_amount: totalAmount,
      });

      for (const variant of lockedVariants) {
        const quantity = quantities.get(variant.id)!;
        await this.productVariantService.decreaseOrderStock(
          manager,
          variant,
          quantity,
        );
      }
      await this.orderItemService.createItems(
        manager,
        shopOrder.id,
        lockedVariants,
        quantities,
        (price, quantity) => this.multiplyMoney(price, quantity),
      );
      return this.orderRepository.findOne({
        where: { id: order.id },
        relations: { shop_orders: { items: true } },
      });
    });
  };

  /** Apply voucher service is called even when no code was supplied. */
  private calculateOrderPrice = async (
    variantAmounts: string[],
    voucher_codes: string[],
    shop_id: string,
    actor: VoucherActor,
  ) => {
    const subtotal = this.sumMoney(variantAmounts);
    return this.voucherService.applyVouchers(
      { subtotal, voucher_codes, shop_id },
      actor,
    );
  };

  private toCents(amount: string): bigint {
    const [whole, fraction = ''] = amount.split('.');
    return BigInt(`${whole}${fraction.padEnd(2, '0').slice(0, 2)}`);
  }

  private fromCents(amount: bigint): string {
    return `${amount / 100n}.${(amount % 100n).toString().padStart(2, '0')}`;
  }

  private sumMoney(amounts: string[]): string {
    return this.fromCents(
      amounts.reduce((sum, amount) => sum + this.toCents(amount), 0n),
    );
  }

  private multiplyMoney(amount: string, quantity: number): string {
    return this.fromCents(this.toCents(amount) * BigInt(quantity));
  }

  private addMoney(first: string, second: string): string {
    return this.fromCents(this.toCents(first) + this.toCents(second));
  }

  private subtractMoney(first: string, second: string): string {
    return this.fromCents(this.toCents(first) - this.toCents(second));
  }
}
