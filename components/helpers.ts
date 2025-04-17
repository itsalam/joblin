import { ApplicationStatus } from "@/types";

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
