import * as agents from "@/server/functions/agents";
import * as calendar from "@/server/functions/calendar";
import * as gmail from "@/server/functions/gmail";
import * as oauth from "@/server/functions/oauth";
import * as demo from "@/server/functions/demo";
import {
  createServerRequestContext,
  runWithServerRequestContext,
} from "@/server/server-fn.runtime";
import { Route as askRoute } from "@/routes/api/ai/ask";
import { Route as copilotRoute } from "@/routes/api/ai/copilot-plan";
import { simulatePlanChange } from "@/server/billing";
import { runScheduledEmailWorker } from "@/server/scheduled-email-worker";

const actions: Record<string, (payload?: { data?: unknown }) => Promise<unknown>> = {
  runCompanyResearch: agents.runCompanyResearch,
  runEmailGenerator: agents.runEmailGenerator,
  runLeadScoring: agents.runLeadScoring,
  runMeetingPrep: agents.runMeetingPrep,
  runMeetingRecap: agents.runMeetingRecap,
  runNextAction: agents.runNextAction,
  runCampaignGenerator: agents.runCampaignGenerator,
  scheduleCampaign: agents.scheduleCampaign,
  runRevenueIntelligence: agents.runRevenueIntelligence,
  runDiscoverDecisionMakers: agents.runDiscoverDecisionMakers,
  calendarListEvents: calendar.calendarListEvents,
  calendarCreateEvent: calendar.calendarCreateEvent,
  calendarUpdateEvent: calendar.calendarUpdateEvent,
  calendarCancelEvent: calendar.calendarCancelEvent,
  calendarAvailability: calendar.calendarAvailability,
  calendarListCalendars: calendar.calendarListCalendars,
  gmailListMessages: gmail.gmailListMessages,
  gmailGetMessage: gmail.gmailGetMessage,
  gmailListLabels: gmail.gmailListLabels,
  gmailListThreads: gmail.gmailListThreads,
  gmailSend: gmail.gmailSend,
  gmailReply: gmail.gmailReply,
  gmailForward: gmail.gmailForward,
  gmailCreateDraft: gmail.gmailCreateDraft,
  gmailMarkRead: gmail.gmailMarkRead,
  gmailTrash: gmail.gmailTrash,
  gmailScheduleSend: gmail.gmailScheduleSend,
  gmailTrackReplies: gmail.gmailTrackReplies,
  startGmailConnect: oauth.startGmailConnect,
  startCalendarConnect: oauth.startCalendarConnect,
  saveAppUserConnection: oauth.saveAppUserConnection,
  disconnectConnector: oauth.disconnectConnector,
  getConnectionStatus: oauth.getConnectionStatus,
  resetDemo: demo.resetDemo,
  generateDemo: demo.generateDemo,
};

export async function dispatchRPC(
  name: string,
  payload: { data?: unknown },
  accessToken: string,
): Promise<unknown> {
  const action = actions[name];
  if (!action) throw new Error("Unknown API operation.");
  const context = await createServerRequestContext(accessToken);
  return runWithServerRequestContext(context, () => action(payload));
}

export async function dispatchAPI(path: string, request: Request): Promise<Response | null> {
  if (path === "/api/ai/ask") return askRoute.server.handlers.POST({ request });
  if (path === "/api/ai/copilot-plan") return copilotRoute.server.handlers.POST({ request });
  if (path === "/api/billing/mock-plan") return simulatePlanChange(request);
  if (path === "/api/cron/scheduled-emails") return runScheduledEmailWorker(request);
  return null;
}
