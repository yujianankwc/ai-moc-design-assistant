export type ServiceRequestType = "bom_review" | "sampling_review" | "creator_plan";

export type ServiceRequestStatus = "pending" | "reviewing" | "responded" | "converted" | "closed";

export type CreateServiceRequestInput = {
  projectId: string;
  requestType: ServiceRequestType;
  contactInfo: string;
  requestNote: string;
  metadata: Record<string, string | boolean>;
};

export type ServiceRequestRow = {
  id: string;
  project_id: string;
  user_id: string;
  request_type: ServiceRequestType;
  contact_info: string;
  request_note: string;
  metadata: Record<string, string | boolean>;
  status: ServiceRequestStatus;
  operator_note?: string | null;
  handled_by?: string | null;
  responded_at?: string | null;
  created_at: string;
  updated_at: string;
  project_title?: string | null;
};
