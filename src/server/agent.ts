import { db, TaskStatus, ResearchTask } from "./db";
import { GoogleGenAI, Type } from "@google/genai";
import { search } from "duck-duck-scrape";
import { sendTaskEmail } from "./mailer";

let aiClient: GoogleGenAI | null = null;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

function isCancelled(taskId: number): boolean {
  const current = db.getTask(taskId);
  return !current || current.status === TaskStatus.CANCELLED;
}

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY environment variable is not set. Please supply it in Settings > Secrets."
      );
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

function mergeSources(newSources: Array<{ title: string; url: string }>, existingSourcesJson: string | null | undefined): string {
  const sourcesList: Array<{ title: string; url: string }> = [];
  if (existingSourcesJson) {
    try {
      sourcesList.push(...JSON.parse(existingSourcesJson));
    } catch (e) {
      console.error("Error parsing existing sources:", e);
    }
  }

  for (const s of newSources) {
    if (s.url) {
      const url = s.url;
      const title = s.title || "Web Source";
      if (!sourcesList.some((existing) => existing.url === url)) {
        sourcesList.push({ title, url });
      }
    }
  }

  return JSON.stringify(sourcesList);
}

function cleanAndParseJson(text: string): any {
  let cleaned = text.trim();
  // Remove markdown code blocks (e.g., ```json ... ```) if present
  if (cleaned.startsWith("```")) {
    const lines = cleaned.split("\n");
    const nonCodeBlockLines = lines.filter(line => !line.trim().startsWith("```"));
    cleaned = nonCodeBlockLines.join("\n").trim();
  }
  return JSON.parse(cleaned);
}

async function stepSearch(task: ResearchTask): Promise<boolean> {
  if (task.search_results) {
    return true; // Idempotently skip if search results are already present
  }

  if (isCancelled(task.id)) return false;

  try {
    db.updateTask(task.id, {
      status: TaskStatus.SEARCHING,
      current_step: "searching",
      error_message: null,
    });

    const isArticle = task.task_type === "article";
    let prompt = "";

    if (isArticle) {
      const numSections = task.num_pages ? (task.num_pages >= 10 ? 10 : (task.num_pages >= 5 ? 7 : 5)) : 5;
      prompt = `You are an elite research journalist and professional technical writer. We are initializing a highly detailed, comprehensive article about the topic: "${task.topic}".
Please search the web for the latest deep dives, expert insights, and accurate factual information on this topic.
Based on your search, generate an outline consisting of exactly ${numSections} sequential, cohesive sections or chapters for the detailed article to span the target length.
Format your output as a raw JSON array of strings, for example:
[
  "Section 1: Introduction to [Topic] - Context, history, and importance",
  "Section 2: Core mechanics and how [Topic] works under the hood",
  "Section 3: Key trends, challenges, and real-world implications",
  "Section 4: Expert case studies, architectural blueprints, or practical examples",
  "Section 5: The future of [Topic] - Upcoming milestones and closing summary"
]
Do not add markdown formatting or explanation outside the JSON.`;
    } else {
      let durationText = "go from absolute beginner to expert/production-ready master";
      if (task.duration === "1_week") {
        durationText = "be completed in a 1-Week Crash Course (high intensity, focused on rapid absorption and core essentials)";
      } else if (task.duration === "4_weeks") {
        durationText = "be completed in a 4-Week Intensive syllabus (practical, hands-on, building confidence)";
      } else if (task.duration === "12_weeks") {
        durationText = "be completed in a 12-Week Full Masterclass (comprehensive deep-dive, building advanced enterprise skills)";
      }

      let focusText = "best tutorials, official documentation standards, and ideal progressive learning pathways";
      if (task.focus === "technical") {
        focusText = "expert code repositories, professional development standards, language specifications, and advanced technical/code-heavy architectures";
      } else if (task.focus === "practical") {
        focusText = "step-by-step practical builders, hands-on tutorials, interactive projects, and practical real-world exercises";
      } else if (task.focus === "theoretical") {
        focusText = "foundational concepts, academic textbooks, structural theories, and theoretical methodologies";
      }

      prompt = `You are an elite curriculum designer and learning planner. We are initializing a step-by-step masterclass learning roadmap for the topic: "${task.topic}"
Please search the web for the latest educational curricula, ${focusText} for this topic.
Based on your search, generate 5 sequential, chronologically-ordered learning phases or modules designed to ${durationText}.
Format your output as a raw JSON array of strings, for example:
[
  "Phase 1: Foundations of [Topic] - Core concepts and environment setup",
  "Phase 2: Core syntax, basic mechanics, and essential patterns",
  "Phase 3: Intermediate concepts, database integration, and building real-world projects",
  "Phase 4: Advanced state management, architectural patterns, and performance optimization",
  "Phase 5: Expert-level deployment, security best practices, and production-ready monitoring"
]
Do not add markdown formatting or explanation outside the JSON.`;
    }

    if (isCancelled(task.id)) return false;

    let ddgResults: any[] = [];
    try {
      const ddgRes = await withTimeout(search(task.topic), 4000, { results: [], noResults: true, vqd: "" });
      ddgResults = ddgRes.results || [];
    } catch (searchErr) {
      console.warn("DuckDuckGo search failed in outline step (using fallback):", searchErr);
    }

    if (isCancelled(task.id)) return false;

    const searchContext = ddgResults.length > 0
      ? ddgResults
          .slice(0, 10)
          .map((r, i) => `Result #${i + 1}:\nTitle: ${r.title}\nURL: ${r.url}\nDescription: ${r.description}`)
          .join("\n\n")
      : "No live web search results are available at the moment. Please rely entirely on your pre-trained knowledge base to craft the most logical and accurate outline possible.";

    const enhancedPrompt = `${prompt}\n\nHere are some live DuckDuckGo web search results for reference to help construct an accurate outline:\n\n${searchContext}`;

    const ai = getAiClient();

    if (isCancelled(task.id)) return false;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: enhancedPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
        },
      },
    });

    if (isCancelled(task.id)) return false;

    const text = response.text || "[]";
    const parsed = cleanAndParseJson(text);
    if (!Array.isArray(parsed)) {
      throw new Error("Output was not a valid JSON array.");
    }

    const newSources = ddgResults.slice(0, 5).map((r) => ({ title: r.title, url: r.url }));
    const mergedSources = mergeSources(newSources, task.sources);

    if (isCancelled(task.id)) return false;

    db.updateTask(task.id, {
      search_results: JSON.stringify(parsed),
      sources: mergedSources,
      current_step: "search_complete",
    });
    return true;
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    db.updateTask(task.id, {
      status: TaskStatus.FAILED,
      error_message: `Search step failed: ${errorMsg}`,
      current_step: "search_failed",
      retry_count: task.retry_count + 1,
    });
    return false;
  }
}

