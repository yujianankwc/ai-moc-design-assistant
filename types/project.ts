export type ProjectStatus = "draft" | "generating" | "ready" | "failed";

export type ProjectFormPayload = {
  title: string;
  category: string;
  style: string;
  size_target: string;
  size_note: string;
  audience: string;
  description: string;
  must_have_elements: string;
  avoid_elements: string;
  build_goal: string;
  collaboration_goal: string;
  willing_creator_plan: string;
  willing_sampling: string;
  reference_links: string;
  notes_for_factory: string;
};

export type ProjectRow = {
  id: string;
  user_id: string;
  title: string | null;
  category?: string | null;
  status: ProjectStatus;
  updated_at: string;
  notes_for_factory?: string | null;
  linked_intent?: {
    id: string;
    source_type: string;
    status: string;
    updated_at: string;
    latest_quote_status?: string | null;
    latest_quote_version?: number | null;
    showcase_control?: {
      featured: boolean;
      homepage: boolean;
      paused: boolean;
    } | null;
  } | null;
};

export type ProjectDetailRow = {
  id: string;
  user_id: string;
  title: string | null;
  category: string | null;
  notes_for_factory?: string | null;
  style: string | null;
  size_target: string | null;
  audience: string | null;
  status: ProjectStatus;
  updated_at: string;
  linked_intent?: {
    id: string;
    source_type: string;
    status: string;
    updated_at: string;
    latest_quote_status?: string | null;
    latest_quote_version?: number | null;
    showcase_control?: {
      featured: boolean;
      homepage: boolean;
      paused: boolean;
    } | null;
    recent_followups?: Array<{
      id: string;
      action_type: string | null;
      content: string | null;
      from_status?: string | null;
      to_status?: string | null;
      created_at: string;
    }>;
  } | null;
  all_linked_intents?: Array<{
    id: string;
    source_type: string;
    status: string;
    updated_at: string;
    latest_quote_status?: string | null;
    latest_quote_version?: number | null;
    showcase_control?: {
      featured: boolean;
      homepage: boolean;
      paused: boolean;
    } | null;
    latest_followup?: {
      id: string;
      action_type: string | null;
      content: string | null;
      from_status?: string | null;
      to_status?: string | null;
      created_at: string;
    } | null;
  }>;
};
