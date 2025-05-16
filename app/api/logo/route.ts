import { handlerFactory } from "@/lib/utils";
import { Resource } from "sst";

type LogoDevResult = {
  name: string;
  domain: string;
  logo_url: string;
}[];

async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company");

  if (!company) {
    throw { error: "Missing company query" };
  }

  const logoRes = await fetch(`https://api.logo.dev/search?q=${company}`, {
    headers: {
      Authorization: `Bearer: ${Resource["LogoDevSK"].value}`,
    },
    next: {
      revalidate: 86400, // 24 hours
    },
  });

  if (!logoRes.ok) {
    throw logoRes;
  }

  const logo = ((await logoRes.json()) as LogoDevResult)?.[0]?.logo_url;

  return new Response(
    JSON.stringify({
      logo,
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
