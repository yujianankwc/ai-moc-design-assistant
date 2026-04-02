"use client";

import { useMemo, useState } from "react";
import type { ServiceRequestType } from "@/types/service-request";
import { buildProjectBriefMarkdown, type ProjectBriefExportData } from "@/lib/brief-export";

type RequestType = "bom" | "sampling" | "original";

type Props = {
  mainRecommendation: string;
  projectId: string;
  exportData: ProjectBriefExportData;
};

type BomForm = {
  contact: string;
  focusQuestion: string;
  responseTime: string;
  confirmPrice: boolean;
};

type SamplingForm = {
  contact: string;
  projectStage: string;
  hasBom: string;
  hasDesignDraft: string;
  focusQuestion: string;
  responseTime: string;
  confirmPrice: boolean;
};

type OriginalForm = {
  contact: string;
  designerName: string;
  isOriginal: string;
  nextStepGoal: string;
  willingToDiscuss: string;
  note: string;
};

const modalTitleMap: Record<RequestType, string> = {
  bom: "补充零件与结构信息",
  sampling: "补充试做路径信息",
  original: "补充完整方案路径"
};

const modalDescMap: Record<RequestType, string> = {
  bom: "这一步会帮助继续判断零件结构是否清楚，方便决定这条方向要不要继续往下推进。",
  sampling: "这一步会帮助继续判断是否适合沿试做路径往下走，先看结构、资源和打样准备度。",
  original: "这一步会帮助把完整方案路径补充清楚，方便继续沟通结构、目标和后续方向。"
};

const initialBomForm: BomForm = {
  contact: "",
  focusQuestion: "",
  responseTime: "",
  confirmPrice: false
};

const initialSamplingForm: SamplingForm = {
  contact: "",
  projectStage: "",
  hasBom: "",
  hasDesignDraft: "",
  focusQuestion: "",
  responseTime: "",
  confirmPrice: false
};

const initialOriginalForm: OriginalForm = {
  contact: "",
  designerName: "",
  isOriginal: "",
  nextStepGoal: "",
  willingToDiscuss: "",
  note: ""
};

const fieldInputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2";
const fieldLabelClass = "text-sm font-medium text-slate-700";

function actionButtonClass(isRecommended: boolean) {
  if (isRecommended) {
    return "w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 sm:w-auto";
  }
  return "w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto";
}

