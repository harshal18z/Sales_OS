import { callServerFn } from "@/lib/server-fn";

const action = (name: string) => callServerFn<any, any>(name);
export const runCompanyResearch = action("runCompanyResearch");
export const runEmailGenerator = action("runEmailGenerator");
export const runLeadScoring = action("runLeadScoring");
export const runMeetingPrep = action("runMeetingPrep");
export const runMeetingRecap = action("runMeetingRecap");
export const runNextAction = action("runNextAction");
export const runCampaignGenerator = action("runCampaignGenerator");
export const scheduleCampaign = action("scheduleCampaign");
export const runRevenueIntelligence = action("runRevenueIntelligence");
export const runDiscoverDecisionMakers = action("runDiscoverDecisionMakers");
