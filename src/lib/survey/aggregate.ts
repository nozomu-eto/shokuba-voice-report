import {
  SURVEY_RATING_FIELDS,
  type SurveyRatingField,
  type SurveyResponse,
} from "./types.ts";

export type SurveyRatingSummary = {
  field: SurveyRatingField;
  total: number;
  average: number;
};

export type SurveyAggregationResult =
  | { status: "empty" }
  | { status: "invalid"; responseIndex: number; field: string }
  | {
      status: "success";
      responseCount: number;
      ratings: Record<SurveyRatingField, SurveyRatingSummary>;
    };

function isValidScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

/** Formats an already-calculated average to one decimal place for display. */
export function formatSurveyAverage(average: number): string {
  return average.toFixed(1);
}

/** Calculates response counts, totals, and unrounded averages without mutating input. */
export function aggregateSurveyResponses(
  responses: readonly SurveyResponse[],
): SurveyAggregationResult {
  if (!Array.isArray(responses)) {
    return { status: "invalid", responseIndex: 0, field: "responses" };
  }
  if (responses.length === 0) return { status: "empty" };

  const totals: Record<SurveyRatingField, number> = {
    workEnvironment: 0,
    easeOfConsultation: 0,
    informationSharing: 0,
    intentionToStay: 0,
  };

  for (const [responseIndex, response] of responses.entries()) {
    if (typeof response !== "object" || response === null) {
      return { status: "invalid", responseIndex, field: "response" };
    }
    for (const field of SURVEY_RATING_FIELDS) {
      const value: unknown = response[field];
      if (!isValidScore(value)) return { status: "invalid", responseIndex, field };
      totals[field] += value;
    }
  }

  const ratings = Object.fromEntries(
    SURVEY_RATING_FIELDS.map((field) => [
      field,
      {
        field,
        total: totals[field],
        average: totals[field] / responses.length,
      },
    ]),
  ) as Record<SurveyRatingField, SurveyRatingSummary>;

  return { status: "success", responseCount: responses.length, ratings };
}
