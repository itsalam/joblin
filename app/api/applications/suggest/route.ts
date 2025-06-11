import { authOptions } from "@/lib/auth";
import { handlerFactory } from "@/lib/utils";
import { OpenSearchRecord } from "@/types";
import { MatchQuery } from "@opensearch-project/opensearch/api/_types/_common.query_dsl.js";
import { ResponseError } from "@opensearch-project/opensearch/lib/errors.js";
import { getServerSession } from "next-auth";
import { fetchSuggestedApplications } from "../../helpers";

type SearchQueries = Partial<Record<keyof OpenSearchRecord, MatchQuery>>;

async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const applicationTitle = searchParams.get("application_title") ?? undefined;
  const searchTerm = searchParams.get("search_term") ?? undefined;
  const company_title = searchParams.get("company_title") ?? undefined;
  if (!applicationTitle || !company_title) {
    throw {
      error: `Missing applicationTitle or company_title query: ${{ applicationTitle, company_title }}`,
      status: 400,
    };
  }

  const session = await getServerSession(authOptions);

  let mustQueries: SearchQueries[] = [];
  let shouldQueries: SearchQueries[] = [];

  const searchTermQueries: SearchQueries = searchTerm
    ? ({
        subject: {
          query: searchTerm,
          fuzziness: "AUTO",
        },
        company_title: {
          query: searchTerm,
          fuzziness: "AUTO",
        },
        text: {
          query: searchTerm,
          fuzziness: "AUTO",
        },
        job_title: {
          query: searchTerm,
          fuzziness: "AUTO",
        },
      } satisfies SearchQueries)
    : {};

  if (searchTermQueries.company_title && company_title) {
    const { company_title: searchTermCompanyTitle, ...rest } =
      searchTermQueries;
    shouldQueries.push({ company_title: searchTermCompanyTitle });
    shouldQueries.push({
      company_title: {
        query: company_title,
        fuzziness: "AUTO",
      },
    });
    mustQueries.push(rest);
  } else {
    mustQueries.push({
      company_title: {
        query: company_title,
        fuzziness: "AUTO",
      },
    });
    shouldQueries.push({
      job_title: {
        query: applicationTitle, // <- your vague term
        fuzziness: "AUTO", // <- loose match
        boost: 0.3, // <- low weight, optional
      },
    });
  }
  let res;
  try {
    res = await fetchSuggestedApplications(
      session?.user?.username!,
      mustQueries,
      shouldQueries
    );
  } catch (e) {
    console.error({ e, ...((e as ResponseError).meta ?? {}) });
  }

  const hits = res?.hits?.hits ?? [];
  const hitItems: CategorizedEmail[] = hits.map((hit) => {
    return hit._source as CategorizeEmailItem;
  });

  const applicationDataMap = new Map(
    hitItems.map((item) => [
      item.group_id,
      {
        company_title: item.company_title,
        id: item.group_id,
        job_title: item.job_title,
      },
    ]) // key by name
  );
  console.log("applicationDataMap", applicationDataMap);

  const applications = [...applicationDataMap.values()];

  return new Response(
    JSON.stringify({
      applications,
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
