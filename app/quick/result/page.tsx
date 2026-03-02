"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  buildQuickEntryResult,
  mapReferenceTypeLabel,
  pickQuickSimilarReferences,
  readQuickAIResultFromSession,
  resolveQuickScalePreference,
  saveQuickAIResultToSession,
  saveQuickPrefillToSession,
  updateQuickAIImageInSession
} from "@/lib/quick-entry";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_VALUE } from "@/lib/session";
import type { QuickDirection, QuickEntryInput, QuickPath, QuickScalePreference, QuickStyle } from "@/types/quick-entry";

function pathLabel(path: QuickPath) {
  if (path === "small_batch") return "小批量单品验证";
  if (path === "creator_plan") return "原创计划 / 众筹验证";
  return "升级专业方案（深度版）";
}

function pathButtonClass(target: QuickPath, current: QuickPath) {
  if (target === current) {
    return "rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-800 ring-1 ring-blue-200";
  }
  if (target === "professional_upgrade") {
    return "rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800";
  }
  return "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50";
}

function scaleLabel(scale: "small" | "medium" | "large") {
  if (scale === "small") return "小型（约80-200颗）";
  if (scale === "medium") return "中型（约200-600颗）";
  return "大型（约600-1200颗）";
}

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
      { key: "pavilion", label: "更像完整景点" },
      { key: "gift", label: "更像景区礼物" },
      { key: "landmark", label: "更像能卖的纪念品" }
    ];
  }
  if (hasAnyKeyword(text, ["泉", "喷泉", "水景", "湖", "河", "地标", "景区", "文旅"])) {
    return [
      { key: "fountain", label: "更像泉池水景" },
      { key: "pavilion", label: "更像完整景点" },
      { key: "gift", label: "更像景区礼物" },
      { key: "landmark", label: "更像桌面摆件" }
    ];
  }
  if (hasAnyKeyword(text, ["机甲", "机械", "载具", "汽车", "战舰"])) {
    return [
      { key: "structure", label: "更像硬核机械款" },
      { key: "play", label: "更像可玩套装" },
      { key: "display", label: "更像桌面摆件" },
      { key: "series", label: "更像一套系列款" }
    ];
  }
  if (hasAnyKeyword(text, ["家庭", "亲子", "校园", "高校", "毕业", "回忆"])) {
    return [
      { key: "story", label: "更像有故事的小场景" },
      { key: "gift", label: "更像纪念礼物" },
      { key: "desk", label: "更像桌面摆件" },
      { key: "set", label: "更像小朋友会喜欢的款" }
    ];
  }
  return [
    { key: "shape", label: "更像核心主体" },
    { key: "scene", label: "更像有场景感" },
    { key: "gift", label: "更像景区礼物" },
    { key: "set", label: "更像能卖的纪念品" }
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
  const searchParams = useSearchParams();
  const quickProjectIdFromQuery = searchParams.get("quickProjectId")?.trim() ?? "";
  const [feedback, setFeedback] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageState, setImageState] = useState<"idle" | "generating" | "failed">("idle");
  const [imageMessage, setImageMessage] = useState("");
  const [resultState, setResultState] = useState<"idle" | "generating" | "failed">("idle");
  const [resultMessage, setResultMessage] = useState("");
  const [refreshHint, setRefreshHint] = useState("");
  const [quickProjectId, setQuickProjectId] = useState(quickProjectIdFromQuery);
  const [dbInput, setDbInput] = useState<QuickEntryInput | null>(null);
  const [dbResult, setDbResult] = useState<ReturnType<typeof buildQuickEntryResult> | null>(null);
  const [overrideInput, setOverrideInput] = useState<QuickEntryInput | null>(null);
  const [dbLoading, setDbLoading] = useState(Boolean(quickProjectIdFromQuery));
  const [dbMessage, setDbMessage] = useState("");
  const [activeCorrection, setActiveCorrection] = useState("");
  const [showReferences, setShowReferences] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [imageProgress, setImageProgress] = useState(8);
  const [hasTriedImageGeneration, setHasTriedImageGeneration] = useState(false);
  const autoRequestedKeyRef = useRef("");
  const imageAutoRequestedKeyRef = useRef("");
  const imageRequestSeqRef = useRef(0);

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
      setShowFullPreview(false);
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
          throw new Error(data?.error ?? "轻量项目读取失败。");
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
        } else if (data.quickProject.imageWarning) {
          setImageState("failed");
          setImageMessage(data.quickProject.imageWarning);
        } else {
          setImageState("idle");
          setImageMessage("");
        }
        setDbLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "轻量项目读取失败。";
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

  const imageWarning = useMemo(() => {
    if (source === "ai" && aiSession?.imageWarning) {
      const sameIdea = aiSession.input.idea.trim() === (input?.idea.trim() ?? "");
      const sameCorrection =
        (aiSession.input.correctionIntent || "").trim() === ((input?.correctionIntent || "").trim() ?? "");
      if (sameIdea && sameCorrection) return aiSession.imageWarning;
    }
    return "";
  }, [aiSession, input, source]);

  const references = useMemo(() => (effectiveInput ? pickQuickSimilarReferences(effectiveInput) : []), [effectiveInput]);
  const correctionOptions = useMemo(
    () => (effectiveInput ? buildCorrectionOptions(effectiveInput) : []),
    [effectiveInput]
  );

  const requestTextResult = useCallback(async (targetInput: QuickEntryInput, opts?: { manual?: boolean }) => {
    setResultState("generating");
    setResultMessage("文字判断生成中，请稍候...");
    if (opts?.manual) setRefreshHint("");

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
      setResultMessage(data.textWarning ?? "");
      if (opts?.manual && !data.textWarning) {
        setRefreshHint("文字判断已更新。");
      }
      if (data.quickProjectId) {
        setQuickProjectId(data.quickProjectId);
      }
      saveQuickAIResultToSession({
        input: data.input,
        result: data.result,
        previewImageUrl: null,
        imageWarning: data.textWarning ?? ""
      });
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "文字判断生成失败，请稍后重试。";
      const normalized = rawMessage.toLowerCase();
      const message =
        normalized.includes("result is not defined") || normalized.includes("referenceerror")
          ? "当前结果用于前期方向判断，后续可继续细化。"
          : rawMessage;
      setResultState("failed");
      setResultMessage(message);
      if (!resolvedResult && fallbackResult) {
        setResolvedResult(fallbackResult);
      }
    }
  }, [fallbackResult, quickProjectId, resolvedResult]);

  useEffect(() => {
    const shouldGenerateText =
      source === "ai" &&
      Boolean(effectiveInput?.idea) &&
      resultState !== "generating";

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
  }, [effectiveInput, hasSessionResultForCurrentIdea, requestTextResult, resolvedResult, resultState, source]);

  useEffect(() => {
    setImageUrl(previewImageUrl);
    if (previewImageUrl) {
      setImageState("idle");
      setImageMessage("");
      return;
    }
    if (imageWarning) {
      setImageState("failed");
      setImageMessage(imageWarning);
    } else {
      setImageState("idle");
      setImageMessage("");
    }
  }, [imageWarning, previewImageUrl]);

  useEffect(() => {
    if (imageState !== "generating") {
      setImageProgress((prev) => (prev >= 100 ? 100 : 8));
      return;
    }
    const timer = window.setInterval(() => {
      setImageProgress((prev) => Math.min(prev + (prev < 60 ? 8 : 3), 92));
    }, 900);
    return () => window.clearInterval(timer);
  }, [imageState]);

  const requestImageResult = useCallback(
    async (targetInput: QuickEntryInput, opts?: { manual?: boolean }) => {
      const requestSeq = ++imageRequestSeqRef.current;
      setHasTriedImageGeneration(true);
      setImageState("generating");
      setImageMessage("预览图生成中，请稍候...");
      setImageProgress(8);
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
            regenerateToken: opts?.manual ? String(Date.now()) : undefined
          })
        });
        const data = (await response.json().catch(() => null)) as
          | { previewImageUrl?: string | null; error?: string }
          | null;
        if (!response.ok || !data?.previewImageUrl) {
          throw new Error(data?.error ?? "预览图生成失败，请稍后重试。");
        }
        if (requestSeq !== imageRequestSeqRef.current) return;
        setImageUrl(data.previewImageUrl);
        setImageState("idle");
        setImageProgress(100);
        setImageMessage("");
        if (quickProjectId) {
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
        const message = error instanceof Error ? error.message : "预览图生成失败，请稍后重试。";
        setImageState("failed");
        setImageProgress(100);
        setImageMessage(message);
        if (quickProjectId) {
          void fetch(`/api/quick/projects/${quickProjectId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              idea: targetInput.idea,
              imageWarning: message
            })
          });
        }
        updateQuickAIImageInSession({
          idea: targetInput.idea,
          imageWarning: message
        });
      }
    },
    [quickProjectId]
  );

  useEffect(() => {
    const shouldGenerateImage =
      source === "ai" &&
      Boolean(effectiveInput?.idea) &&
      Boolean(resolvedResult) &&
      resultState !== "generating" &&
      imageState !== "generating" &&
      !imageUrl &&
      !previewImageUrl;
    if (!shouldGenerateImage || !effectiveInput) return;

    const requestKey = [
      "image-refresh-v1",
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
  }, [effectiveInput, imageState, imageUrl, previewImageUrl, requestImageResult, resolvedResult, resultState, source]);

  if (dbLoading) {
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
  const resolvedScale = effectiveInput ? resolveQuickScalePreference(effectiveInput) : null;
  const scaleSource = effectiveInput?.scale ? "用户指定" : "系统判断";
  const conceptPreviewText = resolvedResult?.conceptPreview || "";
  const shortConceptPreview = clampText(conceptPreviewText, 72);
  const isLongConceptPreview = Array.from(conceptPreviewText).length > 72;
  const previewLead = firstSentenceOf(conceptPreviewText || "这版更像一个可先试水的小体量作品。");
  const previewTail = conceptPreviewText
    .replace(previewLead, "")
    .trim()
    .replace(/^[，。；\s]+/, "");
  const showPreparingImageHint =
    source === "ai" && Boolean(effectiveInput?.idea) && !imageUrl && (imageState === "generating" || !hasTriedImageGeneration);

  const handleUpgrade = () => {
    if (!resolvedResult) return;
    saveQuickPrefillToSession({
      idea: effectiveInput.idea,
      direction: effectiveInput.direction,
      style: effectiveInput.style,
      scale: effectiveInput.scale,
      quickJudgement: resolvedResult.topJudgement,
      quickPath: resolvedResult.suggestedPath
    });

    const nextParams = new URLSearchParams();
    nextParams.set("from", "quick");
    nextParams.set("idea", effectiveInput.idea);
    if (effectiveInput.direction) nextParams.set("direction", effectiveInput.direction);
    if (effectiveInput.style) nextParams.set("style", effectiveInput.style);
    if (effectiveInput.scale) nextParams.set("scale", effectiveInput.scale);
    nextParams.set("quickJudgement", resolvedResult.topJudgement);
    nextParams.set("quickPath", resolvedResult.suggestedPath);
    const nextPath = `/projects/new?${nextParams.toString()}`;
    const hasMockSession = document.cookie.includes(`${SESSION_COOKIE_NAME}=${SESSION_COOKIE_VALUE}`);
    router.push(hasMockSession ? nextPath : `/login?next=${encodeURIComponent(nextPath)}`);
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
    setHasTriedImageGeneration(false);
    setRefreshHint("");
    void requestTextResult(correctedInput, { manual: true });
    void requestImageResult(correctedInput, { manual: true });
  };

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h1 className="text-lg font-semibold text-slate-900">我先帮你看了下这个创意</h1>
        {isLoading ? (
          <>
            <p className="mt-2 text-sm text-slate-700">正在把你的想法梳理成更直观的作品说明...</p>
            <p className="mt-1 text-xs text-slate-500">会先给你一句方向建议，再补充预览图和参考内容。</p>
          </>
        ) : (
          <div className="mt-2 space-y-1 text-sm text-slate-700">
            <p>{clampText(resolvedResult?.topJudgement, 36)}</p>
            <p>先从「{resolvedResult?.recommendedFit}」这个方向推进，会更稳一点。</p>
            <p className="text-xs text-slate-500">先看方向，再做细化。</p>
          </div>
        )}
        {!isLoading && resultState === "generating" && (
          <p className="mt-2 text-xs text-blue-700">文字判断生成中，请稍候...</p>
        )}
        {!isLoading && resultState === "failed" && resultMessage && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-amber-700">
              提示：当前结果用于前期方向判断，后续可继续细化。
            </p>
            <button
              type="button"
              onClick={() => {
                if (effectiveInput) {
                  void requestTextResult(effectiveInput, { manual: true });
                }
              }}
              disabled={resultState === "generating"}
              className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              重试生成文字判断
            </button>
          </div>
        )}
        {!isLoading && resultState === "idle" && refreshHint && (
          <p className="mt-2 text-xs text-emerald-700">{refreshHint}</p>
        )}
        {!isLoading && resolvedScale && (
          <p className="mt-2 text-xs text-slate-500">
            当前规模档位：{scaleLabel(resolvedScale)}（{scaleSource}）
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">AI 创意预览</h2>
        {isLoading ? (
          <div className="mt-3 h-56 animate-pulse rounded-lg bg-slate-100" />
        ) : imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={`${resolvedResult?.conceptTitle ?? "创意预览"} 预览图`}
            className="mt-3 w-full rounded-lg border border-slate-200 object-cover"
          />
        ) : showPreparingImageHint ? (
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            <p>正在生成预览图，马上就好。</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-blue-100">
              <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${imageProgress}%` }} />
            </div>
            <p className="mt-2 text-xs text-blue-700">已完成约 {imageProgress}% · 正在完善细节。</p>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            本次未成功生成预览图，你仍可先根据下方概念说明继续判断与推进。
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">
          仅用于方向判断，不代表最终打样结果。
        </p>
        {isLoading ? (
          <div className="mt-3 space-y-2">
            <div className="h-4 w-2/5 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-slate-100" />
          </div>
        ) : (
          <>
            <p className="mt-3 text-sm font-medium text-slate-900">{resolvedResult?.conceptTitle}</p>
            <div className="mt-2 space-y-2">
              <div>
                <p className="text-xs font-medium text-slate-500">这版更像什么</p>
                <p className="text-sm text-slate-700">{showFullPreview ? previewLead : clampText(previewLead, 44)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">为什么会打动人</p>
                <p className="text-sm text-slate-700">
                  {showFullPreview
                    ? previewTail || "这版的识别点和陈列感都比较直接，适合先拿来做小范围反馈测试。"
                    : clampText(
                        previewTail || "这版的识别点和陈列感都比较直接，适合先拿来做小范围反馈测试。",
                        48
                      )}
                </p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {isLongConceptPreview && (
                <button
                  type="button"
                  onClick={() => setShowFullPreview((prev) => !prev)}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  {showFullPreview ? "收起说明" : "展开说明"}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (effectiveInput) {
                    void requestImageResult(effectiveInput, { manual: true });
                  }
                }}
                disabled={imageState === "generating"}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                重新生成预览图
              </button>
            </div>
            {imageState === "failed" && imageMessage && <p className="mt-2 text-xs text-slate-500">提示：{imageMessage}</p>}
          </>
        )}
        {!isLoading && correctionOptions.length > 0 && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm text-slate-800">这版不太像你想要的？可以快速调整一下</p>
            <p className="mt-1 text-xs text-slate-500">选一个更接近你脑海画面的方向，我会基于当前创意直接重生一版。</p>
            <div className="mt-3 flex flex-wrap gap-2">
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
                        ? "rounded-full border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs text-blue-800"
                        : "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                    }
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              如果你有更接近的参考图，也可以上传一张，帮助结果更贴近你的想法。
            </p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">想看看类似方向怎么做？</h2>
          <button
            type="button"
            onClick={() => setShowReferences((prev) => !prev)}
            className="text-xs text-slate-600 underline-offset-2 hover:text-slate-800 hover:underline"
          >
            {showReferences ? "先收起" : "展开参考"}
          </button>
        </div>
        {!showReferences ? (
          <p className="mt-2 text-xs text-slate-500">这块先帮你收起来了，需要找灵感时再展开就好。</p>
        ) : isLoading ? (
          <div className="mt-3 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                <div className="mt-2 h-3 w-full animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {references.map((item) => (
              <div key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <span className="rounded-full bg-white px-2 py-1 text-xs text-slate-600">
                    {mapReferenceTypeLabel(item.referenceType)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{item.whyRelevant}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">更适合做什么</h2>
        {isLoading ? (
          <div className="mt-2 space-y-2">
            <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-700">
              {resolvedResult?.recommendedReason || "这版更适合先做小体量验证，先看真实用户反馈再决定放大规模。"}
            </p>
          </>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">下一步通路</h2>
        {isLoading ? (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                <div className="mt-2 h-3 w-full animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <button
                type="button"
                onClick={() => setFeedback("已记录你的倾向：先做小批量路径。")}
                className={pathButtonClass("small_batch", resolvedResult?.suggestedPath ?? "professional_upgrade")}
              >
                试做成小批量产品
                <span className="mt-1 block text-xs text-slate-500">先验证成本和礼品感。</span>
              </button>
              <button
                type="button"
                onClick={() => setFeedback("已记录你的倾向：先走原创计划 / 众筹测试。")}
                className={pathButtonClass("creator_plan", resolvedResult?.suggestedPath ?? "professional_upgrade")}
              >
                提交到原创计划 / 众筹
                <span className="mt-1 block text-xs text-slate-500">先看看用户会不会买单。</span>
              </button>
              <button
                type="button"
                onClick={handleUpgrade}
                className={pathButtonClass("professional_upgrade", resolvedResult?.suggestedPath ?? "professional_upgrade")}
              >
                升级为专业方案
                <span className="mt-1 block text-xs text-slate-200">把结构和规模继续做完整。</span>
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              系统当前推荐通路：{pathLabel(resolvedResult?.suggestedPath ?? "professional_upgrade")}
            </p>
          </>
        )}
        {feedback && <p className="mt-2 text-xs text-emerald-700">{feedback}</p>}
      </section>
    </section>
  );
}

