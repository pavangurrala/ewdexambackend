import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const ddbClient = new DynamoDBClient({ region: "eu-west-1" });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    console.log("[EVENT RECEIVED]", JSON.stringify(event));

    
    const cinemaId = event.pathParameters?.cinemaId;
    const movieId = event.queryStringParameters?.movieId;
    const period = event.queryStringParameters?.period; 

    if (!cinemaId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "cinemaId is required." }),
      };
    }

    let queryParams: any = {
      TableName: process.env.TABLE_NAME!,
      KeyConditionExpression: "cinemaId = :cinemaId",
      ExpressionAttributeValues: { ":cinemaId": Number(cinemaId) },
    };

    if (movieId) {
     
      queryParams.KeyConditionExpression += " AND movieId = :movieId";
      queryParams.ExpressionAttributeValues[":movieId"] = movieId;
    } else if (period) {
     
      queryParams.IndexName = "periodIx";
      queryParams.KeyConditionExpression += " AND period = :period";
      queryParams.ExpressionAttributeValues[":period"] = period;
    }

    console.log("[QUERY PARAMS]", queryParams);

    
    const result = await ddbDocClient.send(new QueryCommand(queryParams));
    console.log("[DYNAMODB RESULT]", result);

    return {
      statusCode: 200,
      body: JSON.stringify(result.Items),
    };
  } catch (error) {
    console.error("[GET CINEMA MOVIES ERROR]", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error"}),
    };
  }
};