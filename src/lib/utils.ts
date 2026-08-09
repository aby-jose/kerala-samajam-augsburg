import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

export function truncate(str: string, length: number) {
  return str.length > length ? str.substring(0, length) + "..." : str;
}

export function exportToCSV(headers: string[], data: any[][], filename: string) {
  const csvContent = [
    headers.join(","),
    ...data.map(row => row.map(cell => {
      const cellStr = String(cell ?? "");
      // Handle commas and quotes in CSV
      if (cellStr.includes(",") || cellStr.includes("\"") || cellStr.includes("\n")) {
        return `"${cellStr.replace(/"/g, "\"\"")}"`;
      }
      return cellStr;
    }).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
