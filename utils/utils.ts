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
