import { handlerFactory } from "@/lib/utils";
import { GroupRecord } from "@/types";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { deleteApplication } from "../route";

async function getHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const dbClient = new DynamoDBClient({ region: "us-east-1" });
  const docClient = DynamoDBDocumentClient.from(dbClient);

  const response = await docClient.send(
    new GetCommand({
      TableName: Resource["grouped-applications-table"].name,
      Key: {
        id,
      },
    })
  );

  return new Response(
    JSON.stringify({
      data: response.Item as GroupRecord,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

async function deleteHandler(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { cascadeDelete } = await req.json();
  return deleteApplication({ id, cascadeDelete });
}

const GET = handlerFactory({ methods: ["GET"], handler: getHandler });
const DELETE = handlerFactory({ methods: ["DELETE"], handler: deleteHandler });
export { DELETE, GET };
