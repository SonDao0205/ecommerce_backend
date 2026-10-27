import { Shop } from '../entities/shop.entity.js';

export class ShopResponse {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  phone: string | null;
  warehouse_address: string | null;
  status: string;
  follower_count: number;
  approved_at: Date | null;
  created_at: Date;
  updated_at: Date;

  constructor(shop: Shop) {
    this.id = shop.id;
    this.name = shop.name;
    this.description = shop.description;
    this.logo_url = shop.logo_url;
    this.banner_url = shop.banner_url;
    this.phone = shop.phone;
    this.warehouse_address = shop.warehouse_address;
    this.status = shop.status;
    this.follower_count = shop.follower_count;
    this.approved_at = shop.approved_at;
    this.created_at = shop.created_at;
    this.updated_at = shop.updated_at;
  }
}
