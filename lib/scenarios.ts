export type Risk = "low" | "high";

export interface Scenario {
  id: "balance" | "fraud";
  vertical: string;
  caller: {
    name: string;
    msisdn: string;
    org: string;
    customerId: string;
    segment: string;
  };
  customer: { hausa: string; english: string };
  language: { name: string; code: string; confidence: number };
  intent: {
    id: string;
    label: string;
    confidence: number;
    risk: Risk;
    rationale: string;
  };
  api: {
    system: string;
    tool: string;
    method: string;
    endpoint: string;
    blocked: boolean;
    responseBody?: Record<string, unknown>;
    policyNote?: string;
    handoff?: { queue: string; sla: string; context: string[] };
  };
  agent: { hausa: string; english: string };
  impact: { label: string; value: string; sub?: string }[];
}

export const scenarios: Record<"balance" | "fraud", Scenario> = {
  balance: {
    id: "balance",
    vertical: "Telco",
    caller: {
      name: "Musa Abdullahi",
      msisdn: "+234 803 ••• 4417",
      org: "MTN Nigeria (Sandbox)",
      customerId: "CUS-88291",
      segment: "Prepaid · Gold tier",
    },
    customer: {
      hausa: "Sannu, ina son sanin sauran data da ya rage a layina.",
      english: "Hello, I would like to know how much data is left on my line.",
    },
    language: { name: "Hausa", code: "ha-NG", confidence: 96.4 },
    intent: {
      id: "data_balance_inquiry",
      label: "Data balance inquiry",
      confidence: 94.1,
      risk: "low",
      rationale: "Read-only account query. Eligible for autonomous resolution.",
    },
    api: {
      system: "Telco Core BSS Simulated",
      tool: "get_data_balance",
      method: "GET",
      endpoint: "/v1/customers/CUS-88291/data-balance",
      blocked: false,
      responseBody: {
        msisdn: "+2348030004417",
        bundle: "SmartData 10GB Monthly",
        remaining_gb: 2.4,
        expires_at: "2026-09-12",
        auto_renew: true,
      },
    },
    agent: {
      hausa:
        "Na duba maka yanzu. Saura gigabyte 2.4 a cikin bundle ɗinka, kuma zai ƙare ranar 12 ga Satumba. Akwai wani abu da zan iya taimaka?",
      english:
        "I have checked for you. You have 2.4 GB left in your bundle, and it expires on 12 September. Is there anything else I can help with?",
    },
    impact: [
      { label: "Handle time", value: "46s", sub: "vs 6m 20s human average" },
      { label: "Cost per call", value: "$0.07", sub: "vs $4.10 human-handled" },
      { label: "Containment", value: "Autonomous", sub: "No human minutes used" },
      { label: "Predicted CSAT", value: "4.7 / 5", sub: "Post-call survey model" },
    ],
  },
  fraud: {
    id: "fraud",
    vertical: "Banking",
    caller: {
      name: "Amina Bello",
      msisdn: "+234 705 ••• 8830",
      org: "First Unity Bank (Sandbox)",
      customerId: "CUS-40817",
      segment: "Savings · Verified KYC",
    },
    customer: {
      hausa:
        "Don Allah, ina tsammanin an cire kuɗi daga asusuna ba tare da sanina ba. Ina bukatar taimako cikin gaggawa.",
      english:
        "Please, I think money has been taken from my account without my knowledge. I need help urgently.",
    },
    language: { name: "Hausa", code: "ha-NG", confidence: 95.8 },
    intent: {
      id: "fraud_report",
      label: "Suspected fraud report",
      confidence: 91.7,
      risk: "high",
      rationale: "Account-security intent. Policy requires immediate human handling.",
    },
    api: {
      system: "Bank Fraud Desk Simulated",
      tool: "escalate_to_human",
      method: "POST",
      endpoint: "/v1/cases/fraud-report",
      blocked: true,
      policyNote:
        "Guardrail: high-risk intents (fraud, account security, legal) are never resolved autonomously. No account action was taken by the AI.",
      handoff: {
        queue: "Fraud & Security · Priority",
        sla: "Human pickup SLA: under 60 seconds",
        context: [
          "Full transcript Hausa + English",
          "Detected intent & confidence scores",
          "Caller identity & account flags",
          "Provisional case ID FRD-2214",
        ],
      },
    },
    agent: {
      hausa:
        "Na fahimci damuwarka, wannan lamari ne mai muhimmanci. Domin kare asusunka, zan tura kiran nan ga jami’in tsaro nan take. Ka riƙe layin, don Allah.",
      english:
        "I understand your concern this is a serious matter. To protect your account, I am transferring this call to a human security officer right away. Please hold the line.",
    },
    impact: [
      { label: "Time to handoff", value: "28s", sub: "Priority queue SLA < 60s" },
      { label: "Context transferred", value: "100%", sub: "Transcript, intent, identity" },
      { label: "Risk handled", value: "Safely", sub: "No autonomous action taken" },
      { label: "Audit trail", value: "Recorded", sub: "Full compliance log" },
    ],
  },
};
