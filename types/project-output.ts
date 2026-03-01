export type BomGroup = {
  item: string;
  estimate: string;
  note: string;
};

export type ProjectOutputRow = {
  id: string;
  project_id: string;
  design_summary: string | null;
  design_positioning: string | null;
  build_difficulty: string | null;
  structure_notes: string | null;
  highlight_points: string[] | null;
  bom_groups: BomGroup[] | null;
  substitution_suggestions: string | null;
  risk_notes: string | null;
  production_hint: string | null;
  production_score: number;
  recommended_next_step: string | null;
  internal_recommendation: string | null;
  recommended_service: string | null;
  editable_version: unknown;
  created_at: string;
  updated_at: string;
};
