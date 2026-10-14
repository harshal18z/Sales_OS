import { callServerFn } from "@/lib/server-fn";

export const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
export const GMAIL_CONNECTOR_ID = "google_mail";
export const CALENDAR_CONNECTOR_ID = "google_calendar";
const action = (name: string) => callServerFn<any, any>(name);
export const startGmailConnect = action("startGmailConnect");
export const startCalendarConnect = action("startCalendarConnect");
export const saveAppUserConnection = action("saveAppUserConnection");
export const disconnectConnector = action("disconnectConnector");
export const getConnectionStatus = action("getConnectionStatus");
