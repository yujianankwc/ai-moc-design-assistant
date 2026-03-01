const categoryMap: Record<string, string> = {
  scene: "场景套组",
  vehicle: "载具主题",
  character: "角色人仔",
  architecture: "建筑主题",
  mechanism: "机械装置"
};

const styleMap: Record<string, string> = {
  "retro-sci-fi": "复古科幻",
  industrial: "工业机械",
  cute: "可爱治愈",
  fantasy: "奇幻冒险",
  minimal: "极简现代"
};

const audienceMap: Record<string, string> = {
  kids: "儿童玩家（6-9 岁）",
  teen: "青少年玩家（10-14 岁）",
  family: "亲子共玩家庭",
  adult: "成人收藏玩家",
  all: "全年龄向"
};

const sizeTargetMap: Record<string, string> = {
  small: "小型（100-300 pcs）",
  medium: "中型（300-800 pcs）",
  large: "大型（800-1500 pcs）",
  display: "展示级（1500+ pcs）"
};

const buildDifficultyMap: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
  "中等": "中等",
  "中等偏高": "中等偏高",
  "较高": "较高"
};

const projectStatusMap: Record<string, string> = {
  draft: "草稿中",
  generating: "生成中",
  ready: "已完成",
  failed: "生成失败"
};

function mapValue(value: string | null | undefined, map: Record<string, string>) {
  if (!value) return "未填写";
  return map[value] ?? value;
}

export function mapCategory(value: string | null | undefined) {
  return mapValue(value, categoryMap);
}

export function mapStyle(value: string | null | undefined) {
  return mapValue(value, styleMap);
}

export function mapAudience(value: string | null | undefined) {
  return mapValue(value, audienceMap);
}

export function mapSizeTarget(value: string | null | undefined) {
  return mapValue(value, sizeTargetMap);
}

export function mapBuildDifficulty(value: string | null | undefined) {
  return mapValue(value, buildDifficultyMap);
}

export function mapProjectStatus(value: string | null | undefined) {
  return mapValue(value, projectStatusMap);
}
