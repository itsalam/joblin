import {
  DynamoDBClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { unmarshall } from "@aws-sdk/util-dynamodb";

import { upsertOpenSearchEmailItem } from "./functions/sync-dynamo-to-os";

const URL =
  "https://docs.google.com/document/d/e/2PACX-1vQGUck9HIFCyezsrBSnmENk5ieJuYwpt7YHYEzeNJkIb9OSDdx-ov2nRNReKQyey-cwJOoEKUhLmN9z/pub";

const s3 = new S3Client({});
const dbClient = new DynamoDBClient({ region: "us-east-1" });

const email = "b4881488-6011-7094-4231-99f95f37fc1e";
const table = "hireable-dev-categorizedemailstableTable-sehzarfd";

async function fetchItems() {
  let ExpressionAttributeValues: QueryCommandInput["ExpressionAttributeValues"] =
    {
      ":user_name": {
        S: email,
      },
    };

  let queryCommand: QueryCommandInput = {
    TableName: table,
    IndexName: "userEmails",
    KeyConditionExpression: "user_name = :user_name",
    ExpressionAttributeValues,
  };
  const results = await dbClient.send(new QueryCommand(queryCommand)).then(
    (res) => {
      return (
        (res.Items?.map((item) => unmarshall(item)) as CategorizedEmail[]) ?? []
      );
    },
    (rej) => console.log({ rej })
  );
  return results ?? [];
}

// async function rewriteItems(items: CategorizedEmail[]) {
//   const newItems: CategorizedEmail[] = items.map((item) => {
//     return {
//       ...item,
//       group_id: v4(),
//     };
//   });

//   // const batches = [];
//   // for (let i = 0; i < newItems.length; i += 25) {
//   //   const batch = newItems.slice(i, i + 25).map((Item) => ({
//   //     PutRequest: {
//   //       Item: marshall(Item),
//   //     },
//   //   }));
//   //   batches.push(batch);
//   // }

//   return newItems;
// }

async function main() {
  const dynamoItems = await fetchItems();

  // const items = await rewriteItems(dynamoItems);

  for (const item of dynamoItems) {
    // await dbClient.send(
    //   new BatchWriteItemCommand({
    //     RequestItems: {
    //       [table]: batch,
    //     },
    //   })
    // );
    await upsertOpenSearchEmailItem(item, false);
  }

  // console.log(newItems);
}

main();
