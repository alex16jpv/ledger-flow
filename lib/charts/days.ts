export interface DaySlot {
  key: string;
  value: number;
  count?: number;
  today?: boolean;
  future?: boolean;
}
