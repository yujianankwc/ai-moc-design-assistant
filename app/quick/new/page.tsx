"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { QuickDirection, QuickScalePreference, QuickStyle } from "@/types/quick-entry";

type QuickFormData = {
  idea: string;
  direction: QuickDirection | "";
  style: QuickStyle | "";
  scale: QuickScalePreference | "";
  referenceImage: string;
};

const initialQuickForm: QuickFormData = {
  idea: "",
  direction: "",
  style: "",
  scale: "",
  referenceImage: ""
};

type QuickTopicPreset = {
  id: "city_culture" | "campus" | "heritage" | "family" | "vehicle" | "fantasy_scene";
  label: string;
  example: string;
  hint: string;
  suggestDirection?: QuickDirection;
  suggestStyle?: QuickStyle;
};

const QUICK_TOPIC_PRESETS: QuickTopicPreset[] = [
  {
    id: "city_culture",
    label: "城市文创",
    example: "例如：做一个能摆在办公桌上的城市地标文创积木礼品。",
    hint: "先写清你想做的城市主题，再写最想突出的地标元素，最后补一句更像摆件、礼品还是小套装。",
    suggestDirection: "display",
    suggestStyle: "realistic"
  },
  {
    id: "campus",
    label: "高校岁月",
    example: "例如：做一个以校门和操场记忆点为核心的毕业纪念积木套装。",
    hint: "写出你想还原的校园场景，再点明最有记忆点的元素，最后写更适合做成纪念摆件还是礼品套装。",
    suggestDirection: "display",
    suggestStyle: "cute"
  },
  {
    id: "heritage",
    label: "文物纪念",
    example: "例如：做一个以青铜器纹样为亮点的博物馆文创积木单品。",
    hint: "写你想做的文物或历史主题，再写最想保留的符号细节，最后说明更偏礼品单品还是收藏摆件。",
    suggestDirection: "production",
    suggestStyle: "realistic"
  },
  {
    id: "family",
    label: "家庭缩影",
    example: "例如：做一个三口之家周末厨房时刻的桌面微景观摆件。",
    hint: "先写家庭故事场景，再写最想突出的互动元素，最后写希望它更像温馨摆件还是送礼小套装。",
    suggestDirection: "display",
    suggestStyle: "cute"
  },
  {
    id: "vehicle",
    label: "机械载具",
    example: "例如：做一个可切换巡航与战备形态的城市巡逻载具套装。",
    hint: "先写载具用途，再写最关键的机械亮点，最后说明你更想做成展示摆件还是可玩套装。",
    suggestDirection: "production",
    suggestStyle: "mechanical"
  },
  {
    id: "fantasy_scene",
    label: "奇幻场景",
    example: "例如：做一个漂浮岛集市主题的奇幻微景观积木套装。",
    hint: "先写奇幻世界设定，再写一个最吸睛的场景元素，最后写更适合做成故事摆件还是系列套装。",
    suggestDirection: "display",
    suggestStyle: "fantasy"
  }
];

const defaultPlaceholder = "例如：我想推进一个适合景区售卖的城市地标积木礼品方向。";

const MAX_IMAGE_DIMENSION = 1920;
const JPEG_QUALITY = 0.85;

function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION && file.size <= 1024 * 1024) {
        resolve(file);
        return;
      }
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            resolve(file);
          }
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("这张参考图暂时没法读取，请换一张再试。"));
    };
    img.src = objectUrl;
  });
}

async function uploadReferenceImage(file: File): Promise<string> {
  const compressed = await compressImage(file);
  const formData = new FormData();
  formData.append("file", compressed, file.name);
  const response = await fetch("/api/quick/upload-reference", {
    method: "POST",
    body: formData
  });
  const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!response.ok || !data?.url) {
    throw new Error(data?.error ?? "这张参考图暂时没有上传成功，请稍后重试。");
  }
  return data.url;
}

