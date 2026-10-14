import { callServerFn } from "@/lib/server-fn";
const action = (name: string) => callServerFn<any, any>(name);
export const resetDemo = action("resetDemo");
export const generateDemo = action("generateDemo");
