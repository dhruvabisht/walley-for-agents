import { runAgent, type ChatMessage } from "@/lib/agent";
import { errorResponse } from "@/lib/http";

export const maxDuration = 60;

// Chat with the shopping agent. The client sends the whole conversation back each turn.
export async function POST(req: Request) {
  try {
    const { messages } = (await req.json()) as { messages: ChatMessage[] };
    const origin = new URL(req.url).origin;
    return Response.json(await runAgent(messages.slice(-30), origin));
  } catch (e) {
    return errorResponse(e);
  }
}
