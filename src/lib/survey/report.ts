export type ReportDraft = {
  title: string;
  organization: string;
  surveyPeriod: string;
  positives: string;
  challenges: string;
  nextChecks: string;
};

export type ReportDraftField = keyof ReportDraft;

export const INITIAL_REPORT_DRAFT: ReportDraft = {
  title: "職場アンケート結果報告書",
  organization: "",
  surveyPeriod: "",
  positives: "",
  challenges: "",
  nextChecks: "",
};

export function updateReportDraft(
  draft: ReportDraft,
  field: ReportDraftField,
  value: string,
): ReportDraft {
  return { ...draft, [field]: value };
}
