export type BatchQuantity = 1 | 10 | 50 | 100 | 200 | 500 | 1000 | 3000;
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
  200: 0.92,
  500: 0.86,
  1000: 0.79,
  3000: 0.72
};

const PACKAGING_COST: Record<PackagingLevel, number> = {
  basic: 0,
  standard_gift: 19,
  premium_gift: 49
};

const DESIGN_BASE_FEE = 199;
const DESIGN_ADDON_BY_LEVEL: Record<DesignServiceLevel, number> = {
  direct_sample: 0,
  design_optimize: 200,
  senior_collab: 800
};

const DYNAMIC_HINT_BY_QUANTITY: Record<BatchQuantity, string> = {
  1: "适合先看实物方向，但单套成本最高",
  10: "适合小范围送样或内部验证",
  50: "这是当前更推荐的试水档位",
  100: "更适合初步售卖验证",
  200: "数量更高时，单套成本通常更容易压下来",
  500: "进入小批量推进档，单套成本更稳",
  1000: "接近量产测试档，适合做渠道验证",
  3000: "大货推进档，建议结合排产做人工询价"
};

export function formatCnyRange(range: PricingRange) {
  return `¥${Math.round(range.min)} - ¥${Math.round(range.max)}`;
}

export function computeBatchQuote(input: {
  quantity: BatchQuantity;
  packaging: PackagingLevel;
  designService: DesignServiceLevel;
}): BatchQuoteResult {
  const hasDesignService = input.designService !== "direct_sample";
  const baseDesignFee = hasDesignService ? DESIGN_BASE_FEE : 0;
  const addonFee = DESIGN_ADDON_BY_LEVEL[input.designService];

  let discountAmount = 0;
  // 满 50 套：免基础设计费
  if (input.quantity >= 50 && hasDesignService) {
    discountAmount += DESIGN_BASE_FEE;
  }
  // 满 100 套：抵扣部分设计优化费
  if (input.quantity >= 100) {
    if (input.designService === "design_optimize") {
      discountAmount += 100;
    } else if (input.designService === "senior_collab") {
      discountAmount += 200;
    }
  }

  const rawDesignFee = baseDesignFee + addonFee;
  const designFee = Math.max(0, rawDesignFee - discountAmount);
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