export default function ServiceRequestModals({
  mainRecommendation,
  projectId,
  exportData
}: Props) {
  const [openType, setOpenType] = useState<RequestType | null>(null);
  const [actionFeedback, setActionFeedback] = useState("");

  const [bomForm, setBomForm] = useState<BomForm>(initialBomForm);
  const [samplingForm, setSamplingForm] = useState<SamplingForm>(initialSamplingForm);
  const [originalForm, setOriginalForm] = useState<OriginalForm>(initialOriginalForm);

  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const recommendationType = useMemo<RequestType>(() => {
    if (mainRecommendation === "先把这个方向补充完整") return "original";
    if (mainRecommendation === "去看试做路径") return "sampling";
    if (mainRecommendation === "提交原创计划评审") return "original";
    if (mainRecommendation === "申请打样可行性评估") return "sampling";
    return "bom";
  }, [mainRecommendation]);

  const closeModal = () => {
    setOpenType(null);
    setSubmitError("");
    setSubmitSuccess("");
    setIsSubmitting(false);
  };

  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  const submitRequest = async (payload: {
    requestType: ServiceRequestType;
    contactInfo: string;
    requestNote: string;
    metadata: Record<string, string | boolean>;
  }) => {
    if (!isUuid(projectId)) {
      throw new Error("当前还是演示项目，暂时还不能记下这条推进动作。请先创建真实项目。");
    }

    const response = await fetch("/api/service-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        projectId,
        requestType: payload.requestType,
        contactInfo: payload.contactInfo,
        requestNote: payload.requestNote,
        metadata: payload.metadata
      })
    });

    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      throw new Error(data?.error ?? "这一步暂时没有记下来，请稍后重试。");
    }
  };

  const handleBomSubmit = async () => {
    if (!bomForm.contact || !bomForm.focusQuestion || !bomForm.responseTime || !bomForm.confirmPrice) {
      setSubmitError("请把这一步需要的信息补完整，并确认费用（¥29），这样才能继续记下这条推进动作。");
      return;
    }
    setSubmitError("");
    setIsSubmitting(true);

    try {
      await submitRequest({
        requestType: "bom_review",
        contactInfo: bomForm.contact,
        requestNote: bomForm.focusQuestion,
        metadata: {
          response_time: bomForm.responseTime,
          confirm_price: bomForm.confirmPrice
        }
      });
      setSubmitSuccess("这一步已经记下来了。后续你可以继续查看当前阶段和下一步建议。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "这一步暂时没有记下来，请稍后重试。";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSamplingSubmit = async () => {
    if (
      !samplingForm.contact ||
      !samplingForm.projectStage ||
      !samplingForm.hasBom ||
      !samplingForm.hasDesignDraft ||
      !samplingForm.focusQuestion ||
      !samplingForm.responseTime ||
      !samplingForm.confirmPrice
    ) {
      setSubmitError("还有几项关键信息没补齐，请补充后再继续记下这条试做路径（含费用确认 ¥99）。");
      return;
    }
    setSubmitError("");
    setIsSubmitting(true);

    try {
      await submitRequest({
        requestType: "sampling_review",
        contactInfo: samplingForm.contact,
        requestNote: samplingForm.focusQuestion,
        metadata: {
          project_stage: samplingForm.projectStage,
          has_bom: samplingForm.hasBom,
          has_design_draft: samplingForm.hasDesignDraft,
          response_time: samplingForm.responseTime,
          confirm_price: samplingForm.confirmPrice
        }
      });
      setSubmitSuccess("试做路径信息已经记下来了。后续可以继续查看这条方向的推进状态。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "这条试做路径暂时没有记下来，请稍后重试。";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOriginalSubmit = async () => {
    if (
      !originalForm.contact ||
      !originalForm.designerName ||
      !originalForm.isOriginal ||
      !originalForm.nextStepGoal ||
      !originalForm.willingToDiscuss
    ) {
      setSubmitError("请先补充关键信息，这样才能把完整方案路径说清楚并继续往下推进。");
      return;
    }
    setSubmitError("");
    setIsSubmitting(true);

    try {
      await submitRequest({
        requestType: "creator_plan",
        contactInfo: originalForm.contact,
        requestNote: originalForm.note || "无补充说明",
        metadata: {
          designer_name: originalForm.designerName,
          is_original: originalForm.isOriginal,
          next_step_goal: originalForm.nextStepGoal,
          willing_to_discuss: originalForm.willingToDiscuss
        }
      });
      setSubmitSuccess("完整方案路径已经记下来了。后续可以继续查看这条方向的当前建议。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "完整方案路径暂时没有记下来，请稍后重试。";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyBrief = async () => {
    const markdown = buildProjectBriefMarkdown(exportData);

    try {
      await navigator.clipboard.writeText(markdown);
      setActionFeedback("这版方向说明已经复制好了");
    } catch {
      setActionFeedback("复制暂时失败，请手动重试");
    }
  };

  const handleDownloadBrief = () => {
    try {
      const markdown = buildProjectBriefMarkdown(exportData);
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const safeName = exportData.projectName.replace(/[\\/:*?\"<>|]/g, "_").trim() || "项目简报";
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safeName}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setActionFeedback("这版方向说明已经开始下载");
    } catch {
      setActionFeedback("导出暂时失败，请稍后重试");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleCopyBrief}
          className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
        >
          复制这版方向说明
        </button>
        <button
          type="button"
          onClick={handleDownloadBrief}
          className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
        >
          导出这版方向说明
        </button>
        <button
          type="button"
          onClick={() => {
            setSubmitError("");
            setSubmitSuccess("");
            setOpenType("bom");
          }}
          className={actionButtonClass(recommendationType === "bom")}
        >
          继续补充零件与结构
        </button>
        <button
          type="button"
          onClick={() => {
            setSubmitError("");
            setSubmitSuccess("");
            setOpenType("sampling");
          }}
          className={actionButtonClass(recommendationType === "sampling")}
        >
          继续补充试做路径
        </button>
        <button
          type="button"
          onClick={() => {
            setSubmitError("");
            setSubmitSuccess("");
            setOpenType("original");
          }}
          className={actionButtonClass(recommendationType === "original")}
        >
          继续补充完整方案
        </button>
      </div>

      {actionFeedback && (
        <p className="text-xs text-slate-500" role="status">
          {actionFeedback}
        </p>
      )}

      {openType && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-3 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:items-center sm:p-4">
          <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-4 shadow-lg sm:p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900">{modalTitleMap[openType]}</h3>
              <p className="mt-1 text-sm text-slate-600">{modalDescMap[openType]}</p>
            </div>

            {!submitSuccess && openType === "bom" && (
              <div className="space-y-3">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-6 text-slate-600">
                  <p className="font-semibold text-slate-900">当前动作</p>
                  <p>先把零件与结构上的关键信息补清楚，方便继续判断这条方向值不值得往下推进。</p>
                </div>
                <label className="block space-y-1">
                  <span className={fieldLabelClass}>联系方式 *</span>
                  <input
                    type="text"
                    value={bomForm.contact}
                    onChange={(event) =>
                      setBomForm((prev) => ({ ...prev, contact: event.target.value }))
                    }
                    placeholder="微信 / 手机 / 邮箱"
                    className={fieldInputClass}
                  />
                </label>
                <label className="block space-y-1">
                  <span className={fieldLabelClass}>你现在最想确认什么 *</span>
                  <textarea
                    rows={3}
                    value={bomForm.focusQuestion}
                    onChange={(event) =>
                      setBomForm((prev) => ({ ...prev, focusQuestion: event.target.value }))
                    }
                    placeholder="例如：零件数量是否合理、是否有明显冲突"
                    className={fieldInputClass}
                  />
                </label>
                <label className="block space-y-1">
                  <span className={fieldLabelClass}>你希望多久内收到反馈 *</span>
                  <select
                    value={bomForm.responseTime}
                    onChange={(event) =>
                      setBomForm((prev) => ({ ...prev, responseTime: event.target.value }))
                    }
                    className={fieldInputClass}
                  >
                    <option value="">请选择回复时效</option>
                    <option value="24h">24 小时内</option>
                    <option value="48h">48 小时内</option>
                    <option value="3d">3 天内</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={bomForm.confirmPrice}
                    onChange={(event) =>
                      setBomForm((prev) => ({ ...prev, confirmPrice: event.target.checked }))
                    }
                  />
                  我确认这一步的处理费用为 ¥29 *
                </label>
              </div>
            )}

            {!submitSuccess && openType === "sampling" && (
              <div className="space-y-3">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-6 text-slate-600">
                  <p className="font-semibold text-slate-900">当前动作</p>
                  <p>先把试做路径的信息补清楚，方便继续判断这条方向是否适合进入打样前准备。</p>
                </div>
                <label className="block space-y-1">
                  <span className={fieldLabelClass}>联系方式 *</span>
                  <input
                    type="text"
                    value={samplingForm.contact}
                    onChange={(event) =>
                      setSamplingForm((prev) => ({ ...prev, contact: event.target.value }))
                    }
                    placeholder="微信 / 手机 / 邮箱"
                    className={fieldInputClass}
                  />
                </label>
                <label className="block space-y-1">
                  <span className={fieldLabelClass}>当前走到哪一步了 *</span>
                  <select
                    value={samplingForm.projectStage}
                    onChange={(event) =>
                      setSamplingForm((prev) => ({ ...prev, projectStage: event.target.value }))
                    }
                    className={fieldInputClass}
                  >
                    <option value="">请选择当前阶段</option>
                    <option value="idea">创意已生成</option>
                    <option value="draft">方向判断完成</option>
                    <option value="review">已提交意向</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className={fieldLabelClass}>是否已有 BOM *</span>
                  <select
                    value={samplingForm.hasBom}
                    onChange={(event) =>
                      setSamplingForm((prev) => ({ ...prev, hasBom: event.target.value }))
                    }
                    className={fieldInputClass}
                  >
                    <option value="">请选择</option>
                    <option value="yes">已有</option>
                    <option value="partial">部分完成</option>
                    <option value="no">暂无</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className={fieldLabelClass}>是否已有设计稿 *</span>
                  <select
                    value={samplingForm.hasDesignDraft}
                    onChange={(event) =>
                      setSamplingForm((prev) => ({ ...prev, hasDesignDraft: event.target.value }))
                    }
                    className={fieldInputClass}
                  >
                    <option value="">请选择</option>
                    <option value="yes">已有</option>
                    <option value="partial">部分完成</option>
                    <option value="no">暂无</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className={fieldLabelClass}>最想先判断的问题 *</span>
                  <textarea
                    rows={3}
                    value={samplingForm.focusQuestion}
                    onChange={(event) =>
                      setSamplingForm((prev) => ({ ...prev, focusQuestion: event.target.value }))
                    }
                    placeholder="例如：当前结构是否适合进入打样"
                    className={fieldInputClass}
                  />
                </label>
                <label className="block space-y-1">
                  <span className={fieldLabelClass}>你希望多久内收到反馈 *</span>
                  <select
                    value={samplingForm.responseTime}
                    onChange={(event) =>
                      setSamplingForm((prev) => ({ ...prev, responseTime: event.target.value }))
                    }
                    className={fieldInputClass}
                  >
                    <option value="">请选择回复时效</option>
                    <option value="24h">24 小时内</option>
                    <option value="48h">48 小时内</option>
                    <option value="3d">3 天内</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={samplingForm.confirmPrice}
                    onChange={(event) =>
                      setSamplingForm((prev) => ({ ...prev, confirmPrice: event.target.checked }))
                    }
                  />
                  我确认这一步的处理费用为 ¥99 *
                </label>
              </div>
            )}

            {!submitSuccess && openType === "original" && (
              <div className="space-y-3">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-6 text-slate-600">
                  <p className="font-semibold text-slate-900">当前动作</p>
                  <p>先把完整方案路径说清楚，方便继续沟通这个方向的结构、目标和下一步推进方式。</p>
                </div>
                <label className="block space-y-1">
                  <span className={fieldLabelClass}>联系方式 *</span>
                  <input
                    type="text"
                    value={originalForm.contact}
                    onChange={(event) =>
                      setOriginalForm((prev) => ({ ...prev, contact: event.target.value }))
                    }
                    placeholder="微信 / 手机 / 邮箱"
                    className={fieldInputClass}
                  />
                </label>
                <label className="block space-y-1">
                  <span className={fieldLabelClass}>设计师名称 / 昵称 *</span>
                  <input
                    type="text"
                    value={originalForm.designerName}
                    onChange={(event) =>
                      setOriginalForm((prev) => ({ ...prev, designerName: event.target.value }))
                    }
                    className={fieldInputClass}
                  />
                </label>
                <label className="block space-y-1">
                  <span className={fieldLabelClass}>是否为原创项目 *</span>
                  <select
                    value={originalForm.isOriginal}
                    onChange={(event) =>
                      setOriginalForm((prev) => ({ ...prev, isOriginal: event.target.value }))
                    }
                    className={fieldInputClass}
                  >
                    <option value="">请选择</option>
                    <option value="yes">是，原创项目</option>
                    <option value="partial">部分原创</option>
                    <option value="no">不是原创</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className={fieldLabelClass}>你更希望这个项目接下来怎么推进 *</span>
                  <select
                    value={originalForm.nextStepGoal}
                    onChange={(event) =>
                      setOriginalForm((prev) => ({ ...prev, nextStepGoal: event.target.value }))
                    }
                    className={fieldInputClass}
                  >
                    <option value="">请选择</option>
                    <option value="review">先把完整方案补清楚</option>
                    <option value="sampling">先进入试做路径判断</option>
                    <option value="refine">先补齐设计细节再推进</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className={fieldLabelClass}>如果进入下一步，是否愿意继续沟通 *</span>
                  <select
                    value={originalForm.willingToDiscuss}
                    onChange={(event) =>
                      setOriginalForm((prev) => ({ ...prev, willingToDiscuss: event.target.value }))
                    }
                    className={fieldInputClass}
                  >
                    <option value="">请选择</option>
                    <option value="yes">愿意，保持沟通</option>
                    <option value="maybe">可视情况沟通</option>
                    <option value="no">暂不考虑</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className={fieldLabelClass}>补充说明（可选）</span>
                  <textarea
                    rows={3}
                    value={originalForm.note}
                    onChange={(event) =>
                      setOriginalForm((prev) => ({ ...prev, note: event.target.value }))
                    }
                    className={fieldInputClass}
                  />
                </label>
              </div>
            )}

            <div className="mt-4 min-h-10">
              {!submitSuccess && submitError && (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {submitError}
                </p>
              )}
              {submitSuccess && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  <p>{submitSuccess}</p>
                  <a href="/service-requests" className="mt-2 inline-flex text-sm font-medium text-emerald-800 underline underline-offset-2">
                    去看我的服务申请
                  </a>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
              >
                关闭
              </button>
              {!submitSuccess && openType === "bom" && (
                <button
                  type="button"
                  onClick={handleBomSubmit}
                  disabled={isSubmitting}
                  className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 sm:w-auto"
                >
                  {isSubmitting ? "正在记下这一步..." : "记下这条推进动作"}
                </button>
              )}
              {!submitSuccess && openType === "sampling" && (
                <button
                  type="button"
                  onClick={handleSamplingSubmit}
                  disabled={isSubmitting}
                  className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 sm:w-auto"
                >
                  {isSubmitting ? "正在记下这一步..." : "记下试做路径信息"}
                </button>
              )}
              {!submitSuccess && openType === "original" && (
                <button
                  type="button"
                  onClick={handleOriginalSubmit}
                  disabled={isSubmitting}
                  className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 sm:w-auto"
                >
                  {isSubmitting ? "正在记下这一步..." : "记下完整方案路径"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
