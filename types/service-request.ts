export type ServiceRequestType = "bom_review" | "sampling_review" | "creator_plan";

export type CreateServiceRequestInput = {
  projectId: string;
  requestType: ServiceRequestType;
  contactInfo: string;
  requestNote: string;
  metadata: Record<string, string | boolean>;
};
