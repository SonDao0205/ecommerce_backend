import { Controller } from '@nestjs/common';
import { ShopService } from './shop.service.js';

@Controller('shop')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}
}
