export type ParsedScheduleDate = {
  date: string;
  month: number;
  day: number;
};

const DATE_PATTERN = /^(\d{1,2})\s*월\s*(\d{1,2})\s*일$/;

const pad2 = (value: number) => value.toString().padStart(2, "0");

export const parseScheduleDate = (dateRaw: string, projectYear: number): ParsedScheduleDate => {
  const match = dateRaw.trim().match(DATE_PATTERN);

  if (!match) {
    throw new Error(`Invalid schedule date: ${dateRaw}`);
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const candidate = new Date(Date.UTC(projectYear, month - 1, day));

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    candidate.getUTCFullYear() !== projectYear ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new Error(`Invalid schedule date: ${dateRaw}`);
  }

  return {
    date: `${projectYear}-${pad2(month)}-${pad2(day)}`,
    month,
    day
  };
};
