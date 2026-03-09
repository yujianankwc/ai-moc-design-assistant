"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getFeaturedShowcaseProjects } from "@/data/showcase-projects";
import {
  inferFitForFromJudgement,
  inferJudgementFromQuickInput,
  inferNextSuggestionFromJudgement
} from "@/lib/project-language";
import {
  buildQuickEntryResult,
  mapReferenceTypeLabel,
  pickQuickSimilarReferences,
  readQuickAIResultFromSession,
  saveQuickAIResultToSession,
  saveQuickPrefillToSession,
  updateQuickAIImageInSession
} from "@/lib/quick-entry";
import { buildQuickPathHref } from "@/lib/quick-path-context";
import type { QuickDirection, QuickEntryInput, QuickPath, QuickScalePreference, QuickStyle } from "@/types/quick-entry";

function clampText(value: string | undefined, maxChars: number) {
  const text = (value || "").trim();
  if (!text) return "";
  const chars = Array.from(text);
  if (chars.length <= maxChars) return text;
  return `${chars.slice(0, maxChars).join("")}…`;
}

function firstSentenceOf(text: string) {
  const hit = text.trim().match(/^[^。！？!?]+[。！？!?]?/);
  return (hit?.[0] || text).trim();
}

const IMAGE_AUTO_RETRY_DELAYS_MS = [5000, 8000, 12000, 15000, 15000] as const;
const AUTO_REQUEST_DEDUP_TTL_MS = 120_000;
const recentAutoImageRequestMap = new Map<string, number>();

function wasAutoImageRequestedRecently(key: string) {
  const now = Date.now();
  for (const [mapKey, ts] of recentAutoImageRequestMap.entries()) {
    if (now - ts > AUTO_REQUEST_DEDUP_TTL_MS) {
      recentAutoImageRequestMap.delete(mapKey);
    }
  }
  const lastTs = recentAutoImageRequestMap.get(key);
  if (typeof lastTs === "number" && now - lastTs <= AUTO_REQUEST_DEDUP_TTL_MS) {
    return true;
  }
  recentAutoImageRequestMap.set(key, now);
  return false;
}

type QuickCorrectionOption = {
  key: string;
  label: string;
};

