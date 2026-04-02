"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  inferJudgementFromQuickInput,
  inferNextSuggestionFromJudgement
} from "@/lib/project-language";
import {
  buildQuickEntryResult,
  readQuickAIResultFromSession,
  saveQuickAIResultToSession,
  saveQuickPrefillToSession,
  updateQuickAIImageInSession
} from "@/lib/quick-entry";
import { buildQuickPathHref } from "@/lib/quick-path-context";
import type {
  QuickDirection,
  QuickEntryInput,
  QuickImageModelAlias,
  QuickImageStatus,
  QuickPath,
  QuickScalePreference,
  QuickStyle
} from "@/types/quick-entry";

function clampText(value: string | undefined, maxChars: number) {
  const text = (value || "").trim();
  if (!text) return "";
  const chars = Array.from(text);
  if (chars.length <= maxChars) return text;
  return `${chars.slice(0, maxChars).join("")}…`;
}

const AUTO_REQUEST_DEDUP_TTL_MS = 120_000;
const recentAutoImageRequestMap = new Map<string, number>();

const IMAGE_POLL_INTERVAL_MS = 15_000;

function parseClientSeconds(rawValue: string | undefined, fallback: number) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.round(parsed);
}

const IMAGE_WAIT_SECONDS = parseClientSeconds(process.env.NEXT_PUBLIC_IMAGE_WAIT_SECONDS, 30);
const IMAGE_RETRY_SECONDS = Math.max(
  IMAGE_WAIT_SECONDS,
  parseClientSeconds(process.env.NEXT_PUBLIC_IMAGE_RETRY_SECONDS, 90)
);

