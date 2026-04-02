import type { ShowcaseCategory } from "@/data/showcase-projects";

export const SHOWCASE_CATEGORY_FILTERS: Array<ShowcaseCategory | "全部"> = [
  "全部",
  "城市文创",
  "文博纪念",
  "高校主题",
  "家庭场景",
  "奇幻场景",
  "机械载具"
];

export function mapProjectCategoryToShowcaseCategory(category: string | null | undefined): ShowcaseCategory {
  if (category === "campus") return "高校主题";
  if (category === "museum") return "文博纪念";
  if (category === "scene") return "家庭场景";
  if (category === "fantasy") return "奇幻场景";
  if (category === "vehicle" || category === "mecha" || category === "mechanism") return "机械载具";
  if (category === "architecture") return "城市文创";
  return "城市文创";
}
