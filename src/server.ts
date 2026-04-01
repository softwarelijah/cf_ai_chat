import { createWorkersAI } from "workers-ai-provider";
import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import {
  streamText,
  convertToModelMessages,
  pruneMessages,
  stepCountIs,
  type ToolSet,
  tool,
} from "ai";
import { z } from "zod";
import { routeAgentRequest } from "agents";

interface Env {
  AI: Ai;
  ChatAgent: DurableObjectNamespace;
}

export class ChatAgent extends AIChatAgent<Env> {
  maxPersistedMessages = 100;

  async onChatMessage(_onFinish: unknown, options?: OnChatMessageOptions) {
    const workersai = createWorkersAI({ binding: this.env.AI });

    const tools: ToolSet = {
      getWeather: tool({
        description:
          "Get the current weather for a given city. Returns temperature and conditions.",
        parameters: z.object({
          city: z.string().describe("The city to get weather for"),
        }),
        execute: async ({ city }) => {
          const conditions = ["Sunny", "Cloudy", "Rainy", "Partly Cloudy", "Windy"];
          const condition = conditions[Math.floor(Math.random() * conditions.length)];
          const temp = Math.floor(Math.random() * 30) + 50;
          return { city, temperature: `${temp}°F`, condition };
        },
      }),

      getUserTimezone: tool({
        description: "Get the user's current timezone from their browser.",
        parameters: z.object({}),
      }),

      calculate: tool({
        description: "Perform a math calculation.",
        parameters: z.object({
          expression: z.string().describe("A math expression like '2 + 2' or '15 * 37'"),
        }),
        execute: async ({ expression }) => {
          try {
            const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, "");
            const result = new Function(`return (${sanitized})`)();
            return { expression, result: String(result) };
          } catch {
            return { expression, error: "Could not evaluate expression" };
          }
        },
      }),

      scheduleTask: tool({
        description:
          "Schedule a task to be executed later. Supports delays like '5 minutes' or specific times.",
        parameters: z.object({
          description: z.string().describe("What the task should do"),
          delayMinutes: z
            .number()
            .describe("How many minutes from now to execute the task"),
        }),
        execute: async ({ description, delayMinutes }) => {
          const executeAt = new Date(Date.now() + delayMinutes * 60 * 1000);
          await this.schedule(executeAt, "onTaskScheduled" as keyof this, {
            description,
          });
          return {
            scheduled: true,
            description,
            executeAt: executeAt.toISOString(),
          };
        },
      }),

      getScheduledTasks: tool({
        description: "List all currently scheduled tasks.",
        parameters: z.object({}),
        execute: async () => {
          const tasks = this.getSchedules();
          return {
            tasks: tasks.map((t) => ({
              id: t.id,
              description: (t.payload as { description: string }).description,
              scheduledFor: t.time,
            })),
          };
        },
      }),

      cancelScheduledTask: tool({
        description: "Cancel a scheduled task by its ID.",
        parameters: z.object({
          taskId: z.string().describe("The ID of the task to cancel"),
        }),
        execute: async ({ taskId }) => {
          await this.cancelSchedule(taskId);
          return { cancelled: true, taskId };
        },
      }),
    };

    const result = streamText({
      model: workersai("@cf/meta/llama-4-scout-17b-16e-instruct"),
      system:
        "You are a friendly, helpful AI assistant. You have access to tools and should use them proactively. " +
        "When a user asks about the weather, use the getWeather tool (ask them which city if they don't specify). " +
        "When they ask you to calculate something, use the calculate tool. " +
        "When they want to schedule a reminder, use the scheduleTask tool. " +
        "Keep responses concise and conversational.",
      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages),
      }),
      tools,
      stopWhen: stepCountIs(5),
      abortSignal: options?.abortSignal,
    });

    return result.toUIMessageStreamResponse();
  }

  async onTaskScheduled(payload: unknown) {
    const data = payload as { description: string };
    this.setState({
      ...this.state,
      lastNotification: {
        type: "scheduled-task",
        message: `Scheduled task completed: ${data.description}`,
        timestamp: new Date().toISOString(),
      },
    } as Record<string, unknown>);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await routeAgentRequest(request, env);
    if (response) return response;
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
