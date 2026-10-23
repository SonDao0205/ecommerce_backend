import { Address } from '../entities/address.entity.js';

export class AddressResponse {
  id: string;
  recipient_name: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  street_detail: string;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;

  constructor(address: Address) {
    this.id = address.id;
    this.recipient_name = address.recipient_name;
    this.phone = address.phone;
    this.province = address.province;
    this.district = address.district;
    this.ward = address.ward;
    this.street_detail = address.street_detail;
    this.is_default = address.is_default;
    this.created_at = address.created_at;
    this.updated_at = address.updated_at;
  }
}
