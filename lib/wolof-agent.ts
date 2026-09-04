export type IntentId =
  | "greeting"
  | "data_balance"
  | "fraud_report"
  | "human_handoff"
  | "thanks"
  | "unknown";

export interface AgentDecision {
  intent: IntentId;
  label: string;
  risk: "low" | "high";
  reply: { wolof: string; english: string };
  card?: "balance" | "handoff";
  handoff?: { queue: string; sla: string; caseId?: string };
  endsCall: boolean;
}

export const OPENING = {
  wolof: "Asalaa maalekum, dalal ak jàmm ci Afriklang! Naka laa la mën a dimbali tay?",
  english: "Peace be with you, welcome to Afriklang! How can I help you today?",
};

export const BALANCE_DATA = {
  bundle: "SmartData 10GB Monthly",
  remainingGb: 2.4,
  expires: "12 September 2026",
  autoRenew: true,
};

const DECISIONS: Record<IntentId, AgentDecision> = {
  greeting: {
    intent: "greeting",
    label: "Greeting",
    risk: "low",
    reply: {
      wolof: "Dalal ak jàmm! Nu ngi fi ngir dimbali la. Lan nga soxla tay?",
      english: "Welcome! We are here to help you. What do you need today?",
    },
    endsCall: false,
  },
  data_balance: {
    intent: "data_balance",
    label: "Data balance inquiry",
    risk: "low",
    reply: {
      wolof:
        "Waaw, seet naa ko. Dess na la 2.4 GB ci sa bundle, mu jeex 12 septembar. Ndax am na leneen?",
      english:
        "Yes, I checked. You have 2.4 GB left in your bundle, expiring 12 September. Anything else?",
    },
    card: "balance",
    endsCall: false,
  },
  fraud_report: {
    intent: "fraud_report",
    label: "Fraud report",
    risk: "high",
    reply: {
      wolof:
        "Dégg naa la, bul tiit. Dinaa la jokkale ak sunu ekipu kaaraange léegi. Xaaral tuuti, jërëjëf.",
      english:
        "I hear you, don't worry. I am connecting you to our security team right now. Please hold, thank you.",
    },
    card: "handoff",
    handoff: { queue: "Fraud & Security Desk", sla: "Under 60 seconds", caseId: "FRD-2214" },
    endsCall: true,
  },
  human_handoff: {
    intent: "human_handoff",
    label: "Human agent request",
    risk: "low",
    reply: {
      wolof: "Amul solo. Dinaa la jokkale ak nit léegi, xaaral tuuti.",
      english: "No problem. I am connecting you to a human agent now, one moment.",
    },
    card: "handoff",
    handoff: { queue: "Customer Care · Priority", sla: "Under 60 seconds" },
    endsCall: true,
  },
  thanks: {
    intent: "thanks",
    label: "Thanks / goodbye",
    risk: "low",
    reply: {
      wolof: "Amul solo! Jërëjëf ci sa woote. Ba beneen yoon!",
      english: "You're welcome! Thank you for your call. Until next time!",
    },
    endsCall: true,
  },
  unknown: {
    intent: "unknown",
    label: "Not understood",
    risk: "low",
    reply: {
      wolof: "Baal ma, dégguma bu baax. Waxaat ko benn yoon, su la neexee.",
      english: "Sorry, I didn't understand well. Please say it once more.",
    },
    endsCall: false,
  },
};

// Order matters: high-risk and explicit requests win over generic matches.
const RULES: [IntentId, RegExp][] = [
  ["fraud_report", /xaalis|s[àa]cc|fraud|j[ëe]l|wor\b|vol[ée]?/i],
  ["human_handoff", /\bnit\b|agent|human|jokkale|operat/i],
  ["data_balance", /data|internet|giga|\bgb\b|solde|balance|\bdes+\b|bundle/i],
  ["thanks", /j[ëe]r[ëe]j[ëe]f|merci|thank|ba beneen/i],
  ["greeting", /salaa?m|asalaa|j[àa]mm|naka|dalal|hello|bonjour/i],
];

export function decide(transcript: string): AgentDecision {
  for (const [intent, re] of RULES) {
    if (re.test(transcript)) return DECISIONS[intent];
  }
  return DECISIONS.unknown;
}
