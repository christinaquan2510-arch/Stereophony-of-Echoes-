// 古今回响 · server function
// Holds the Kimi API key (never sent to the browser), builds the prompt from the project files,
// and streams the table's reply back as plain text (one JSON object per line).
// Nothing the visitor writes is stored or logged here.

import { PROMPTS } from "./_prompts.js";

export const config = { runtime: "edge" };

const GUESTS = {
  woolf: "Virginia Woolf",
  plato: "Plato",
  sushi: "Su Shi (苏轼)",
  freud: "Sigmund Freud",
  leonardo: "Leonardo da Vinci",
  einstein: "Albert Einstein",
  dickinson: "Emily Dickinson",
};

const LIMITS = {
  questionChars: 1000,
  historyTurns: 40,
  historyChars: 12000, // older turns beyond this are dropped from what the model sees
  maxTokens: 4000,
};

const LANG_RULE = {
  auto: "Reply in the language of the visitor's latest message. If it is Chinese, everyone speaks Chinese, each still in their own voice.",
  zh: "Everyone speaks Simplified Chinese, whatever language the visitor used. Figures who wrote in other languages speak as they would in a fine Chinese translation of their own voice, keeping their own manner; quote their own words only if confident, otherwise paraphrase.",
  en: "Everyone speaks English, whatever language the visitor used. 苏轼 may quote a line of his own in Chinese with a brief English gloss.",
};

function buildSystem(seated, lang = "auto") {
  const solo = seated.length === 1;
  const guestCards = seated
    .map((k) => `### GUEST: ${GUESTS[k]}\n${PROMPTS.CARDS[k]}`)
    .join("\n\n");

  return `You are staging 古今回响 (Stereophony of Echoes): dead historical figures around a table respond to a living visitor. Write the next round of the exchange.

READ FIRST: WHY THIS TABLE EXISTS
${PROMPTS.FOUNDING}

TABLE RULES (for every figure, including the host)
${PROMPTS.TABLE_RULES}

HOST: Roland Barthes
${PROMPTS.HOST}

GUESTS AT THE TABLE TONIGHT
${guestCards}

STAGING
- Only the host and the guests listed above may speak. No one else.
- Address only the seated guests and the visitor. Never call on, quote or ask a question of anyone who is not seated, even if an example elsewhere in these instructions uses that person (the worked examples show principles, not scripts).
- The host's opening must hand the question to a seated guest by name, and every round must include each seated guest's answer. Never end the round after the host alone.
- ${solo ? "There is one guest. The host may press them once, and the guest replies." : "After each guest's first answer, at least two turns must reply directly to another guest by name, and disagree where their real views clash."}
- ${solo ? "4 to 6 turns in total." : "7 to 10 turns in total."} The host opens briefly and closes briefly. Guest turns are usually 2 to 4 sentences; a reflective turn may run longer.
- At most ONE guest asks the visitor a question in a round (the host's closing may also ask one). The other guests answer, argue or offer; they do not also turn the question back. Never let two guests ask the visitor the same or a similar question.
- Each turn is in ONE language from start to finish. Do not switch languages inside a turn, except a short quotation of a figure's own words in the original, immediately followed by a gloss in the turn's language.
- If this is a continuing conversation, build on what has already been said, use what the visitor has told you, and do not repeat earlier lines or images.
- ${LANG_RULE[lang]}
- If the bottom line's danger tier applies, ignore the turn counts: the host (or "The table") speaks plainly, warmly and briefly to the real person.

OUTPUT FORMAT (always, including in the danger tier)
One JSON object per line, nothing else, no code fences, no commentary:
{"speaker":"<exact name: Roland Barthes, ${seated.map((k) => GUESTS[k].split(" (")[0]).join(", ")}, or The table>","to":"<name addressed, or Visitor>","text":"<what they say>"}`;
}

