import type { ShowcaseJudgement, ShowcaseNextSuggestion, ShowcaseStage } from "@/data/showcase-projects";
import type { QuickEntryInput, QuickPath } from "@/types/quick-entry";

export type ProjectPathLabel = "试做路径" | "完整方案路径" | "公开展示路径";

export const PROJECT_STAGE_LABELS: ShowcaseStage[] = [
  "创意已生成",
  "方向判断完成",
  "已提交意向",
  "公开展示中"
];

export function inferJudgementFromQuickInput(input: QuickEntryInput): ShowcaseJudgement {
  const text = input.idea;
  if (/(景区|文创|地标|礼盒|纪念)/.test(text)) return "更适合作为文创单品尝试";
  if (/(礼物|送礼|纪念)/.test(text)) return "更适合礼物方向";
  if (/(场景|厨房|桌面|微景观|家庭)/.test(text)) return "更适合桌面陈列 / 小场景方向";
  if (/(奇幻|世界观|故事|漂浮岛)/.test(text)) return "更适合扩展故事感";
  if (/(系列|系列化)/.test(text)) return "更适合做系列化";
  if (/(收藏|文物|博物馆)/.test(text)) return "更适合面向收藏用户";
  if (/(机械|载具|巡逻|战舰|结构)/.test(text)) return "更适合先验证用户兴趣";
  return "更适合先做小批量验证";
}

export function inferFitForFromJudgement(judgement: ShowcaseJudgement) {
  const map: Record<ShowcaseJudgement, string> = {
    "更适合先做小批量验证": "更适合先做一版可验证的试水方案。",
    "更适合礼物方向": "更适合作为礼物或纪念款方向继续推进。",
    "更适合做系列化": "更适合继续扩成系列主题，而不是只做单款。",
    "更适合扩展故事感": "更适合先补强故事和场景表达，再决定是否继续。",
    "更适合面向收藏用户": "更适合面向收藏型用户和纪念向场景。",
    "更适合先验证用户兴趣": "更适合先看用户会不会对这个题材买单。",
    "更适合桌面陈列 / 小场景方向": "更适合作为桌面摆件或小场景方向继续。",
    "更适合作为文创单品尝试": "更适合作为文创单品先做一轮方向验证。"
  };
  return map[judgement];
}

export function inferNextSuggestionFromJudgement(judgement: ShowcaseJudgement): ShowcaseNextSuggestion {
  if (judgement === "更适合扩展故事感") return "生成完整方案";
  if (judgement === "更适合做系列化") return "生成完整方案";
  if (judgement === "更适合先验证用户兴趣") return "查看相似灵感";
  if (judgement === "更适合桌面陈列 / 小场景方向") return "继续公开展示";
  return "去看试做路径";
}

export function formatNextSuggestionLabel(suggestion: ShowcaseNextSuggestion) {
  if (suggestion === "生成完整方案") return "先把这个方向补充完整";
  return suggestion;
}

export function mapQuickPathToLabel(path: QuickPath): ProjectPathLabel {
  if (path === "small_batch") return "试做路径";
  if (path === "professional_upgrade") return "完整方案路径";
  return "公开展示路径";
}

export function mapIntentStatusToUnifiedStage(status: string): ShowcaseStage {
  if (
    status === "quoted" ||
    status === "deposit_pending" ||
    status === "locked" ||
    status === "preparing_delivery" ||
    status === "delivering" ||
    status === "delivered" ||
    status === "closed_won"
  ) {
    return "已提交意向";
  }
  return "方向判断完成";
}

export function mapIntentToUnifiedStage(input: { status: string; sourceType?: string | null }): ShowcaseStage {
  if (input.sourceType === "crowdfunding") return "公开展示中";
  return mapIntentStatusToUnifiedStage(input.status);
}

export function mapIntentStatusToAdminLabel(status: string) {
  const map: Record<string, string> = {
    new: "刚记下推进意向",
    contact_pending: "等待进一步沟通",
    contacted: "已完成第一轮沟通",
    confirming: "正在确认路径细节",
    quoted: "已给出报价说明",
    deposit_pending: "等待补上定金凭证",
    locked: "已进入锁单推进",
    preparing_delivery: "正在准备交付",
    delivering: "正在继续交付",
    delivered: "已完成交付",
    closed_won: "已进入后续交付",
    closed_lost: "暂时停止推进"
  };
  return map[status] || status;
}

export function mapIntentStatusToStageProgress(status: string) {
  if (
    status === "locked" ||
    status === "preparing_delivery" ||
    status === "delivering" ||
    status === "delivered" ||
    status === "closed_won"
  )
    return 4;
  if (status === "deposit_pending" || status === "quoted") return 3;
  return 2;
}

