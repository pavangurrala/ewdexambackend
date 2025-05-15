import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { generateBatch } from "../shared/util";
import { schedules } from "../seed/movies";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as path from "path";

export class ExamStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

  
    const table = new dynamodb.Table(this, "CinemasTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "cinemaId", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: "movieId", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "CinemaTable",
    });

    table.addLocalSecondaryIndex({
      indexName: "periodIx",
      sortKey: { name: "period", type: dynamodb.AttributeType.STRING },
    });

   
    const getCinemaMoviesFn = new lambdanode.NodejsFunction(this, "GetCinemaMoviesFn", {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, "../lambdas/getmoviesbycinema.ts"),
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: table.tableName,
        REGION: "eu-west-1",
      },
    });

  
    table.grantReadData(getCinemaMoviesFn);

    new custom.AwsCustomResource(this, "moviesddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [table.tableName]: generateBatch(schedules),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("moviesddbInitData"),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [table.tableArn],
      }),
    });


    const api = new apig.RestApi(this, "ExamAPI", {
      description: "Exam API",
      deployOptions: { stageName: "dev" },
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
    });


    const cinemasResource = api.root.addResource("cinemas");
    const cinemaIdResource = cinemasResource.addResource("{cinemaId}");
    const moviesResource = cinemaIdResource.addResource("movies");

    
    moviesResource.addMethod("GET", new apig.LambdaIntegration(getCinemaMoviesFn));
  }
}