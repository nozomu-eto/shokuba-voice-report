import type { SurveyCsvError } from "./csv.ts";
import type { SurveyResponse } from "./types.ts";

export type SurveyWorkflowState =
  | { status: "idle"; requestId: number }
  | { status: "loading"; requestId: number; source: "bundled-sample" | "user-upload" }
  | { status: "error"; requestId: number; errors: SurveyCsvError[] }
  | {
      status: "ready";
      requestId: number;
      source: "bundled-sample" | "user-upload";
      responses: SurveyResponse[];
    };

export type SurveyWorkflowAction =
  | { type: "begin"; requestId: number; source: "bundled-sample" | "user-upload" }
  | { type: "success"; requestId: number; responses: SurveyResponse[] }
  | { type: "failure"; requestId: number; errors: SurveyCsvError[] };

export const INITIAL_SURVEY_WORKFLOW_STATE: SurveyWorkflowState = { status: "idle", requestId: 0 };

/** Ignore any completion that belongs to a selection older than the current one. */
export function surveyWorkflowReducer(
  state: SurveyWorkflowState,
  action: SurveyWorkflowAction,
): SurveyWorkflowState {
  if (action.type === "begin") {
    return { status: "loading", requestId: action.requestId, source: action.source };
  }
  if (action.requestId !== state.requestId || state.status !== "loading") return state;
  if (action.type === "failure") {
    return { status: "error", requestId: action.requestId, errors: action.errors };
  }
  return {
    status: "ready",
    requestId: action.requestId,
    source: state.source,
    responses: action.responses,
  };
}