function buildUser(history, question, cont) {
  let transcript = "";
  // Keep the most recent part of the conversation within the character budget.
  for (let i = history.length - 1; i >= 0; i--) {
    const t = history[i];
    const line =
      t.role === "visitor"
        ? `VISITOR: ${t.text}\n`
        : `${t.speaker}${t.to ? " → " + t.to : ""}: ${t.text}\n`;
    if (transcript.length + line.length > LIMITS.historyChars) break;
    transcript = line + transcript;
  }
  if (cont) {
    // The previous reply stopped after the host alone. Ask for the rest of the same round.
    return `CONVERSATION SO FAR\n${transcript}\n` +
      `The round above stopped too early: no guest has answered the visitor's latest message yet. ` +
      `Continue the same round from where it stopped. Do not repeat or rewrite the lines already given. ` +
      `If the host called on someone who is not seated, the host briefly turns instead to a seated guest. ` +
      `Then the seated guests answer and reply to each other, and the host closes briefly.`;
  }
  return (transcript ? `CONVERSATION SO FAR\n${transcript}\n` : "") +
    `THE VISITOR NOW SAYS\n${question}`;
}

function bad(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default async function handler(req) {
  if (req.method !== "POST") return bad(405, "Use POST.");

  const required = process.env.ACCESS_CODE;
  if (required && req.headers.get("x-access-code") !== required) {
    return bad(401, "Access code needed.");
  }
  if (!process.env.MOONSHOT_API_KEY) return bad(500, "Server is missing its API key.");

  let body;
  try {
    body = await req.json();
  } catch {
    return bad(400, "Bad request.");
  }

  const question = String(body.question || "").trim().slice(0, LIMITS.questionChars);
  const seated = Array.isArray(body.seated)
    ? [...new Set(body.seated)].filter((k) => k in GUESTS).slice(0, 4)
    : [];
  const history = (Array.isArray(body.history) ? body.history : [])
    .slice(-LIMITS.historyTurns)
    .map((t) => ({
      role: t.role === "visitor" ? "visitor" : "table",
      speaker: String(t.speaker || "").slice(0, 60),
      to: String(t.to || "").slice(0, 60),
      text: String(t.text || "").slice(0, 2000),
    }));

  const lang = ["auto", "zh", "en"].includes(body.lang) ? body.lang : "auto";
  if (!question) return bad(400, "Ask the table something.");
  if (!seated.length) return bad(400, "Seat at least one guest.");

  const base = (process.env.MOONSHOT_BASE_URL || "https://api.moonshot.cn/v1").replace(/\/$/, "");
  const upstream = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.MOONSHOT_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.MOONSHOT_MODEL || "kimi-k2.6",
      stream: true,
      max_tokens: LIMITS.maxTokens,
      // Kimi K2.6 thinks privately before answering by default; that thinking can use up the
      // whole reply budget and leave no answer. The table needs speech, not hidden reasoning.
      ...(process.env.MOONSHOT_THINKING === "on" ? {} : { thinking: { type: "disabled" } }),
      messages: [
        { role: "system", content: buildSystem(seated, lang) },
        { role: "user", content: buildUser(history, question, body.cont === true && history.length > 0) },
      ],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    // Log only the status and provider message, never the visitor's words.
    console.error("Kimi error", upstream.status, detail.slice(0, 300));
    const msg =
      upstream.status === 401 ? "The server's Kimi key was rejected."
      : upstream.status === 429 ? "The table is busy or the Kimi balance has run out. Try again shortly."
      : "The table could not be reached.";
    return bad(502, msg);
  }

  // Turn Kimi's server-sent events into a plain stream of the model's text.
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n");
          buffer = events.pop();
          for (const ev of events) {
            const line = ev.trim();
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const piece = JSON.parse(data).choices?.[0]?.delta?.content;
              if (piece) controller.enqueue(encoder.encode(piece));
            } catch { /* ignore keep-alives and partial events */ }
          }
        }
      } catch (e) {
        console.error("Stream interrupted", String(e).slice(0, 200));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
