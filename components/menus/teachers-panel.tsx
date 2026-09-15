"use client";
import { UserPlus, Pencil, Trash2 } from "lucide-react";
import { Panel } from "@/components/menus/panel";
import { PagedList } from "@/components/paged-list";
import type { Teacher, User, Role } from "@/lib/types";
import type { TeacherEditDraft } from "@/components/menus/menu-types";
export interface TeachersPanelProps {
filteredTeachers:Teacher[]; teachers:Teacher[]; deferredSearchTerm:string; primaryButtonClass:string;
setTeacherModalOpen:(value:boolean)=>void; userForTeacher:(id:string)=>User|undefined;
updateTeacherRole:(teacher:Teacher,role:Role)=>void; editingTeacherId:string; teacherEditDraft:TeacherEditDraft;
startEditTeacher:(teacher:Teacher)=>void; cancelEditTeacher:()=>void; setTeacherEditDraft:(draft:TeacherEditDraft)=>void;
saveTeacherEdit:(id:string)=>void; toggleTeacherActive:(teacher:Teacher)=>void; deleteTeacher:(teacher:Teacher)=>void;
}

export function TeachersPanel({filteredTeachers, teachers, deferredSearchTerm, primaryButtonClass, setTeacherModalOpen, userForTeacher, updateTeacherRole, editingTeacherId, teacherEditDraft, startEditTeacher, cancelEditTeacher, setTeacherEditDraft, saveTeacherEdit, toggleTeacherActive, deleteTeacher}: TeachersPanelProps) {
    return (
      <Panel title="Danh sách giáo viên" action={`${filteredTeachers.length}/${teachers.length} người`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-[var(--brand-dark)]">Bảng quản lý giáo viên</p>
            <p className="text-xs font-semibold text-[var(--muted)]">Theo dõi thông tin, email, số điện thoại và phân quyền.</p>
          </div>
          <button type="button" onClick={() => setTeacherModalOpen(true)} className={primaryButtonClass}>
            <UserPlus size={18} />
            Thêm giáo viên
          </button>
        </div>
        <div className="app-scrollbar overflow-x-auto">
          <div className="min-w-[1120px] overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
            <div className="grid grid-cols-[2fr_150px_2fr_150px_110px_190px] gap-3 border-b border-[var(--line)] bg-cyan-50 px-4 py-3 text-xs font-black uppercase text-[var(--brand-dark)]">
              <span>Tên giáo viên</span>
              <span>Số điện thoại</span>
              <span>Email</span>
              <span>Phân quyền</span>
              <span>Trạng thái</span>
              <span>Thao tác</span>
            </div>
            <div className="divide-y divide-[var(--line)]">
              <PagedList items={filteredTeachers} resetKey={deferredSearchTerm} className="divide-y divide-[var(--line)]">
              {(pageTeachers) => pageTeachers.map((teacher) => (
                <TeacherTableRow
                  key={teacher.id}
                  teacher={teacher}
                  user={userForTeacher(teacher.id)}
                  onRoleChange={updateTeacherRole}
                  isEditing={editingTeacherId === teacher.id}
                  draft={teacherEditDraft}
                  onStartEdit={startEditTeacher}
                  onCancelEdit={cancelEditTeacher}
                  onDraftChange={setTeacherEditDraft}
                  onSaveEdit={saveTeacherEdit}
                  onToggleActive={toggleTeacherActive}
                  onDelete={deleteTeacher}
                />
              ))}
              </PagedList>
              {filteredTeachers.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm font-semibold text-[var(--muted)]">
                  Không tìm thấy giáo viên phù hợp với từ khóa đang nhập.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Panel>
    );
  }
function TeacherTableRow({
  teacher,
  user,
  onRoleChange,
  isEditing,
  draft,
  onStartEdit,
  onCancelEdit,
  onDraftChange,
  onSaveEdit,
  onToggleActive,
  onDelete,
}: {
  teacher: Teacher;
  user?: User;
  onRoleChange: (teacher: Teacher, role: Role) => void;
  isEditing: boolean;
  draft: TeacherEditDraft;
  onStartEdit: (teacher: Teacher) => void;
  onCancelEdit: () => void;
  onDraftChange: (draft: TeacherEditDraft) => void;
  onSaveEdit: (teacherId: string) => void;
  onToggleActive: (teacher: Teacher) => void;
  onDelete: (teacher: Teacher) => void;
}) {
  const role = user?.role ?? "teacher";

  if (isEditing) {
    return (
      <div className="grid grid-cols-[2fr_150px_2fr_150px_110px_190px] items-center gap-3 bg-cyan-50/40 px-4 py-3 text-sm">
        <div className="min-w-0 space-y-2">
          <input
            value={draft.name}
            onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
            placeholder="Họ tên"
            className="w-full rounded-xl border border-cyan-100 bg-white px-3 py-2 font-semibold text-[var(--brand-dark)] outline-none transition focus:border-[var(--brand)]"
          />
          <input
            value={draft.specialty}
            onChange={(event) => onDraftChange({ ...draft, specialty: event.target.value })}
            placeholder="Chuyên môn"
            className="w-full rounded-xl border border-cyan-100 bg-white px-3 py-2 text-xs font-semibold text-[var(--brand-dark)] outline-none transition focus:border-[var(--brand)]"
          />
        </div>
        <input
          value={draft.phone}
          onChange={(event) => onDraftChange({ ...draft, phone: event.target.value })}
          placeholder="Số điện thoại"
          className="w-full rounded-xl border border-cyan-100 bg-white px-3 py-2 font-semibold text-[var(--brand-dark)] outline-none transition focus:border-[var(--brand)]"
        />
        <input
          value={draft.email}
          onChange={(event) => onDraftChange({ ...draft, email: event.target.value })}
          placeholder="Email"
          className="w-full rounded-xl border border-cyan-100 bg-white px-3 py-2 font-semibold text-[var(--brand-dark)] outline-none transition focus:border-[var(--brand)]"
        />
        <select
          value={role}
          onChange={(event) => onRoleChange(teacher, event.target.value as Role)}
          className="w-full rounded-xl border border-cyan-100 bg-white px-3 py-2 text-sm font-black text-[var(--brand-dark)] outline-none transition focus:border-[var(--brand)]"
        >
          <option value="teacher">Giáo viên</option>
          <option value="assistant">Trợ giảng</option>
          <option value="admin">Quản trị</option>
        </select>
        <span
          className={`inline-flex h-10 items-center justify-center rounded-xl px-3 text-xs font-black ${
            teacher.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
          }`}
        >
          {teacher.active ? "Đang bật" : "Đang tắt"}
        </span>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancelEdit}
            className="inline-flex h-9 items-center rounded-lg border border-[var(--line)] bg-white px-3 text-xs font-black text-[var(--brand-dark)]"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => onSaveEdit(teacher.id)}
            className="inline-flex h-9 items-center rounded-lg bg-[var(--brand)] px-3 text-xs font-black text-white"
          >
            Lưu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[2fr_150px_2fr_150px_110px_190px] items-center gap-3 px-4 py-3 text-sm transition hover:bg-cyan-50/45">
      <div className="flex min-w-0 items-center gap-3">
        <img alt={teacher.name} src={teacher.avatarUrl} className="h-10 w-10 rounded-xl object-cover" />
        <div className="min-w-0">
          <p className="truncate font-black text-[var(--brand-dark)]">{teacher.name}</p>
          <p className="truncate text-xs font-bold uppercase text-[var(--muted)]">{teacher.specialty}</p>
        </div>
      </div>
      <span className="truncate font-bold text-orange-700">{teacher.phone}</span>
      <span className="truncate font-bold text-[var(--brand-dark)]">{teacher.email}</span>
      <select
        value={role}
        onChange={(event) => onRoleChange(teacher, event.target.value as Role)}
        className="w-full rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-sm font-black text-[var(--brand-dark)] outline-none transition focus:border-[var(--brand)]"
        >
          <option value="teacher">Giáo viên</option>
          <option value="assistant">Trợ giảng</option>
          <option value="admin">Quản trị</option>
      </select>
      <span
        className={`inline-flex h-10 items-center justify-center rounded-xl px-3 text-xs font-black ${
          teacher.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
        }`}
      >
        {teacher.active ? "Đang bật" : "Đang tắt"}
      </span>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          title="Sửa giáo viên"
          onClick={() => onStartEdit(teacher)}
          className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-50 text-[var(--brand-dark)] transition hover:bg-cyan-100"
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          title={teacher.active ? "Tắt giáo viên" : "Bật giáo viên"}
          onClick={() => onToggleActive(teacher)}
          className="inline-flex h-8 items-center rounded-lg bg-white px-2 text-[11px] font-black text-[var(--brand-dark)] ring-1 ring-[var(--line)] transition hover:bg-cyan-50"
        >
          {teacher.active ? "Tắt" : "Bật"}
        </button>
        <button
          type="button"
          title="Xóa giáo viên"
          onClick={() => onDelete(teacher)}
          className="grid h-8 w-8 place-items-center rounded-lg bg-rose-100 text-rose-700 transition hover:bg-rose-200"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