export function getIntentStageProgress(input: { status: string; sourceType?: string | null }) {
  if (input.sourceType === "crowdfunding") return 4;
  return mapIntentStatusToStageProgress(input.status);
}

export function getIntentStageSteps(input: { sourceType?: string | null }) {
  if (input.sourceType === "crowdfunding") {
    return ["创意已生成", "方向判断完成", "公开展示中"] satisfies ShowcaseStage[];
  }
  return ["创意已生成", "方向判断完成", "已提交意向"] satisfies ShowcaseStage[];
}

export function mapIntentSourceTypeToPathLabel(sourceType: string): ProjectPathLabel {
  if (sourceType === "small_batch") return "试做路径";
  if (sourceType === "professional_upgrade" || sourceType === "pro_upgrade") return "完整方案路径";
  return "公开展示路径";
}

export function mapIntentSourceTypeToJudgement(sourceType: string): ShowcaseJudgement {
  if (sourceType === "small_batch") return "更适合先做小批量验证";
  if (sourceType === "professional_upgrade" || sourceType === "pro_upgrade") return "更适合扩展故事感";
  return "更适合先验证用户兴趣";
}

export function inferIntentNextSuggestion(input: { sourceType: string; status: string }) {
  if (input.status === "quoted") return "确认这版报价说明";
  if (input.status === "deposit_pending") return "补上定金凭证";
  if (input.status === "locked" || input.status === "preparing_delivery") return "继续看交付安排";
  if (input.status === "delivering") return "继续看交付进度";
  if (input.status === "delivered" || input.status === "closed_won") return "继续查看已完成阶段";

  const pathLabel = mapIntentSourceTypeToPathLabel(input.sourceType);
  if (pathLabel === "试做路径") return "继续看试做路径";
  if (pathLabel === "完整方案路径") return "继续补充完整方案";
  return "继续公开展示";
}

export function getIntentStatusExplanation(input: { status: string; sourceType: string }) {
  const pathLabel = mapIntentSourceTypeToPathLabel(input.sourceType);

  if (input.status === "quoted") {
    return `当前已经给出报价说明，现在更适合沿着${pathLabel}决定是否继续投入预算和时间。`;
  }
  if (input.status === "deposit_pending") {
    return "当前已经确认这条方向会继续推进，下一步更适合补上定金凭证，让它进入锁单阶段。";
  }
  if (input.status === "locked") {
    return "当前已经进入锁单推进阶段，下一步更适合开始确认交付安排和细节。";
  }
  if (input.status === "preparing_delivery") {
    return "当前已经进入准备交付阶段，重点是把交付安排、节奏和细节先确认清楚。";
  }
  if (input.status === "delivering") {
    return "当前已经进入交付推进阶段，重点是继续跟进交付进度和关键节点。";
  }
  if (input.status === "delivered" || input.status === "closed_won") {
    return "当前已经完成交付，这条方向已经进入更稳定的完成阶段，后续重点会转向复盘和下一轮推进。";
  }
  if (input.status === "closed_lost") {
    return "这条方向当前先停在这里，后续仍可以回头继续补充判断或重新推进。";
  }
  if (input.status === "contacted" || input.status === "confirming") {
    return `当前已经开始围绕${pathLabel}补充细节，重点是把方向、预算和推进方式说得更清楚。`;
  }
  return `当前还处在前期推进阶段，这一步主要是先把${pathLabel}需要的信息整理清楚，再判断值不值得继续。`;
}

export function formatIntentFollowupSummary(input: {
  actionType?: string | null;
  content?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
}) {
  const content = (input.content || "").trim();
  if (content) return content;

  if (input.actionType === "quote_created") return "已经整理出一版报价说明。";
  if (input.actionType === "quote_accepted") return "这版报价说明已经确认，准备进入下一步。";
  if (input.actionType === "quote_status_change") return "报价说明状态刚更新过。";
  if (input.actionType === "status_change" && input.toStatus) {
    return `当前阶段已更新为：${mapIntentStatusToAdminLabel(input.toStatus)}。`;
  }
  if (input.actionType === "deposit_submitted") return "定金凭证已经补上，方向继续往下推进。";
  if (input.actionType === "delivery_note") return "这条方向刚补了一条交付推进记录。";
  if (input.actionType === "contact") return "这条方向刚补了一条沟通记录。";
  if (input.actionType === "risk") return "这条方向补了一条风险提醒。";
  return "这条方向最近有新的推进记录。";
}

