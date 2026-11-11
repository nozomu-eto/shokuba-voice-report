/**
 * Provisional CSV contract from docs/IMPLEMENTATION_BRIEF.md.
 * Keep CSV headers in this order for the bundled fixture; parsers must map by
 * header name and must not rely on this order.
 */
export const SURVEY_CSV_HEADERS = [
  "回答ID",
  "働きやすさ",
  "相談しやすさ",
  "情報共有",
  "継続意向",
  "自由記述",
] as const;

export type SurveyCsvHeader = (typeof SURVEY_CSV_HEADERS)[number];

/** Scores accepted by the survey's four rating columns. */
export type SurveyScore = 1 | 2 | 3 | 4 | 5;

/** One validated response row. Empty free-text comments are allowed. */
export type SurveyResponse = {
  responseId: string;
  workEnvironment: SurveyScore;
  easeOfConsultation: SurveyScore;
  informationSharing: SurveyScore;
  intentionToStay: SurveyScore;
  comment: string;
};

export type SurveyRatingField =
  | "workEnvironment"
  | "easeOfConsultation"
  | "informationSharing"
  | "intentionToStay";

export const SURVEY_RATING_FIELDS = [
  "workEnvironment",
  "easeOfConsultation",
  "informationSharing",
  "intentionToStay",
] as const satisfies readonly SurveyRatingField[];
