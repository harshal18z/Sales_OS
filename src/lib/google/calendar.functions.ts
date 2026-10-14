import { callServerFn } from "@/lib/server-fn";
const action = (name: string) => callServerFn<any, any>(name);
export const calendarListEvents = action("calendarListEvents");
export const calendarCreateEvent = action("calendarCreateEvent");
export const calendarUpdateEvent = action("calendarUpdateEvent");
export const calendarCancelEvent = action("calendarCancelEvent");
export const calendarAvailability = action("calendarAvailability");
export const calendarListCalendars = action("calendarListCalendars");
