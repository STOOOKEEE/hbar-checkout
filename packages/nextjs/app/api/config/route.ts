import { readToken } from "@hbar-checkout/checkout";
import { getConfig, errorResponse } from "@/lib/server";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const config = getConfig(new URL(request.url).searchParams.get("network"));
    const token = await readToken(config);
    return Response.json({ config, token });
  } catch (error) {
    return errorResponse(error);
  }
}