async function stepExtract(task: ResearchTask): Promise<boolean> {
  if (task.extracted_data) {
    return true; // Already done
  }

  if (isCancelled(task.id)) return false;

  const currentTask = db.getTask(task.id);
  if (!currentTask || !currentTask.search_results) {
    db.updateTask(task.id, {
      status: TaskStatus.FAILED,
      error_message: "Cannot extract - search results missing.",
      current_step: "extract_failed",
    });
    return false;
  }

  try {
    db.updateTask(task.id, {
      status: TaskStatus.EXTRACTING,
      current_step: "extracting",
      error_message: null,
    });

    const angles: string[] = JSON.parse(currentTask.search_results);
    const anglesText = angles.map((a) => `- ${a}`).join("\n");

    const isArticle = task.task_type === "article";
    let prompt = "";

    if (isArticle) {
      prompt = `You are a world-class investigative journalist, chief research analyst, and expert AI search intelligence assistant. We are drafting high-value research findings and deep-dive sections for our comprehensive article on: "${task.topic}".

Sequential article sections identified:
${anglesText}

For each of these ${angles.length} sections, thoroughly analyze the provided search results to gather the absolute best, highest-value, and most valuable factual insights. Avoid high-level generic summaries; instead, search for and extract specific statistics, exact numbers, concrete real-world case studies, architectural specifications, technical/business breakthroughs, and expert frameworks.
For each section, construct the "findings" field to look exactly like an elite research analyst's ground-truth briefing. It MUST follow this specific markdown structure:

### 🔍 Search Query & Key Takeaways
- **Search Query**: [Provide a highly-specific, precise search query relevant to this section]
- [4-5 extremely detailed, high-impact bullet points packed with the most valuable facts, specific metrics, trade-offs, real-world examples, and expert insights discovered from your deep web search]

### 💡 Answer & Analysis
[Provide an authoritative, deeply synthesized, and high-density technical/professional answer and analysis of this section's core topic (2-3 substantial paragraphs, 200-300 words). Incorporate precise terminology, actionable insights, and robust logic to ensure it serves as the definitive reference on the subject]

CRITICAL REQUIREMENT:
- Every single URL must be active, real, and related. Do NOT invent deep links. Prefer official domain roots or major credible resources.

Format your response as a raw JSON array of objects, where each object has "angle" (matching the section string exactly), "findings" (the structured findings containing the markdown sections above), and "resources" (an array of resource objects containing "title", "url", "type", and "description").

Example format:
[
  {
    "angle": "Section 1: Introduction to...",
    "findings": "### 🔍 Search Query & Key Takeaways\\n- **Search Query**: quantum computing cryptography standard\\n- Found that NIST finalized three post-quantum algorithms.\\n- Found that RSA-2048 is projected to be vulnerable by 2030.\\n\\n### 💡 Answer & Analysis\\nQuantum computing poses a paradigm shift in our cryptographic frameworks. Transitioning to lattice-based schemes is critical...",
    "resources": [
      {
        "title": "NIST Post-Quantum Cryptography",
        "url": "https://www.nist.gov",
        "type": "website",
        "description": "NIST's official page on post-quantum cryptography standards and algorithms."
      }
    ]
  }
]
Do not add any explanations or text outside the JSON.`;
    } else {
      prompt = `You are an elite educational architect and world-class developer relations engineer creating the ultimate step-by-step masterclass learning syllabus for the topic: "${task.topic}".

Sequential learning modules identified:
${anglesText}

For each of these 5 sequential modules, design a masterful, highly structured progressive curriculum. You must extract and highlight the absolute best learning roadmap pathway. For each phase, provide:
1. **Core Concept Mastery**: A highly detailed educational guide (3-4 substantial paragraphs, 200-300 words) defining the precise technical concepts, critical core fundamentals, step-by-step execution path, and key skills to focus on in this phase to achieve deep expertise.
2. **Actionable Hands-on Projects**: 2 concrete, extremely practical hands-on exercises or coding assignments the learner should build to apply these concepts in practice.

Search the web to find 2-3 of the absolute best, most highly-rated, active, and official educational resources to support this learning.
These resources must include a mix of:
- Videos/Tutorials (verified YouTube courses, complete playlists, expert masterclasses)
- Websites/Articles (e.g., in-depth guides from Baeldung, dev.to, freeCodeCamp, Medium)
- Official Documentation (official specifications, MDN Web Docs, standard-setting docs, language guides)
- Interactive/Practice (verified GitHub repositories, online interactive coding platforms, playgrounds)

CRITICAL REQUIREMENT FOR VALID RESOURCES & NO HALLUCINATION:
- DO NOT hallucinate, guess, or invent deep links or video URLs. Every single URL provided must be active and valid.
- If suggesting a YouTube video, use an actual verified YouTube video link from your search results, or link to an official playlist or channel page (e.g. "https://www.youtube.com/c/Freecodecamp" or "https://www.youtube.com/user/TechGuyWeb").
- If you cannot find a precise working video ID, link to a live YouTube search query for the specific topic, e.g. "https://www.youtube.com/results?search_query=react+tutorial".
- If suggesting documentation, use the official verified domain root or landing page (e.g. "https://react.dev" or "https://developer.mozilla.org") instead of guessing deep subpaths that might lead to a 404 error.
- Verify every link you output is a legitimate, reputable domain (e.g. github.com, youtube.com, developer.mozilla.org, w3schools.com, nextjs.org).

For each module, provide:
1. The comprehensive structured educational guide and actionable hands-on projects containing markdown headings, bold terms, and neat lists.
2. A list of 2-3 curated, active, high-quality learning resources with real working URLs.

Format your response as a raw JSON array of objects, where each object has "angle" (matching the module string exactly), "findings" (the complete markdown-formatted structured educational guide and hands-on projects description), and "resources" (an array of resource objects containing "title", "url", "type", and "description").

Example format:
[
  {
    "angle": "Phase 1: Foundations...",
    "findings": "### 📚 Core Concept Mastery\\nThis phase introduces you to the essential building blocks...\\n\\n### 🛠️ Actionable Hands-on Projects\\n1. **Mini Web Project**: Build a small indexer...\\n2. **Command Line Tracker**: Code a terminal status utility...",
    "resources": [
      {
        "title": "MDN JavaScript Guide - Getting Started",
        "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
        "type": "documentation",
        "description": "The official beginner guide explaining syntax and developer setup."
      },
      {
        "title": "Learn JavaScript - Full Course for Beginners",
        "url": "https://www.youtube.com/watch?v=PkZNo7MFNFg",
        "type": "video",
        "description": "An excellent comprehensive video course covering variables, functions, and control flow."
      }
    ]
  }
]
Do not add any explanations or text outside the JSON.`;
    }

    if (isCancelled(task.id)) return false;

    let ddgResults: any[] = [];
    try {
      const searchRes = await withTimeout(search(task.topic), 4000, { results: [], noResults: true, vqd: "" });
      ddgResults = searchRes.results || [];
    } catch (err) {
      console.warn("DuckDuckGo search failed in research step (using fallback):", err);
    }

    if (isCancelled(task.id)) return false;

    // Build the search context block for the prompt
    let ddgContextBlock = "Here are live web search results for reference. Use these real URLs and facts for generating your findings and references:\n\n";
    if (ddgResults.length === 0) {
      ddgContextBlock += "No direct search results found. Please rely entirely on your pre-trained knowledge base to craft highly logical, professional, and detailed findings, explanation answers, and simulated reference recommendations.\n";
    } else {
      ddgResults.slice(0, 15).forEach((r, idx) => {
        ddgContextBlock += `[Reference ${idx + 1}]\nTitle: ${r.title}\nURL: ${r.url}\nSnippet: ${r.description}\n\n`;
      });
    }

    const enhancedPrompt = `${prompt}\n\n${ddgContextBlock}`;

    const ai = getAiClient();

    if (isCancelled(task.id)) return false;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: enhancedPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              angle: {
                type: Type.STRING,
                description: "The exact section or phase string from the outline/sequence.",
              },
              findings: {
                type: Type.STRING,
                description: "The complete rich write-up, synthesis findings, or structured analysis for this section (markdown formatted).",
              },
              resources: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: "The resource title." },
                    url: { type: Type.STRING, description: "Active, valid URL." },
                    type: { type: Type.STRING, description: "One of: 'video', 'website', 'documentation', 'article', or 'interactive'." },
                    description: { type: Type.STRING, description: "A brief description of what this resource covers." },
                  },
                  required: ["title", "url", "type", "description"],
                },
              },
            },
            required: ["angle", "findings", "resources"],
          },
        },
      },
    });

    if (isCancelled(task.id)) return false;

    const text = response.text || "[]";
    const parsed = cleanAndParseJson(text);
    if (!Array.isArray(parsed)) {
      throw new Error("Output was not a valid list of findings objects.");
    }

    // Convert to lookup map { [angle]: { findings, resources } } as expected by the React frontend
    const extractedMap: Record<string, any> = {};
    for (const item of parsed) {
      if (item && item.angle) {
        extractedMap[item.angle] = {
          findings: item.findings || "",
          resources: item.resources || [],
        };
      }
    }

    const flatDdgSources: Array<{ title: string; url: string }> = ddgResults.map((r) => ({
      title: r.title || "Web Source",
      url: r.url,
    }));
    const mergedSources = mergeSources(flatDdgSources, currentTask.sources);

    if (isCancelled(task.id)) return false;

    db.updateTask(task.id, {
      extracted_data: JSON.stringify(extractedMap),
      sources: mergedSources,
      current_step: "extract_complete",
    });
    return true;
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    db.updateTask(task.id, {
      status: TaskStatus.FAILED,
      error_message: `Extract step failed: ${errorMsg}`,
      current_step: "extract_failed",
      retry_count: task.retry_count + 1,
    });
    return false;
  }
}

