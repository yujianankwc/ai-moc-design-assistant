export type MockProjectResult = {
  id: string;
  projectTitle: string;
  category: string;
  style: string;
  sizeTarget: string;
  audience: string;
  buildDifficulty: string;
  scenarioTag: string;
  production_score: number;
  designBrief: string[];
  bomDraft: Array<{ item: string; estimate: string; note: string }>;
  risks: string[];
  manufacturabilityTips: string[];
  scoreDeductions?: string[];
  manualEditDraft: string;
  collaborationAdvice: string[];
};

export const DEFAULT_MOCK_PROJECT_ID = "p-001";

export const mockProjectResults: MockProjectResult[] = [
  {
    id: "p-001",
    projectTitle: "城市夜巡机甲系列",
    category: "机械装置",
    style: "工业机械",
    sizeTarget: "中型（300-800 pcs）",
    audience: "青少年玩家（10-14 岁）",
    buildDifficulty: "中等",
    scenarioTag: "适合提交原创计划评审",
    production_score: 82,
    designBrief: [
      "核心设定为“夜巡机甲 + 城市维护站”，突出模块化可替换装备。",
      "主玩点为多关节姿态切换与工具臂功能演绎，兼顾展示与把玩。",
      "视觉重点放在高识别度肩甲轮廓与对比色警示条。"
    ],
    bomDraft: [
      { item: "关节连接件", estimate: "90-120 pcs", note: "优先标准关节规格，降低替换成本" },
      { item: "装甲外壳件", estimate: "120-160 pcs", note: "控制大面积异形件比例" },
      { item: "场景底座件", estimate: "80-100 pcs", note: "底座尽量复用标准砖块" }
    ],
    risks: [
      "肩部结构若叠层过厚，可能导致抬臂动作受限。",
      "外观色块过多会增加配色管理难度与说明书复杂度。"
    ],
    manufacturabilityTips: [
      "优先采用两层装甲分段方案，避免单块过长异形件。",
      "对称结构优先共用件，减少小批量试产成本。",
      "预留 1-2 个可替换装饰位，便于后续衍生版本。"
    ],
    manualEditDraft:
      "建议补充：1）夜巡机甲和维护站的故事关系；2）目标定价区间；3）首发希望强调的差异化卖点。",
    collaborationAdvice: [
      "建议先提交原创计划评审，确认主题完整度与玩法卖点。",
      "评审通过后再补齐展示图与零件优先级表。"
    ]
  },
  {
    id: "p-002",
    projectTitle: "海岸救援场景套组",
    category: "场景套组",
    style: "极简现代",
    sizeTarget: "小型（100-300 pcs）",
    audience: "亲子共玩家庭",
    buildDifficulty: "中等偏高",
    scenarioTag: "适合申请打样可行性评估",
    production_score: 63,
    designBrief: [
      "围绕“海岸救援站 + 快速响应载具”构建轻剧情协作玩法。",
      "强调亲子拼搭友好度，零件层次清晰、上手门槛低。",
      "保留可扩展接口，便于后续加入天气或海面状态组件。"
    ],
    bomDraft: [
      { item: "建筑主体件", estimate: "70-90 pcs", note: "可拆分成两个独立子模块" },
      { item: "载具与配件", estimate: "40-60 pcs", note: "轮轴与卡扣件需提前验证耐用性" },
      { item: "人物与道具", estimate: "20-30 pcs", note: "确保关键角色识别度" }
    ],
    risks: [
      "小体量下若叙事元素过多，会稀释主玩法焦点。",
      "场景与载具比例不协调会影响整体观感。"
    ],
    manufacturabilityTips: [
      "建议先进行打样可行性评估，验证结构稳固与装配顺序。",
      "优先确认轮轴和转动件的容错范围。",
      "说明书步骤保持短路径，减少返工。"
    ],
    manualEditDraft:
      "建议补充：1）救援任务流程图；2）亲子协作玩法示例；3）希望优先打样的两个结构点。",
    collaborationAdvice: [
      "当前更适合先申请打样可行性评估，再决定是否进入完整评审。",
      "建议准备 2 个关键结构的打样优先级清单。"
    ]
  },
  {
    id: "p-003",
    projectTitle: "太空维修站套组",
    category: "建筑主题",
    style: "复古科幻",
    sizeTarget: "展示级（1500+ pcs）",
    audience: "成人收藏玩家",
    buildDifficulty: "较高",
    scenarioTag: "适合申请 BOM 快速校对",
    production_score: 44,
    designBrief: [
      "主题聚焦“轨道维修站”，视觉细节密度高，强调陈列效果。",
      "当前方案亮点较多，但结构层级和玩法主线尚未收敛。",
      "建议先压缩功能模块数量，突出 1 条核心体验路径。"
    ],
    bomDraft: [
      { item: "外立面细节件", estimate: "450-600 pcs", note: "细节件比例偏高，需控制采购压力" },
      { item: "内部结构件", estimate: "500-700 pcs", note: "先确认支撑框架后再叠加装饰" },
      { item: "展示支架件", estimate: "80-120 pcs", note: "需评估承重与稳定性" }
    ],
    risks: [
      "零件种类过散，可能导致 BOM 初版难以快速收敛。",
      "结构复杂度高，早期打样成本和失败率偏高。"
    ],
    manufacturabilityTips: [
      "先做 BOM 快速校对，清理重复与低性价比零件。",
      "建立主结构件优先级，再补齐装饰细节件。",
      "减少一次性定制件，优先标准件替代。"
    ],
    manualEditDraft:
      "建议补充：1）必须保留的视觉亮点 Top5；2）可降级细节清单；3）可接受的零件总量上限。",
    collaborationAdvice: [
      "当前优先申请 BOM 快速校对，先把零件结构打磨清楚。",
      "校对完成后再评估是否进入打样阶段。"
    ]
  }
];

export const mockProjectResultMap = Object.fromEntries(
  mockProjectResults.map((item) => [item.id, item])
) as Record<string, MockProjectResult>;
