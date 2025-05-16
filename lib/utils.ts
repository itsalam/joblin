import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type HandlerFactoryArgs = {
  methods: Request["method"][];
  handler: (req: Request, params: Promise<any>) => Promise<Response>;
};

export function handlerFactory({ methods, handler }: HandlerFactoryArgs) {
  return async (req: Request, params: Promise<any>) => {
    if (!methods.includes(req.method))
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
      });
    try {
      return await handler(req, params);
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }
      console.error(error);
      return new Response(JSON.stringify({ error: (error as any).message }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
  };
}

export function dateRangeToString(
  startDate: Date,
  endDate: Date = new Date(),
  formatString = (str: string) => `Last ${str}`
): string {
  const start = new Date(startDate);

  if (
    Math.abs(endDate.getTime() - new Date().getTime()) > 24 * 60 * 60 * 1000 &&
    Math.abs(start.getTime() - new Date().getTime()) > 24 * 60 * 60 * 1000
  ) {
    // Custom range
    const formatDate = (date: Date) => {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "2-digit",
      });
    };
    return `${formatDate(start)} - ${formatDate(endDate)}`;
  }

  const diffInMilliseconds = endDate.getTime() - start.getTime();
  const diffInDays = diffInMilliseconds / (1000 * 60 * 60 * 24);
  const diffInWeeks = diffInDays / 7;
  const diffInMonths = diffInDays / 30;
  const diffInYears = diffInDays / 365;

  const printCount = (count: number) => {
    return count > 1 ? `${count} ` : "";
  };

  const timeUnitMap = {
    year: diffInYears,
    month: diffInMonths,
    week: diffInWeeks,
    day: diffInDays,
  };

  for (const [timeUnit, count] of Object.entries(timeUnitMap)) {
    if (count >= 1) {
      const flatCount = Math.floor(count);
      return formatString(
        `${printCount(flatCount)}${timeUnit}${flatCount > 1 ? "s" : ""}`
      );
    }
  }

  return `Today`;
}

export function timeAgo(dateStr: string): string {
  const dateTime = new Date(dateStr);
  const now = new Date();

  const diffInSeconds = (now.getTime() - dateTime.getTime()) / 1000;
  const diffInMinutes = diffInSeconds / 60;
  const diffInHours = diffInMinutes / 60;
  const diffInDays = diffInHours / 24;
  const diffInWeeks = diffInDays / 7;
  const diffInMonths = diffInDays / 30;
  const diffInYears = diffInDays / 365;

  if (diffInMinutes < 1) {
    return "just now";
  } else if (diffInHours < 1) {
    const minutes = Math.floor(diffInMinutes);
    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  } else if (diffInDays < 1) {
    const hours = Math.floor(diffInHours);
    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  } else if (diffInWeeks < 1) {
    const days = Math.floor(diffInDays);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  } else if (diffInMonths < 1) {
    const weeks = Math.floor(diffInWeeks);
    return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  } else if (diffInYears < 1) {
    const months = Math.floor(diffInMonths);
    return `${months} month${months > 1 ? "s" : ""} ago`;
  } else {
    const years = Math.floor(diffInYears);
    return `${years} year${years > 1 ? "s" : ""} ago`;
  }
}