async function stepAwaitApproval(task: ResearchTask): Promise<boolean> {
  db.updateTask(task.id, {
    status: TaskStatus.AWAITING_APPROVAL,
    current_step: "awaiting_approval",
  });
  return true;
}

async function stepSummarize(task: ResearchTask): Promise<boolean> {
  if (task.final_summary) {
    return true;
  }

  if (isCancelled(task.id)) return false;

  const currentTask = db.getTask(task.id);
  if (!currentTask || !currentTask.extracted_data) {
    db.updateTask(task.id, {
      status: TaskStatus.FAILED,
      error_message: "Cannot summarize - extracted data missing.",
      current_step: "summarize_failed",
    });
    return false;
  }

  try {
    db.updateTask(task.id, {
      status: TaskStatus.SUMMARIZING,
      current_step: "summarizing",
      error_message: null,
    });

    const extracted: Record<string, any> = JSON.parse(
      currentTask.extracted_data
    );
    const findingsText = Object.entries(extracted)
      .map(([angle, data]) => {
        const textFindings = typeof data === "object" && data !== null ? data.findings : data;
        return `**${angle}**\n${textFindings}`;
      })
      .join("\n\n");

    const isArticle = task.task_type === "article";
    let prompt = "";

    if (isArticle) {
      const targetPages = task.num_pages || 3;
      let targetWords = "1200-1500 words";
      let structureDetails = "extensive details, multiple sub-headings, and robust analyses of key trends";
      if (targetPages === 1) {
        targetWords = "400-500 words (compact 1-page executive summary)";
        structureDetails = "focused highlights, immediate action items, and highly condensed synthesized paragraphs";
      } else if (targetPages === 2) {
        targetWords = "800-1000 words (focused 2-page detailed brief)";
        structureDetails = "deep paragraphs explaining core concepts, key trade-offs, and clear section dividers";
      } else if (targetPages === 3) {
        targetWords = "1200-1500 words (extensive 3-page standard article)";
        structureDetails = "deeply descriptive sections, sub-headings, fully developed logical paragraphs, and thorough analyses";
      } else if (targetPages === 5) {
        targetWords = "2000-2500 words (in-depth 5-page comprehensive report)";
        structureDetails = "exhaustive breakdown of each section, step-by-step logic, technical descriptions, comparison blocks, and full case-study style narratives";
      } else if (targetPages >= 10) {
        targetWords = "4000-5000 words (highly academic 10-page expert whitepaper)";
        structureDetails = "extremely granular deep dives, comprehensive multi-paragraph treatises for every phase, rich structural layouts, tables or lists representation, and professional whitepaper tone";
      }

      prompt = `You are an elite chief investigative journalist and senior technical editor. Below are the sequential sections, detailed research findings, and reference documents drafted for the topic: "${task.topic}"

${findingsText}

Using these raw section draft findings, write a highly engaging, professional, fully synthesized, and deeply detailed Article targeting exactly ${targetPages} pages of printed PDF content (${targetWords}) on "${task.topic}":
1. Write an elegant, attention-grabbing introduction that sets the stage, introduces the theme, and highlights why this topic matters.
2. Synthesize each of the ${Object.keys(extracted).length} sections seamlessly. Blend the points into beautifully written paragraphs with smooth transitions. Use ${structureDetails} to fully flesh out the content to meet the target page volume.
3. Enhance the prose with clear explanations, expert styling, and relevant examples. For high page counts (like 5 or 10 pages), write extremely long, thoroughly detailed sub-chapters for each section with multiple paragraphs to reach a highly comprehensive publication standard.
4. Conclude with a powerful, forward-looking summary or reflection that leaves the reader with a lasting impression.
5. Do NOT list the curated links in this section—they are displayed separately in the resources sidebar.

Write in a highly polished, professional, publication-ready tone. Use markdown headings, clear paragraphs, and bold focal points to make this a stellar read!`;
    } else {
      prompt = `You are a world-class education expert, mentor, and curriculum coordinator. Below are the sequential milestones and curated resources for: "${task.topic}"

${findingsText}

Write an engaging, comprehensive, and highly-structured Study Guide and Mentorship Strategy (400-600 words) for mastering this topic:
1. Provide a warm, encouraging mentorship introduction on how to approach learning "${task.topic}" successfully.
2. Outline specific strategies for time management, avoiding common pitfalls/traps beginners usually make, and how to practice effectively.
3. Suggest a recommended weekly breakdown or daily studying schedule.
4. Pitch a final, comprehensive "Capstone Project" idea that ties all 5 phases together, explaining how building it will prove mastery.

Write in a highly professional, polished tone. Use markdown headings, bold terms, and neat bullet points to format the guide so it is a pleasure to read!`;
    }

    const ai = getAiClient();

    if (isCancelled(task.id)) return false;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    if (isCancelled(task.id)) return false;

    const summary = response.text || "";
    const mergedSources = currentTask.sources || "[]";

    if (isCancelled(task.id)) return false;

    const updatedTask = db.updateTask(task.id, {
      final_summary: summary,
      sources: mergedSources,
      status: TaskStatus.COMPLETED,
      current_step: "completed",
    });
    if (updatedTask) {
      sendTaskEmail(updatedTask, updatedTask.user_email).catch((mErr) => {
        console.error(`[Orchestrator] Failed to send completion email for task ${task.id}:`, mErr);
      });
    }
    return true;
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    const updatedTask = db.updateTask(task.id, {
      status: TaskStatus.FAILED,
      error_message: `Summarize step failed: ${errorMsg}`,
      current_step: "summarize_failed",
      retry_count: task.retry_count + 1,
    });
    if (updatedTask) {
      sendTaskEmail(updatedTask, updatedTask.user_email).catch((mErr) => {
        console.error(`[Orchestrator] Failed to send failure email for task ${task.id}:`, mErr);
      });
    }
    return false;
  }
}

