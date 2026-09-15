export type LessonDraft = {
  grade: string;
  topicId: string;
  title: string;
  objective: string;
  lesson1Title: string;
  lesson1Objective: string;
  lesson2Title: string;
  lesson2Objective: string;
  samplePlanUrl: string;
  durationMinutes: number | "";
};

export type BulkLessonRow = LessonDraft & {
  id: string;
  topicId: string;
};

export type TeacherEditDraft = {
  name: string;
  email: string;
  phone: string;
  specialty: string;
};
