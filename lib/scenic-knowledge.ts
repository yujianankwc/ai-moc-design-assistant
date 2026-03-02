import { existsSync, readFileSync } from "fs";
import path from "path";

type ScenicSpot = {
  name: string;
  normalizedName: string;
  address: string;
  description: string;
  highlights: string[];
};

type ScenicMatch = {
  spotName: string;
  highlights: string[];
};

const STOPWORDS = ["景区", "旅游区", "风景区", "风景名胜区", "国家公园", "遗址公园"];
const HIGHLIGHT_KEYWORDS = [
  "泉",
  "喷泉",
  "泉池",
  "湖",
  "湿地",
  "瀑布",
  "古城",
  "古镇",
  "古建",
  "亭",
  "桥",
  "寺",
  "庙",
  "塔",
  "石窟",
  "园林",
  "水乡",
  "地标",
  "宫殿",
  "城墙",
  "玻璃栈道",
  "梯田",
  "山峰",
  "峡谷"
];

const SCENIC_ALIASES: Record<string, string> = {
  趵突泉: "天下第一泉景区",
  天下第一泉: "天下第一泉景区",
  故宫: "故宫博物院",
  兵马俑: "秦始皇陵兵马俑博物馆",
  黄果树: "黄果树瀑布景区",
  西湖: "杭州西湖风景名胜区",
  九寨沟: "九寨沟景区",
  黄山: "黄山风景区",
  泰山: "泰山风景区",
  布达拉宫: "布达拉宫景区",
  东方明珠: "东方明珠广播电视塔",
  洪崖洞: "重庆洪崖洞民俗风貌区",
  漓江: "桂林漓江风景区",
  鼓浪屿: "鼓浪屿风景名胜区",
  长白山: "长白山景区"
};

let cachedSpots: ScenicSpot[] | null = null;

function normalizeSpotName(name: string) {
  let text = name.trim().toLowerCase();
  for (const word of STOPWORDS) {
    text = text.replaceAll(word, "");
  }
  return text.replace(/\s+/g, "");
}

function pickHighlights(description: string) {
  const text = description.toLowerCase();
  const hits = HIGHLIGHT_KEYWORDS.filter((word) => text.includes(word.toLowerCase())).slice(0, 5);
  return hits.length > 0 ? hits : ["地标识别", "场景表达"];
}

function parseScenicCsv(raw: string): ScenicSpot[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("|"))
    .map((line) => {
      const [name = "", address = "", description = ""] = line.split("|").map((item) => item.trim());
      return {
        name,
        normalizedName: normalizeSpotName(name),
        address,
        description,
        highlights: pickHighlights(description)
      } satisfies ScenicSpot;
    })
    .filter((item) => item.name.length > 0);
}

function loadScenicCsvRaw() {
  const configured = process.env.SCENIC_5A_CSV_PATH?.trim();
  const defaultPath = path.join(process.cwd(), "data/scenic-5a.csv");
  const candidatePaths = [configured, defaultPath, "/Users/jackyyu/Downloads/全国 358 家 5A 级旅游景区完整可复制版.csv"].filter(
    Boolean
  ) as string[];

  for (const filePath of candidatePaths) {
    if (existsSync(filePath)) {
      return readFileSync(filePath, "utf-8");
    }
  }
  return "";
}

function getScenicSpots() {
  if (cachedSpots) return cachedSpots;
  const raw = loadScenicCsvRaw();
  cachedSpots = raw ? parseScenicCsv(raw) : [];
  return cachedSpots;
}

export function matchScenicSpotByIdea(idea: string): ScenicMatch | null {
  const normalizedIdea = normalizeSpotName(idea);
  if (!normalizedIdea) return null;
  const spots = getScenicSpots();
  const aliasHit = Object.entries(SCENIC_ALIASES).find(([alias]) => normalizedIdea.includes(normalizeSpotName(alias)));
  if (aliasHit) {
    const target = spots.find((spot) => spot.name.includes(aliasHit[1]));
    if (target) {
      return {
        spotName: target.name,
        highlights: target.highlights
      };
    }
  }
  const hit = spots.find((spot) => normalizedIdea.includes(spot.normalizedName) || spot.normalizedName.includes(normalizedIdea));
  if (!hit) return null;
  return {
    spotName: hit.name,
    highlights: hit.highlights
  };
}