export async function runPipeline(taskId: number): Promise<void> {
  const maxRetries = 10;
  const retryDelayMs = 3000;
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  let task = db.getTask(taskId);
  if (!task || task.status === TaskStatus.CANCELLED) return;

  while (true) {
    task = db.getTask(taskId);
    if (!task || task.status === TaskStatus.CANCELLED || task.status === TaskStatus.COMPLETED) {
      break;
    }

    let step = task.current_step || "pending";

    // Step 1: Search & Outline
    if (step === "pending" || step === "search_failed") {
      if (isCancelled(taskId)) break;
      const success = await stepSearch(task);
      if (!success) {
        task = db.getTask(taskId)!;
        if (task.retry_count < maxRetries && !isCancelled(taskId)) {
          console.log(`[Pipeline] Search failed. Auto-retrying (attempt ${task.retry_count}/${maxRetries}) in ${retryDelayMs}ms...`);
          db.updateTask(taskId, {
            status: TaskStatus.SEARCHING,
            error_message: `Search failed. Auto-retrying (Attempt ${task.retry_count} of ${maxRetries})...`,
          });
          await sleep(retryDelayMs);
          continue; // rerun loop to retry the failed search step
        } else {
          break; // Exceeded max retries or was cancelled
        }
      }
      step = "search_complete";
      task = db.getTask(taskId)!;
    }

    // Step 2: Extract & Study Guide Detailed Concepts
    if (step === "search_complete" || step === "extract_failed") {
      if (isCancelled(taskId)) break;
      const success = await stepExtract(task);
      if (!success) {
        task = db.getTask(taskId)!;
        if (task.retry_count < maxRetries && !isCancelled(taskId)) {
          console.log(`[Pipeline] Extract failed. Auto-retrying (attempt ${task.retry_count}/${maxRetries}) in ${retryDelayMs}ms...`);
          db.updateTask(taskId, {
            status: TaskStatus.EXTRACTING,
            error_message: `Extract failed. Auto-retrying (Attempt ${task.retry_count} of ${maxRetries})...`,
          });
          await sleep(retryDelayMs);
          continue; // rerun loop to retry extract step
        } else {
          break;
        }
      }
      step = "extract_complete";
      task = db.getTask(taskId)!;
    }

    // Step 3: Direct transition to approved step
    if (step === "extract_complete") {
      if (isCancelled(taskId)) break;
      step = "approved";
      task = db.getTask(taskId)!;
    }

    // Step 4: Summarize & Synthesis
    if (step === "approved" || step === "summarize_failed") {
      if (isCancelled(taskId)) break;
      const success = await stepSummarize(task);
      if (!success) {
        task = db.getTask(taskId)!;
        if (task.retry_count < maxRetries && !isCancelled(taskId)) {
          console.log(`[Pipeline] Summarize failed. Auto-retrying (attempt ${task.retry_count}/${maxRetries}) in ${retryDelayMs}ms...`);
          db.updateTask(taskId, {
            status: TaskStatus.SUMMARIZING,
            error_message: `Synthesis failed. Auto-retrying (Attempt ${task.retry_count} of ${maxRetries})...`,
          });
          await sleep(retryDelayMs);
          continue; // rerun loop to retry summarize step
        } else {
          break;
        }
      }
    }

    // If we completed all steps successfully and task status has transitioned, break out
    break;
  }
}

export async function resumePipeline(taskId: number): Promise<void> {
  const task = db.getTask(taskId);
  if (!task) return;

  if (task.status !== TaskStatus.AWAITING_APPROVAL) {
    return; // Nothing to resume
  }

  db.updateTask(taskId, {
    current_step: "approved",
  });

  const updatedTask = db.getTask(taskId)!;
  await stepSummarize(updatedTask);
}
