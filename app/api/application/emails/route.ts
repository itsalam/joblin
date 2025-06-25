import { authOptions } from "@/lib/auth";
import { handlerFactory } from "@/lib/utils";
import { getServerSession } from "next-auth";
import { fetchRelevantEmails } from "../../helpers";

async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const applicationId = searchParams.get("applicationId") ?? undefined;

  if (!applicationId) {
    throw { error: "Missing arn applicationId" };
  }

  const session = await getServerSession(authOptions);

  const emails: CategorizedEmail[] = await fetchRelevantEmails(
    session?.user?.username!,
    applicationId
  );

  return new Response(
    JSON.stringify({
      emails,
    }),
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        "Content-Type": "application/json",
      },
    }
  );
}

const GET = handlerFactory({ methods: ["GET"], handler });
export { GET };
