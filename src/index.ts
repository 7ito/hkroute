import { getDirections } from "./directions.js";
import { formatRoutes } from "./formatter.js";
import type { ErrorOutput } from "./types.js";

function parseArgs(args: string[]): {
  origin: string | null;
  destination: string | null;
  departureTime: string | null;
} {
  const result: { origin: string | null; destination: string | null; departureTime: string | null } = {
    origin: null,
    destination: null,
    departureTime: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--origin" && i + 1 < args.length) {
      result.origin = args[++i];
    } else if (arg === "--destination" && i + 1 < args.length) {
      result.destination = args[++i];
    } else if (arg === "--departure-time" && i + 1 < args.length) {
      result.departureTime = args[++i];
    }
  }

  return result;
}

function exitWithError(code: ErrorOutput["code"], message: string): never {
  const output: ErrorOutput = { error: true, code, message };
  console.log(JSON.stringify(output, null, 2));
  return process.exit(1) as never;
}

async function main() {
  const { origin, destination, departureTime } = parseArgs(process.argv.slice(2));

  if (!origin || !destination) {
    return exitWithError("INVALID_INPUT", "Both --origin and --destination are required.");
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return exitWithError("INVALID_INPUT", "GOOGLE_MAPS_API_KEY environment variable is not set.");
  }

  let departureDate: Date | undefined;
  if (departureTime) {
    departureDate = new Date(departureTime);
    if (isNaN(departureDate.getTime())) {
      return exitWithError("INVALID_INPUT", `Invalid departure time: "${departureTime}". Use ISO 8601 format.`);
    }
  }

  try {
    const routes = await getDirections(origin, destination, apiKey, departureDate);
    const output = formatRoutes(routes, origin, destination);
    console.log(JSON.stringify(output, null, 2));

    if (output.error) {
      process.exit(1);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    exitWithError("GOOGLE_API_ERROR", message);
  }
}

main();
