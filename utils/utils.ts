export const formatAmount = ({
  amount,
  minimumFractionDigits = 0,
  maximumFractionDigits = 0,
}: {
  amount: number;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(amount);
};

export const percentMinMax = (
  value: number,
  min: number = 0,
  max: number = 100,
): number => {
  return Math.min(max, Math.max(min, value));
};

export const formatDate = ({
  date,
  options = {
    month: "long",
    day: "numeric",
    year: "numeric",
  },
}: {
  date: Date;
  options?: Intl.DateTimeFormatOptions;
}): string => {
  return date.toLocaleDateString("en-US", {
    ...options,
  });
};

export const getCurrentDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getCurrentTime = (): string => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const formatUTCShortDate = (date: Date): string => {
  return `${MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCDate()}`;
};

export const formatUTCTime = (date: Date): string => {
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

export const formatUTCDateTime = (date: Date): string => {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = MONTHS_SHORT[date.getUTCMonth()];
  const time = formatUTCTime(date);
  return `${day} ${month} · ${time}`;
};

export const getCurrentMonthName = (): string => {
  return new Date().toLocaleDateString("en-US", { month: "long" });
};
