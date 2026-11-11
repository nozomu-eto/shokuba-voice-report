import assert from "node:assert/strict";
import test from "node:test";
import {
  INITIAL_SURVEY_WORKFLOW_STATE,
  surveyWorkflowReducer,
} from "../src/lib/survey/workflow.ts";
import { BUNDLED_SAMPLE_RESPONSES } from "../src/lib/survey/sample.ts";

test("beginning a new selection clears prior results and errors", () => {
  const ready = surveyWorkflowReducer(INITIAL_SURVEY_WORKFLOW_STATE, {
    type: "begin",
    requestId: 1,
    source: "bundled-sample",
  });
  const completed = surveyWorkflowReducer(ready, {
    type: "success",
    requestId: 1,
    responses: [...BUNDLED_SAMPLE_RESPONSES],
  });

  assert.deepEqual(
    surveyWorkflowReducer(completed, { type: "begin", requestId: 2, source: "user-upload" }),
    { status: "loading", requestId: 2, source: "user-upload" },
  );
});

test("late success and failure from an older read cannot replace latest selection", () => {
  const latest = surveyWorkflowReducer(
    surveyWorkflowReducer(INITIAL_SURVEY_WORKFLOW_STATE, {
      type: "begin",
      requestId: 1,
      source: "user-upload",
    }),
    { type: "begin", requestId: 2, source: "user-upload" },
  );

  assert.equal(
    surveyWorkflowReducer(latest, {
      type: "success",
      requestId: 1,
      responses: [...BUNDLED_SAMPLE_RESPONSES],
    }),
    latest,
  );
  assert.equal(
    surveyWorkflowReducer(latest, {
      type: "failure",
      requestId: 1,
      errors: [{ code: "empty", message: "古い読み込みのエラー" }],
    }),
    latest,
  );
});

test("a failed latest read replaces the loading state with actionable errors", () => {
  const loading = surveyWorkflowReducer(INITIAL_SURVEY_WORKFLOW_STATE, {
    type: "begin",
    requestId: 4,
    source: "user-upload",
  });
  assert.deepEqual(
    surveyWorkflowReducer(loading, {
      type: "failure",
      requestId: 4,
      errors: [{ code: "too_large", message: "2 MiBを超えています" }],
    }),
    { status: "error", requestId: 4, errors: [{ code: "too_large", message: "2 MiBを超えています" }] },
  );
});
