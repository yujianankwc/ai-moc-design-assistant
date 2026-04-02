export type IntentSourceType = "small_batch" | "crowdfunding" | "pro_upgrade" | "manual_consult";

export type IntentStatus =
  | "new"
  | "contact_pending"
  | "contacted"
  | "confirming"
  | "quoted"
  | "deposit_pending"
  | "locked"
  | "preparing_delivery"
  | "delivering"
  | "delivered"
  | "closed_won"
  | "closed_lost";

export type IntentPriority = "low" | "normal" | "high" | "urgent";

export type QuoteStatus = "draft" | "sent" | "accepted" | "expired" | "replaced" | "converted_to_order";

export type QuotePaymentMode = "deposit" | "full" | "crowdfunding_support";

export type IntentSnapshotInput = {
  projectTitle?: string;
  resultSummary?: string;
  intentKind?: "quick_publish" | "purchase_interest";
  selectedQuantity?: number;
  packageLevel?: string;
  designServiceLevel?: string;
  saleMode?: string;
  crowdfundingTargetPeople?: number;
  estimatedUnitPriceMin?: number;
  estimatedUnitPriceMax?: number;
  estimatedTotalPriceMin?: number;
  estimatedTotalPriceMax?: number;
  discountAmount?: number;
  pricingMeta?: Record<string, unknown>;
  uiContext?: Record<string, unknown>;
};

export type CreateIntentInput = {
  projectId?: string;
  sourceType: IntentSourceType;
  contactName?: string;
  contactPhoneOrWechat?: string;
  contactPreference?: string;
  preferPriorityContact?: boolean;
  operatorNote?: string;
  snapshot: IntentSnapshotInput;
};

export type CreateQuoteInput = {
  validUntil?: string;
  quantity: number;
  packageLevel: string;
  designServiceLevel: string;
  finalUnitPrice: number;
  finalTotalPrice: number;
  designFee?: number;
  discountAmount?: number;
  depositAmount?: number;
  paymentMode?: QuotePaymentMode;
  deliveryNote?: string;
  productionNote?: string;
  riskNote?: string;
  extra?: Record<string, unknown>;
  confirmedBy?: string;
};
