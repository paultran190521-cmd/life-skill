import fs from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import ts from "typescript";

const emailSource = fs.readFileSync(new URL("../lib/email.ts", import.meta.url), "utf8");
const gasSource = fs.readFileSync(new URL("./gas-life-skill-webhook.js", import.meta.url), "utf8");

const requiredPatterns = [
  ['mobile viewport', 'meta name="viewport"'],
  ['light color scheme', 'meta name="color-scheme" content="light only"'],
  ['responsive breakpoint', '@media only screen and (max-width:600px)'],
  ['desktop schedule table', 'class="desktop-schedule-table"'],
  ['desktop five-column layout', '<colgroup>'],
  ['single-column schedule cards', 'class="schedule-card"'],
  ['mobile-only schedule wrapper', 'class="mobile-schedule-cards"'],
  ['desktop action wrapper', 'class="desktop-email-actions"'],
  ['mobile action wrapper', 'class="mobile-email-actions"'],
  ['full-width mobile actions', 'class="email-button"'],
  ['presentation tables', 'role="presentation"'],
  ['safe Vietnamese word wrapping', 'word-break:normal;overflow-wrap:break-word'],
];

for (const [label, pattern] of requiredPatterns) {
  if (!emailSource.includes(pattern)) {
    throw new Error(`Schedule email template is missing ${label}: ${pattern}`);
  }
}

for (const responsiveRule of [
  '.desktop-schedule-table { display:table; }',
  '.mobile-schedule-cards, .mobile-email-actions { display:none;',
  '.desktop-schedule-table, .desktop-email-actions { display:none !important;',
  '.mobile-schedule-cards, .mobile-email-actions { display:block !important;',
]) {
  if (!emailSource.includes(responsiveRule)) {
    throw new Error(`Desktop/mobile email switch is incomplete: ${responsiveRule}`);
  }
}

const appTemplateVersion = emailSource.match(/scheduleEmailTemplateVersion = "([^"]+)"/)?.[1];
const gasTemplateVersion = gasSource.match(/ACTIVE_SCHEDULE_EMAIL_TEMPLATE_VERSION = "([^"]+)"/)?.[1];
if (!appTemplateVersion || appTemplateVersion !== gasTemplateVersion) {
  throw new Error(`Email template version mismatch: app=${appTemplateVersion}, gas=${gasTemplateVersion}`);
}

const compiled = ts.transpileModule(`${emailSource}\nexport { renderScheduleDigestEmail };`, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;

const runtimeModule = { exports: {} };
const runtimeContext = {
  module: runtimeModule,
  exports: runtimeModule.exports,
  require(specifier) {
    if (specifier === "@/lib/schedule-confirmation") {
      return {
        createScheduleConfirmationToken: (scheduleId) => `token-${scheduleId}`,
        createScheduleConfirmationBatchToken: (scheduleIds) => `batch-${scheduleIds.join("-")}`,
      };
    }
    if (specifier === "@/lib/google-sheets") return { appendSheetRowWithHeaders: async () => undefined };
    if (specifier === "@/lib/academic-week") return { formatAcademicWeekLabel: () => "tuần 2 năm học 2026-2027" };
    if (specifier === "nodemailer") return { createTransport: () => ({ sendMail: async () => ({}) }) };
    throw new Error(`Unexpected test import: ${specifier}`);
  },
  process: { env: { NEXT_PUBLIC_APP_URL: "https://giaovukns.mettasoul.vn" } },
  URL,
  TextEncoder,
  crypto: webcrypto,
  console,
};
vm.runInNewContext(compiled, runtimeContext, { filename: "lib/email.ts" });

const schedule = {
  id: "schedule-preview-1",
  teacherId: "teacher-preview-1",
  date: "2026-09-09",
  lessonPeriods: "lesson1",
  status: "sent",
};
const renderedHtml = runtimeModule.exports.renderScheduleDigestEmail({
  teacher: { name: "Cô Nguyễn Ánh", email: "teacher@example.com" },
  schedules: [schedule],
  rows: [{
    schedule,
    school: { name: "TRƯỜNG THPT TÂN TÚC" },
    participantClassNames: ["12A1"],
    lesson: { title: "Phong cách và gu thẩm mỹ cá nhân", lesson1Title: "Xây dựng phong cách cá nhân" },
    slot: { start: "13:15", end: "14:50" },
  }],
});

for (const expectedText of [
  "TRƯỜNG THPT TÂN TÚC",
  "Phong cách và gu thẩm mỹ cá nhân",
  "Xây dựng phong cách cá nhân",
  "XÁC NHẬN TIẾT NÀY",
  "XÁC NHẬN TẤT CẢ",
]) {
  if (!renderedHtml.includes(expectedText)) {
    throw new Error(`Rendered schedule email is missing expected content: ${expectedText}`);
  }
}

if (renderedHtml.includes("undefined")) {
  throw new Error("Rendered schedule email contains an invalid value.");
}

if (!renderedHtml.includes('class="desktop-schedule-table"') || !renderedHtml.includes('class="mobile-schedule-cards"')) {
  throw new Error("Rendered schedule email does not contain both desktop and mobile layouts.");
}

const previewPath = process.argv[2] || process.env.EMAIL_PREVIEW_PATH;
if (previewPath) {
  fs.writeFileSync(previewPath, renderedHtml, "utf8");
}

console.log("Responsive schedule email template test passed (rendered mobile cards, actions, wrapping, GAS version).")
