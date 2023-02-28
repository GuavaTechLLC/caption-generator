import { Ratelimit } from "@upstash/ratelimit";
import type { NextApiRequest, NextApiResponse } from "next";
import requestIp from "request-ip";
import redis from "../../utils/redis";
import { Configuration, OpenAIApi } from "openai";


const configuration = new Configuration({
  organization: process.env.OPEN_AI_API_ORGANIZATION_ID,
  apiKey: process.env.OPEN_AI_API_SECRET_KEY,
});
const openai = new OpenAIApi(configuration);

type Data = string;
interface ExtendedNextApiRequest extends NextApiRequest {
  body: {
    imageUrl: string;
  };
}

// Create a new ratelimiter, that allows 3 requests per 60 seconds
const ratelimit = redis
  ? new Ratelimit({
      redis: redis,
      limiter: Ratelimit.fixedWindow(3, "60 s"),
    })
  : undefined;

export default async function handler(
  req: ExtendedNextApiRequest,
  res: NextApiResponse<Data>
) {
  // Rate Limiter Code
  if (ratelimit) {
    const identifier = requestIp.getClientIp(req);
    const result = await ratelimit.limit(identifier!);
    res.setHeader("X-RateLimit-Limit", result.limit);
    res.setHeader("X-RateLimit-Remaining", result.remaining);

    if (!result.success) {
      res
        .status(429)
        .json(
          "Too many uploads in 1 minute. Please try again in a few minutes."
        );
      return;
    }
  }

  const imageUrl = req.body.imageUrl;
  // POST request to Replicate to start the image description text generation process
  let response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Token " + process.env.REPLICATE_API_KEY,
    },
    body: JSON.stringify({
      version:
        "2e1dddc8621f72155f24cf2e0adbde548458d3cab9f00c0139eea840d0ac4746",
      input: { image: imageUrl },
    }),
  });

  let prediction = await response.json();
  let endpointUrl = prediction.urls.get;

  if (response.status !== 201) {
    let error = await response.json();
    res.statusCode = 500;
    res.end(JSON.stringify({ detail: error.detail }));
    return error;
  }

  if (endpointUrl) {

    let imageDescription: string | null = null;

    while (!imageDescription) {
      // Loop in 1s intervals until the image description text is ready
      console.log("polling for result...", endpointUrl);
      let finalResponse = await fetch(endpointUrl, {
        method: "GET",
        headers: {
          Authorization: "Token " + process.env.REPLICATE_API_KEY,
          "Content-Type": "application/json",
        },
      });
      let jsonFinalResponse = await finalResponse.json();

      if (jsonFinalResponse.status === "succeeded") {
        imageDescription = jsonFinalResponse.output;
        callOpenAiAPI(imageDescription);
        break;
      } else if (jsonFinalResponse.status === "failed") {
        break;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

  }

  // Call OpenAI API to get captions from image description text
  async function callOpenAiAPI(imageDescription: string | null) {

    let captionList = null;
    const prompt = `Generate 5 Instagram captions for a photo of ${imageDescription}`;

    const openAIResponse = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: prompt,
      max_tokens: 60,
      n: 1,
      temperature: 0.7
    });

    captionList = JSON.stringify(openAIResponse.data.choices);

    res
    .status(200)
    .json(captionList ? captionList : "Failed to fetch captions");

  }

}
