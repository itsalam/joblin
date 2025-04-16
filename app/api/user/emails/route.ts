import { handlerFactory } from "@/lib/utils";
import { getFormattedEmails } from "../../helpers";

async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const dateRangeParam = searchParams.get("dateRange") ?? undefined;
  const absolute = !!searchParams.get("absolute");

  const { emails, chartData } = await getFormattedEmails({
    dateRangeParam,
    absolute,
  });

  return new Response(
    JSON.stringify({
      emails,
      chartData,
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
