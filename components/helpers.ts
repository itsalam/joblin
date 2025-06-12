import { ApplicationStatus } from "@/types";
import { useEffect, useRef, useState } from "react";
import sanitize from "sanitize-html";

export const ApplicationStatusTextColor: Partial<
  Record<ApplicationStatus, string>
> = {
  // [ApplicationStatus.Posted]: "text-gray-500 bg-gray-100", // Neutral for job postings
  [ApplicationStatus.ApplicationAcknowledged]: "text-blue-600", // Blue for acknowledgment
  [ApplicationStatus.InterviewRequested]: "text-yellow-600", // Yellow for pending interview
  [ApplicationStatus.Complete]: "text-green-600", // Green for completed applications
  [ApplicationStatus.OfferExtended]: "text-purple-600", // Purple for offers (highlighting excitement)
  [ApplicationStatus.Rejected]: "text-gray-500", // Red for rejection
};

export const ApplicationStatusBorderColor: Partial<
  Record<ApplicationStatus, string>
> = {
  // [ApplicationStatus.Posted]: "text-gray-500 bg-gray-100", // Neutral for job postings
  [ApplicationStatus.ApplicationAcknowledged]: "border-blue-600", // Blue for acknowledgment
  [ApplicationStatus.InterviewRequested]: "border-yellow-600", // Yellow for pending interview
  [ApplicationStatus.Complete]: "border-green-600", // Green for completed applications
  [ApplicationStatus.OfferExtended]: "border-purple-600", // Purple for offers (highlighting excitement)
  [ApplicationStatus.Rejected]: "border-gray-500", // Red for rejection
};

export const ApplicationStatusBackground: Partial<
  Record<ApplicationStatus, string>
> = {
  // [ApplicationStatus.Posted]: "text-gray-500 bg-gray-100", // Neutral for job postings
  [ApplicationStatus.ApplicationAcknowledged]: "bg-blue-100", // Blue for acknowledgment
  [ApplicationStatus.InterviewRequested]: "bg-yellow-100", // Yellow for pending interview
  [ApplicationStatus.Complete]: "bg-green-100", // Green for completed applications
  [ApplicationStatus.OfferExtended]: "bg-purple-100", // Purple for offers (highlighting excitement)
  [ApplicationStatus.Rejected]: "bg-gray-100", // Red for rejection
};

export const ApplicationStatusColor: Partial<
  Record<ApplicationStatus, string>
> = {
  // [ApplicationStatus.Posted]: "var(--color-gray-500 bg-gray-100", // Neutral for job postings
  [ApplicationStatus.ApplicationAcknowledged]: "var(--color-blue-600)", // Blue for acknowledgment
  [ApplicationStatus.InterviewRequested]: "var(--color-yellow-600)", // Yellow for pending interview
  [ApplicationStatus.Complete]: "var(--color-green-600)", // Green for completed applications
  [ApplicationStatus.OfferExtended]: "var(--color-purple-600)", // Purple for offers (highlighting excitement)
  [ApplicationStatus.Rejected]: "var(--color-gray-500)", // Red for rejection
};

export const ApplicationStatusStyle: Record<ApplicationStatus, string> =
  Object.values(ApplicationStatus).reduce(
    (acc, key) => {
      acc[key] = [
        ApplicationStatusTextColor,
        ApplicationStatusBorderColor,
        ApplicationStatusBackground,
      ]
        .map((record) => record[key])
        .join(" ");
      return acc;
    },
    {} as Record<ApplicationStatus, string>
  );

