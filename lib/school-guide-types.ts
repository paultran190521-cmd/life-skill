export type SchoolGuideLeader = {
  role: string;
  name: string;
};

export type SchoolGuideEntry = {
  id: string;
  name: string;
  schoolType: string;
  address: string;
  mapUrl: string;
  distanceFromMettasoul: string;
  partnershipYears: number;
  teachingGrades: string;
  coordinationNote: string;
  studentProfile: string;
  leaders: SchoolGuideLeader[];
};

export type SchoolGuideResponse = {
  schoolYear: string;
  schools: SchoolGuideEntry[];
};
