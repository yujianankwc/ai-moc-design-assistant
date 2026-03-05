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
};

export type ProjectDetailRow = {
  id: string;
  user_id: string;
  title: string | null;
  category: string | null;
  style: string | null;
  size_target: string | null;
  audience: string | null;
  status: ProjectStatus;
  updated_at: string;
};
