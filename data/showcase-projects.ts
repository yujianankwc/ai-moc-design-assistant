export type ShowcaseStage =
  | "创意已生成"
  | "方向判断完成"
  | "已提交意向"
  | "公开展示中";

export type ShowcaseSortKey = "latest" | "popular" | "trial";

export type ShowcaseCategory =
  | "城市文创"
  | "高校主题"
  | "文博纪念"
  | "家庭场景"
  | "奇幻场景"
  | "机械载具";

export type ShowcaseJudgement =
  | "更适合先做小批量验证"
  | "更适合礼物方向"
  | "更适合做系列化"
  | "更适合扩展故事感"
  | "更适合面向收藏用户"
  | "更适合先验证用户兴趣"
  | "更适合桌面陈列 / 小场景方向"
  | "更适合作为文创单品尝试";

export type ShowcaseNextSuggestion =
  | "继续补充方向"
  | "去看试做路径"
  | "继续公开展示"
  | "查看相似灵感"
  | "生成完整方案";

export type ShowcaseProject = {
  slug: string;
  title: string;
  category: ShowcaseCategory;
  tags: string[];
  relatedTags: string[];
  stage: ShowcaseStage;
  statusExplanation: string;
  judgement: ShowcaseJudgement;
  fitFor: string;
  nextSuggestion: ShowcaseNextSuggestion;
  recentStatus: string;
  hook: string;
  summary: string;
  highlight: string;
  popularityHint: string;
  whyItWorks: string;
  audience: string;
  recommendedFor: string;
  caution: string;
  likes: number;
  watchers: number;
  updates: string[];
  priorityScore: number;
  isRecommendedToAdvance: boolean;
  sortWeight: {
    latest: number;
    popular: number;
    trial: number;
  };
  coverGradient: string;
  coverAccentClass: string;
};

