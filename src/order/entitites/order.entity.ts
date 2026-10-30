import { Entity } from 'typeorm';

@Entity({
  name: 'orders',
})
export class Order {
  id: string;
}