export default function QuickEntryNewPage() {
  const router = useRouter();
  const [form, setForm] = useState<QuickFormData>(initialQuickForm);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<QuickTopicPreset["id"] | "">("");
  const [showMoreSettings, setShowMoreSettings] = useState(false);
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);

  const [referencePreviewUrl, setReferencePreviewUrl] = useState<string | null>(null);
  const [referenceUploadState, setReferenceUploadState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [referenceUploadError, setReferenceUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeTopicPreset = useMemo(
    () => QUICK_TOPIC_PRESETS.find((item) => item.id === selectedTopicId),
    [selectedTopicId]
  );

  const handleQuickTopicSelect = (preset: QuickTopicPreset) => {
    setSelectedTopicId(preset.id);
    setForm((prev) => ({
      ...prev,
      direction: prev.direction || preset.suggestDirection || "",
      style: prev.style || preset.suggestStyle || ""
    }));
  };

  const clearReferenceImage = useCallback(() => {
    if (referencePreviewUrl) URL.revokeObjectURL(referencePreviewUrl);
    setReferencePreviewUrl(null);
    setReferenceUploadState("idle");
    setReferenceUploadError("");
    setForm((prev) => ({ ...prev, referenceImage: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [referencePreviewUrl]);

  useEffect(() => {
    return () => {
      if (referencePreviewUrl) URL.revokeObjectURL(referencePreviewUrl);
    };
  }, [referencePreviewUrl]);

  const handleReferenceFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setReferenceUploadError("请上传图片文件（JPG / PNG / WebP）。");
        event.target.value = "";
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setReferenceUploadError("图片文件不能超过 20MB，请换一张更小的图片。");
        event.target.value = "";
        return;
      }

      if (referencePreviewUrl) URL.revokeObjectURL(referencePreviewUrl);
      const previewUrl = URL.createObjectURL(file);
      setReferencePreviewUrl(previewUrl);
      setReferenceUploadState("uploading");
      setReferenceUploadError("");
      setError("");
      setForm((prev) => ({ ...prev, referenceImage: "" }));

      try {
        const url = await uploadReferenceImage(file);
        setForm((prev) => ({ ...prev, referenceImage: url }));
        setReferenceUploadState("done");
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : "这张参考图暂时没有上传成功，请稍后重试。";
        setForm((prev) => ({ ...prev, referenceImage: "" }));
        setReferenceUploadError(message);
        setReferenceUploadState("error");
      }
    },
    [referencePreviewUrl]
  );

  const handleSubmit = () => {
    const trimmedIdea = form.idea.trim();
    if (!trimmedIdea) {
      setError("请先把这条方向说清楚一点，我们才能继续帮你做判断。");
      return;
    }
    if (referenceUploadState === "uploading") {
      setError("参考图还在上传中，等它记下来后再继续。");
      return;
    }
    if (referencePreviewUrl && referenceUploadState === "error") {
      setError("这张参考图还没有上传成功，请重试上传，或者先移除后再继续。");
      return;
    }
    setError("");
    setIsSubmitting(true);
    const params = new URLSearchParams();
    params.set("source", "ai");
    params.set("idea", trimmedIdea);
    if (form.direction) params.set("direction", form.direction);
    if (form.style) params.set("style", form.style);
    if (form.scale) params.set("scale", form.scale);
    if (form.referenceImage.trim()) params.set("referenceImage", form.referenceImage.trim());
    router.push(`/quick/result?${params.toString()}`);
  };

  const isUploadBusy = referenceUploadState === "uploading";

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-3">
        <p className="inline-flex items-center rounded-full border-2 border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
          第 1 步 · 先试创意
        </p>
        <div className="space-y-2 text-center sm:text-left">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">先说一句你想做什么</h1>
          <p className="text-sm font-medium text-slate-600">不用先学规则，也不用一次说完整。</p>
        </div>
      </div>

      <div className="space-y-5 rounded-[28px] border-2 border-amber-100 bg-white p-6 shadow-[0_10px_30px_-18px_rgba(217,119,6,0.35)] sm:p-8">
        <label className="block space-y-3">
          <span className="text-sm font-bold text-slate-800">你想做什么积木方向？ *</span>
          <textarea
            rows={3}
            value={form.idea}
            onChange={(event) => {
              setForm((prev) => ({ ...prev, idea: event.target.value }));
              if (error) setError("");
            }}
            placeholder={activeTopicPreset?.example || defaultPlaceholder}
            className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20"
          />
          <p className="text-xs font-medium text-slate-500">
            先写一句最想做的，我们先帮你判断值不值得继续。
          </p>
        </label>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || isUploadBusy}
            className="relative inline-flex w-full items-center justify-center rounded-2xl border border-amber-300 bg-amber-400 px-8 py-4 text-lg font-extrabold tracking-wide text-amber-950 shadow-[0_6px_0_0_#d97706] transition-all duration-200 hover:bg-amber-300 active:translate-y-1 active:shadow-[0_2px_0_0_#d97706] disabled:pointer-events-none disabled:opacity-60"
          >
            {isSubmitting ? "正在做方向判断..." : isUploadBusy ? "参考图上传中..." : "先试这个创意"}
          </button>
          <p className="text-center text-xs font-medium text-slate-500">先看判断，再决定要不要继续。</p>
          {error && <p className="text-sm font-bold text-rose-600">{error}</p>}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
          <button
            type="button"
            onClick={() => setShowMoreSettings((prev) => !prev)}
            className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-700"
          >
            <span>{showMoreSettings ? "收起补充设置" : "再补充一下：主题、参考图、风格"}</span>
            <span className="text-xs text-slate-400">{showMoreSettings ? "收起" : "展开"}</span>
          </button>
          {!showMoreSettings && (
            <p className="mt-2 text-xs text-slate-500">现在直接点按钮就能开始，这些都可以先不填。</p>
          )}
          {showMoreSettings && (
            <div className="space-y-5 pt-4">
              <div className="space-y-3">
                <span className="text-sm font-bold text-slate-800">没想好方向也没关系</span>
                <div className="flex flex-wrap gap-2">
                  {QUICK_TOPIC_PRESETS.map((preset) => {
                    const isActive = selectedTopicId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleQuickTopicSelect(preset)}
                        className={
                          isActive
                            ? "rounded-full border-2 border-amber-300 bg-amber-50 px-4 py-1.5 text-xs font-bold text-amber-900 shadow-sm"
                            : "rounded-full border-2 border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-amber-200 hover:bg-amber-50/50 hover:text-amber-800"
                        }
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                <button
                  type="button"
                  onClick={() => setShowAdvancedDetails((prev) => !prev)}
                  className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-700"
                >
                  <span>{showAdvancedDetails ? "收起更细一点的设置" : "继续补充：参考图、风格、体量"}</span>
                  <span className="text-xs text-slate-400">{showAdvancedDetails ? "收起" : "展开"}</span>
                </button>
                {!showAdvancedDetails && (
                  <p className="mt-2 text-xs text-slate-500">如果你已经有参考图，或者想指定风格，再展开这一步。</p>
                )}
              </div>

              {showAdvancedDetails && (
                <div className="space-y-5">
                  <div className="space-y-3">
                    <span className="text-sm font-bold text-slate-800">上传一张你想靠近的参考图（可选）</span>
                    <p className="text-xs font-medium text-slate-500">不是为了照搬，而是帮助系统更贴近你想推进的风格和画面感。</p>

                    {referencePreviewUrl ? (
                      <div className="relative inline-block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={referencePreviewUrl}
                          alt="参考图预览"
                          className="h-32 w-auto rounded-xl border-2 border-slate-200 object-cover shadow-sm"
                        />
                        {isUploadBusy && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900/40 backdrop-blur-[1px]">
                            <span className="text-xs font-bold text-white shadow-sm">上传中...</span>
                          </div>
                        )}
                        {referenceUploadState === "done" && (
                          <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-green-500 text-xs font-bold text-white shadow-sm">
                            ✓
                          </span>
                        )}
                        {referenceUploadState === "error" && (
                          <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-rose-500 text-xs font-bold text-white shadow-sm">
                            !
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={clearReferenceImage}
                          className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-200 bg-white text-sm font-bold text-slate-600 shadow-sm transition-transform hover:scale-110 hover:border-rose-200 hover:text-rose-500"
                          title="移除参考图"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white px-4 py-8 text-sm font-medium text-slate-500 transition-colors hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700">
                        <span>点击选择图片，或拍照上传</span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={handleReferenceFileChange}
                          className="hidden"
                        />
                      </label>
                    )}

                    {referenceUploadError && (
                      <p className="text-xs font-medium text-rose-600">{referenceUploadError}</p>
                    )}

                    {referencePreviewUrl && referenceUploadState === "error" && (
                      <p className="text-xs font-medium text-amber-700">当前这张图还没上传成功，这次不会作为参考图提交。</p>
                    )}

                    {referenceUploadState === "done" && (
                      <p className="text-xs font-medium text-green-700">参考图已上传，会用于帮助判断这条方向更适合怎么推进。</p>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="block space-y-2">
                      <span className="text-xs font-bold text-slate-700">你更想让它最终更像什么？</span>
                      <select
                        value={form.direction}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, direction: event.target.value as QuickDirection | "" }))
                        }
                        className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-medium outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20"
                      >
                        <option value="">我还不确定，先帮我判断</option>
                        <option value="display">展示感</option>
                        <option value="cost">成本友好</option>
                        <option value="production">可量产</option>
                      </select>
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-bold text-slate-700">你希望它整体更偏哪种感觉？</span>
                      <select
                        value={form.style}
                        onChange={(event) => setForm((prev) => ({ ...prev, style: event.target.value as QuickStyle | "" }))}
                        className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-medium outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20"
                      >
                        <option value="">我还不确定，先帮我判断</option>
                        <option value="cute">可爱</option>
                        <option value="mechanical">机械</option>
                        <option value="realistic">写实</option>
                        <option value="fantasy">奇幻</option>
                      </select>
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-bold text-slate-700">你大概想先从多大体量开始判断？</span>
                      <select
                        value={form.scale}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, scale: event.target.value as QuickScalePreference | "" }))
                        }
                        className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm font-medium outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-400/20"
                      >
                        <option value="">我还不确定，先帮我判断</option>
                        <option value="small">小型（约80-200颗）</option>
                        <option value="medium">中型（约200-600颗）</option>
                        <option value="large">大型（约600-1200颗）</option>
                      </select>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