function hasAnyKeyword(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function buildCorrectionOptions(input: QuickEntryInput): QuickCorrectionOption[] {
  const text = input.idea.toLowerCase();
  if (hasAnyKeyword(text, ["趵突泉", "济南"])) {
    return [
      { key: "fountain", label: "更像泉池喷涌感" },
      { key: "gift", label: "更像景区礼物" },
      { key: "pavilion", label: "更像完整景点" }
    ];
  }
  if (hasAnyKeyword(text, ["泉", "喷泉", "水景", "湖", "河", "地标", "景区", "文旅"])) {
    return [
      { key: "fountain", label: "更像泉池水景" },
      { key: "gift", label: "更像景区礼物" },
      { key: "pavilion", label: "更像完整景点" }
    ];
  }
  if (hasAnyKeyword(text, ["机甲", "机械", "载具", "汽车", "战舰"])) {
    return [
      { key: "structure", label: "更像硬核主体" },
      { key: "display", label: "更像桌面摆件" },
      { key: "play", label: "更像可玩套装" }
    ];
  }
  if (hasAnyKeyword(text, ["家庭", "亲子", "校园", "高校", "毕业", "回忆"])) {
    return [
      { key: "story", label: "更像有故事的小场景" },
      { key: "gift", label: "更像纪念礼物" },
      { key: "desk", label: "更像桌面摆件" }
    ];
  }
  return [
    { key: "shape", label: "更像核心主体" },
    { key: "gift", label: "更像景区礼物" },
    { key: "scene", label: "更像有场景感" }
  ];
}

function parseFromSearchParams(searchParams: URLSearchParams): QuickEntryInput | null {
  const idea = searchParams.get("idea")?.trim() ?? "";
  if (!idea) return null;
  const directionValue = searchParams.get("direction");
  const styleValue = searchParams.get("style");

  const direction: QuickDirection | "" =
    directionValue === "display" || directionValue === "cost" || directionValue === "production"
      ? directionValue
      : "";
  const style: QuickStyle | "" =
    styleValue === "cute" || styleValue === "mechanical" || styleValue === "realistic" || styleValue === "fantasy"
      ? styleValue
      : "";
  const scaleValue = searchParams.get("scale");
  const scale: QuickScalePreference | "" =
    scaleValue === "small" || scaleValue === "medium" || scaleValue === "large" ? scaleValue : "";

  return {
    idea,
    direction,
    style,
    scale,
    referenceImage: searchParams.get("referenceImage")?.trim() ?? "",
    correctionIntent: searchParams.get("correctionIntent")?.trim() ?? ""
  };
}

export default function QuickEntryResultPage() {
  const router = useRouter();
  const [rawSearch, setRawSearch] = useState("");
  const searchParams = useMemo(() => new URLSearchParams(rawSearch), [rawSearch]);
  const quickProjectIdFromQuery = searchParams.get("quickProjectId")?.trim() ?? "";
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageState, setImageState] = useState<"idle" | "generating" | "failed">("idle");
  const [, setImageMessage] = useState("");
  const [imageInfoHint, setImageInfoHint] = useState("");
  const [resultState, setResultState] = useState<"idle" | "generating" | "failed">("idle");
  const [quickProjectId, setQuickProjectId] = useState(quickProjectIdFromQuery);
  const [dbInput, setDbInput] = useState<QuickEntryInput | null>(null);
  const [dbResult, setDbResult] = useState<ReturnType<typeof buildQuickEntryResult> | null>(null);
  const [overrideInput, setOverrideInput] = useState<QuickEntryInput | null>(null);
  const [dbLoading, setDbLoading] = useState(Boolean(quickProjectIdFromQuery));
  const [dbMessage, setDbMessage] = useState("");
  const [activeCorrection, setActiveCorrection] = useState("");
  const [showReferences, setShowReferences] = useState(false);
  const [showMorePaths, setShowMorePaths] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [imageProgress, setImageProgress] = useState(8);
  const [imageElapsedSeconds, setImageElapsedSeconds] = useState(0);
  const [hasTriedImageGeneration, setHasTriedImageGeneration] = useState(false);
  const [referenceImageWasDropped, setReferenceImageWasDropped] = useState(false);
  const autoRequestedKeyRef = useRef("");
  const imageAutoRequestedKeyRef = useRef("");
  const imageRequestSeqRef = useRef(0);
  const imageRetryCountRef = useRef(0);
  const imageRetryTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setRawSearch(window.location.search);
  }, []);

  useEffect(() => {
    if (!lightboxOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxOpen]);

  const source = searchParams.get("source");
  const input = useMemo(() => parseFromSearchParams(searchParams), [searchParams]);
  const aiSession = readQuickAIResultFromSession();

  useEffect(() => {
    setQuickProjectId(quickProjectIdFromQuery);
  }, [quickProjectIdFromQuery]);
  const hasSessionResultForCurrentIdea = Boolean(
    source === "ai" &&
      aiSession?.result &&
      aiSession.input.idea.trim() === (input?.idea.trim() ?? "") &&
      (aiSession.input.correctionIntent || "").trim() === ((input?.correctionIntent || "").trim() ?? "")
  );

  const result = useMemo(() => {
    if (dbResult) return dbResult;
    if (hasSessionResultForCurrentIdea && aiSession?.result) {
      return aiSession.result;
    }
    if (source === "ai") {
      return null;
    }
    return input ? buildQuickEntryResult(input) : null;
  }, [aiSession, dbResult, hasSessionResultForCurrentIdea, input, source]);

  const effectiveInput = useMemo(() => {
    if (overrideInput) return overrideInput;
    if (dbInput) return dbInput;
    if (
      source === "ai" &&
      aiSession?.input &&
      aiSession.input.idea.trim() === (input?.idea.trim() ?? "") &&
      (aiSession.input.correctionIntent || "").trim() === (input?.correctionIntent || "").trim()
    ) {
      return aiSession.input;
    }
    return input;
  }, [aiSession, dbInput, input, overrideInput, source]);
  const fallbackResult = useMemo(
    () => (effectiveInput ? buildQuickEntryResult(effectiveInput) : null),
    [effectiveInput]
  );

  const [resolvedResult, setResolvedResult] = useState(result);
  useEffect(() => {
    if (result) {
      setResolvedResult(result);
    }
  }, [result]);

  useEffect(() => {
    if (!quickProjectId) {
      setDbLoading(false);
      return;
    }
    let cancelled = false;
    setDbLoading(true);
    setDbMessage("");

    fetch(`/api/quick/projects/${quickProjectId}`)
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as
          | {
              quickProject?: {
                id: string;
                input: QuickEntryInput;
                result: ReturnType<typeof buildQuickEntryResult>;
                previewImageUrl: string | null;
                imageWarning: string;
              };
              error?: string;
            }
          | null;
        if (!response.ok || !data?.quickProject) {
          throw new Error(data?.error ?? "这条轻量方向暂时没有读取出来。");
        }
        if (cancelled) return;
        setDbInput(data.quickProject.input);
        setOverrideInput(null);
        setDbResult(data.quickProject.result);
        setResolvedResult(data.quickProject.result);
        setImageUrl(data.quickProject.previewImageUrl ?? null);
        if (data.quickProject.previewImageUrl) {
          setImageState("idle");
          setImageMessage("");
          setImageInfoHint("");
        } else if (data.quickProject.imageWarning) {
          setImageState("failed");
          setImageMessage(data.quickProject.imageWarning);
          setImageInfoHint("");
        } else {
          setImageState("idle");
          setImageMessage("");
          setImageInfoHint("");
        }
        setDbLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "这条轻量方向暂时没有读取出来。";
        setDbMessage(message);
        setDbLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [quickProjectId]);

  const previewImageUrl = useMemo(() => {
    if (source === "ai" && aiSession?.previewImageUrl) {
      const sameIdea = aiSession.input.idea.trim() === (input?.idea.trim() ?? "");
      const sameCorrection =
        (aiSession.input.correctionIntent || "").trim() === ((input?.correctionIntent || "").trim() ?? "");
      if (sameIdea && sameCorrection) return aiSession.previewImageUrl;
    }
    return null;
  }, [aiSession, input, source]);

  const references = useMemo(() => (effectiveInput ? pickQuickSimilarReferences(effectiveInput) : []), [effectiveInput]);
  const showcaseRecommendations = useMemo(() => getFeaturedShowcaseProjects(3), []);
  const correctionOptions = useMemo(
    () => (effectiveInput ? buildCorrectionOptions(effectiveInput) : []),
    [effectiveInput]
  );

  const requestTextResult = useCallback(async (targetInput: QuickEntryInput, opts?: { manual?: boolean }) => {
    setResultState("generating");

    try {
      const response = await fetch("/api/quick/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          idea: targetInput.idea,
          direction: targetInput.direction,
          style: targetInput.style,
          scale: targetInput.scale,
          referenceImage: targetInput.referenceImage,
          correctionIntent: targetInput.correctionIntent,
          quickProjectId: quickProjectId || undefined,
          regenerateToken: opts?.manual ? String(Date.now()) : undefined
        })
      });
      const data = (await response.json().catch(() => null)) as
        | {
            input?: QuickEntryInput;
            result?: typeof resolvedResult;
            textWarning?: string;
            quickProjectId?: string;
            error?: string;
          }
        | null;
      if (!response.ok || !data?.input || !data?.result) {
        throw new Error(data?.error ?? "文字判断生成失败，请稍后重试。");
      }

      setResolvedResult(data.result);
      setResultState("idle");
      if (data.quickProjectId) {
        setQuickProjectId(data.quickProjectId);
      }
      saveQuickAIResultToSession({
        input: data.input,
        result: data.result,
        previewImageUrl: null,
        imageWarning: ""
      });
    } catch {
      setResultState("failed");
      if (!resolvedResult && fallbackResult) {
        setResolvedResult(fallbackResult);
      }
    }
  }, [fallbackResult, quickProjectId, resolvedResult]);

  useEffect(() => {
    const shouldGenerateText =
      source === "ai" &&
      Boolean(effectiveInput?.idea) &&
      resultState !== "generating" &&
      !hasSessionResultForCurrentIdea &&
      !dbResult;

    if (!shouldGenerateText || !effectiveInput) return;
    const requestKey = [
      "refresh-v2",
      effectiveInput.idea.trim(),
      effectiveInput.direction,
      effectiveInput.style,
      effectiveInput.scale,
      effectiveInput.referenceImage.trim(),
      effectiveInput.correctionIntent?.trim() || ""
    ].join("|");
    if (autoRequestedKeyRef.current === requestKey) return;
    autoRequestedKeyRef.current = requestKey;
    void requestTextResult(effectiveInput);
  }, [dbResult, effectiveInput, hasSessionResultForCurrentIdea, requestTextResult, resolvedResult, resultState, source]);

  useEffect(() => {
    if (!previewImageUrl) return;
    setImageUrl(previewImageUrl);
    setImageState("idle");
    setImageMessage("");
    setImageInfoHint("");
  }, [previewImageUrl]);

  useEffect(() => {
    if (!hasTriedImageGeneration || imageUrl) {
      setImageProgress((prev) => (prev >= 100 ? 100 : 5));
      setImageElapsedSeconds(0);
      return;
    }
    const progressTimer = window.setInterval(() => {
      setImageElapsedSeconds((prev) => prev + 1);
      setImageProgress((prev) => {
        if (prev >= 92) return 92;
        if (prev < 40) return Math.min(prev + 0.65, 40);
        if (prev < 70) return Math.min(prev + 0.25, 70);
        if (prev < 90) return Math.min(prev + 0.1, 90);
        return Math.min(prev + 0.03, 92);
      });
    }, 1000);
    return () => {
      window.clearInterval(progressTimer);
    };
  }, [hasTriedImageGeneration, imageUrl]);

  const imageStateRef = useRef(imageState);
  imageStateRef.current = imageState;
  const imageUrlRef = useRef(imageUrl);
  imageUrlRef.current = imageUrl;

  // Poll DB every 15s while waiting for image generation.
  // Handles reverse-proxy timeouts: the backend persists the image to DB, but
  // the long-running fetch response never reaches the browser.
  const IMAGE_POLL_INTERVAL_MS = 15_000;
  useEffect(() => {
    if (!quickProjectId || !hasTriedImageGeneration || imageUrl) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/quick/projects/${quickProjectId}`);
        if (!res.ok) return;
        const data = (await res.json().catch(() => null)) as
          | { quickProject?: { previewImageUrl?: string | null } }
          | null;
        const dbUrl = data?.quickProject?.previewImageUrl;
        if (dbUrl && !imageUrlRef.current) {
          setImageUrl(dbUrl);
          setImageState("idle");
          setImageProgress(100);
          setImageMessage("");
          setImageInfoHint("");
          imageRequestSeqRef.current += 1;
          updateQuickAIImageInSession({
            idea: effectiveInput?.idea ?? "",
            previewImageUrl: dbUrl,
            imageWarning: ""
          });
        }
      } catch {
        // Polling failure is non-critical; next poll will retry.
      }
    };
    const timer = window.setInterval(poll, IMAGE_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [quickProjectId, hasTriedImageGeneration, imageUrl, effectiveInput]);

  const clearImageRetryTimer = useCallback(() => {
    if (imageRetryTimerRef.current !== null) {
      window.clearTimeout(imageRetryTimerRef.current);
      imageRetryTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearImageRetryTimer(), [clearImageRetryTimer]);

  const requestImageResult = useCallback(
    async (targetInput: QuickEntryInput, opts?: { manual?: boolean; preserveProgress?: boolean }) => {
      const requestSeq = ++imageRequestSeqRef.current;
      if (!opts?.preserveProgress) {
        imageRetryCountRef.current = 0;
        clearImageRetryTimer();
      }
      setHasTriedImageGeneration(true);
      setImageState("generating");
      setImageMessage("预览图正在整理中，请稍候...");
      setImageInfoHint("");
      if (!opts?.preserveProgress) {
        setImageProgress(8);
        setImageElapsedSeconds(0);
      }
      try {
        const response = await fetch("/api/quick/generate-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            idea: targetInput.idea,
            direction: targetInput.direction,
            style: targetInput.style,
            scale: targetInput.scale,
            referenceImage: targetInput.referenceImage,
            correctionIntent: targetInput.correctionIntent,
            quickProjectId: quickProjectId || undefined,
            regenerateToken: opts?.manual ? String(Date.now()) : undefined
          })
        });
        const data = (await response.json().catch(() => null)) as
          | {
              previewImageUrl?: string | null;
              usedFallbackToDefault?: boolean;
              usedReferenceImage?: boolean;
              referenceImageDropped?: boolean;
              persistedToProject?: boolean;
              error?: string;
              retryable?: boolean;
            }
          | null;
        if (!response.ok || !data?.previewImageUrl) {
          const apiError = new Error(data?.error ?? "AI 积木设计师暂时忙不过来，稍后去项目列表查看，我们一定会帮你设计出来。") as Error & { retryable?: boolean };
          apiError.retryable = Boolean(data?.retryable);
          throw apiError;
        }
        if (requestSeq !== imageRequestSeqRef.current) return;
        clearImageRetryTimer();
        imageRetryCountRef.current = 0;
        setImageUrl(data.previewImageUrl);
        setImageState("idle");
        setImageProgress(100);
        setImageMessage("");
        setReferenceImageWasDropped(Boolean(data.referenceImageDropped));
        const messageParts: string[] = [];
        if (data.referenceImageDropped) {
          messageParts.push("排队的人有点多，换了一位设计师帮你，参考图这次暂未用上。");
        } else if (data.usedReferenceImage) {
          messageParts.push("已参考你的图片来画的哦。");
        }
        if (!data.referenceImageDropped && data.usedFallbackToDefault) {
          messageParts.push("排队设计的人有点多，已经换了一位设计师帮你搞定。");
        }
        if (quickProjectId && !data.persistedToProject) {
          messageParts.push("图片已生成，正在同步到项目列表。");
        }
        setImageInfoHint(messageParts.join(" "));
        if (quickProjectId && !data.persistedToProject) {
          void fetch(`/api/quick/projects/${quickProjectId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              idea: targetInput.idea,
              previewImageUrl: data.previewImageUrl,
              imageWarning: ""
            })
          });
        }
        updateQuickAIImageInSession({
          idea: targetInput.idea,
          previewImageUrl: data.previewImageUrl,
          imageWarning: ""
        });
      } catch (error) {
        if (requestSeq !== imageRequestSeqRef.current) return;
        const message =
          error instanceof Error
            ? error.message
            : typeof error === "object" && error !== null && "message" in error
              ? String((error as { message: unknown }).message)
              : "AI 积木设计师暂时忙不过来，稍后去项目列表查看，我们一定会帮你设计出来。";
        const retryable = Boolean(
          error instanceof Error &&
            "retryable" in error &&
            (error as Error & { retryable?: boolean }).retryable
        );
        const nextDelay = IMAGE_AUTO_RETRY_DELAYS_MS[imageRetryCountRef.current];
        if (retryable && typeof nextDelay === "number") {
          imageRetryCountRef.current += 1;
          const retryRound = imageRetryCountRef.current;
          setImageState("generating");
          setImageMessage("");
          setImageInfoHint(`大家都在设计积木，AI 设计师正在第 ${retryRound} 次排队中...`);
          clearImageRetryTimer();
          imageRetryTimerRef.current = window.setTimeout(() => {
            void requestImageResult(targetInput, { preserveProgress: true });
          }, nextDelay);
          return;
        }
        clearImageRetryTimer();
        setImageInfoHint("");
        setImageState("failed");
        setImageProgress(100);
        setImageMessage(message);
        updateQuickAIImageInSession({
          idea: targetInput.idea,
          imageWarning: message
        });
      }
    },
    [clearImageRetryTimer, quickProjectId]
  );

  useEffect(() => {
    if (
      source !== "ai" ||
      !effectiveInput?.idea ||
      !resolvedResult ||
      resultState === "generating"
    ) return;
    if (imageStateRef.current === "generating" || imageUrlRef.current || previewImageUrl) return;

    const requestKey = [
      "image-refresh-v2",
      quickProjectId || "no-project",
      effectiveInput.idea.trim(),
      effectiveInput.direction,
      effectiveInput.style,
      effectiveInput.scale,
      effectiveInput.referenceImage.trim(),
      effectiveInput.correctionIntent?.trim() || ""
    ].join("|");
    if (imageAutoRequestedKeyRef.current === requestKey) return;
    if (wasAutoImageRequestedRecently(requestKey)) return;
    imageAutoRequestedKeyRef.current = requestKey;

    void requestImageResult(effectiveInput);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveInput, previewImageUrl, quickProjectId, resolvedResult, resultState, source]);

  useEffect(() => {
    if (
      source === "ai" ||
      !effectiveInput?.idea ||
      !dbResult ||
      dbLoading ||
      imageStateRef.current === "generating" ||
      imageUrlRef.current
    ) {
      return;
    }
    const requestKey = [
      "image-db-retry-v1",
      effectiveInput.idea.trim(),
      effectiveInput.direction,
      effectiveInput.style,
      effectiveInput.scale,
      effectiveInput.referenceImage.trim(),
      effectiveInput.correctionIntent?.trim() || ""
    ].join("|");
    if (imageAutoRequestedKeyRef.current === requestKey) return;
    imageAutoRequestedKeyRef.current = requestKey;

    void requestImageResult(effectiveInput);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbLoading, dbResult, effectiveInput, source]);

  const shouldBlockForDbLoading = dbLoading && !effectiveInput && !resolvedResult;
  if (shouldBlockForDbLoading) {
    return (
      <section className="mx-auto max-w-3xl space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-900">我先帮你看了下这个创意</h1>
        <p className="text-sm text-slate-700">正在把这个想法整理成更好读的方向建议...</p>
      </section>
    );
  }

  if (!effectiveInput) {
    return (
      <section className="mx-auto max-w-3xl space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-slate-900">我先帮你看了下这个创意</h1>
        <p className="text-sm text-slate-600">
          {dbMessage || "当前缺少创意输入，请先回到轻量入口填写一句话创意。"}
        </p>
        <Link
          href="/quick/new"
          className="inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          返回轻量输入页
        </Link>
      </section>
    );
  }

  const isLoading = source === "ai" && !resolvedResult;
  const projectJudgement = inferJudgementFromQuickInput(effectiveInput);
  const projectFitFor = inferFitForFromJudgement(projectJudgement);
  const projectNextSuggestion = inferNextSuggestionFromJudgement(projectJudgement);
  const primaryPath: QuickPath = projectNextSuggestion === "生成完整方案" ? "professional_upgrade" : "small_batch";
  const primaryCtaLabel = primaryPath === "professional_upgrade" ? "先把这个方向补充完整" : "去看试做路径";
  const conceptPreviewText = resolvedResult?.conceptPreview || "";
  const previewLead = firstSentenceOf(conceptPreviewText || "这版更像一个可先试水的小体量作品。");
  const highlightText = clampText(resolvedResult?.recommendedReason || fallbackResult?.recommendedReason || "主题记忆点比较明确，比较适合先拿来验证方向。", 36);
  const audienceHint = (() => {
    const ideaText = effectiveInput.idea;
    if (hasAnyKeyword(ideaText, ["景区", "地标", "文创", "礼盒"])) return "更适合景区文创、纪念礼品或桌面摆件方向。";
    if (hasAnyKeyword(ideaText, ["高校", "校园", "毕业"])) return "更适合校园纪念、毕业礼物或社团主题方向。";
    if (hasAnyKeyword(ideaText, ["机械", "载具", "战舰"])) return "更适合玩家向展示件或可玩套装方向。";
    return "更适合先做一版可以讨论和试水的小体量作品。";
  })();
  const riskHint = (() => {
    if (hasAnyKeyword(effectiveInput.idea, ["机械", "载具", "机甲"])) return "注意别把结构做得太散，后续要重点看稳定性和零件复杂度。";
    if (hasAnyKeyword(effectiveInput.idea, ["景区", "高校", "建筑"])) return "注意主题识别度和礼品感，别只像一张建筑照片。";
    return "注意主题表达和体量控制，先让人一眼看懂这个项目想做什么。";
  })();
  const showProjectListLink = imageElapsedSeconds >= 20 || imageState === "failed";
  const showThreeMinuteGuidance = imageElapsedSeconds >= 180 || imageState === "failed";
  const imageStageMessage = (() => {
    if (imageInfoHint && imageState !== "failed") return imageInfoHint;
    if (imageElapsedSeconds < 30) return "正在准备画面，请稍候。";
    if (imageElapsedSeconds < 90) return "正在拼搭主体结构。";
    if (imageElapsedSeconds < 180) return "正在补细节与光影。";
    return "仍在整理中，可先去项目列表稍后查看。";
  })();
  const imageFromDbMissing = !imageUrl && !hasTriedImageGeneration && Boolean(dbResult) && !dbLoading;
  const displayTopJudgement = clampText(
    resolvedResult?.topJudgement || fallbackResult?.topJudgement || "正在整理中，请稍候...",
    42
  );
  const isWaitingPrimaryView = hasTriedImageGeneration && !imageUrl && !imageFromDbMissing;

  const goQuickPath = (path: QuickPath) => {
    const context = {
      idea: effectiveInput.idea,
      direction: effectiveInput.direction,
      style: effectiveInput.style,
      scale: effectiveInput.scale,
      referenceImage: effectiveInput.referenceImage,
      quickJudgement: resolvedResult?.topJudgement || "",
      quickPath: path
    };
    try {
      saveQuickPrefillToSession({
        idea: context.idea,
        direction: context.direction,
        style: context.style,
        scale: context.scale,
        quickJudgement: context.quickJudgement,
        quickPath: path
      });
    } catch {
      // Some WebViews may block sessionStorage. Navigation should still work.
    }
    const href = buildQuickPathHref(path, context);
    const currentPath = window.location.pathname;
    const currentSearch = window.location.search;
    router.push(href);
    window.setTimeout(() => {
      if (window.location.pathname === currentPath && window.location.search === currentSearch) {
        window.location.assign(href);
      }
    }, 300);
  };
  const handleQuickCorrection = (intent: string) => {
    if (!effectiveInput) return;
    const correctedInput: QuickEntryInput = {
      ...effectiveInput,
      correctionIntent: intent
    };
    setActiveCorrection(intent);
    setOverrideInput(correctedInput);
    setImageUrl(null);
    setImageMessage("");
    setImageInfoHint("");
    setHasTriedImageGeneration(false);
    void requestTextResult(correctedInput, { manual: true });
    void requestImageResult(correctedInput, { manual: true });
  };

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-[28px] border-2 border-amber-100 bg-gradient-to-b from-amber-50/60 to-white p-6 shadow-[0_12px_30px_-20px_rgba(217,119,6,0.4)] sm:p-8">
        <p className="inline-flex items-center rounded-full border-2 border-amber-200 bg-white px-3 py-1 text-xs font-bold text-amber-800">
          当前状态 · 方向判断完成
        </p>
        <h1 className="text-xl font-bold text-slate-900">我先帮你看了下这个创意</h1>
        <div className="mt-3 space-y-2">
          <p className="text-sm font-medium text-slate-700">{displayTopJudgement}</p>
          <p className="text-xs font-medium text-slate-500">当前已完成方向判断，适合决定这个创意值不值得继续推进。这一步不是定稿，而是帮助你判断是否继续投入时间和预算。</p>
        </div>
      </section>

      {!isWaitingPrimaryView && !isLoading ? (
        <section className="rounded-3xl border-2 border-amber-100 bg-amber-50/60 p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-bold text-slate-900">项目判断卡</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs font-bold text-slate-400">主判断语</p>
              <p className="mt-2 text-base font-bold text-slate-900">{projectJudgement}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs font-bold text-slate-400">更适合什么方向</p>
              <p className="mt-2 text-base font-bold text-slate-900">{projectFitFor}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs font-bold text-slate-400">当前建议</p>
              <p className="mt-2 text-base font-bold text-slate-900">{projectNextSuggestion}</p>
            </div>
          </div>
          <div className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-400">注意点</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{riskHint}</p>
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border-2 border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">AI 创意预览</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">这是一版方向预览，后续可以继续扩展更多版本。</p>
          </div>
          {!isWaitingPrimaryView ? (
            <button
              type="button"
              onClick={() => goQuickPath(primaryPath)}
              className="relative inline-flex items-center justify-center rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-amber-950 shadow-[0_4px_0_0_#d97706] transition-all duration-200 hover:bg-amber-300 active:translate-y-1 active:shadow-none"
            >
              {primaryCtaLabel}
            </button>
          ) : null}
        </div>
        {imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={`${resolvedResult?.conceptTitle ?? "创意预览"} 预览图`}
              className="mt-3 w-full cursor-pointer rounded-2xl border-2 border-slate-100 object-cover shadow-sm active:opacity-80"
              onClick={() => {
                setLightboxZoom(1);
                setLightboxOpen(true);
              }}
            />
            <p className="mt-1 text-center text-xs text-slate-400">点击图片可查看大图，长按可保存</p>
            {imageInfoHint && <p className="mt-1 text-center text-xs text-amber-600">{imageInfoHint}</p>}
            {referenceImageWasDropped && (
              <button
                type="button"
                onClick={() => {
                  if (effectiveInput) {
                    setReferenceImageWasDropped(false);
                    setImageUrl(null);
                    void requestImageResult(effectiveInput, { manual: true });
                  }
                }}
                className="mx-auto mt-2 block rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-700 hover:bg-amber-100"
              >
                参考你的图再设计一次
              </button>
            )}
            {lightboxOpen && (
              <div
                className="fixed inset-0 z-50 bg-black/90"
                onClick={() => {
                  setLightboxOpen(false);
                  setLightboxZoom(1);
                }}
              >
                <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-black/55 px-3 py-2 text-white backdrop-blur-sm">
                  <p className="text-xs">拖动画面查看细节</p>
                  <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      className="rounded bg-white/90 px-2 py-1 text-xs text-slate-800"
                      onClick={() => setLightboxZoom((prev) => Math.max(1, Number((prev - 0.25).toFixed(2))))}
                    >
                      -
                    </button>
                    <span className="min-w-12 text-center text-xs">{Math.round(lightboxZoom * 100)}%</span>
                    <button
                      type="button"
                      className="rounded bg-white/90 px-2 py-1 text-xs text-slate-800"
                      onClick={() => setLightboxZoom((prev) => Math.min(3, Number((prev + 0.25).toFixed(2))))}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="rounded bg-white/90 px-2 py-1 text-xs text-slate-800"
                      onClick={() => setLightboxZoom(1)}
                    >
                      还原
                    </button>
                    <button
                      type="button"
                      className="rounded border border-white/40 bg-black/30 px-2 py-1 text-xs text-white"
                      onClick={() => {
                        setLightboxOpen(false);
                        setLightboxZoom(1);
                      }}
                    >
                      关闭
                    </button>
                  </div>
                </div>
                <div
                  className="absolute inset-0 overflow-auto px-2 pb-2 pt-12"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex min-h-full min-w-full items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="大图预览"
                      className="h-auto max-w-none rounded-lg"
                      style={{
                        width: `${Math.round(92 * lightboxZoom)}vw`,
                        minWidth: "92vw",
                        maxWidth: "none"
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        ) : imageFromDbMissing ? (
          <div className="mt-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 shadow-[0_8px_24px_-16px_rgba(217,119,6,0.4)]">
            <p className="font-bold">AI 积木设计师还没来得及设计这张图，现在帮你补上？</p>
            <button
              type="button"
              onClick={() => {
                if (effectiveInput) {
                  void requestImageResult(effectiveInput, { manual: true });
                }
              }}
              className="mt-3 relative inline-flex items-center justify-center rounded-xl bg-amber-400 font-bold text-amber-950 shadow-[0_4px_0_0_#d97706] transition-all duration-200 hover:bg-amber-300 active:translate-y-1 active:shadow-none disabled:pointer-events-none disabled:opacity-60 px-4 py-2 text-sm"
            >
              让 AI 设计师设计一张
            </button>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border-2 border-blue-200 bg-blue-50 p-6 text-sm text-blue-900 shadow-[0_8px_24px_-16px_rgba(59,130,246,0.45)]">
            <div className="mb-3 flex items-center gap-1.5">
              <span className="h-3 w-3 animate-bounce rounded bg-blue-500 [animation-delay:-0.2s]" />
              <span className="h-3 w-3 animate-bounce rounded bg-blue-500 [animation-delay:-0.1s]" />
              <span className="h-3 w-3 animate-bounce rounded bg-blue-500" />
              <span className="ml-2 inline-block h-3 w-3 animate-spin rounded border-2 border-blue-400 border-t-transparent" />
            </div>
            <p className="font-bold text-base">AI 积木设计师正在为你设计中，预计 3-5 分钟，请耐心等待。</p>
            <p className="mt-2 text-blue-800">{imageStageMessage}</p>
            <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-blue-200/50 shadow-inner">
              <div className="h-full rounded-full bg-blue-500 transition-all duration-1000" style={{ width: `${imageProgress}%` }} />
            </div>
            {showProjectListLink && (
              <p className="mt-4 font-medium text-blue-800">
                {showThreeMinuteGuidance ? "设计还在进行中，你可以先去" : "也可以去"}
                <Link href="/projects" className="mx-1 text-blue-600 underline underline-offset-4 hover:text-blue-900">
                  项目列表
                </Link>
                {showThreeMinuteGuidance ? "稍后查看，完成后会自动出现在那里。" : "稍后查看，设计好了会自动出现。"}
              </p>
            )}
          </div>
        )}
          <p className="mt-4 text-xs font-medium text-slate-500">用于方向判断。</p>
        {isLoading || isWaitingPrimaryView ? (
          <div className="mt-4 space-y-3">
            <div className="h-5 w-2/5 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-4 w-full animate-pulse rounded-lg bg-slate-100" />
            <div className="h-4 w-4/5 animate-pulse rounded-lg bg-slate-100" />
          </div>
        ) : (
          <>
            <p className="mt-4 text-sm font-medium text-slate-700">{clampText(previewLead, 44)}</p>
          </>
        )}
        {!isLoading && !isWaitingPrimaryView && correctionOptions.length > 0 && (
          <div className="mt-5 rounded-2xl border-2 border-slate-100 bg-slate-50/50 p-5">
            <p className="text-sm font-bold text-slate-800">换个方向再试试</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {correctionOptions.map((option) => {
                const isActive = activeCorrection === option.label;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => handleQuickCorrection(option.label)}
                    disabled={resultState === "generating" || imageState === "generating"}
                    className={
                      isActive
                        ? "rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-900 shadow-sm"
                        : "rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-amber-200 hover:bg-amber-50/50 hover:text-amber-800 disabled:opacity-50"
                    }
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {!isWaitingPrimaryView && (
        <section className="rounded-3xl border-2 border-slate-100 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-bold text-slate-900">为什么这个方向值得继续</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-50/70 p-4">
              <p className="text-xs font-bold text-slate-400">亮点</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{highlightText}</p>
            </div>
            <div className="rounded-2xl bg-slate-50/70 p-4">
              <p className="text-xs font-bold text-slate-400">适合谁</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{audienceHint}</p>
            </div>
            <div className="rounded-2xl bg-slate-50/70 p-4">
              <p className="text-xs font-bold text-slate-400">注意点</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{riskHint}</p>
            </div>
          </div>
        </section>
      )}

      {!isWaitingPrimaryView && (
        <section className="rounded-3xl border-2 border-slate-100 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-bold text-slate-900">推进路径选择</h2>
          <p className="mt-2 text-sm text-slate-500">当前状态是方向判断完成。下一步重点不是继续看图，而是决定要不要沿一条路径往下推进。</p>
          <button
            type="button"
            onClick={() => goQuickPath(primaryPath)}
            className="mt-4 w-full relative inline-flex items-center justify-center rounded-2xl border border-amber-300 bg-amber-400 px-5 py-3 text-base font-extrabold text-amber-950 shadow-[0_6px_0_0_#d97706] transition-all duration-200 hover:bg-amber-300 active:translate-y-1 active:shadow-[0_2px_0_0_#d97706] disabled:pointer-events-none disabled:opacity-60"
          >
            {primaryCtaLabel}
          </button>
          <button
            type="button"
            onClick={() => setShowMorePaths((prev) => !prev)}
            className="mt-4 text-xs font-medium text-slate-600 hover:text-amber-600 hover:underline"
          >
            {showMorePaths ? "收起更多选择" : "更多选择（团购/众筹、专业方案）"}
          </button>
          {showMorePaths && (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => goQuickPath("creator_plan")}
                className="relative inline-flex items-center justify-center rounded-2xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-[0_4px_0_0_#e2e8f0] transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 active:translate-y-1 active:shadow-none disabled:pointer-events-none disabled:opacity-60 w-full"
              >
                我要团购 / 众筹
              </button>
              <button
                type="button"
                onClick={() => goQuickPath("professional_upgrade")}
                className="relative inline-flex items-center justify-center rounded-2xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-[0_4px_0_0_#e2e8f0] transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 active:translate-y-1 active:shadow-none disabled:pointer-events-none disabled:opacity-60 w-full"
              >
                先把这个方向补充完整
              </button>
            </div>
          )}
          <div className="mt-4 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => handleQuickCorrection(correctionOptions[0]?.label || "更像核心主体")}
              className="text-sm font-medium text-slate-500 hover:text-slate-800 hover:underline"
            >
              暂时先不推进，再换一个方向试试
            </button>
          </div>
        </section>
      )}

      {!isWaitingPrimaryView && (
        <section className="rounded-3xl border-2 border-slate-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-900">想看类似方向（可选）</h2>
            <button
              type="button"
              onClick={() => setShowReferences((prev) => !prev)}
              className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-800 hover:underline"
            >
              {showReferences ? "收起" : "展开"}
            </button>
          </div>
          {showReferences && (isLoading ? (
            <div className="mt-4 space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-4">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
                  <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-200" />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {references.map((item) => (
                <div key={item.id} className="rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 transition-colors hover:border-amber-200 hover:bg-amber-50/50">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-base font-bold text-slate-900">{item.title}</p>
                    <span className="rounded-full border-2 border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600">
                      {mapReferenceTypeLabel(item.referenceType)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{clampText(item.whyRelevant, 24)}</p>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}

      {!isWaitingPrimaryView && (
        <section className="rounded-3xl border-2 border-slate-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">别人也在做这些方向</h2>
              <p className="mt-2 text-sm text-slate-500">先看看类似案例，感受一下别人是怎么把创意继续往下推进的。</p>
            </div>
            <Link href="/showcase" className="text-sm font-bold text-amber-700 hover:text-amber-900 hover:underline">
              查看更多案例
            </Link>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {showcaseRecommendations.map((project) => (
              <article key={project.slug} className="overflow-hidden rounded-3xl border-2 border-slate-100 bg-slate-50/60">
                <div className={`h-28 bg-gradient-to-br ${project.coverGradient}`} />
                <div className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-600">{project.category}</span>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-800">{project.stage}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{project.title}</p>
                  <p className="text-xs font-bold text-slate-800">{project.judgement}</p>
                  <p className="text-xs leading-6 text-slate-500">{project.nextSuggestion}</p>
                  <Link href={`/showcase/${project.slug}`} className="inline-flex text-sm font-bold text-amber-700 hover:text-amber-900">
                    看看这个方向
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