export const safelyParseHTMLForDisplay = (html: string) => {
  const cleanHtml = sanitize(html, {
    allowedTags: false, // allow all tags
    allowedAttributes: {
      img: ["src", "srcset", "alt", "title", "width", "height", "loading"],
      a: ["href", "name", "target", "rel"],
      "*": ["*"], // allow all attributes
    },
    allowedSchemes: ["data", "https", "mailto", "ftp", "tel"], // allow data URIs and https
    allowVulnerableTags: true,
    allowedClasses: {
      "*": false,
    },

    transformTags: {
      "*": (tagName, attribs) => {
        return {
          tagName,
          attribs,
        };
      },
      img: (tagName, attribs) => {
        // TOOD: Add a safe mode for protected sources only
        const src = attribs.src || "";
        const isLocal = src.startsWith("/"); // Check if the src is a local path
        const isCloudFront = src.includes(
          process.env.NEXT_PUBLIC_CDN_URL ?? ""
        ); // your CF domain
        const isDataUri = src.startsWith("data:image");

        // if (!isLocal && !isDataUri) {
        //   return { tagName: 'img', attribs: {} }; // Strip src
        // }

        if (isCloudFront) {
          if (!src.startsWith("https://")) {
            const newSrc = `https://${src}`;
            return {
              tagName,
              attribs: {
                ...attribs,
                src: newSrc,
              },
            };
          }
        }

        return {
          tagName,
          attribs: {
            ...attribs,
            src,
          },
        };
      },
      a: (tagName, attribs) => {
        const href = attribs.href || "";
        const isSafe =
          href.startsWith("mailto:") || href.startsWith("https://");

        if (!isSafe) {
          return { tagName: "a", attribs: {} };
        }

        return {
          tagName,
          attribs: {
            ...attribs,
            href,
            target: "_blank",
            rel: "noopener noreferrer",
          },
        };
      },
    },
  });

  return cleanHtml;
};

const logoCache = new Map<string, string | null>();
const shimmerWithLetter = (
  w: number,
  h: number,
  letter: string,
  isLoading: boolean
) => `
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">

  <rect width="${w}" height="${h}" fill="#DDD" />
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color: #DDD; stop-opacity: 1" />
      <stop offset="100%" style="stop-color: #EEE; stop-opacity: 1" />
    </linearGradient>
  </defs>
  ${isLoading ? `<rect id="r" width="${w}" height="${h}" fill="url(#g)"/>` : ""}
  <text
    x="50%" y="55%"
    text-anchor="middle"
    dominant-baseline="middle"
    font-size="${Math.floor(h * 0.66)}"
    fill="#888"
    font-family="sans-serif"
  >

    ${letter}
  </text>
</svg>`;

const toBase64 = (str: string) =>
  typeof window === "undefined"
    ? Buffer.from(str).toString("base64")
    : window.btoa(str);

export function useCachedLogo(company: string, size = 48, isLoading = false) {
  const baseURL = "/api/logo";
  const fallbackUrl = `data:image/svg+xml;base64,${toBase64(shimmerWithLetter(size, size, (company ?? "").slice(0, 1).toLocaleUpperCase(), isLoading))}`;
  const [url, setUrl] = useState<string>(logoCache.get(company) ?? fallbackUrl);
  const [error, setError] = useState<string | null>(null);
  const fetchLogoUrl = async () => {
    try {
      // if (logoUrl) return; // already cached or set
      const searchParams = new URLSearchParams({
        company,
      });

      const url = `${baseURL}?${searchParams.toString()}`;
      const response = await fetch(url, {
        next: { revalidate: 1000 },
      });
      const data = await response.json();
      if (data.logo) {
        return data.logo;
      } else {
        setError("No logo URL found in BIMI record");
        return fallbackUrl;
      }
    } catch (err) {
      setError("Failed to fetch Logo");
      console.error(err);
      return fallbackUrl; // Return the fallback URL
    }
  };

  useEffect(() => {
    if (logoCache.has(company)) return;

    fetchLogoUrl().then((logo) => {
      logoCache.set(company, logo);
      setUrl(logo);
    });
  }, [company]);

  return url; // Return the logo URL and error state
}

export const useDraggedData = (
  ref: HTMLElement,
  dragDataCallback?: (data: any) => void
) => {
  const draggedData = useRef<any>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (event: DragEvent) => {
    const data = event.dataTransfer?.getData("text/plain");
    setIsDragging(true);
    if (data) {
      draggedData.current = JSON.parse(data);
      dragDataCallback?.(draggedData.current);
    }
  };

  const handleDragEnd = (event: DragEvent) => {
    setIsDragging(false);
  };

  useEffect(() => {
    ref.addEventListener("dragstart", handleDragStart);
    ref.addEventListener("dragend", handleDragEnd);
    return () => {
      ref.removeEventListener("dragstart", handleDragStart);
      ref.removeEventListener("dragend", handleDragEnd);
    };
  }, []);

  return { draggedData, isDragging };
};

export function createSafeId(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\-_:.]/gi, "-") // Replace invalid characters
    .replace(/^[^a-z]+/, "id-"); // Ensure starts with a valid letter
}
