import {
  SURVEY_CSV_HEADERS,
  SURVEY_RATING_FIELDS,
  type SurveyResponse,
  type SurveyRatingField,
  type SurveyScore,
} from "./types.ts";

export const MAX_SURVEY_CSV_BYTES = 2 * 1024 * 1024;
const MAX_VALIDATION_ERRORS = 100;

export type SurveyCsvError = {
  code:
    | "empty"
    | "too_large"
    | "malformed"
    | "missing_header"
    | "duplicate_header"
    | "column_count"
    | "empty_id"
    | "invalid_id"
    | "duplicate_id"
    | "invalid_score";
  row?: number;
  column?: string;
  message: string;
};

export type SurveyCsvResult =
  | { success: true; responses: SurveyResponse[] }
  | { success: false; errors: SurveyCsvError[] };

type CsvRecord = { fields: string[]; line: number };

type CsvParseResult =
  | { success: true; records: CsvRecord[] }
  | { success: false; error: SurveyCsvError };

const RATING_FIELD_TO_HEADER = {
  workEnvironment: "働きやすさ",
  easeOfConsultation: "相談しやすさ",
  informationSharing: "情報共有",
  intentionToStay: "継続意向",
} as const satisfies Record<SurveyRatingField, Exclude<(typeof SURVEY_CSV_HEADERS)[number], "回答ID" | "自由記述">>;

function isSurveyScore(value: string): value is `${SurveyScore}` {
  return value === "1" || value === "2" || value === "3" || value === "4" || value === "5";
}

function toSurveyScore(value: `${SurveyScore}`): SurveyScore {
  switch (value) {
    case "1":
      return 1;
    case "2":
      return 2;
    case "3":
      return 3;
    case "4":
      return 4;
    case "5":
      return 5;
  }
}

function parseCsvRecords(input: string): CsvParseResult {
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let line = 1;
  let recordLine = 1;
  let inQuotes = false;
  let afterQuote = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
        afterQuote = true;
      } else if (char === "\r" || char === "\n") {
        if (char === "\r" && next === "\n") index += 1;
        field += "\n";
        line += 1;
      } else {
        field += char;
      }
      continue;
    }

    if (afterQuote && char !== "," && char !== "\r" && char !== "\n") {
      return {
        success: false,
        error: {
          code: "malformed",
          row: line,
          message: `${line}行目: 引用符の後に不要な文字があります。引用符を閉じた後は、カンマか改行を入力してください。`,
        },
      };
    }

    if (char === '"') {
      if (field.length > 0 || afterQuote) {
        return {
          success: false,
          error: {
            code: "malformed",
            row: line,
            message: `${line}行目: 引用符の位置が正しくありません。項目全体を引用符で囲んでください。`,
          },
        };
      }
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      fields.push(field);
      field = "";
      afterQuote = false;
      continue;
    }

    if (char === "\r" || char === "\n") {
      if (char === "\r" && next === "\n") index += 1;
      fields.push(field);
      if (fields.length > 1 || fields.some((value) => value.length > 0)) records.push({ fields, line: recordLine });
      fields = [];
      field = "";
      afterQuote = false;
      line += 1;
      recordLine = line;
      continue;
    }

    field += char;
  }

  if (inQuotes) {
    return {
      success: false,
      error: {
        code: "malformed",
        row: recordLine,
        message: `${recordLine}行目: 引用符が閉じられていません。自由記述などの項目を閉じる引用符を追加してください。`,
      },
    };
  }

  fields.push(field);
  if (fields.length > 1 || fields.some((value) => value.length > 0)) records.push({ fields, line: recordLine });
  return { success: true, records };
}

function addError(errors: SurveyCsvError[], error: SurveyCsvError): void {
  if (errors.length < MAX_VALIDATION_ERRORS) errors.push(error);
}

