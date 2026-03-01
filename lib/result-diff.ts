import type { GenerationMode } from "@/types/generation-mode";

export type ResultDiffSnapshot = {
  production_score: number;
  recommended_next_step: string;
  recommended_service: string;
  bom_groups: Array<{ item: string; estimate: string }>;
  risk_count: number;
  mode_label: string | null;
};

export function toResultDiffSnapshot(input: {
  productionScore: number;
  recommendedNextStep: string;
  recommendedService: string;
  bomGroups: Array<{ item: string; estimate: string }>;
  riskCount: number;
}): ResultDiffSnapshot {
  return {
    production_score: input.productionScore,
    recommended_next_step: input.recommendedNextStep,
    recommended_service: input.recommendedService,
    bom_groups: input.bomGroups.slice(0, 5),
    risk_count: input.riskCount,
    mode_label: null
  };
}

const SNAPSHOT_KEY_PREFIX = "moc_diff_prev_snapshot:";
const DISMISSED_KEY_PREFIX = "moc_diff_dismissed:";
const CURRENT_MODE_KEY_PREFIX = "moc_diff_current_mode:";

function getSnapshotKey(projectId: string) {
  return `${SNAPSHOT_KEY_PREFIX}${projectId}`;
}

function getDismissedKey(projectId: string) {
  return `${DISMISSED_KEY_PREFIX}${projectId}`;
}

function getCurrentModeKey(projectId: string) {
  return `${CURRENT_MODE_KEY_PREFIX}${projectId}`;
}

export function modeToLabel(mode?: GenerationMode | "default") {
  if (mode === "display_focused") return "偏展示版";
  if (mode === "cost_focused") return "偏成本版";
  if (mode === "production_focused") return "偏量产版";
  return "标准模式";
}

export function savePreviousSnapshot(projectId: string, snapshot: ResultDiffSnapshot) {
  if (typeof window === "undefined") return;
  const currentMode = readCurrentModeLabel(projectId);
  const payload: ResultDiffSnapshot = {
    ...snapshot,
    mode_label: currentMode
  };
  window.sessionStorage.setItem(getSnapshotKey(projectId), JSON.stringify(payload));
}

export function readPreviousSnapshot(projectId: string): ResultDiffSnapshot | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(getSnapshotKey(projectId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ResultDiffSnapshot>;
    if (
      typeof parsed.production_score === "number" &&
      typeof parsed.recommended_next_step === "string" &&
      typeof parsed.recommended_service === "string" &&
      Array.isArray(parsed.bom_groups) &&
      typeof parsed.risk_count === "number"
    ) {
      return {
        production_score: parsed.production_score,
        recommended_next_step: parsed.recommended_next_step,
        recommended_service: parsed.recommended_service,
        bom_groups: parsed.bom_groups
          .map((item) => ({
            item: typeof item?.item === "string" ? item.item : "",
            estimate: typeof item?.estimate === "string" ? item.estimate : ""
          }))
          .filter((item) => item.item),
        risk_count: parsed.risk_count,
        mode_label: typeof parsed.mode_label === "string" ? parsed.mode_label : null
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function saveCurrentModeLabel(projectId: string, label: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(getCurrentModeKey(projectId), label);
}

export function readCurrentModeLabel(projectId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(getCurrentModeKey(projectId));
}

export function clearDiffDismissed(projectId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(getDismissedKey(projectId));
}

export function setDiffDismissed(projectId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(getDismissedKey(projectId), "1");
}

export function isDiffDismissed(projectId: string) {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(getDismissedKey(projectId)) === "1";
}

export function buildDiffSummary(params: {
  previous: ResultDiffSnapshot;
  current: ResultDiffSnapshot;
  currentModeLabel: string | null;
}) {
  const lines: string[] = [];
  const { previous, current, currentModeLabel } = params;

  if (previous.production_score !== current.production_score) {
    lines.push(`可生产性评分：${previous.production_score} -> ${current.production_score}`);
  }

  if (previous.recommended_service !== current.recommended_service) {
    lines.push(`主推荐动作：${previous.recommended_service} -> ${current.recommended_service}`);
  }

  if (previous.risk_count !== current.risk_count) {
    const trend =
      current.risk_count < previous.risk_count
        ? `风险条数从 ${previous.risk_count} 条降到 ${current.risk_count} 条`
        : `风险条数从 ${previous.risk_count} 条升到 ${current.risk_count} 条`;
    lines.push(trend);
  }

  const previousBom = previous.bom_groups.map((item) => `${item.item}${item.estimate}`).join(" | ");
  const currentBom = current.bom_groups.map((item) => `${item.item}${item.estimate}`).join(" | ");
  if (previousBom && currentBom && previousBom !== currentBom) {
    const prevFocus = previous.bom_groups.slice(0, 2).map((item) => item.item).join("、");
    const currFocus = current.bom_groups.slice(0, 2).map((item) => item.item).join("、");
    lines.push(`零件规划重点由「${prevFocus || "原方案"}」调整为「${currFocus || "当前方案"}」`);
  }

  if (currentModeLabel && currentModeLabel !== previous.mode_label) {
    lines.push(`当前为${currentModeLabel}`);
  }

  if (lines.length === 0) {
    return ["本次结果变化较小，建议重点复核细节描述与零件配比。"];
  }
  return lines;
}
