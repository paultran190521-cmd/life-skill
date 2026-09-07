"use client";

import {
  BookOpenText,
  ChevronDown,
  ExternalLink,
  GraduationCap,
  LoaderCircle,
  MapPin,
  RefreshCcw,
  Route,
  Search,
  School2,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { SchoolGuideEntry, SchoolGuideLeader, SchoolGuideResponse } from "@/lib/school-guide-types";

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLocaleLowerCase("vi");
}

export function SchoolGuidePanel() {
  const [guide, setGuide] = useState<SchoolGuideResponse | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadGuide() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/school-guide", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || "Không tải được thông tin trường.");
      }
      setGuide(payload as SchoolGuideResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không tải được thông tin trường.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGuide();
  }, []);

  const filteredSchools = useMemo(() => {
    const normalizedQuery = normalizeSearch(query.trim());
    if (!normalizedQuery) {
      return guide?.schools ?? [];
    }
    return (guide?.schools ?? []).filter((school) =>
      normalizeSearch(
        [school.name, school.schoolType, school.address, school.teachingGrades].join(" "),
      ).includes(normalizedQuery),
    );
  }, [guide, query]);

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-[28px] border border-cyan-200 bg-white shadow-[0_20px_50px_rgba(15,73,92,0.09)]">
        <div className="bg-gradient-to-br from-cyan-50 via-white to-emerald-50 px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[var(--brand)] px-3 py-1.5 text-xs font-black text-white">
                <School2 size={15} aria-hidden="true" />
                Cẩm nang giảng dạy
              </div>
              <h2 className="text-2xl font-black tracking-tight text-[var(--brand-dark)] sm:text-3xl">
                Thông tin trường đối tác
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                Xem nhanh đặc điểm học sinh, lưu ý phối hợp và người phụ trách trước khi đến trường.
                Nút chỉ đường sử dụng đúng liên kết bản đồ do METTASOUL cung cấp.
              </p>
              {guide ? (
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
                  <span className="rounded-full bg-white px-3 py-1.5 text-[var(--brand-dark)] shadow-sm">
                    Năm học {guide.schoolYear}
                  </span>
                  <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-800">
                    {guide.schools.length} trường
                  </span>
                </div>
              ) : null}
            </div>

            <label className="relative block w-full xl:max-w-md">
              <span className="sr-only">Tìm trường</span>
              <Search
                size={19}
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm theo tên, địa chỉ hoặc khối..."
                className="h-12 w-full rounded-2xl border border-cyan-200 bg-white pl-12 pr-4 text-sm font-bold text-[var(--brand-dark)] shadow-sm outline-none transition placeholder:font-semibold placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />
            </label>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid min-h-64 place-items-center rounded-[28px] border border-cyan-200 bg-white">
          <div className="flex items-center gap-3 text-sm font-black text-[var(--brand-dark)]">
            <LoaderCircle className="animate-spin" size={22} aria-hidden="true" />
            Đang tải cẩm nang trường...
          </div>
        </div>
      ) : error ? (
        <div className="rounded-[28px] border border-rose-200 bg-white p-7 text-center shadow-sm">
          <p className="font-black text-rose-700">{error}</p>
          <button
            type="button"
            onClick={() => void loadGuide()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-black text-white"
          >
            <RefreshCcw size={17} aria-hidden="true" />
            Tải lại
          </button>
        </div>
      ) : filteredSchools.length === 0 ? (
        <div className="rounded-[28px] border border-cyan-200 bg-white p-10 text-center">
          <Search className="mx-auto text-cyan-600" size={30} aria-hidden="true" />
          <p className="mt-3 font-black text-[var(--brand-dark)]">Không tìm thấy trường phù hợp</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">Thử tìm bằng tên trường, địa chỉ hoặc khối lớp.</p>
        </div>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {filteredSchools.map((school, index) => (
            <SchoolGuideCard key={school.id} school={school} index={index} />
          ))}
        </div>
      )}
    </section>
  );
}

