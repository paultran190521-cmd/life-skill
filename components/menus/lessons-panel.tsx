"use client";
import type React from "react";
import { Download, FileSpreadsheet, Plus, Save, LoaderCircle, Search, X, Pencil, Trash2 } from "lucide-react";
import { Panel } from "@/components/menus/panel";
import { PagedList } from "@/components/paged-list";
import type { Lesson } from "@/lib/types";
import type { LessonDraft, BulkLessonRow } from "@/components/menus/menu-types";
export interface LessonsPanelProps {

bulkLessonRows: BulkLessonRow[];
bulkLessonErrors: Record<string,string>;
lessonGrades: string[];
lessonDurations: number[];
compactInputClass: string;
primaryButtonClass: string;
updateBulkLessonRow: (id:string, patch:Partial<BulkLessonRow>)=>void;
pasteBulkLessons: (id:string,event:React.ClipboardEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>void;
toLessonDuration: (value:string)=>number|"";
removeBulkLessonRow:(id:string)=>void;
downloadLessonSpreadsheetTemplate:()=>void;
importLessonsFromSpreadsheet:(event:React.ChangeEvent<HTMLInputElement>)=>void;
addBulkLessonRow:()=>void;
saveBulkLessons:()=>void;
isBusy:boolean;
filteredLessons:Lesson[];
activeLessons:Lesson[];
lessonSearchTerm:string;
setLessonSearchTerm:(value:string)=>void;
lessonGradeFilter:string;
setLessonGradeFilter:(value:string)=>void;
deferredLessonSearchTerm:string;
editingLessonId:string;
lessonEditDraft:LessonDraft;
setLessonEditDraft:(value:LessonDraft)=>void;
setEditingLessonId:(value:string)=>void;
saveLessonEdit:(id:string)=>void;
formatLessonObjectiveForDisplay:(objective:string)=>string;
startEditLesson:(lesson:Lesson)=>void;
setLessonDeleteTarget:(lesson:Lesson)=>void;
}

export function LessonsPanel({bulkLessonRows, bulkLessonErrors, lessonGrades, lessonDurations, compactInputClass, primaryButtonClass, updateBulkLessonRow, pasteBulkLessons, toLessonDuration, removeBulkLessonRow, downloadLessonSpreadsheetTemplate, importLessonsFromSpreadsheet, addBulkLessonRow, saveBulkLessons, isBusy, filteredLessons, activeLessons, lessonSearchTerm, setLessonSearchTerm, lessonGradeFilter, setLessonGradeFilter, deferredLessonSearchTerm, editingLessonId, lessonEditDraft, setLessonEditDraft, setEditingLessonId, saveLessonEdit, formatLessonObjectiveForDisplay, startEditLesson, setLessonDeleteTarget}: LessonsPanelProps) {
    return (
      <div className="space-y-5">
        <Panel title="Nhập mẫu bài học" action="Spreadsheet / hàng loạt">
          <div className="grid gap-4">
            <div className="app-scrollbar overflow-x-auto">
              <div className="min-w-[920px]">
                <div className="grid grid-cols-[130px_210px_1fr_220px_120px_48px] gap-2 px-2 pb-2 text-xs font-black uppercase text-[var(--brand-dark)]">
                  <span>Khối</span>
                  <span>Tên chuyên đề</span>
                  <span>Mục tiêu</span>
                  <span>Giáo án mẫu</span>
                  <span>Số phút</span>
                  <span />
                </div>
                <div className="space-y-2">
                  {bulkLessonRows.map((row) => (
                    <div key={row.id}>
                      <div className="grid grid-cols-[130px_210px_1fr_220px_120px_48px] items-start gap-2">
                        <select
                          value={row.grade}
                          onChange={(event) => updateBulkLessonRow(row.id, { grade: event.target.value })}
                          onPaste={(event) => pasteBulkLessons(row.id, event)}
                          className={compactInputClass}
                        >
                          {lessonGrades.map((grade) => (
                            <option key={grade}>{grade}</option>
                          ))}
                        </select>
                        <input
                          value={row.title}
                          onChange={(event) => updateBulkLessonRow(row.id, { title: event.target.value })}
                          onPaste={(event) => pasteBulkLessons(row.id, event)}
                          placeholder="Tên chuyên đề"
                          className={compactInputClass}
                        />
                        <textarea
                          value={row.objective}
                          onChange={(event) => updateBulkLessonRow(row.id, { objective: event.target.value })}
                          onPaste={(event) => pasteBulkLessons(row.id, event)}
                          placeholder="Mỗi mục tiêu một dòng"
                          className={`${compactInputClass} min-h-12 resize-y whitespace-pre-line`}
                        />
                        <input
                          value={row.samplePlanUrl}
                          onChange={(event) => updateBulkLessonRow(row.id, { samplePlanUrl: event.target.value })}
                          onPaste={(event) => pasteBulkLessons(row.id, event)}
                          placeholder="Link Google Drive/PDF"
                          className={compactInputClass}
                        />
                        <select
                          value={row.durationMinutes}
                          onChange={(event) =>
                            updateBulkLessonRow(row.id, { durationMinutes: toLessonDuration(event.target.value) })
                          }
                          onPaste={(event) => pasteBulkLessons(row.id, event)}
                          className={compactInputClass}
                        >
                          <option value="">Chọn</option>
                          {lessonDurations.map((minutes) => (
                            <option key={minutes} value={minutes}>
                              {minutes}
                            </option>
                          ))}
                        </select>
                        <button
                          title="Xóa dòng"
                          onClick={() => removeBulkLessonRow(row.id)}
                          className="grid h-11 w-11 place-items-center rounded-xl bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      {bulkLessonErrors[row.id] ? (
                        <p className="mt-1 px-2 text-xs font-bold text-rose-700">{bulkLessonErrors[row.id]}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={downloadLessonSpreadsheetTemplate}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-100 bg-white px-3 py-2 text-xs font-black text-[var(--brand-dark)] transition hover:bg-cyan-50"
                  >
                    <Download size={16} />
                    Tải mẫu spreadsheet
                  </button>
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-cyan-100 bg-white px-3 py-2 text-xs font-black text-[var(--brand-dark)] transition hover:bg-cyan-50">
                    <FileSpreadsheet size={16} />
                    Nhập từ spreadsheet
                    <input
                      type="file"
                      accept=".xlsx,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values"
                      className="hidden"
                      onChange={importLessonsFromSpreadsheet}
                    />
                  </label>
                  <button
                    onClick={addBulkLessonRow}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-100 bg-white px-3 py-2 text-xs font-black text-[var(--brand-dark)] transition hover:bg-cyan-50"
                  >
                    <Plus size={16} />
                    Thêm dòng
                  </button>
                  <button onClick={saveBulkLessons} disabled={isBusy} className={primaryButtonClass}>
                    {isBusy ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />}
                    {isBusy ? "Đang lưu..." : "Lưu hàng loạt"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Thư viện bài học" action={`${filteredLessons.length}/${activeLessons.length} bài`}>
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_180px]">
            <label className="flex min-w-0 items-center gap-2 rounded-2xl border border-[var(--line)] bg-white px-3 py-2 shadow-sm transition focus-within:border-[var(--brand)]">
              <Search size={17} className="text-[var(--muted)]" />
              <input
                value={lessonSearchTerm}
                onChange={(event) => setLessonSearchTerm(event.target.value)}
                placeholder="Tìm chuyên đề, mục tiêu..."
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--brand-dark)] outline-none placeholder:text-slate-400"
              />
            </label>
            <select
              value={lessonGradeFilter}
              onChange={(event) => setLessonGradeFilter(event.target.value)}
              className={compactInputClass}
            >
              <option value="all">Tất cả khối</option>
              {lessonGrades.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </div>
          <PagedList items={filteredLessons} resetKey={`${lessonGradeFilter}:${deferredLessonSearchTerm}`} pageSize={24} className="grid gap-3 lg:grid-cols-2">
            {(pageLessons) => pageLessons.map((lesson) => {
              const isEditing = editingLessonId === lesson.id;
              return (
                <div key={lesson.id} className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
                  {isEditing ? (
                    <div className="grid gap-3">
                      <div className="grid gap-3 md:grid-cols-[140px_1fr_120px]">
                        <select
                          value={lessonEditDraft.grade}
                          onChange={(event) => setLessonEditDraft({ ...lessonEditDraft, grade: event.target.value })}
                          className={compactInputClass}
                        >
                          {lessonGrades.map((grade) => (
                            <option key={grade}>{grade}</option>
                          ))}
                        </select>
                        <input
                          value={lessonEditDraft.title}
                          onChange={(event) => setLessonEditDraft({ ...lessonEditDraft, title: event.target.value })}
                          className={compactInputClass}
                        />
                        <select
                          value={lessonEditDraft.durationMinutes}
                          onChange={(event) =>
                            setLessonEditDraft({ ...lessonEditDraft, durationMinutes: toLessonDuration(event.target.value) })
                          }
                          className={compactInputClass}
                        >
                          <option value="">Chọn</option>
                          {lessonDurations.map((minutes) => (
                            <option key={minutes} value={minutes}>
                              {minutes} phút
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/40 p-3 md:grid-cols-2">
                        <div className="grid gap-2">
                          <p className="text-xs font-black uppercase text-cyan-900">Tiết 1</p>
                          <input
                            value={lessonEditDraft.lesson1Title}
                            onChange={(event) => setLessonEditDraft({ ...lessonEditDraft, lesson1Title: event.target.value })}
                            placeholder="Tên tiết 1"
                            className={compactInputClass}
                          />
                          <textarea
                            value={lessonEditDraft.lesson1Objective}
                            onChange={(event) => setLessonEditDraft({ ...lessonEditDraft, lesson1Objective: event.target.value })}
                            placeholder="Mục tiêu tiết 1"
                            className={`${compactInputClass} min-h-24 resize-y whitespace-pre-line`}
                          />
                        </div>
                        <div className="grid gap-2">
                          <p className="text-xs font-black uppercase text-cyan-900">Tiết 2</p>
                          <input
                            value={lessonEditDraft.lesson2Title}
                            onChange={(event) => setLessonEditDraft({ ...lessonEditDraft, lesson2Title: event.target.value })}
                            placeholder="Tên tiết 2"
                            className={compactInputClass}
                          />
                          <textarea
                            value={lessonEditDraft.lesson2Objective}
                            onChange={(event) => setLessonEditDraft({ ...lessonEditDraft, lesson2Objective: event.target.value })}
                            placeholder="Mục tiêu tiết 2"
                            className={`${compactInputClass} min-h-24 resize-y whitespace-pre-line`}
                          />
                        </div>
                      </div>
                      <input
                        value={lessonEditDraft.samplePlanUrl}
                        onChange={(event) =>
                          setLessonEditDraft({ ...lessonEditDraft, samplePlanUrl: event.target.value })
                        }
                        placeholder="Link giáo án mẫu trên Google Drive/PDF"
                        className={compactInputClass}
                      />
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          onClick={() => setEditingLessonId("")}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-black text-[var(--brand-dark)] transition hover:bg-cyan-50"
                        >
                          <X size={16} />
                          Hủy
                        </button>
                        <button onClick={() => saveLessonEdit(lesson.id)} disabled={isBusy} className={primaryButtonClass}>
                          {isBusy ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />}
                          {isBusy ? "Đang lưu..." : "Lưu"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase text-[var(--brand)]">{lesson.grade}</p>
                          <h3 className="mt-1 text-base font-black text-[var(--brand-dark)]">{lesson.title}</h3>
                          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[var(--muted)]">
                            {formatLessonObjectiveForDisplay(lesson.objective)}
                          </p>
                          {lesson.samplePlanUrl ? (
                            <a
                              href={lesson.samplePlanUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 transition hover:bg-blue-100"
                            >
                              <FileSpreadsheet size={14} />
                              Giáo án mẫu
                            </a>
                          ) : null}
                        </div>
                        <span className="shrink-0 rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-700">
                          {lesson.durationMinutes} phút
                        </span>
                      </div>
                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          title="Sửa bài học"
                          onClick={() => startEditLesson(lesson)}
                          className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-50 text-[var(--brand-dark)] transition hover:bg-cyan-100"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          title="Xóa bài học"
                          onClick={() => setLessonDeleteTarget(lesson)}
                          className="grid h-9 w-9 place-items-center rounded-xl bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </PagedList>
        </Panel>
      </div>
    );
  }