export const showcaseProjects: ShowcaseProject[] = [
  {
    slug: "jinan-landmark-gift",
    title: "济南地标礼盒",
    category: "城市文创",
    tags: ["景区礼物", "城市地标"],
    relatedTags: ["礼物感", "景区文创", "桌面摆件"],
    stage: "方向判断完成",
    statusExplanation: "方向判断已经完成，当前更适合先看试做路径，判断这个方向值不值得继续推进。",
    judgement: "更适合作为文创单品尝试",
    fitFor: "更适合景区礼品、小型纪念款和桌面摆件方向。",
    nextSuggestion: "去看试做路径",
    recentStatus: "主题识别度已经比较稳定，当前更适合先验证礼品感和价格带。",
    hook: "把城市记忆点做成能带走的积木礼物。",
    summary: "适合景区和文创店先做一轮试水。",
    highlight: "主题识别度高，礼品感比较完整。",
    popularityHint: "更多人先看这个方向",
    whyItWorks: "主题识别度高，礼品感明确，适合先验证售卖反应。",
    audience: "景区游客、城市文创用户",
    recommendedFor: "更适合景区礼品、小型纪念款和桌面摆件方向。",
    caution: "包装和城市标识需要进一步统一，避免只像建筑模型。",
    likes: 18,
    watchers: 9,
    updates: [
      "最近有 3 人收藏了这个方向。",
      "也有人在看相似的城市文创礼盒。",
      "当前更适合先做小批量验证。",
      "礼物感是这个项目最容易打动人的地方。"
    ],
    priorityScore: 96,
    isRecommendedToAdvance: true,
    sortWeight: { latest: 90, popular: 96, trial: 98 },
    coverGradient: "from-amber-100 via-orange-50 to-white",
    coverAccentClass: "text-amber-800"
  },
  {
    slug: "campus-south-gate",
    title: "校园南门纪念款",
    category: "高校主题",
    tags: ["毕业纪念", "校园回忆"],
    relatedTags: ["校门主题", "纪念款", "毕业季"],
    stage: "创意已生成",
    statusExplanation: "当前还停留在创意已生成阶段，更适合继续补充方向和价格带，再决定要不要推进。",
    judgement: "更适合礼物方向",
    fitFor: "更适合校园纪念、毕业礼物和校庆主题单品。",
    nextSuggestion: "继续补充方向",
    recentStatus: "校园记忆点已经明确，下一步建议把体量和礼物感再收敛一点。",
    hook: "把校园记忆点做成能摆在桌上的小纪念。",
    summary: "适合毕业季和校庆节点做纪念方向验证。",
    highlight: "情绪价值强，一眼就有毕业纪念感。",
    popularityHint: "最近更受欢迎",
    whyItWorks: "情绪价值强，适合作为礼品或纪念摆件。",
    audience: "毕业生、校友、校园文创店",
    recommendedFor: "更适合校园纪念、毕业礼物和校庆主题单品。",
    caution: "需要进一步收敛尺寸与价格带，避免只剩纪念意义而少了礼品感。",
    likes: 14,
    watchers: 8,
    updates: [
      "最近有校友在看类似校园纪念方向。",
      "这类项目更容易在毕业季形成传播。",
      "当前更适合礼物方向。",
      "校园记忆点是这个方向最强的卖点。"
    ],
    priorityScore: 78,
    isRecommendedToAdvance: false,
    sortWeight: { latest: 95, popular: 91, trial: 82 },
    coverGradient: "from-rose-100 via-red-50 to-white",
    coverAccentClass: "text-rose-800"
  },
  {
    slug: "museum-bronze-pattern",
    title: "青铜纹样文创单品",
    category: "文博纪念",
    tags: ["博物馆", "收藏感"],
    relatedTags: ["文物元素", "纹样提炼", "文创礼品"],
    stage: "已提交意向",
    statusExplanation: "当前已提交意向，说明这个方向已经进入进一步沟通和推进阶段。",
    judgement: "更适合作为文创单品尝试",
    fitFor: "更适合博物馆礼品店、节庆纪念款和收藏型单品。",
    nextSuggestion: "去看试做路径",
    recentStatus: "已经有人想继续推进，当前更适合先验证文创单品方向。",
    hook: "让文物纹样变成更年轻的积木表达。",
    summary: "更适合先做小批量文创单品验证。",
    highlight: "文物符号突出，兼顾纪念属性和收藏感。",
    popularityHint: "文博方向里更容易做出礼物感",
    whyItWorks: "文物符号突出，兼顾纪念属性和收藏感。",
    audience: "文博用户、礼品渠道",
    recommendedFor: "更适合博物馆礼品店、节庆纪念款和收藏型单品。",
    caution: "花纹还原和颗粒语言要平衡，不要把视觉做得太碎。",
    likes: 21,
    watchers: 12,
    updates: [
      "这个方向已经进入进一步沟通和推进阶段。",
      "最近有人也在浏览相似的文博纪念方向。",
      "当前更适合作为文创单品尝试。",
      "文物元素是当前最强的识别点。"
    ],
    priorityScore: 98,
    isRecommendedToAdvance: true,
    sortWeight: { latest: 88, popular: 93, trial: 94 },
    coverGradient: "from-emerald-100 via-lime-50 to-white",
    coverAccentClass: "text-emerald-800"
  },
  {
    slug: "family-kitchen-moment",
    title: "周末厨房小场景",
    category: "家庭场景",
    tags: ["亲子", "桌面摆件"],
    relatedTags: ["家庭故事", "礼物向", "场景感"],
    stage: "公开展示中",
    statusExplanation: "当前处于公开展示中，用于让更多人先看到这个方向，帮助判断是否值得继续推进。",
    judgement: "更适合桌面陈列 / 小场景方向",
    fitFor: "更适合节日礼物、家庭纪念和温馨场景摆件。",
    nextSuggestion: "继续公开展示",
    recentStatus: "已经进入公开展示中，当前更适合继续收集关注和方向反馈。",
    hook: "把家庭日常做成更有故事感的小场景。",
    summary: "适合轻礼物和家庭纪念方向。",
    highlight: "亲和力强，容易形成场景代入。",
    popularityHint: "最近有人也在看这个方向",
    whyItWorks: "亲和力强，容易形成场景代入。",
    audience: "亲子家庭、节日礼物用户",
    recommendedFor: "更适合节日礼物、家庭纪念和温馨场景摆件。",
    caution: "场景层次和人物关系还可加强，避免只像普通家居模型。",
    likes: 16,
    watchers: 11,
    updates: [
      "这个方向已经进入公开展示中。",
      "最近有更多人收藏了家庭场景题材。",
      "当前更适合桌面陈列 / 小场景方向。",
      "还可以继续加强人物和故事感。"
    ],
    priorityScore: 84,
    isRecommendedToAdvance: true,
    sortWeight: { latest: 80, popular: 89, trial: 78 },
    coverGradient: "from-sky-100 via-cyan-50 to-white",
    coverAccentClass: "text-sky-800"
  },
  {
    slug: "floating-island-market",
    title: "漂浮岛集市",
    category: "奇幻场景",
    tags: ["奇幻", "微景观"],
    relatedTags: ["故事感", "系列化", "世界观"],
    stage: "创意已生成",
    statusExplanation: "当前还处在创意已生成阶段，更适合继续补充主体识别和故事感。",
    judgement: "更适合扩展故事感",
    fitFor: "更适合奇幻微景观、故事摆件和系列化收藏方向。",
    nextSuggestion: "生成完整方案",
    recentStatus: "视觉吸引力已经有了，下一步更适合继续扩展故事感和系列设定。",
    hook: "把奇幻世界先变成一眼能懂的故事场景。",
    summary: "更适合继续打磨后再进入完整方案。",
    highlight: "视觉吸引力强，容易形成系列感。",
    popularityHint: "适合做成系列世界观",
    whyItWorks: "视觉吸引力强，适合形成系列感。",
    audience: "奇幻题材玩家、收藏用户",
    recommendedFor: "更适合奇幻微景观、故事摆件和系列化收藏方向。",
    caution: "结构复杂度偏高，适合二次收敛，不适合直接量产判断。",
    likes: 12,
    watchers: 7,
    updates: [
      "最近有人从奇幻场景切到完整方案继续看。",
      "系列化潜力是这个方向最大的吸引点。",
      "当前更适合扩展故事感。",
      "它更适合先做展示型方向判断。"
    ],
    priorityScore: 73,
    isRecommendedToAdvance: false,
    sortWeight: { latest: 92, popular: 84, trial: 70 },
    coverGradient: "from-violet-100 via-purple-50 to-white",
    coverAccentClass: "text-violet-800"
  },
  {
    slug: "city-patrol-carrier",
    title: "城市巡逻载具",
    category: "机械载具",
    tags: ["机械感", "可玩套装"],
    relatedTags: ["载具主体", "结构感", "系列延展"],
    stage: "方向判断完成",
    statusExplanation: "方向判断已经完成，当前更适合先验证结构识别和用户兴趣，再决定是否继续推进。",
    judgement: "更适合先验证用户兴趣",
    fitFor: "更适合玩家向展示件、载具主题套装和试水款项目。",
    nextSuggestion: "查看相似灵感",
    recentStatus: "载具主体已经明确，当前更适合先验证结构和用户兴趣。",
    hook: "先把硬核题材做成更容易试水的载具方案。",
    summary: "适合先验证结构和用户兴趣。",
    highlight: "题材明确，容易做出系列化延展。",
    popularityHint: "更适合先做小范围验证",
    whyItWorks: "题材明确，容易做出系列化延展。",
    audience: "机械玩家、载具题材用户",
    recommendedFor: "更适合玩家向展示件、载具主题套装和试水款项目。",
    caution: "要继续防止机甲化跑偏，先把载具识别做稳。",
    likes: 15,
    watchers: 10,
    updates: [
      "最近有人也在看类似的机械载具方向。",
      "结构识别度是这个项目最关键的部分。",
      "当前更适合先验证用户兴趣。",
      "这个方向更容易做出系列化。"
    ],
    priorityScore: 86,
    isRecommendedToAdvance: true,
    sortWeight: { latest: 86, popular: 90, trial: 88 },
    coverGradient: "from-slate-200 via-slate-100 to-white",
    coverAccentClass: "text-slate-700"
  }
];

export function getShowcaseProjectBySlug(slug: string) {
  return showcaseProjects.find((item) => item.slug === slug) || null;
}

export function getFeaturedShowcaseProjects(limit = 6) {
  return showcaseProjects.slice(0, limit);
}

export function getShowcaseProjectsBySort(sort: ShowcaseSortKey) {
  return [...showcaseProjects].sort((a, b) => b.sortWeight[sort] - a.sortWeight[sort]);
}

export function getRelatedShowcaseProjects(project: ShowcaseProject, limit = 3) {
  return showcaseProjects
    .filter((item) => item.slug !== project.slug)
    .map((item) => {
      const sameCategory = item.category === project.category ? 4 : 0;
      const tagOverlap = item.relatedTags.filter((tag) => project.relatedTags.includes(tag)).length;
      return { item, score: sameCategory + tagOverlap };
    })
    .sort((a, b) => b.score - a.score || b.item.priorityScore - a.item.priorityScore)
    .slice(0, limit)
    .map((entry) => entry.item);
}
