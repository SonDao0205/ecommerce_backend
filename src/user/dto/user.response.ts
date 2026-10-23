import { User } from '../../entities/user.entity.js';

export class UserResponse {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  avatar_url: string | null;
  email_verified: boolean;
  role: string;
  status: string;
  created_at: Date;
  updated_at: Date;

  constructor(user: User) {
    this.id = user.id;
    this.full_name = user.full_name;
    this.email = user.email;
    this.phone = user.phone;
    this.avatar_url = user.avatar_url;
    this.email_verified = Number(user.email_verified) === 1;
    this.role = user.role;
    this.status = user.status;
    this.created_at = user.created_at;
    this.updated_at = user.updated_at;
  }
}