export function formatDeliveryRecordContent(input: {
  milestone?: string | null;
  eta?: string | null;
  note?: string | null;
  link?: string | null;
}) {
  const segments = [];
  if ((input.milestone || "").trim()) segments.push(`交付节点：${input.milestone?.trim()}`);
  if ((input.eta || "").trim()) segments.push(`预计时间：${input.eta?.trim()}`);
  if ((input.note || "").trim()) segments.push(`说明：${input.note?.trim()}`);
  if ((input.link || "").trim()) segments.push(`链接：${input.link?.trim()}`);
  return segments.join("；");
}

export function parseDeliveryRecordContent(content: string | null | undefined) {
  const text = (content || "").trim();
  const find = (label: string) => {
    const matched = text.match(new RegExp(`(?:^|；)${label}：([^；]+)`));
    return matched?.[1]?.trim() || "";
  };

  return {
    milestone: find("交付节点"),
    eta: find("预计时间"),
    note: find("说明"),
    link: find("链接")
  };
}

export function mapProjectStatusToUnifiedStage(status: string | null | undefined): ShowcaseStage {
  if (status === "completed") return "已提交意向";
  if (status === "generating") return "方向判断完成";
  return "创意已生成";
}

export function mapProjectWithIntentToUnifiedStage(input: {
  projectStatus: string | null | undefined;
  intentStatus?: string | null;
  intentSourceType?: string | null;
}): ShowcaseStage {
  if (input.intentStatus) {
    return mapIntentToUnifiedStage({
      status: input.intentStatus,
      sourceType: input.intentSourceType
    });
  }
  return mapProjectStatusToUnifiedStage(input.projectStatus);
}

export function mapProjectCategoryToPathLabel(category: string | null | undefined): ProjectPathLabel {
  if (category === "quick_entry") return "试做路径";
  return "完整方案路径";
}

export function inferJudgementFromProjectSnapshot(input: {
  category?: string | null;
  style?: string | null;
  audience?: string | null;
  designBrief?: string[];
  recommendation?: string | null;
}): ShowcaseJudgement {
  const haystack = [
    input.category ?? "",
    input.style ?? "",
    input.audience ?? "",
    input.recommendation ?? "",
    ...(input.designBrief ?? [])
  ].join(" ");

  if (/(architecture|文博|博物|收藏|adult)/i.test(haystack)) return "更适合面向收藏用户";
  if (/(scene|家庭|桌面|微景观|display)/i.test(haystack)) return "更适合桌面陈列 / 小场景方向";
  if (/(character|礼物|送礼|campus)/i.test(haystack)) return "更适合礼物方向";
  if (/(vehicle|mechanism|机械|载具)/i.test(haystack)) return "更适合先验证用户兴趣";
  if (/(原创计划评审|系列|series)/i.test(haystack)) return "更适合做系列化";
  if (/(fantasy|故事|世界观|冒险)/i.test(haystack)) return "更适合扩展故事感";
  if (/(文创|景区|纪念|礼盒)/i.test(haystack)) return "更适合作为文创单品尝试";
  return "更适合先做小批量验证";
}

export function getStageExplanation(stage: ShowcaseStage, pathLabel: ProjectPathLabel) {
  if (stage === "创意已生成") {
    return `当前处于创意已生成阶段，说明这条方向已经被记下来，下一步更适合沿着${pathLabel}继续补充判断。`;
  }
  if (stage === "方向判断完成") {
    return `当前处于方向判断完成阶段，说明这个方向已经看清楚了，现在更适合决定是否进入${pathLabel}继续推进。`;
  }
  if (stage === "已提交意向") {
    return "当前已提交意向，说明这个方向已经进入进一步推进和沟通阶段。";
  }
  return "当前处于公开展示中，适合先让更多人看到这个方向，再判断是否继续推进。";
}

export function inferProgressOwnerHint(input: { stage: ShowcaseStage; nextSuggestion: string }) {
  if (input.nextSuggestion === "补上定金凭证" || input.nextSuggestion === "确认这版报价说明") {
    return "这一步更适合先由你确认，再继续往下推进。";
  }
  if (input.stage === "公开展示中") {
    return "这一步更适合先看外部关注和反馈，再决定要不要继续推进。";
  }
  if (input.stage === "创意已生成") {
    return "这一步更适合先由你补清方向，再继续判断。";
  }
  if (input.nextSuggestion === "继续看试做路径" || input.nextSuggestion === "去看试做路径") {
    return "这一步更适合先由你决定是否沿试做路径继续。";
  }
  if (input.nextSuggestion === "继续补充完整方案" || input.nextSuggestion === "先把这个方向补充完整") {
    return "这一步更适合先把方向补充完整，再继续往下推进。";
  }
  return "这一步更适合先看清当前阶段，再决定下一步怎么走。";
}