function SchoolGuideCard({ school, index }: { school: SchoolGuideEntry; index: number }) {
  const accents = [
    "from-cyan-500 to-teal-500",
    "from-emerald-500 to-teal-500",
    "from-indigo-500 to-cyan-500",
    "from-amber-500 to-orange-500",
  ];
  const principals = school.leaders.filter((leader) => leader.role.toLocaleLowerCase("vi") === "hiệu trưởng");
  const deputyPrincipals = school.leaders.filter((leader) => leader.role.toLocaleLowerCase("vi") !== "hiệu trưởng");

  return (
    <article className="overflow-hidden rounded-[26px] border border-cyan-200 bg-white shadow-[0_14px_36px_rgba(15,73,92,0.08)]">
      <div className={`h-1.5 bg-gradient-to-r ${accents[index % accents.length]}`} />
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-700">{school.schoolType}</p>
            <h3 className="mt-1 text-xl font-black text-[var(--brand-dark)]">{school.name}</h3>
            <p className="mt-2 flex items-start gap-2 text-sm font-semibold leading-5 text-slate-600">
              <MapPin className="mt-0.5 shrink-0 text-rose-500" size={17} aria-hidden="true" />
              <span>{school.address}</span>
            </p>
          </div>
          <a
            href={school.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] px-4 py-3 text-sm font-black text-white shadow-lg shadow-cyan-900/15 transition hover:-translate-y-0.5 hover:bg-[var(--brand-dark)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200"
            aria-label={`Chỉ đường đến ${school.schoolType} ${school.name}`}
          >
            <Route size={18} aria-hidden="true" />
            Chỉ đường
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <InfoChip icon={GraduationCap} label="Giảng dạy" value={school.teachingGrades} />
          <InfoChip icon={MapPin} label="Từ METTASOUL" value={school.distanceFromMettasoul} />
          <InfoChip icon={Users} label="Hợp tác" value={`${school.partnershipYears.toString().padStart(2, "0")} năm`} />
        </div>

        <details className="group mt-5 rounded-2xl border border-cyan-100 bg-cyan-50/60 open:bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-black text-[var(--brand-dark)] marker:content-none">
            <span className="inline-flex items-center gap-2">
              <BookOpenText size={18} className="text-cyan-700" aria-hidden="true" />
              Xem thông tin trước khi giảng dạy
            </span>
            <ChevronDown size={18} className="shrink-0 transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="space-y-4 border-t border-cyan-100 px-4 py-4 text-sm leading-6">
            <GuideSection title="Lưu ý phối hợp" body={school.coordinationNote} tone="amber" />
            <GuideSection title="Đặc điểm học sinh" body={school.studentProfile} tone="cyan" />
            <div className="overflow-hidden rounded-[24px] border border-cyan-100 bg-gradient-to-b from-cyan-50 via-white to-amber-50/60 px-4 py-5 sm:px-6 sm:py-7">
              <div className="text-center">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">Ban Giám hiệu</p>
                <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-gradient-to-r from-amber-400 to-cyan-500" />
              </div>

              {principals.length > 0 ? (
                <div className="mt-6 flex justify-center">
                  {principals.map((leader) => (
                    <LeaderPortrait key={`${leader.role}-${leader.name}`} leader={leader} prominent />
                  ))}
                </div>
              ) : null}

              {deputyPrincipals.length > 0 ? (
                <div className="mx-auto mt-7 grid max-w-2xl gap-x-5 gap-y-7 sm:grid-cols-2">
                  {deputyPrincipals.map((leader, leaderIndex) => (
                    <div
                      key={`${leader.role}-${leader.name}`}
                      className={leaderIndex === deputyPrincipals.length - 1 && deputyPrincipals.length % 2 === 1
                        ? "w-full sm:col-span-2 sm:w-[260px] sm:justify-self-center"
                        : "w-full"}
                    >
                      <LeaderPortrait leader={leader} />
                    </div>
                  ))}
                </div>
              ) : null}

              {school.leaders.length === 0 ? (
                <p className="mt-5 text-center text-sm font-semibold text-slate-500">Chưa cập nhật thông tin Ban Giám hiệu.</p>
              ) : null}
            </div>
          </div>
        </details>
      </div>
    </article>
  );
}

function LeaderPortrait({ leader, prominent = false }: { leader: SchoolGuideLeader; prominent?: boolean }) {
  return (
    <figure className={`group/leader flex min-w-0 flex-col items-center text-center ${prominent ? "max-w-sm" : "w-full"}`}>
      <div
        className={`relative overflow-hidden rounded-full bg-gradient-to-br from-amber-100 via-white to-cyan-100 p-1.5 shadow-[0_18px_38px_rgba(15,73,92,0.18)] ring-1 ring-amber-200 transition duration-300 group-hover/leader:-translate-y-1 group-hover/leader:shadow-[0_24px_48px_rgba(15,73,92,0.24)] ${
          prominent
            ? "h-[250px] w-[250px] sm:h-[300px] sm:w-[300px]"
            : "h-[210px] w-[210px] sm:h-[260px] sm:w-[260px]"
        }`}
      >
        <div className="relative h-full w-full overflow-hidden rounded-full bg-white">
          <Image
            src={leader.imageUrl}
            alt={`${leader.role} ${leader.name}`}
            fill
            unoptimized
            sizes={prominent ? "(min-width: 640px) 300px, 250px" : "(min-width: 640px) 260px, 210px"}
            className="object-cover object-top"
          />
        </div>
      </div>
      <figcaption className={`relative -mt-5 rounded-2xl border border-white/80 bg-white/95 px-5 py-3 shadow-lg backdrop-blur ${prominent ? "min-w-[220px]" : "w-[90%] max-w-[260px]"}`}>
        <p className={`font-black uppercase tracking-[0.12em] ${prominent ? "text-sm text-amber-600" : "text-xs text-cyan-700"}`}>
          {leader.role}
        </p>
        <p className={`mt-1 font-black leading-snug text-[var(--brand-dark)] ${prominent ? "text-lg" : "text-base"}`}>
          {leader.name}
        </p>
      </figcaption>
    </figure>
  );
}

function InfoChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-slate-500">
        <Icon size={14} aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-[var(--brand-dark)]">{value}</p>
    </div>
  );
}

function GuideSection({ title, body, tone }: { title: string; body: string; tone: "amber" | "cyan" }) {
  const toneClass = tone === "amber"
    ? "border-amber-200 bg-amber-50 text-amber-950"
    : "border-cyan-200 bg-cyan-50 text-cyan-950";
  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-wide">{title}</p>
      <p className="mt-1 font-semibold">{body}</p>
    </div>
  );
}
