import { ApplicationStatus } from "@/types";
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
console.log(html)
const cleanHtml = sanitize(html, {
  allowedTags: false, // allow all tags
  allowedAttributes: {
    img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading' ],
    a: ['href', 'name', 'target', 'rel'],
    '*': ["*"], // allow all attributes
  },
  allowedSchemes: ['data', 'https', 'mailto', 'ftp', 'tel'], // allow data URIs and https
  allowVulnerableTags: true,
  allowedClasses: {
    '*': ["*"]
  },

  transformTags: {
    '*': (tagName, attribs) => {
      return {
        tagName,
        attribs,
      };
    },
    img: (tagName, attribs) => {
      const src = attribs.src || '';
      const isCloudFront = src.includes(process.env.NEXT_PUBLIC_CDN_URL ?? ""); // your CF domain
      const isDataUri = src.startsWith('data:image');

      if (!isCloudFront && !isDataUri) {
        return { tagName: 'img', attribs: {} }; // Strip src
      }

      if (isCloudFront) {
        if (!src.startsWith('https://')) {
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
      const href = attribs.href || '';
      const isSafe = href.startsWith('mailto:') || href.startsWith('https://');

      if (!isSafe) {
        return { tagName: 'a', attribs: {} };
      }

      return {
        tagName,
        attribs: {
          ...attribs,
          href,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      };
    },
  },
});

  return cleanHtml;
}