export function parseSurveyCsv(input: string): SurveyCsvResult {
  if (new TextEncoder().encode(input).byteLength > MAX_SURVEY_CSV_BYTES) {
    return {
      success: false,
      errors: [
        {
          code: "too_large",
          message: `CSVのサイズが上限の2 MiBを超えています。ファイルを分けて、1ファイルあたり2 MiB以下にしてください。`,
        },
      ],
    };
  }
  const csv = input.startsWith("\uFEFF") ? input.slice(1) : input;
  if (csv.trim().length === 0) {
    return {
      success: false,
      errors: [{ code: "empty", message: "CSVが空です。6列の見出しと1件以上の回答を含めてください。" }],
    };
  }

  const parsed = parseCsvRecords(csv);
  if (!parsed.success) return { success: false, errors: [parsed.error] };
  if (parsed.records.length === 0) {
    return {
      success: false,
      errors: [{ code: "empty", message: "CSVに見出しと回答がありません。6列の見出しと1件以上の回答を含めてください。" }],
    };
  }

  const [headerRecord, ...dataRecords] = parsed.records;
  const headers = headerRecord.fields.map((header) => header.trim());
  const errors: SurveyCsvError[] = [];
  const headerIndexes = new Map<string, number>();

  headers.forEach((header, index) => {
    if (headerIndexes.has(header)) {
      addError(errors, {
        code: "duplicate_header",
        row: headerRecord.line,
        column: header,
        message: `${headerRecord.line}行目: 「${header || "（空欄）"}」列が重複しています。見出しを1列だけ残してください。`,
      });
    } else {
      headerIndexes.set(header, index);
    }
  });

  for (const header of SURVEY_CSV_HEADERS) {
    if (!headerIndexes.has(header)) {
      addError(errors, {
        code: "missing_header",
        row: headerRecord.line,
        column: header,
        message: `${headerRecord.line}行目: 必須列「${header}」がありません。見出しに「${header}」を追加してください。`,
      });
    }
  }

  if (errors.length > 0) return { success: false, errors };
  if (dataRecords.length === 0) {
    return {
      success: false,
      errors: [{ code: "empty", row: headerRecord.line, message: "回答データがありません。見出しの下に1件以上の回答を追加してください。" }],
    };
  }

  const responses: SurveyResponse[] = [];
  const responseIds = new Set<string>();

  for (const record of dataRecords) {
    if (record.fields.length !== headers.length) {
      addError(errors, {
        code: "column_count",
        row: record.line,
        message: `${record.line}行目: 列数が見出し（${headers.length}列）と一致しません。カンマや引用符の位置を確認してください。`,
      });
      continue;
    }

    const values = new Map<string, string>();
    headers.forEach((header, index) => values.set(header, record.fields[index]));

    const rawId = values.get("回答ID") ?? "";
    const responseId = rawId.trim();
    let valid = true;
    if (!responseId) {
      addError(errors, {
        code: "empty_id",
        row: record.line,
        column: "回答ID",
        message: `${record.line}行目: 「回答ID」が空です。回答ごとに異なるIDを入力してください。`,
      });
      valid = false;
    } else if (rawId !== responseId) {
      addError(errors, {
        code: "invalid_id",
        row: record.line,
        column: "回答ID",
        message: `${record.line}行目: 「回答ID」の前後に空白があります。IDの前後の空白を削除してください。`,
      });
      valid = false;
    } else if (responseIds.has(responseId)) {
      addError(errors, {
        code: "duplicate_id",
        row: record.line,
        column: "回答ID",
        message: `${record.line}行目: 回答ID「${responseId}」が重複しています。各回答に一意のIDを付けてください。`,
      });
      valid = false;
    }
    if (responseId) responseIds.add(responseId);

    const scores: SurveyScore[] = [];
    for (const field of SURVEY_RATING_FIELDS) {
      const header = RATING_FIELD_TO_HEADER[field];
      const rawValue = values.get(header) ?? "";
      if (!isSurveyScore(rawValue)) {
        addError(errors, {
          code: "invalid_score",
          row: record.line,
          column: header,
          message: `${record.line}行目: 「${header}」の値「${rawValue}」は無効です。1〜5の整数を入力してください。`,
        });
        valid = false;
      } else {
        scores.push(toSurveyScore(rawValue));
      }
    }

    if (!valid) continue;
    const [workEnvironment, easeOfConsultation, informationSharing, intentionToStay] = scores;
    responses.push({
      responseId,
      workEnvironment,
      easeOfConsultation,
      informationSharing,
      intentionToStay,
      comment: values.get("自由記述") ?? "",
    });
  }

  if (errors.length > 0) return { success: false, errors };
  return { success: true, responses };
}
