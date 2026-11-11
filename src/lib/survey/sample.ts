import type { SurveyResponse } from "./types.ts";

/**
 * Client-safe parsed contents of fixtures/employee-survey-sample.csv.
 * Keep this in sync with the CSV; survey-ai-analysis.test.mts checks the parity.
 */
export const BUNDLED_SAMPLE_RESPONSES: readonly SurveyResponse[] = [
  {
    responseId: "R001",
    workEnvironment: 4,
    easeOfConsultation: 2,
    informationSharing: 3,
    intentionToStay: 4,
    comment: "業務手順が部署ごとに異なり、引き継ぎで迷うことがあります。",
  },
  {
    responseId: "R002",
    workEnvironment: 2,
    easeOfConsultation: 2,
    informationSharing: 2,
    intentionToStay: 3,
    comment: "繁忙期に相談できる相手が見つからず、業務が集中します。",
  },
  {
    responseId: "R003",
    workEnvironment: 4,
    easeOfConsultation: 4,
    informationSharing: 4,
    intentionToStay: 4,
    comment: "週次ミーティングで情報共有が進み、安心して相談できます。",
  },
];
