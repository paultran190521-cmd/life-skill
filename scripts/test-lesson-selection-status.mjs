import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../components/mettasoul-app.tsx", import.meta.url), "utf8");
const start = source.lastIndexOf("<select", source.indexOf('aria-label="Chọn bài học"'));
const end = source.indexOf("const selectedLesson = activeLessons.find", start);
assert.ok(start >= 0 && end > start, "lesson selector has an adjacent status message");
const lessonSelector = source.slice(start, end);

assert.match(lessonSelector, /value=\{item\.lessonId\}/);
assert.match(lessonSelector, /aria-describedby=\{`lesson-selection-status-\$\{item\.id\}`\}/);
assert.match(lessonSelector, /<option value="">\{rowLessons\.length === 0 \? "Chưa có bài học phù hợp" : "Chọn bài học"\}<\/option>/);
assert.match(lessonSelector, /rowLessons\.map\(\(lesson\) =>/);
assert.match(lessonSelector, /rowLessons\.some\(\(lesson\) => lesson\.id === item\.lessonId\) \? "text-emerald-700" : "text-rose-700"/);
assert.match(lessonSelector, /Rất tốt! Bài đã được chọn\./);
assert.match(lessonSelector, /Chưa chọn bài học — hãy chọn bài trước khi giao\./);
assert.match(lessonSelector, /role="status"\s+aria-live="polite"/);

console.log("Lesson selection status contract checks passed.");
