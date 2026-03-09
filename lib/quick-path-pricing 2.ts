export type BatchQuantity = 1 | 10 | 50 | 100 | 200;
export type PackagingLevel = "basic" | "standard_gift" | "premium_gift";
export type DesignServiceLevel = "direct_sample" | "design_optimize" | "senior_collab";

type PricingRange = {
  min: number;
  max: number;
};

export type BatchQuoteResult = {
  unitPriceRange: PricingRange;
  totalPriceRange: PricingRange;
  unitPriceEstimate: number;
  totalPriceEstimate: number;
  designFee: number;
  discountAmount: number;
  recommendation: string;
};

const BASE_UNIT_COST = 199;
const BASE_HANDLING_FEE = 199;

const QUANTITY_FACTOR: Record<BatchQuantity, number> = {
  1: 2.6,
  10: 1.7,
  50: 1.15,
  100: 1.0,
  200: 0.92
};

const PACKAGING_COST: Record<PackagingLevel, number> = {
  basic: 0,
  standard_gift: 19,
  premium_gift: 49
};

const DESIGN_FEE_BY_LEVEL: Record<DesignServiceLevel, number> = {
  direct_sample: 0,
  design_optimize: 399,
  senior_collab: 999
};

const DYNAMIC_HINT_BY_QUANTITY: Record<BatchQuantity, string> = {
  1: "适合先看实物方向，但单套成本最高",
  10: "适合小范围送样或内部验证",
  50: "这是当前更推荐的试水档位",
  100: "更适合初步售卖验证",
  200: "数量更高时，单套成本通常更容易压下来"
};

export function formatCnyRange(range: PricingRange) {
  return `¥${Math.round(range.min)} - ¥${Math.round(range.max)}`;
}

export function computeBatchQuote(input: {
  quantity: BatchQuantity;
  packaging: PackagingLevel;
  designService: DesignServiceLevel;
}): BatchQuoteResult {
  let discountAmount = 0;
  if (input.quantity >= 100 && input.designService === "design_optimize") {
    discountAmount = 399;
  } else if (input.quantity >= 50 && input.designService === "design_optimize") {
    discountAmount = 199;
  }
  if (input.quantity >= 100 && input.designService === "senior_collab") {
    discountAmount = 399;
  }

  const baseDesignFee = DESIGN_FEE_BY_LEVEL[input.designService];
  const designFee = Math.max(0, baseDesignFee - discountAmount);
  const unitPriceEstimate = BASE_UNIT_COST * QUANTITY_FACTOR[input.quantity] + PACKAGING_COST[input.packaging];
  const totalPriceEstimate = unitPriceEstimate * input.quantity + BASE_HANDLING_FEE + designFee;
  const unitPriceRange: PricingRange = {
    min: unitPriceEstimate * 0.9,
    max: unitPriceEstimate * 1.1
  };
  const totalPriceRange: PricingRange = {
    min: totalPriceEstimate * 0.9,
    max: totalPriceEstimate * 1.1
  };

  const recommendation = DYNAMIC_HINT_BY_QUANTITY[input.quantity];

  return {
    unitPriceRange,
    totalPriceRange,
    unitPriceEstimate,
    totalPriceEstimate,
    designFee,
    discountAmount,
    recommendation
  };
}

