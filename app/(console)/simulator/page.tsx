import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { CustomerSimulator } from "@/components/console/customer-simulator";

export const metadata: Metadata = { title: "Customer Simulator" };

export default function SimulatorPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Customer Simulator"
        subtitle="Play the customer: speak Wolof and the agent listens, reasons and answers back with voice live on the Afriklang speech models."
      />
      <CustomerSimulator />
    </div>
  );
}
