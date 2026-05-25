import { assistantBackendCorpus } from "../components/FloatingAssistantBackendCorpus";

function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickAnswer(question: string): string | null {
  const q = normalize(question);
  const corpus = assistantBackendCorpus;
  const c = normalize(corpus);

  // Extremely simple grounding heuristic: only answer if question keywords exist in the corpus.
  const mustMatchTokens = [
    "about",
    "mission",
    "vision",
    "pricing",
    "basic",
    "pro",
    "premium",
    "contact",
    "email",
    "mobile",
    "address",
    "how",
    "works",
    "upload",
    "vault",
    "prompts",
    "etb",
  ];

  const hits = mustMatchTokens.filter((t) => q.includes(t) || c.includes(t));
  const atLeastOneRelevant = hits.length > 0;

  // If no relevant tokens appear, refuse.
  if (!atLeastOneRelevant) return null;

  // Provide a deterministic response by selecting relevant sections.
  const lines: string[] = [];
  if (q.includes("about") || q.includes("who") || q.includes("exec")) {
    lines.push(
      "About DocuMind AI:\n- Executive Profile: Kassahun Mulatu • CEO & Founder\n- Mission: empower professionals, researchers, students, and businesses with secure, context-aware AI capable of reading, parsing, and summarizing dense PDF resources in seconds.\n- Vision: become a leading intelligence companion globally for deep knowledge querying with unrestricted semantic context searches and absolute structural analysis.",
    );
  }
  if (
    q.includes("pricing") ||
    q.includes("price") ||
    q.includes("basic") ||
    q.includes("pro") ||
    q.includes("premium") ||
    q.includes("etb") ||
    q.includes("prompts")
  ) {
    lines.push(
      "Pricing:\n- Basic: ETB 100 (1 month access) - access to 50 prompts in total, semantic indexing, grounded citations.\n- Pro: ETB 500 (1 year access) - 600 prompts total (limited monthly), faster processing, interactive PDF processor.\n- Premium: ETB 1000 (lifetime access) - unlimited prompts, multiple PDF uploads, zero latency throttling.",
    );
  }
  if (
    q.includes("contact") ||
    q.includes("email") ||
    q.includes("mobile") ||
    q.includes("address")
  ) {
    lines.push(
      "Contact:\n- Address: Bahir Dar, Ethiopia\n- Email: kmulatu21@gmail.com\n- Mobile: 0915508167",
    );
  }
  if (
    q.includes("how") ||
    q.includes("works") ||
    q.includes("work") ||
    q.includes("upload") ||
    q.includes("vault") ||
    q.includes("document")
  ) {
    lines.push(
      "How it works:\n- Upload PDFs into your Document Vault.\n- Ask questions; answers are grounded in stored PDF snippets.",
    );
  }

  if (lines.length === 0) {
    // If question was relevant but we couldn't categorize, return a concise grounded summary.
    lines.push(
      "I can answer about DocuMind AI using only the website content. Please ask about About, Pricing, Contact, or How it works.",
    );
  }

  return lines.join("\n\n");
}

export function handleStaticQA(question: string): { answer: string } {
  const answer = pickAnswer(question);
  if (!answer) {
    return {
      answer:
        "I could not produce an answer from the website content (insufficient grounded match).",
    };
  }
  return { answer };
}
