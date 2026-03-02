"use client";

import { type ChangeEvent, useMemo, useState } from "react";
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

export default function QuickEntryNewPage() {
  const router = useRouter();
  const [form, setForm] = useState<QuickFormData>(initialQuickForm);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedReferenceName, setUploadedReferenceName] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<QuickTopicPreset["id"] | "">("");
  const [showMoreSettings, setShowMoreSettings] = useState(false);

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

  const handleReferenceFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("请上传图片文件（jpg/png/webp 等）。");
      event.target.value = "";
      return;
    }
    setError("");
    setUploadedReferenceName(file.name);
    setForm((prev) => ({
      ...prev,
      // 当前阶段作为方向锚点，不做结构反推。
      referenceImage: `uploaded://${file.name}`
    }));
  };

  const handleSubmit = () => {
    const trimmedIdea = form.idea.trim();
    if (!trimmedIdea) {
      setError("请先写下一句话创意，我们才能生成创意方向结果。");
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

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">先试一下你的创意方向</h1>
        <p className="text-sm text-slate-600">用最少输入快速得到方向判断，再决定是否进入专业方案流程。</p>
      </div>

      <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
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

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">参考图（可选，占位）</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleReferenceFileChange}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:text-slate-700"
                />
                {uploadedReferenceName && (
                  <p className="text-xs text-slate-500">
                    已上传参考图：{uploadedReferenceName}（将作为风格与场景锚点）
                  </p>
                )}
                <input
                  type="text"
                  value={form.referenceImage}
                  onChange={(event) => setForm((prev) => ({ ...prev, referenceImage: event.target.value }))}
                  placeholder="可粘贴参考图链接，或直接上传图片作为方向锚点。"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {isSubmitting ? "正在生成..." : "立即生成创意方向结果"}
        </button>
        <p className="text-xs text-slate-500">先给你方向判断，不等同最终打样结论。</p>
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
    </section>
  );
}

