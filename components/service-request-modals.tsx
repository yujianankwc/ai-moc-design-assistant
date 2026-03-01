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
  bom: "BOM 快速校对申请",
  sampling: "打样可行性评估申请",
  original: "原创计划评审申请"
};

const modalDescMap: Record<RequestType, string> = {
  bom: "适合先确认零件清单的准确性与可执行性，快速识别明显问题。",
  sampling: "适合想进入打样前的结构与资源评估，先明确风险与优先级。",
  original: "适合希望进一步推进原创项目，获得方向评审与下一步建议。"
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
    return "rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800";
  }
  return "rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";
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
      throw new Error("当前为演示项目，暂不支持提交真实申请。请先创建真实项目。");
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
      throw new Error(data?.error ?? "提交失败，请稍后重试。");
    }
  };

  const handleBomSubmit = async () => {
    if (!bomForm.contact || !bomForm.focusQuestion || !bomForm.responseTime || !bomForm.confirmPrice) {
      setSubmitError("请补充完整信息并确认价格（¥29），这样我们才能继续处理你的申请。");
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
      setSubmitSuccess("申请已提交并记录，我们会尽快与你联系。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "提交失败，请稍后重试。";
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
      setSubmitError("还有几项信息未填写完整，请补充后再提交（含价格确认 ¥99）。");
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
      setSubmitSuccess("申请已提交并记录，我们会尽快与你联系。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "提交失败，请稍后重试。";
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
      setSubmitError("请先补充关键信息，便于我们更准确地安排原创计划评审。");
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
      setSubmitSuccess("申请已提交并记录，我们会尽快与你联系。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "提交失败，请稍后重试。";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyBrief = async () => {
    const markdown = buildProjectBriefMarkdown(exportData);

    try {
      await navigator.clipboard.writeText(markdown);
      setActionFeedback("已复制项目简报文本");
    } catch {
      setActionFeedback("复制失败，请手动重试");
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
      setActionFeedback("已开始下载 Markdown 简报");
    } catch {
      setActionFeedback("导出失败，请稍后重试");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleCopyBrief}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          复制文本
        </button>
        <button
          type="button"
          onClick={handleDownloadBrief}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          导出简报（Markdown）
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
          申请 BOM 快速校对
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
          申请打样可行性评估
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
          提交原创计划评审
        </button>
      </div>

      {actionFeedback && (
        <p className="text-xs text-slate-500" role="status">
          {actionFeedback}
        </p>
      )}

      {openType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-lg">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900">{modalTitleMap[openType]}</h3>
              <p className="mt-1 text-sm text-slate-600">{modalDescMap[openType]}</p>
            </div>

            {!submitSuccess && openType === "bom" && (
              <div className="space-y-3">
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
                  <span className={fieldLabelClass}>希望多久内回复 *</span>
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
                  我确认本次服务价格为 ¥29 *
                </label>
              </div>
            )}

            {!submitSuccess && openType === "sampling" && (
              <div className="space-y-3">
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
                  <span className={fieldLabelClass}>项目当前阶段 *</span>
                  <select
                    value={samplingForm.projectStage}
                    onChange={(event) =>
                      setSamplingForm((prev) => ({ ...prev, projectStage: event.target.value }))
                    }
                    className={fieldInputClass}
                  >
                    <option value="">请选择项目阶段</option>
                    <option value="idea">概念阶段</option>
                    <option value="draft">方案草稿阶段</option>
                    <option value="review">待评审阶段</option>
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
                  <span className={fieldLabelClass}>希望多久内回复 *</span>
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
                  我确认本次服务价格为 ¥99 *
                </label>
              </div>
            )}

            {!submitSuccess && openType === "original" && (
              <div className="space-y-3">
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
                  <span className={fieldLabelClass}>你更希望这个项目往哪一步走 *</span>
                  <select
                    value={originalForm.nextStepGoal}
                    onChange={(event) =>
                      setOriginalForm((prev) => ({ ...prev, nextStepGoal: event.target.value }))
                    }
                    className={fieldInputClass}
                  >
                    <option value="">请选择</option>
                    <option value="review">先完成方案评审</option>
                    <option value="sampling">尽快进入打样评估</option>
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
                  {submitSuccess}
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                关闭
              </button>
              {!submitSuccess && openType === "bom" && (
                <button
                  type="button"
                  onClick={handleBomSubmit}
                  disabled={isSubmitting}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  {isSubmitting ? "提交中..." : "提交申请"}
                </button>
              )}
              {!submitSuccess && openType === "sampling" && (
                <button
                  type="button"
                  onClick={handleSamplingSubmit}
                  disabled={isSubmitting}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  {isSubmitting ? "提交中..." : "提交申请"}
                </button>
              )}
              {!submitSuccess && openType === "original" && (
                <button
                  type="button"
                  onClick={handleOriginalSubmit}
                  disabled={isSubmitting}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  {isSubmitting ? "提交中..." : "提交申请"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
