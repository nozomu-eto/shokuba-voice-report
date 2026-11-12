import assert from "node:assert/strict";
import test from "node:test";
import { INITIAL_REPORT_DRAFT, updateReportDraft } from "../src/lib/survey/report.ts";
import { aggregateSurveyResponses } from "../src/lib/survey/aggregate.ts";
import { BUNDLED_SAMPLE_RESPONSES } from "../src/lib/survey/sample.ts";
import { INITIAL_SURVEY_WORKFLOW_STATE, surveyWorkflowReducer } from "../src/lib/survey/workflow.ts";

test("report can be created from sample data and manual text is editable", () => {
  const edited = updateReportDraft(INITIAL_REPORT_DRAFT, "positives", "会議で情報共有できている");
  const aggregate = aggregateSurveyResponses(BUNDLED_SAMPLE_RESPONSES);
  assert.equal(edited.positives, "会議で情報共有できている");
  assert.equal(aggregate.status === "success" ? aggregate.responseCount : 0, 3);
  assert.notEqual(INITIAL_REPORT_DRAFT, edited);
  assert.equal(INITIAL_REPORT_DRAFT.positives, "");
});

test("switching data and failed reads replace the current workflow result", () => {
  const ready = surveyWorkflowReducer(INITIAL_SURVEY_WORKFLOW_STATE, { type: "begin", requestId: 1, source: "bundled-sample" });
  const sample = surveyWorkflowReducer(ready, { type: "success", requestId: 1, responses: [...BUNDLED_SAMPLE_RESPONSES] });
  const loading = surveyWorkflowReducer(sample, { type: "begin", requestId: 2, source: "user-upload" });
  assert.deepEqual(loading, { status: "loading", requestId: 2, source: "user-upload" });
  const failed = surveyWorkflowReducer(loading, { type: "failure", requestId: 2, errors: [{ code: "empty", message: "空です" }] });
  assert.equal(failed.status, "error");
  assert.equal(surveyWorkflowReducer(loading, { type: "success", requestId: 1, responses: [...BUNDLED_SAMPLE_RESPONSES] }), loading);
});
