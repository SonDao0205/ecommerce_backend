import { User } from '../../user/entities/user.entity.js';

export class LoginResponse {
  role: string;
  status: string;
  access_token: string;
  refresh_token: string;

  constructor(user: User, access_token: string, refresh_token: string) {
    this.role = user.role;
    this.status = user.status;
    this.access_token = access_token;
    this.refresh_token = refresh_token;
  }
}
