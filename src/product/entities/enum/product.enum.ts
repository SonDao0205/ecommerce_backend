export enum ProductStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  HIDDEN = 'HIDDEN',
  REJECTED = 'REJECTED',
}

export enum ProductVariantStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum ProductReviewStatus {
  ACTIVE = ProductStatus.ACTIVE,
  REJECTED = ProductStatus.REJECTED,
}
