import { authOptions } from "@/lib/auth";
import { handlerFactory } from "@/lib/utils";
import { getServerSession } from "next-auth";
import { fetchEmails } from "../../helpers";

async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const applicationId = searchParams.get("applicationId") ?? undefined;

  if (!applicationId) {
    throw { error: "Missing arn applicationId" };
  }

  const session = await getServerSession(authOptions);

  const emails: CategorizedEmail[] = await fetchEmails(
    session?.user?.username!,
    undefined,
    applicationId
  );

  return new Response(
    JSON.stringify({
      emails,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

const GET = handlerFactory({ methods: ["GET"], handler });
export { GET };
