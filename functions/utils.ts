import { ParsedEmailContent } from "@/types";
import * as cheerio from "cheerio";
import { ParsedMail, simpleParser } from "mailparser";
import sanitizeHtml from "sanitize-html";
import { Resource } from "sst";
import { createLogger, format, transports } from "winston";

export const lambdaLogger = () => {
  const LOG_LEVEL =
    Resource["App"].stage === "prod"
      ? "info"
      : process.env.LOG_LEVEL || "debug";
  return createLogger({
    level: LOG_LEVEL,
    format: format.combine(
      format.colorize(),
      format.timestamp({ format: "MM-DD HH:mm:ss" }),

      format.printf(({ level, message, timestamp, ...meta }) => {
        // Convert message to JSON if it's an object
        const msg =
          typeof message === "object"
            ? JSON.stringify(message, null, 2)
            : message;

        // Handle additional metadata (useful when passing objects)
        const metaData =
          Object.keys(meta).length > 0
            ? ` ${JSON.stringify(meta, null, 2)}`
            : "";

        return `${timestamp} [${level}]: ${msg}${metaData}`;
      })
    ),
    transports: [new transports.Console()],
  });
};

const extractFromPreview = (preview: string) => {
  const emailRegex = /From:\s*(?:(.*?)\s*)?(?:<([^>]+)>|([^\n\r<>]+))/i;
  const match = preview.match(emailRegex);
  return match ? match[0] : null;
};

export const extractEmailDataFromString = async (
  rawEmail: string,
  userSourceEmails?: Set<string>
): Promise<ParsedEmailContent & { id: string }> => {
  const email = await simpleParser(rawEmail);
  const messageId = extractOriginalMessageId(email)
  const date = extractEarliestDateFromBody(rawEmail);
  const fromEmails = email.from?.value;
  const nonUserSourceEmails = fromEmails?.filter(
    (emailAddress) =>
      !emailAddress.address || !userSourceEmails?.has(emailAddress.address)
  );
  const preview = await extractPreview(email);
  const from =
    nonUserSourceEmails?.[0]?.address ??
    extractFromPreview(preview ?? "") ??
    fromEmails?.[0]?.address;

  return {
    id: messageId,
    text: email.text,
    subject: email.subject,
    date: date ?? email.date ?? new Date(),
    from: from,
    html: email.html,
    preview,
  };
};

export function extractEarliestDateFromBody(emailBody: string): Date | null {
  // Step 1: Manually decode quoted-printable artifacts (basic cases)
  let decodedBody = emailBody
    .replace(/=\r?\n/g, "") // Remove soft line breaks
    .replace(/=20/g, " ") // Convert space encoding
    .replace(/=E2=80=AF/g, " "); // Convert narrow no-break space

  // Step 2: Extract Date Lines (Including Forwarded Messages)
  const datePattern = /^>*\s*Date:\s*(.+)$/gim;
  let match;
  let dates: Date[] = [];

  while ((match = datePattern.exec(decodedBody)) !== null) {
    let rawDate = match[1].trim();

    // Step 3: Normalize common email date formats
    rawDate = rawDate
      .replace(/\bat\b/g, "") // Remove "at" (e.g., "Feb 7, 2025 at 12:21 PM")
      .replace(/\s+/g, " ") // Normalize spaces
      .trim();

    // Step 4: Try Parsing with JavaScript Date
    const parsedDate = new Date(rawDate);

    if (!isNaN(parsedDate.getTime())) {
      dates.push(parsedDate);
    }
  }

  // Step 5: Return the Earliest Date Found
  return dates.length > 0
    ? new Date(Math.min(...dates.map((d) => d.getTime())))
    : null;
}

export const extractOriginalMessageId = (emailContent: ParsedMail) => {
  const headers = emailContent.headers;
  const referenceHeader = headers.get("references");

  let messageId = headers.get("message-id");
  if (referenceHeader) {
    const referenceIds = referenceHeader.toString().match(/<([^>]+)>/g); // Extract all Message-IDs
    if (referenceIds && referenceIds.length > 0) {
      messageId = referenceIds[0].toString(); // Return first ID, removing angle brackets and replacing @ and . with underscores
    }
  }

  // Step 2: Try extracting from In-Reply-To (can sometimes contain the original Message-ID)
  if (headers.has("in-reply-to")) {
    messageId = headers.get("in-reply-to")?.toString();
  }

  if (!messageId) {
    messageId =
      emailContent?.text?.match(/Message-ID:\s*<([^>]+)>/i)?.[0] ??
      emailContent.messageId ??
      "";
  }
  return messageId.toString().replace(/[<>]/g, "").replace(/[@.]/g, "_");
};

export const extractPreview = async (content: ParsedMail & {
  html: ParsedMail["html"];
  text?: ParsedMail["text"];
}) => {
  let preview;
  if (content.html) {
    // Sanitize the HTML
    const sanitized = sanitizeHtml(content.html);

    // Use cheerio to parse the sanitized HTML
    const $ = cheerio.load(sanitized);

    const textContent = $("body").text().trim();
    preview = textContent.slice(0, 200);
  } else {
     preview = content.text?.slice(0, 200);
  }
  return preview;
};
