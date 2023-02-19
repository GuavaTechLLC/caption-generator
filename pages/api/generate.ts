import { Ratelimit } from "@upstash/ratelimit";
import type { NextApiRequest, NextApiResponse } from "next";
import requestIp from "request-ip";
import redis from "../../utils/redis";

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
  // POST request to Replicate to start the image restoration generation process
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


  // if (response.status !== 201) {
  //   let error = await response.json();
  //   // res.statusCode = 500;
  //   // res.end(JSON.stringify({ detail: error.detail }));
  //   return error;
  // }

  if (endpointUrl) {
    const finalResponse = await fetch(
      endpointUrl,
      {
        headers: {
          Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
    // if (finalResponse.status !== 200) {
    //   let error = await finalResponse.json();
    //   // res.statusCode = 500;
    //   // res.end(JSON.stringify({ detail: error.detail }));
    //   return error;
    // }
  
    const descriptionResult = await finalResponse.json();
    console.log('IS IT HERE:', descriptionResult)
    res.end(JSON.stringify(descriptionResult));
  }

  // const prediction = await response.json();
  // res.statusCode = 201;
  // console.log(JSON.stringify(prediction))
  // res.end(JSON.stringify(prediction));


  // GET request to get the status of the image restoration process & return the result when it's ready
  // let restoredImage: string | null = null;
  // while (!restoredImage) {
  //   // Loop in 1s intervals until the alt text is ready
  //   console.log("polling for result...", endpointUrl);
  //   let finalResponse = await fetch(endpointUrl, {
  //     method: "GET",
  //     headers: {
  //       "Content-Type": "application/json",
  //       Authorization: "Token " + process.env.REPLICATE_API_KEY,
  //     },
  //   });
  //   let jsonFinalResponse = await finalResponse.json();

  //   if (jsonFinalResponse.status === "succeeded") {
  //     console.log('SUCCESS', jsonFinalResponse)
  //     // restoredImage = jsonFinalResponse.output;
  //   } else if (jsonFinalResponse.status === "failed") {
  //     break;
  //   } else {
  //     await new Promise((resolve) => setTimeout(resolve, 1000));
  //   }
  // }
  // res
  //   .status(200)
  //   .json(restoredImage ? restoredImage : "Failed to restore image");
}