type QuickProjectImageSnapshot = {
  previewImageUrl: string | null;
  imageWarning: string;
  imageStatus: QuickImageStatus;
  imageUpdatedAt: string | null;
  imageLastError: string;
  imageAttemptCount: number;
  imageModelAlias: QuickImageModelAlias | null;
};

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
  const [imageStatus, setImageStatus] = useState<QuickImageStatus>("idle");
  const [imageError, setImageError] = useState("");
  const [imageUpdatedAt, setImageUpdatedAt] = useState<string | null>(null);
  const [imageAttemptCount, setImageAttemptCount] = useState(0);
  const [, setImageModelAlias] = useState<QuickImageModelAlias | null>(null);
  const [imageInfoHint, setImageInfoHint] = useState("");
  const [resultState, setResultState] = useState<"idle" | "generating" | "failed">("idle");
  const [quickProjectId, setQuickProjectId] = useState(quickProjectIdFromQuery);
  const [dbInput, setDbInput] = useState<QuickEntryInput | null>(null);
  const [dbResult, setDbResult] = useState<ReturnType<typeof buildQuickEntryResult> | null>(null);
  const [overrideInput, setOverrideInput] = useState<QuickEntryInput | null>(null);
  const [dbLoading, setDbLoading] = useState(Boolean(quickProjectIdFromQuery));
  const [dbMessage, setDbMessage] = useState("");
  const [activeCorrection, setActiveCorrection] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [imageProgress, setImageProgress] = useState(8);
  const [imageElapsedSeconds, setImageElapsedSeconds] = useState(0);
  const [referenceImageWasDropped, setReferenceImageWasDropped] = useState(false);
  const autoRequestedKeyRef = useRef("");
  const imageAutoRequestedKeyRef = useRef("");
  const imageRequestSeqRef = useRef(0);

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

  const syncImageSnapshot = useCallback((snapshot: Partial<QuickProjectImageSnapshot>) => {
    setImageUrl(snapshot.previewImageUrl ?? null);
    setImageStatus(
      snapshot.imageStatus ??
        (snapshot.previewImageUrl ? "succeeded" : snapshot.imageWarning || snapshot.imageLastError ? "failed" : "idle")
    );
    setImageError(snapshot.imageLastError ?? snapshot.imageWarning ?? "");
    setImageUpdatedAt(snapshot.imageUpdatedAt ?? null);
    setImageAttemptCount(snapshot.imageAttemptCount ?? 0);
    setImageModelAlias(snapshot.imageModelAlias ?? null);
  }, []);

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
                imageStatus: QuickImageStatus;
                imageUpdatedAt: string | null;
                imageLastError: string;
                imageAttemptCount: number;
                imageModelAlias: QuickImageModelAlias | null;
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
        syncImageSnapshot(data.quickProject);
        setImageInfoHint("");
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
  }, [quickProjectId, syncImageSnapshot]);

  const previewImageUrl = useMemo(() => {
    if (source === "ai" && aiSession?.previewImageUrl) {
      const sameIdea = aiSession.input.idea.trim() === (input?.idea.trim() ?? "");
      const sameCorrection =
        (aiSession.input.correctionIntent || "").trim() === ((input?.correctionIntent || "").trim() ?? "");
      if (sameIdea && sameCorrection) return aiSession.previewImageUrl;
    }
    return null;
  }, [aiSession, input, source]);

  const correctionOptions = useMemo(
    () => (effectiveInput ? buildCorrectionOptions(effectiveInput) : []),
    [effectiveInput]
  );

  const requestTextResult = useCallback(
    async (targetInput: QuickEntryInput, opts?: { manual?: boolean }) => {
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
        syncImageSnapshot({
          previewImageUrl: null,
          imageWarning: "",
          imageStatus: "idle",
          imageLastError: "",
          imageUpdatedAt: null,
          imageAttemptCount: 0,
          imageModelAlias: null
        });
        if (data.quickProjectId) {
          setQuickProjectId(data.quickProjectId);
        }
        saveQuickAIResultToSession({
          input: data.input,
          result: data.result,
          previewImageUrl: null,
          imageWarning: "",
          imageStatus: "idle",
          imageLastError: "",
          imageUpdatedAt: null,
          imageAttemptCount: 0,
          imageModelAlias: null
        });
        return {
          input: data.input,
          result: data.result,
          quickProjectId: data.quickProjectId?.trim() || quickProjectId || ""
        };
      } catch {
        setResultState("failed");
        if (!resolvedResult && fallbackResult) {
          setResolvedResult(fallbackResult);
        }
        return null;
      }
    },
    [fallbackResult, quickProjectId, resolvedResult, syncImageSnapshot]
  );

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
    syncImageSnapshot({
      previewImageUrl,
      imageStatus: aiSession?.imageStatus ?? "succeeded",
      imageWarning: "",
      imageLastError: aiSession?.imageLastError ?? "",
      imageUpdatedAt: aiSession?.imageUpdatedAt ?? null,
      imageAttemptCount: aiSession?.imageAttemptCount ?? 0,
      imageModelAlias: aiSession?.imageModelAlias ?? null
    });
    setImageInfoHint("");
  }, [aiSession, previewImageUrl, syncImageSnapshot]);

  useEffect(() => {
    const isImageGenerating = (imageStatus === "queued" || imageStatus === "generating") && !imageUrl;
    if (!isImageGenerating) {
      setImageProgress((prev) => (prev >= 100 ? 100 : 5));
      setImageElapsedSeconds(0);
      return;
    }
    const updateProgress = () => {
      const startedAtMs = imageUpdatedAt ? new Date(imageUpdatedAt).getTime() : Date.now();
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
      setImageElapsedSeconds(elapsedSeconds);
      setImageProgress((prev) => {
        if (prev >= 92) return 92;
        if (prev < 40) return Math.min(prev + 0.65, 40);
        if (prev < 70) return Math.min(prev + 0.25, 70);
        if (prev < 90) return Math.min(prev + 0.1, 90);
        return Math.min(prev + 0.03, 92);
      });
    };
    updateProgress();
    const progressTimer = window.setInterval(() => {
      updateProgress();
    }, 1000);
    return () => {
      window.clearInterval(progressTimer);
    };
  }, [imageStatus, imageUpdatedAt, imageUrl]);

  const imageStatusRef = useRef(imageStatus);
  imageStatusRef.current = imageStatus;
  const imageUrlRef = useRef(imageUrl);
  imageUrlRef.current = imageUrl;

  useEffect(() => {
    if (!quickProjectId) return;
    if (imageStatus !== "queued" && imageStatus !== "generating") return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/quick/projects/${quickProjectId}`);
        if (!res.ok) return;
        const data = (await res.json().catch(() => null)) as
          | {
              quickProject?: QuickProjectImageSnapshot;
            }
          | null;
        if (!data?.quickProject) return;
        const nextSnapshot = data.quickProject;
        syncImageSnapshot(nextSnapshot);
        if (nextSnapshot.previewImageUrl && !imageUrlRef.current) {
          setImageProgress(100);
          setImageInfoHint("");
          imageRequestSeqRef.current += 1;
          updateQuickAIImageInSession({
            idea: effectiveInput?.idea ?? "",
            previewImageUrl: nextSnapshot.previewImageUrl,
            imageWarning: nextSnapshot.imageWarning,
            imageStatus: nextSnapshot.imageStatus,
            imageLastError: nextSnapshot.imageLastError,
            imageUpdatedAt: nextSnapshot.imageUpdatedAt,
            imageAttemptCount: nextSnapshot.imageAttemptCount,
            imageModelAlias: nextSnapshot.imageModelAlias
          });
        } else if (nextSnapshot.imageStatus === "failed") {
          updateQuickAIImageInSession({
            idea: effectiveInput?.idea ?? "",
            imageWarning: nextSnapshot.imageWarning,
            imageStatus: nextSnapshot.imageStatus,
            imageLastError: nextSnapshot.imageLastError,
            imageUpdatedAt: nextSnapshot.imageUpdatedAt,
            imageAttemptCount: nextSnapshot.imageAttemptCount,
            imageModelAlias: nextSnapshot.imageModelAlias
          });
        }
      } catch {
        // Polling failure is non-critical; next poll will retry.
      }
    };
    const timer = window.setInterval(poll, IMAGE_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [effectiveInput, imageStatus, quickProjectId, syncImageSnapshot]);

  const requestImageResult = useCallback(
    async (targetInput: QuickEntryInput, opts?: { manual?: boolean; projectIdOverride?: string }) => {
      const targetQuickProjectId = opts?.projectIdOverride?.trim() || quickProjectId;
      if (!targetQuickProjectId) {
        setImageStatus("failed");
        setImageError("当前项目还没准备好，请稍后再试一次。");
        setImageInfoHint("");
        return;
      }
      if (targetQuickProjectId !== quickProjectId) {
        setQuickProjectId(targetQuickProjectId);
      }
      const requestSeq = ++imageRequestSeqRef.current;
      const startedAt = new Date().toISOString();
      const nextAttempt = imageAttemptCount + 1;
      setReferenceImageWasDropped(false);
      setImageStatus("generating");
      setImageError("");
      setImageUpdatedAt(startedAt);
      setImageAttemptCount(nextAttempt);
      setImageInfoHint("");
      setImageProgress(8);
      setImageElapsedSeconds(0);
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
            quickProjectId: targetQuickProjectId,
            regenerateToken: opts?.manual ? String(Date.now()) : undefined
          })
        });
        const data = (await response.json().catch(() => null)) as
          | {
              status?: QuickImageStatus;
              previewImageUrl?: string | null;
              message?: string;
              usedFallbackToDefault?: boolean;
              usedReferenceImage?: boolean;
              referenceImageDropped?: boolean;
              persistedToProject?: boolean;
              retryable?: boolean;
            }
          | null;
        if (requestSeq !== imageRequestSeqRef.current) return;
        if (!response.ok || data?.status !== "succeeded" || !data?.previewImageUrl) {
          const failedMessage = data?.message ?? "这次预览图还没整理出来，请再试一次。";
          setImageUrl(null);
          setImageStatus("failed");
          setImageError(failedMessage);
          setImageUpdatedAt(new Date().toISOString());
          setImageInfoHint("");
          setImageProgress(100);
          updateQuickAIImageInSession({
            idea: targetInput.idea,
            imageWarning: failedMessage,
            imageStatus: "failed",
            imageLastError: failedMessage,
            imageUpdatedAt: new Date().toISOString(),
            imageAttemptCount: nextAttempt
          });
          return;
        }
        setImageUrl(data.previewImageUrl);
        setImageStatus("succeeded");
        setImageError("");
        setImageProgress(100);
        setImageUpdatedAt(new Date().toISOString());
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
        setImageInfoHint(messageParts.join(" "));
        updateQuickAIImageInSession({
          idea: targetInput.idea,
          previewImageUrl: data.previewImageUrl,
          imageWarning: "",
          imageStatus: "succeeded",
          imageLastError: "",
          imageUpdatedAt: new Date().toISOString(),
          imageAttemptCount: nextAttempt
        });
      } catch (error) {
        if (requestSeq !== imageRequestSeqRef.current) return;
        const message =
          error instanceof Error
            ? error.message
            : typeof error === "object" && error !== null && "message" in error
              ? String((error as { message: unknown }).message)
              : "这次预览图还没整理出来，请再试一次。";
        setImageUrl(null);
        setImageStatus("failed");
        setImageError(message);
        setImageUpdatedAt(new Date().toISOString());
        setImageInfoHint("");
        setImageProgress(100);
        updateQuickAIImageInSession({
          idea: targetInput.idea,
          imageWarning: message,
          imageStatus: "failed",
          imageLastError: message,
          imageUpdatedAt: new Date().toISOString(),
          imageAttemptCount: nextAttempt
        });
      }
    },
    [imageAttemptCount, quickProjectId]
  );

  useEffect(() => {
    if (
      source !== "ai" ||
      !effectiveInput?.idea ||
      !resolvedResult ||
      resultState === "generating" ||
      !quickProjectId
    ) return;
    if (imageStatusRef.current === "queued" || imageStatusRef.current === "generating" || imageUrlRef.current || previewImageUrl) return;
    if (imageStatusRef.current !== "idle") return;

    const requestKey = [
      "image-refresh-v3",
      quickProjectId,
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
  }, [effectiveInput, imageStatus, previewImageUrl, quickProjectId, requestImageResult, resolvedResult, resultState, source]);

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
  const projectNextSuggestion = inferNextSuggestionFromJudgement(projectJudgement);
  const primaryPath: QuickPath = projectNextSuggestion === "生成完整方案" ? "professional_upgrade" : "small_batch";
  const primaryCtaLabel = primaryPath === "professional_upgrade" ? "继续完善这个方向" : "先下单试做";
  const isImageGenerating = (imageStatus === "queued" || imageStatus === "generating") && !imageUrl;
  const hasTimedOutWaiting = isImageGenerating && imageElapsedSeconds >= IMAGE_RETRY_SECONDS;
  const shouldShowFailedCard = (!imageUrl && imageStatus === "failed") || hasTimedOutWaiting;
  const showProjectListLink = imageElapsedSeconds >= IMAGE_WAIT_SECONDS || shouldShowFailedCard;
  const showThreeMinuteGuidance = imageElapsedSeconds >= IMAGE_RETRY_SECONDS || shouldShowFailedCard;
  const imageStageMessage = (() => {
    if (imageInfoHint && !shouldShowFailedCard) return imageInfoHint;
    if (imageElapsedSeconds < Math.min(30, IMAGE_WAIT_SECONDS)) return "正在准备画面，请稍候。";
    if (imageElapsedSeconds < Math.min(90, IMAGE_RETRY_SECONDS)) return "正在拼搭主体结构。";
    if (imageElapsedSeconds < IMAGE_RETRY_SECONDS) return "正在补细节与光影。";
    return "结果还在整理中，可先去项目列表稍后查看。";
  })();
  const shouldShowIdleImageCard = !imageUrl && imageStatus === "idle" && !dbLoading && Boolean(resolvedResult || fallbackResult);
  const imageFailureMessage = imageError || "这次预览图还没整理出来，你可以马上再试一次。";
  const displayTopJudgement = clampText(
    resolvedResult?.topJudgement || fallbackResult?.topJudgement || "结果正在整理中，请稍候...",
    42
  );
  const isWaitingPrimaryView = isImageGenerating && !hasTimedOutWaiting && !imageUrl && !shouldShowIdleImageCard;

  const goQuickPath = (path: QuickPath) => {
    const context = {
      projectId: quickProjectId || "",
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
  const handleQuickCorrection = async (intent: string) => {
    if (!effectiveInput) return;
    const correctedInput: QuickEntryInput = {
      ...effectiveInput,
      correctionIntent: intent
    };
    setActiveCorrection(intent);
    setOverrideInput(correctedInput);
    setImageUrl(null);
    setImageStatus("idle");
    setImageError("");
    setImageUpdatedAt(null);
    setImageAttemptCount(0);
    setImageModelAlias(null);
    setImageInfoHint("");
    const nextTextResult = await requestTextResult(correctedInput, { manual: true });
    if (!nextTextResult?.quickProjectId) return;
    await requestImageResult(correctedInput, {
      manual: true,
      projectIdOverride: nextTextResult.quickProjectId
    });
  };

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <section className="page-hero bg-[radial-gradient(circle_at_top_left,_rgba(253,230,138,0.4),_transparent_32%),radial-gradient(circle_at_84%_20%,_rgba(191,219,254,0.18),_transparent_26%),linear-gradient(180deg,rgba(255,251,235,0.76),rgba(255,255,255,0.92))]">
        <p className="eyebrow">
          第 1 步 · 看看值不值得继续
        </p>
        <h1 className="display-title mt-4 text-4xl font-black text-slate-900 sm:text-5xl">这条方向，适合继续往下做。</h1>
        <div className="mt-4 space-y-3">
          <p className="soft-note max-w-2xl">先看结论，再点下面那个按钮就行。</p>
        </div>
        {!isWaitingPrimaryView && !isLoading ? (
          <>
            <div className="mt-6">
              <div className="rounded-[24px] border border-amber-200/70 bg-[linear-gradient(180deg,rgba(255,248,220,0.88),rgba(255,255,255,0.9))] p-5 shadow-[0_22px_40px_-34px_rgba(217,119,6,0.3)]">
                <p className="text-xs font-bold text-slate-400">现在最适合</p>
                <p className="mt-3 text-base font-bold leading-7 text-amber-900">{primaryCtaLabel}</p>
                <p className="mt-2 text-sm text-slate-500">{displayTopJudgement}</p>
              </div>
            </div>
          </>
        ) : null}
      </section>

      <section className="page-section">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="section-title">先看看这一版</h2>
          </div>
        </div>
        {imageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={`${resolvedResult?.conceptTitle ?? "创意预览"} 预览图`}
              className="mt-4 w-full cursor-pointer rounded-[32px] border border-white/85 object-cover shadow-[0_26px_56px_-36px_rgba(15,23,42,0.28)] active:opacity-80"
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
        ) : shouldShowIdleImageCard ? (
          <div className="mt-5 rounded-[28px] border border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,248,220,0.9),rgba(255,255,255,0.92))] p-6 text-sm text-amber-900 shadow-[0_22px_46px_-34px_rgba(217,119,6,0.34)]">
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
        ) : shouldShowFailedCard ? (
          <div className="mt-5 rounded-[28px] border border-rose-200/80 bg-[linear-gradient(180deg,rgba(255,241,242,0.94),rgba(255,255,255,0.92))] p-6 text-sm text-rose-900 shadow-[0_22px_48px_-34px_rgba(244,63,94,0.24)]">
            <p className="font-bold text-base">这次预览图还没整理出来。</p>
            <p className="mt-2 text-rose-800">{hasTimedOutWaiting ? "这次等待有点久了，你可以马上再试一次，或者先继续下一步。" : imageFailureMessage}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  if (effectiveInput) {
                    void requestImageResult(effectiveInput, { manual: true });
                  }
                }}
                className="relative inline-flex items-center justify-center rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white shadow-[0_4px_0_0_#e11d48] transition-all duration-200 hover:bg-rose-400 active:translate-y-1 active:shadow-none"
              >
                再试一次
              </button>
              <Link
                href="/projects"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-[0_4px_0_0_#e2e8f0] transition-all duration-200 hover:bg-slate-50 active:translate-y-1 active:shadow-none"
              >
                先去项目列表
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-[28px] border border-blue-200/80 bg-[linear-gradient(180deg,rgba(239,246,255,0.92),rgba(255,255,255,0.92))] p-6 text-sm text-blue-900 shadow-[0_22px_48px_-34px_rgba(59,130,246,0.28)]">
            <div className="mb-3 flex items-center gap-1.5">
              <span className="h-3 w-3 animate-bounce rounded bg-blue-500 [animation-delay:-0.2s]" />
              <span className="h-3 w-3 animate-bounce rounded bg-blue-500 [animation-delay:-0.1s]" />
              <span className="h-3 w-3 animate-bounce rounded bg-blue-500" />
              <span className="ml-2 inline-block h-3 w-3 animate-spin rounded border-2 border-blue-400 border-t-transparent" />
            </div>
            <p className="font-bold text-base">AI 积木设计师正在为你设计中，请耐心等待。</p>
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
                {showThreeMinuteGuidance ? "稍后查看，等它整理好会自动出现在那里。" : "稍后查看，设计好了会自动出现。"}
              </p>
            )}
          </div>
        )}
        <p className="mt-4 text-xs font-medium text-slate-500">这张图先帮你看方向，不是最终成品。</p>
        {isLoading || isWaitingPrimaryView ? (
          <div className="mt-4 space-y-3">
            <div className="h-5 w-2/5 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-4 w-full animate-pulse rounded-lg bg-slate-100" />
            <div className="h-4 w-4/5 animate-pulse rounded-lg bg-slate-100" />
          </div>
        ) : null}
        {!isLoading && !isWaitingPrimaryView && correctionOptions.length > 0 && (
          <div className="mt-6 rounded-[28px] border border-white/80 bg-white/74 p-5 shadow-[0_18px_36px_-34px_rgba(15,23,42,0.22)]">
            <p className="text-sm font-bold text-slate-800">如果你想换个感觉</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {correctionOptions.map((option) => {
                const isActive = activeCorrection === option.label;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => handleQuickCorrection(option.label)}
                    disabled={resultState === "generating" || imageStatus === "generating" || imageStatus === "queued"}
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
        <section className="page-section bg-[linear-gradient(180deg,rgba(255,248,220,0.48),rgba(255,255,255,0.84))]">
          <h2 className="section-title">你现在点哪个按钮</h2>
          <p className="section-copy mt-2">先点主按钮就行。</p>
          <div className="mt-5 space-y-4">
            <div className="rounded-[30px] border border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,248,220,0.92),rgba(255,255,255,0.9))] p-6 shadow-[0_24px_50px_-36px_rgba(217,119,6,0.3)]">
              <p className="text-xs font-bold text-amber-700">推荐先点这个</p>
              <p className="mt-3 text-3xl font-black tracking-tight text-slate-900">{primaryCtaLabel}</p>
              <button
                type="button"
                onClick={() => goQuickPath(primaryPath)}
                className="primary-cta mt-5 w-full text-base disabled:pointer-events-none disabled:opacity-60"
              >
                {primaryCtaLabel}
              </button>
            </div>
            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => goQuickPath("creator_plan")}
                className="w-full rounded-2xl border-2 border-slate-200 bg-white px-5 py-4 text-left text-sm font-bold text-slate-700 shadow-[0_4px_0_0_#e2e8f0] transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 active:translate-y-1 active:shadow-none disabled:pointer-events-none disabled:opacity-60"
              >
                <span className="block text-base text-slate-900">先发布出来看看</span>
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => goQuickPath("professional_upgrade")}
              className="text-sm font-medium text-slate-500 hover:text-slate-800 hover:underline"
            >
              先把这个方向补完整
            </button>
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
    </section>
  );
}
