import type { Metadata } from "next";
import { LiveAgentConsole } from "@/components/live/live-agent-console";

export const metadata: Metadata = { title: "Live Agent" };

export default function LiveAgentPage() {
  return <LiveAgentConsole />;
}
