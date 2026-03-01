"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectFormPayload, ProjectStatus } from "@/types/project";

type FormData = {
  title: string;
  category: string;
  style: string;
  size_target: string;
  size_note: string;
  audience: string;
  description: string;
  must_have_elements: string;
  avoid_elements: string;
  build_goal: string;
  collaboration_goal: string;
  willing_creator_plan: string;
  willing_sampling: string;
  reference_links: string;
  notes_for_factory: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

const initialFormData: FormData = {
  title: "",
  category: "",
  style: "",
  size_target: "",
  size_note: "",
  audience: "",
  description: "",
  must_have_elements: "",
  avoid_elements: "",
  build_goal: "",
  collaboration_goal: "",
  willing_creator_plan: "",
  willing_sampling: "",
  reference_links: "",
  notes_for_factory: ""
};

const requiredFields: Array<keyof FormData> = [
  "title",
  "category",
  "style",
  "size_target",
  "description"
];

const fieldLabels: Record<keyof FormData, string> = {
  title: "项目名称",
  category: "作品类型",
  style: "风格方向",
  size_target: "目标体量",
  size_note: "体量补充说明",
  audience: "目标受众",
  description: "作品描述",
  must_have_elements: "必须包含元素",
  avoid_elements: "希望避免元素",
  build_goal: "推进目标",
  collaboration_goal: "合作意图",
  willing_creator_plan: "是否愿意创作者联名方案",
  willing_sampling: "是否愿意打样",
  reference_links: "参考链接",
  notes_for_factory: "给工厂的补充说明"
};

function inputClass(error?: string) {
  return `w-full rounded-md border px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2 ${
    error ? "border-rose-300 bg-rose-50" : "border-slate-300"
  }`;
}

export default function ProjectCreatePage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateRequiredFields = () => {
    const nextErrors: FormErrors = {};

    requiredFields.forEach((field) => {
      if (!formData[field].trim()) {
        nextErrors[field] = `请补充${fieldLabels[field]}，这样我们才能更准确地生成项目方案。`;
      }
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const persistProject = async (status: ProjectStatus) => {
    const payload: ProjectFormPayload = {
      ...formData
    };

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status,
        payload
      })
    });

    const data = (await response.json().catch(() => null)) as
      | { error?: string; projectId?: string; usedFallbackOutput?: boolean; warning?: string }
      | null;

    if (!response.ok) {
      throw new Error(data?.error ?? "提交失败，请稍后再试");
    }

    if (!data?.projectId) {
      throw new Error("项目创建失败");
    }

    return {
      projectId: data.projectId,
      usedFallbackOutput: Boolean(data.usedFallbackOutput),
      warning: data.warning ?? ""
    };
  };

  const handleSaveDraft = async () => {
    setIsSubmitting(true);
    setFeedback("正在保存草稿...");

    try {
      await persistProject("draft");
      setFeedback("草稿已保存，正在返回项目列表。");
      router.push("/projects");
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存草稿失败";
      setFeedback(`保存失败：${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGeneratePlan = async () => {
    const isValid = validateRequiredFields();
    if (!isValid) {
      setFeedback("还有几项关键信息未填写完整，补充后即可继续。");
      return;
    }

    setIsSubmitting(true);
    setFeedback("正在保存项目并生成方案...");

    try {
      const result = await persistProject("generating");
      const hint = result.usedFallbackOutput
        ? result.warning || "AI 生成失败，已使用回退结果。"
        : "项目已保存，正在进入方案结果页。";
      setFeedback(hint);
      router.push(`/projects/${result.projectId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "生成项目方案失败";
      setFeedback(`操作失败：${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">提交创意项目</h1>
        <p className="text-sm text-slate-600">
          用几分钟把你的创意方向、关键约束和推进目标说清楚，我们会先生成一版可讨论的方案草案。
        </p>
      </div>

      <form
        className="space-y-5 rounded-xl border border-slate-200 bg-white p-6"
        onSubmit={(event) => event.preventDefault()}
      >
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-slate-900">先定义项目方向</h2>
          <p className="text-xs text-slate-500">先把题材、风格和体量定下来，后续判断会更稳定。</p>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">项目名称 *</span>
              <input
                type="text"
                value={formData.title}
                onChange={(event) => handleChange("title", event.target.value)}
                placeholder="例如：城市夜巡机甲系列"
                className={inputClass(errors.title)}
              />
              {errors.title && <p className="text-xs text-rose-600">{errors.title}</p>}
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">作品类型 *</span>
              <select
                value={formData.category}
                onChange={(event) => handleChange("category", event.target.value)}
                className={inputClass(errors.category)}
              >
                <option value="">请选择你的创意题材</option>
                <option value="scene">场景套组</option>
                <option value="vehicle">载具主题</option>
                <option value="character">角色人仔</option>
                <option value="architecture">建筑主题</option>
                <option value="mechanism">机械装置</option>
              </select>
              {errors.category && <p className="text-xs text-rose-600">{errors.category}</p>}
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">风格方向 *</span>
              <select
                value={formData.style}
                onChange={(event) => handleChange("style", event.target.value)}
                className={inputClass(errors.style)}
              >
                <option value="">请选择风格方向</option>
                <option value="retro-sci-fi">复古科幻</option>
                <option value="industrial">工业机械</option>
                <option value="cute">可爱治愈</option>
                <option value="fantasy">奇幻冒险</option>
                <option value="minimal">极简现代</option>
              </select>
              {errors.style && <p className="text-xs text-rose-600">{errors.style}</p>}
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">目标体量 *</span>
              <select
                value={formData.size_target}
                onChange={(event) => handleChange("size_target", event.target.value)}
                className={inputClass(errors.size_target)}
              >
                <option value="">请选择目标体量（规模）</option>
                <option value="small">小型（100-300 pcs）</option>
                <option value="medium">中型（300-800 pcs）</option>
                <option value="large">大型（800-1500 pcs）</option>
                <option value="display">展示级（1500+ pcs）</option>
              </select>
              {errors.size_target && (
                <p className="text-xs text-rose-600">{errors.size_target}</p>
              )}
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">体量补充说明</span>
            <textarea
              rows={3}
              value={formData.size_note}
              onChange={(event) => handleChange("size_note", event.target.value)}
              placeholder="可补充预算区间、尺寸限制、复杂度偏好等"
              className={inputClass()}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">目标受众（可选）</span>
            <select
              value={formData.audience}
              onChange={(event) => handleChange("audience", event.target.value)}
              className={inputClass()}
            >
              <option value="">请选择目标受众</option>
              <option value="kids">儿童玩家（6-9 岁）</option>
              <option value="teen">青少年玩家（10-14 岁）</option>
              <option value="family">亲子共玩家庭</option>
              <option value="adult">成人收藏玩家</option>
              <option value="all">全年龄向</option>
            </select>
          </label>
        </section>

        <section className="space-y-4 border-t border-slate-100 pt-5">
          <h2 className="text-base font-semibold text-slate-900">再说清核心创意</h2>
          <p className="text-xs text-slate-500">这里决定方案会往哪条路走，建议尽量具体。</p>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">作品描述 *</span>
            <textarea
              rows={5}
              value={formData.description}
              onChange={(event) => handleChange("description", event.target.value)}
              placeholder="用 3-5 句写清：它是什么、亮点在哪、你希望用户看到什么"
              className={inputClass(errors.description)}
            />
            {errors.description && <p className="text-xs text-rose-600">{errors.description}</p>}
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">必须包含元素</span>
              <textarea
                rows={4}
                value={formData.must_have_elements}
                onChange={(event) => handleChange("must_have_elements", event.target.value)}
                placeholder="请写必须保留的要点（如：核心造型、关键功能、主角色）"
                className={inputClass()}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">希望避免元素</span>
              <textarea
                rows={4}
                value={formData.avoid_elements}
                onChange={(event) => handleChange("avoid_elements", event.target.value)}
                placeholder="请写你不希望出现的方向（如：过度复杂、某类材质、某种视觉风格）"
                className={inputClass()}
              />
            </label>
          </div>
        </section>

        <section className="space-y-4 border-t border-slate-100 pt-5">
          <h2 className="text-base font-semibold text-slate-900">确定这次想推进到哪一步</h2>
          <p className="text-xs text-slate-500">明确目标后，系统会更聚焦地给出下一步建议。</p>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">推进目标</span>
              <select
                value={formData.build_goal}
                onChange={(event) => handleChange("build_goal", event.target.value)}
                className={inputClass()}
              >
                <option value="">请选择你这轮最想推进的目标</option>
                <option value="idea">先完成概念梳理</option>
                <option value="brief">产出可评审设计简报</option>
                <option value="bom">形成 BOM 草稿</option>
                <option value="factory">准备对接工厂沟通</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">合作意图</span>
              <select
                value={formData.collaboration_goal}
                onChange={(event) => handleChange("collaboration_goal", event.target.value)}
                className={inputClass()}
              >
                <option value="">请选择你希望获得的支持方式</option>
                <option value="none">先独立推进</option>
                <option value="review">希望获得方案评审建议</option>
                <option value="co-create">希望寻找共创合作伙伴</option>
                <option value="factory-bridge">希望协助对接打样资源</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">是否愿意尝试创作者联名方案</span>
              <select
                value={formData.willing_creator_plan}
                onChange={(event) => handleChange("willing_creator_plan", event.target.value)}
                className={inputClass()}
              >
                <option value="">请选择</option>
                <option value="yes">愿意</option>
                <option value="no">暂不考虑</option>
                <option value="maybe">可讨论</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">是否愿意进入打样流程</span>
              <select
                value={formData.willing_sampling}
                onChange={(event) => handleChange("willing_sampling", event.target.value)}
                className={inputClass()}
              >
                <option value="">请选择</option>
                <option value="yes">愿意</option>
                <option value="no">暂不考虑</option>
                <option value="maybe">看评估结果</option>
              </select>
            </label>
          </div>
        </section>

        <section className="space-y-4 border-t border-slate-100 pt-5">
          <h2 className="text-base font-semibold text-slate-900">补充参考与落地约束</h2>
          <p className="text-xs text-slate-500">这部分能帮助方案更贴近你真实的执行边界。</p>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">参考链接</span>
            <textarea
              rows={4}
              value={formData.reference_links}
              onChange={(event) => handleChange("reference_links", event.target.value)}
              placeholder="可粘贴多个链接（每行一个）"
              className={inputClass()}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">给工厂的补充说明</span>
            <textarea
              rows={4}
              value={formData.notes_for_factory}
              onChange={(event) => handleChange("notes_for_factory", event.target.value)}
              placeholder="可补充工艺限制、材质偏好、结构顾虑、可接受成本区间等"
              className={inputClass()}
            />
          </label>
        </section>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={isSubmitting}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          保存草稿
        </button>
        <button
          type="button"
          onClick={handleGeneratePlan}
          disabled={isSubmitting}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          提交并生成方案
        </button>
      </div>

      {feedback && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {feedback}
        </div>
      )}

      <p className="text-xs text-slate-500">
        说明：当前结果用于前期判断与方案整理，不等同于最终打样或量产结论。
      </p>
    </section>
  );
}
