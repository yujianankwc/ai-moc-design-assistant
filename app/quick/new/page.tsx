"use client";

import { type ChangeEvent, useCallback, useMemo, useRef, useState } from "react";
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

const defaultWritingHint = "这一句话建议包含三点：你想做什么、最想突出的元素、以及更像摆件/礼品/套装中的哪一种。";
const defaultPlaceholder = "例如：做一个能摆在办公桌上的城市地标文创积木礼品。";

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
      reject(new Error("图片读取失败，请检查文件是否损坏。"));
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
    throw new Error(data?.error ?? "参考图上传失败，请稍后重试。");
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

      try {
        const url = await uploadReferenceImage(file);
        setForm((prev) => ({ ...prev, referenceImage: url }));
        setReferenceUploadState("done");
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : "参考图上传失败，请稍后重试。";
        setReferenceUploadError(message);
        setReferenceUploadState("error");
      }
    },
    [referencePreviewUrl]
  );

  const handleSubmit = () => {
    const trimmedIdea = form.idea.trim();
    if (!trimmedIdea) {
      setError("请先写下一句话创意，我们才能生成创意方向结果。");
      return;
    }
    if (referenceUploadState === "uploading") {
      setError("参考图正在上传中，请稍等片刻。");
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
    <section className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">先试一下你的创意方向</h1>
        <p className="text-sm text-slate-600">用最少输入快速得到方向判断，再决定是否进入专业方案流程。</p>
      </div>

      <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">先选一个方向（建议）</p>
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
                      ? "rounded-full border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800"
                      : "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  }
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">一句话创意 *</span>
          <textarea
            rows={4}
            value={form.idea}
            onChange={(event) => {
              setForm((prev) => ({ ...prev, idea: event.target.value }));
              if (error) setError("");
            }}
            placeholder={activeTopicPreset?.example || defaultPlaceholder}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
          />
          <p className="text-xs text-slate-500">{activeTopicPreset?.hint || defaultWritingHint}</p>
        </label>

        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <button
            type="button"
            onClick={() => setShowMoreSettings((prev) => !prev)}
            className="text-sm font-medium text-slate-700 underline-offset-2 hover:text-slate-900 hover:underline"
          >
            {showMoreSettings ? "收起更多设置" : "更多设置（可选）"}
          </button>
          {showMoreSettings && (
            <div className="space-y-4">
              <div className="space-y-2">
                <span className="text-sm font-medium text-slate-700">参考图（可选）</span>
                <p className="text-xs text-slate-500">
                  上传一张景区、建筑或场景照片，AI 会参考它的风格和构图来生成创意预览图。
                </p>

                {referencePreviewUrl ? (
                  <div className="relative inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={referencePreviewUrl}
                      alt="参考图预览"
                      className="h-32 w-auto rounded-lg border border-slate-200 object-cover"
                    />
                    {isUploadBusy && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40">
                        <span className="text-xs font-medium text-white">上传中...</span>
                      </div>
                    )}
                    {referenceUploadState === "done" && (
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                        ✓
                      </span>
                    )}
                    {referenceUploadState === "error" && (
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white">
                        !
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={clearReferenceImage}
                      className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-xs text-slate-600 shadow-sm hover:bg-slate-100"
                      title="移除参考图"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500 transition hover:border-blue-400 hover:text-blue-600">
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
                  <p className="text-xs text-rose-600">{referenceUploadError}</p>
                )}

                {referenceUploadState === "done" && (
                  <p className="text-xs text-green-700">参考图已上传，将用于引导 AI 生成方向。</p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">方向偏好（可选）</span>
                  <select
                    value={form.direction}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, direction: event.target.value as QuickDirection | "" }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                  >
                    <option value="">我还不确定，先帮我判断</option>
                    <option value="display">展示感</option>
                    <option value="cost">成本友好</option>
                    <option value="production">可量产</option>
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">风格偏好（可选）</span>
                  <select
                    value={form.style}
                    onChange={(event) => setForm((prev) => ({ ...prev, style: event.target.value as QuickStyle | "" }))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                  >
                    <option value="">我还不确定，先帮我判断</option>
                    <option value="cute">可爱</option>
                    <option value="mechanical">机械</option>
                    <option value="realistic">写实</option>
                    <option value="fantasy">奇幻</option>
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">规模偏好（可选）</span>
                  <select
                    value={form.scale}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, scale: event.target.value as QuickScalePreference | "" }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
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
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || isUploadBusy}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 sm:w-auto"
        >
          {isSubmitting ? "正在生成..." : isUploadBusy ? "参考图上传中..." : "立即生成创意方向结果"}
        </button>
        <p className="text-xs text-slate-500">先给你方向判断，不等同最终打样结论。</p>
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
    </section>
  );
}
