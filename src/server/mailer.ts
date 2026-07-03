import nodemailer from "nodemailer";
import { ResearchTask } from "./db";

// Keep a lazy-loaded transporter to avoid creating it multiple times
let mailTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (mailTransporter) return mailTransporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

  if (!user || !pass) {
    throw new Error(
      "GMAIL_USER and GMAIL_APP_PASSWORD environment variables are required for sending emails. Please set them in your environment configuration."
    );
  }

  mailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: user,
      pass: pass,
    },
  });

  return mailTransporter;
}

/**
 * Parses markdown to a basic readable HTML format for email clients.
 */
function simpleMarkdownToHtml(markdown: string): string {
  if (!markdown) return "";
  
  return markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Headers
    .replace(/^### (.*$)/gim, '<h3 style="color:#0f172a; font-size:16px; margin-top:16px; margin-bottom:8px; font-weight:bold;">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 style="color:#0f172a; font-size:18px; border-bottom:1px solid #e2e8f0; padding-bottom:4px; margin-top:20px; margin-bottom:10px; font-weight:bold;">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 style="color:#0f172a; font-size:22px; margin-top:24px; margin-bottom:12px; font-weight:bold;">$1</h1>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#0f172a;">$1</strong>')
    // Bullet lists
    .replace(/^\s*-\s+(.*$)/gim, '<li style="margin-bottom:4px; margin-left:20px;">$1</li>')
    .replace(/^\s*\*\s+(.*$)/gim, '<li style="margin-bottom:4px; margin-left:20px;">$1</li>')
    // Bullet lists wrapper
    .replace(/(<li>.*<\/li>)/gim, '<ul style="padding-left:0; margin-top:8px; margin-bottom:8px; color:#334155;">$1</ul>')
    // Duplicate <ul> cleanup
    .replace(/<\/ul>\s*<ul style="padding-left:0; margin-top:8px; margin-bottom:8px; color:#334155;">/g, "")
    // Paragraphs (split by double newlines)
    .split(/\n{2,}/g)
    .map(p => {
      if (p.trim().startsWith("<h") || p.trim().startsWith("<ul") || p.trim().startsWith("<li")) {
        return p;
      }
      return `<p style="margin-top:0; margin-bottom:12px; line-height:1.6; color:#334155;">${p.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");
}

/**
 * Sends a task completion or fail status notification email to the user.
 */
export async function sendTaskEmail(
  task: ResearchTask,
  recipientEmail: string,
  customMessage?: string
): Promise<boolean> {
  try {
    if (!recipientEmail || !recipientEmail.includes("@") || recipientEmail === "guest@persistiq.io") {
      console.warn(`[Mailer] Invalid or guest recipient email (${recipientEmail}). Skipping email dispatch.`);
      return false;
    }

    const transporter = getTransporter();
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const shareLink = `${appUrl}?share=${task.id}`;
    
    const isCompleted = task.status === "completed";
    const statusText = isCompleted ? "Completed Successfully" : "Failed / Stopped";
    const badgeColor = isCompleted ? "#22c55e" : "#ef4444";
    
    const subject = `[PersistIQ] Research & Syllabus: "${task.topic}" is ${isCompleted ? "Ready" : "Failed"}`;

    // Format content
    const finalSummaryHtml = simpleMarkdownToHtml(task.final_summary || "");
    const errorMessageHtml = task.error_message 
      ? `<div style="background-color:#fef2f2; border:1px solid #fecaca; color:#991b1b; padding:12px; rounded:8px; margin-bottom:16px; font-family:monospace; font-size:12px;">${task.error_message}</div>`
      : "";

    // Parse sources
    let sourcesListHtml = "";
    if (task.sources) {
      try {
        const parsedSources = JSON.parse(task.sources);
        if (Array.isArray(parsedSources) && parsedSources.length > 0) {
          sourcesListHtml = `
            <div style="margin-top:24px; padding-top:16px; border-top:1px solid #e2e8f0;">
              <h3 style="color:#0f172a; font-size:14px; margin-bottom:8px; font-weight:bold;">Curated Learning Sources & Articles:</h3>
              <ul style="padding-left:20px; color:#475569; font-size:13px;">
                ${parsedSources
                  .map(
                    (s: any) =>
                      `<li style="margin-bottom:6px;"><a href="${s.url}" target="_blank" style="color:#2563eb; text-decoration:underline;">${s.title || s.url}</a>${s.snippet ? ` - <span style="color:#64748b; font-size:12px;">${s.snippet.substring(0, 100)}...</span>` : ""}</li>`
                  )
                  .join("")}
              </ul>
            </div>
          `;
        }
      } catch (e) {
        console.warn("[Mailer] Error parsing sources for email", e);
      }
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
      </head>
      <body style="font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color:#f8fafc; margin:0; padding:40px 20px; color:#1e293b;">
        <div style="max-width:600px; margin:0 auto; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03); border:1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <div style="background-color:#0f172a; padding:32px; text-align:center;">
            <h1 style="color:#ffffff; margin:0; font-size:24px; font-weight:bold; letter-spacing:-0.5px;">PersistIQ</h1>
            <p style="color:#94a3b8; margin:8px 0 0 0; font-size:14px;">Your AI-Powered Research & Syllabus Assistant</p>
          </div>
          
          <!-- Content Body -->
          <div style="padding:32px;">
            <div style="display:inline-block; background-color:${badgeColor}20; color:${badgeColor}; font-size:11px; font-weight:bold; padding:4px 12px; border-radius:9999px; text-transform:uppercase; margin-bottom:16px; letter-spacing:0.5px;">
              ${statusText}
            </div>
            
            <h2 style="margin-top:0; color:#0f172a; font-size:20px; font-weight:bold; line-height:1.3; margin-bottom:12px;">
              Topic: ${task.topic}
            </h2>

            ${customMessage ? `<p style="background-color:#f1f5f9; padding:12px; border-radius:8px; border-left:4px solid #64748b; font-style:italic; font-size:13px; color:#475569; margin-bottom:20px;">"${customMessage}"</p>` : ""}

            <p style="font-size:14px; color:#475569; margin-bottom:24px;">
              Here are the complete study roadmap, curated articles, and hands-on synthesis generated specifically for you.
            </p>

            ${errorMessageHtml}

            <!-- Primary CTA -->
            <div style="text-align:center; margin:28px 0;">
              <a href="${shareLink}" target="_blank" style="display:inline-block; background-color:#2563eb; color:#ffffff; font-weight:bold; font-size:14px; text-decoration:none; padding:12px 24px; border-radius:10px; box-shadow:0 2px 4px rgba(37,99,235,0.2);">
                Interactive Syllabus & Roadmap Link 🔗
              </a>
              <p style="font-size:11px; color:#94a3b8; margin-top:8px;">
                Link: <a href="${shareLink}" style="color:#64748b;">${shareLink}</a>
              </p>
            </div>

            <!-- Content Preview Section -->
            ${isCompleted ? `
              <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:24px; margin-top:24px;">
                <h3 style="color:#0f172a; font-size:15px; margin-top:0; margin-bottom:12px; font-weight:bold; border-bottom:1px dashed #cbd5e1; padding-bottom:8px;">
                  Syllabus / Study Guide Preview:
                </h3>
                <div style="font-size:13px; color:#334155;">
                  ${finalSummaryHtml}
                </div>
              </div>
            ` : ""}

            ${sourcesListHtml}

          </div>

          <!-- Footer -->
          <div style="background-color:#f1f5f9; padding:20px; text-align:center; border-top:1px solid #e2e8f0; font-size:11px; color:#64748b;">
            <p style="margin:0 0 6px 0;">This email was sent to you because you requested an AI syllabus roadmap for "${task.topic}".</p>
            <p style="margin:0;">&copy; 2026 PersistIQ. Built for lifelong learners.</p>
          </div>

        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"PersistIQ Research" <${process.env.GMAIL_USER}>`,
      to: recipientEmail,
      subject: subject,
      html: emailHtml,
    });

    console.log(`[Mailer] Successfully dispatched email notification to ${recipientEmail} for task ${task.id}.`);
    return true;
  } catch (err: any) {
    console.error(`[Mailer] Failed to send task email for task ${task.id} to ${recipientEmail}:`, err);
    throw err;
  }
}
