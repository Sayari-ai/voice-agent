import type { Metadata } from "next";
import { CustomerAssistant } from "@/components/customer/customer-assistant";

export const metadata: Metadata = {
  title: { absolute: "Afriklang Assistant Customer care in your language" },
  description:
    "Ask for help in Hausa and get answers in seconds. Demo with a simulated enterprise backend.",
};

export default function CustomerPage() {
  return <CustomerAssistant />;
}
