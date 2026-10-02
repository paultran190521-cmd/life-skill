import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/school-intake-mail.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
let outgoing;
const exports = {};
const process = { env: { SCHOOL_INTAKE_SMTP_PASS: "test-app-password" } };
vm.runInNewContext(compiled, {
  exports, process,
  require(name) {
    if (name === "nodemailer") return { default: { createTransport: (options) => ({ sendMail: async (message) => { outgoing = { options, message }; return { messageId: message.messageId }; } }) } };
    throw new Error(`Unexpected import: ${name}`);
  },
  String, Number, Boolean,
});
const batch = { id: "batch-123456789012", school: "2 trường", weekStart: "2026-10-05", count: 3, submittedBy: "nhung@example.com", approvedBy: "phuong@example.com", note: "<sửa lại>", raw: ["", "", "", "", "", "3", "1", "1", "0", "1"] };
const settings = { submitter: "nhung@example.com", reviewer: "phuong@example.com", director: "sunny@example.com" };
assert.equal(exports.canSendIntakeMail("submitted", { ...batch, status: "WAITING_REVIEW" }, settings, settings.submitter), true);
assert.equal(exports.canSendIntakeMail("submitted", { ...batch, status: "WAITING_REVIEW" }, settings, settings.reviewer), false);
assert.equal(exports.canSendIntakeMail("returned", { ...batch, status: "RETURNED" }, settings, settings.reviewer), true);
assert.equal(exports.canSendIntakeMail("approved", { ...batch, status: "SYNCED" }, settings, settings.reviewer), true);
assert.equal(exports.canSendIntakeMail("approved", { ...batch, status: "RETURNED" }, settings, settings.reviewer), false);
const submitted = exports.buildIntakeMail("submitted", batch, settings);
assert.equal(submitted.to, settings.reviewer);
assert.match(submitted.html, /TÀI KHOẢN ĐƯỢC CẤP QUYỀN/);
assert.match(submitted.body, /phuong@example\.com/);
const returned = exports.buildIntakeMail("returned", batch, settings);
assert.equal(returned.to, settings.submitter);
assert.match(returned.html, /&lt;sửa lại&gt;/);
assert.doesNotMatch(returned.html, /<sửa lại>/);
assert.equal(exports.buildIntakeMail("approved", batch, settings).to, settings.director);
await exports.sendIntakeMail("submitted", batch, settings);
assert.equal(outgoing.options.auth.user, "lifeskill@mettasoul.vn");
assert.equal(outgoing.options.host, "smtp.gmail.com");
assert.equal(outgoing.options.port, 465);
assert.match(outgoing.message.from, /<lifeskill@mettasoul\.vn>/);
assert.equal(outgoing.message.to, settings.reviewer);
await exports.sendIntakeTestMail(settings.submitter);
assert.equal(outgoing.message.to, settings.submitter);
assert.match(outgoing.message.subject, /Kiểm tra email/);
assert.match(outgoing.message.from, /<lifeskill@mettasoul\.vn>/);
process.env.SCHOOL_INTAKE_SMTP_PASS = "";
await assert.rejects(() => exports.sendIntakeMail("submitted", batch, settings), /Chưa cấu hình/);
console.log("School intake SMTP sender checks passed.");
