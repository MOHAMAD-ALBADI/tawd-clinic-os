import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "SAR") {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date, locale = "ar-SA") {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(date)
  );
}

export function formatTime(date: string | Date) {
  return new Intl.DateTimeFormat("ar-SA", { timeStyle: "short" }).format(
    new Date(date)
  );
}

export function isLateAppointment(
  time: string,
  status: string,
  thresholdMinutes = 15
): boolean {
  if (status !== "confirmed") return false;
  return Date.now() - new Date(time).getTime() > thresholdMinutes * 60 * 1000;
}
