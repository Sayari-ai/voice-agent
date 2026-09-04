import type { ChipTone } from "@/components/ui";

export interface ConversationRow {
  id: string;
  time: string;
  customer: string;
  org: string;
  language: string;
  intent: string;
  duration: string;
  outcome: "Resolved" | "Escalated" | "In progress";
}

export const conversations: ConversationRow[] = [
  { id: "C-10482", time: "14:32", customer: "Musa Abdullahi", org: "MTN Nigeria", language: "Hausa", intent: "data_balance_inquiry", duration: "0:46", outcome: "Resolved" },
  { id: "C-10481", time: "14:29", customer: "Amina Bello", org: "First Unity Bank", language: "Hausa", intent: "fraud_report", duration: "0:52", outcome: "Escalated" },
  { id: "C-10480", time: "14:21", customer: "Chiamaka Okafor", org: "First Unity Bank", language: "Igbo", intent: "transfer_limit_increase", duration: "1:38", outcome: "Resolved" },
  { id: "C-10479", time: "14:17", customer: "Tunde Adewale", org: "MTN Nigeria", language: "Yoruba", intent: "bundle_purchase", duration: "1:04", outcome: "Resolved" },
  { id: "C-10478", time: "14:16", customer: "Halima Yusuf", org: "MTN Nigeria", language: "Hausa", intent: "airtime_topup", duration: "0:58", outcome: "Resolved" },
  { id: "C-10477", time: "14:09", customer: "Wanjiku Kamau", org: "Safaricom", language: "Swahili", intent: "sim_swap_request", duration: "2:12", outcome: "Escalated" },
  { id: "C-10476", time: "14:03", customer: "Emeka Nwosu", org: "First Unity Bank", language: "Igbo", intent: "loan_repayment_date", duration: "1:12", outcome: "Resolved" },
  { id: "C-10475", time: "13:58", customer: "Fatima Sani", org: "First Unity Bank", language: "Hausa", intent: "card_block_request", duration: "1:47", outcome: "Resolved" },
  { id: "C-10474", time: "13:54", customer: "Kwame Mensah", org: "MTN Ghana", language: "Twi", intent: "data_balance_inquiry", duration: "0:51", outcome: "Resolved" },
  { id: "C-10473", time: "13:47", customer: "Aisha Mohammed", org: "First Unity Bank", language: "Hausa", intent: "account_statement", duration: "1:21", outcome: "Resolved" },
  { id: "C-10472", time: "13:41", customer: "Oluwaseun Ade", org: "MTN Nigeria", language: "Nigerian Pidgin", intent: "pin_reset", duration: "1:35", outcome: "In progress" },
  { id: "C-10471", time: "13:36", customer: "Grace Otieno", org: "Safaricom", language: "Swahili", intent: "billing_dispute", duration: "2:44", outcome: "Escalated" },
];

export interface LanguageModel {
  name: string;
  code: string;
  version: string;
  status: "Production" | "Beta" | "Training";
  wer: string;
  intentF1: string;
  dialects: string[];
  updated: string;
}

export const languageModels: LanguageModel[] = [
  { name: "Hausa", code: "ha-NG", version: "v3.2", status: "Production", wer: "8.2%", intentF1: "0.94", dialects: ["Kano", "Sokoto", "Zazzau"], updated: "Aug 28, 2026" },
  { name: "Yoruba", code: "yo-NG", version: "v2.9", status: "Production", wer: "9.1%", intentF1: "0.92", dialects: ["Ọyọ", "Lagos", "Ekiti"], updated: "Aug 21, 2026" },
  { name: "Igbo", code: "ig-NG", version: "v2.7", status: "Production", wer: "10.4%", intentF1: "0.90", dialects: ["Owerri", "Onitsha"], updated: "Aug 19, 2026" },
  { name: "Swahili", code: "sw-KE", version: "v3.0", status: "Production", wer: "7.8%", intentF1: "0.93", dialects: ["Coastal", "Nairobi", "Tanzanian"], updated: "Aug 30, 2026" },
  { name: "Nigerian Pidgin", code: "pcm-NG", version: "v2.1", status: "Production", wer: "11.0%", intentF1: "0.89", dialects: ["Lagos", "Warri"], updated: "Aug 12, 2026" },
  { name: "Amharic", code: "am-ET", version: "v1.4", status: "Beta", wer: "14.2%", intentF1: "0.84", dialects: ["Addis Ababa"], updated: "Aug 25, 2026" },
  { name: "Twi", code: "tw-GH", version: "v0.9", status: "Beta", wer: "16.5%", intentF1: "0.81", dialects: ["Asante", "Akuapem"], updated: "Aug 9, 2026" },
  { name: "Zulu", code: "zu-ZA", version: "v1.2", status: "Beta", wer: "13.1%", intentF1: "0.86", dialects: ["KwaZulu-Natal"], updated: "Aug 16, 2026" },
  { name: "Wolof", code: "wo-SN", version: "v0.6", status: "Training", wer: "—", intentF1: "—", dialects: ["Dakar"], updated: "In progress" },
];

export const weeklyCalls = [
  { day: "Mon", calls: 1120 },
  { day: "Tue", calls: 1236 },
  { day: "Wed", calls: 1188 },
  { day: "Thu", calls: 1342 },
  { day: "Fri", calls: 1481 },
  { day: "Sat", calls: 930 },
  { day: "Sun", calls: 842 },
];

export const containmentTrend = [82.1, 83.4, 84.0, 84.8, 85.5, 86.1, 86.9, 87.3];

export const languageShare = [
  { language: "Hausa", share: 42 },
  { language: "Yoruba", share: 23 },
  { language: "Igbo", share: 14 },
  { language: "Swahili", share: 11 },
  { language: "Nigerian Pidgin", share: 6 },
  { language: "Other", share: 4 },
];

export const topIntents = [
  { intent: "data_balance_inquiry", share: 27 },
  { intent: "airtime_topup", share: 18 },
  { intent: "bundle_purchase", share: 14 },
  { intent: "account_statement", share: 11 },
  { intent: "pin_reset", share: 9 },
  { intent: "fraud_report", share: 4 },
];

export const escalationReasons: { reason: string; count: number; tone: ChipTone }[] = [
  { reason: "Fraud / account security", count: 38, tone: "red" },
  { reason: "Low ASR confidence (< 85%)", count: 21, tone: "amber" },
  { reason: "Customer requested a human", count: 17, tone: "amber" },
  { reason: "Unsupported intent", count: 9, tone: "gray" },
];
