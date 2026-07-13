import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Play,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Pause,
  BookOpen,
  ExternalLink,
  Globe,
  Video,
  FileText,
  Code,
  ArrowRight,
  Download,
  Share2,
  Check,
  Square,
  Mail,
} from "lucide-react";
import { jsPDF } from "jspdf";
import StatusBadge from "./StatusBadge";
import ProgressBar from "./ProgressBar";
import { ResearchTask, tasksApi } from "../lib/api";
import ReactMarkdown from "react-markdown";
import { useAuth } from "../context/AuthContext";

const normalizeAngleTitle = (angle: string, i: number, isArticle: boolean) => {
  const clean = angle.replace(/^(section|phase)\s*\d+[:\-]?\s*/i, "").trim();
  return isArticle ? `Section ${i + 1}: ${clean}` : `Phase ${i + 1}: ${clean}`;
};

const getStepMessage = (step: string, status: string): string => {
  if (status === "failed") return "";
  if (status === "cancelled") return "Research stopped by user.";
  
  switch (step) {
    case "pending":
      return "Preparing pipeline resources...";
    case "searching":
      return "Searching the web and formulating outline structure...";
    case "search_complete":
      return "Outline structured successfully.";
    case "extracting":
      return "Extracting detailed concepts and verified study guides...";
    case "extract_complete":
      return "Detailed resources and plans compiled.";
    case "summarizing":
      return "Synthesizing full masterclass guide & mentorship strategy...";
    case "completed":
      return "Roadmap successfully compiled & persisted.";
    default:
      return "Processing...";
  }
};

interface RenderMarkdownOptions {
  defaultFontSize?: number;
  defaultLineHeight?: number;
  defaultColor?: [number, number, number];
}

interface TextSegment {
  text: string;
  bold: boolean;
}

const parseInlineMarkdown = (text: string): TextSegment[] => {
  const segments: TextSegment[] = [];
  const parts = text.split("**");
  let isBold = false;
  parts.forEach((part) => {
    segments.push({ text: part, bold: isBold });
    isBold = !isBold;
  });
  return segments;
};

const wrapSegments = (doc: any, segments: TextSegment[], maxWidth: number, fontSize: number): TextSegment[][] => {
  const lines: TextSegment[][] = [];
  let currentLine: TextSegment[] = [];
  let currentLineWidth = 0;

  doc.setFontSize(fontSize);

  segments.forEach((seg) => {
    const words = seg.text.split(/(\s+)/);
    
    words.forEach((word) => {
      if (word === "") return;
      
      doc.setFont("helvetica", seg.bold ? "bold" : "normal");
      const wordWidth = doc.getTextWidth(word);
      
      if (currentLineWidth + wordWidth > maxWidth) {
        if (word.trim() === "" && currentLineWidth === 0) {
          return;
        }
        
        if (currentLine.length > 0) {
          lines.push(currentLine);
        }
        currentLine = [{ text: word, bold: seg.bold }];
        currentLineWidth = wordWidth;
      } else {
        const lastSeg = currentLine[currentLine.length - 1];
        if (lastSeg && lastSeg.bold === seg.bold) {
          lastSeg.text += word;
        } else {
          currentLine.push({ text: word, bold: seg.bold });
        }
        currentLineWidth += wordWidth;
      }
    });
  });

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
};

const drawLineSegments = (doc: any, line: TextSegment[], x: number, y: number, fontSize: number) => {
  let currentX = x;
  line.forEach((seg) => {
    doc.setFont("helvetica", seg.bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.text(seg.text, currentX, y);
    currentX += doc.getTextWidth(seg.text);
  });
};

const renderMarkdownToPDF = (
  doc: any,
  text: string,
  startX: number,
  startY: number | { y: number },
  maxWidth: number,
  checkPageBreak: (neededHeight: number) => void,
  options: RenderMarkdownOptions = {}
): number => {
  const defaultFontSize = options.defaultFontSize || 7.5;
  const defaultLineHeight = options.defaultLineHeight || 4.2;
  const defaultColor = options.defaultColor || [71, 85, 105];
  
  const cleanText = text
    .replace(/🔍/g, "")
    .replace(/💡/g, "")
    .replace(/⏱/g, "")
    .replace(/🎯/g, "")
    .replace(/📝/g, "")
    .replace(/📰/g, "")
    .replace(/🚀/g, "")
    .replace(/⭐/g, "")
    .replace(/✔️|✅/g, "")
    .replace(/❌/g, "")
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, "");

  const blocks = cleanText.split(/\r?\n/);
  
  let localY = typeof startY === "number" ? startY : 0;
  const getY = (): number => {
    if (typeof startY === "object" && startY !== null) {
      return startY.y;
    }
    return localY;
  };
  const updateY = (newY: number) => {
    if (typeof startY === "object" && startY !== null) {
      startY.y = newY;
    } else {
      localY = newY;
    }
  };

  blocks.forEach((block) => {
    const trimmed = block.trim();
    if (!trimmed) {
      updateY(getY() + defaultLineHeight * 0.5);
      return;
    }

    if (trimmed.startsWith("#")) {
      const match = trimmed.match(/^(#{1,4})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const headerText = match[2].trim();
        
        let headerFontSize = defaultFontSize;
        let headerSpacing = defaultLineHeight;
        let headerColor: [number, number, number] = [15, 23, 42];
        
        if (level === 1) {
          headerFontSize = 13;
          headerSpacing = 7;
          headerColor = [15, 23, 42];
        } else if (level === 2) {
          headerFontSize = 11;
          headerSpacing = 6;
          headerColor = [30, 41, 59];
        } else if (level === 3) {
          headerFontSize = 9;
          headerSpacing = 5;
          headerColor = [79, 70, 229];
        } else {
          headerFontSize = 8;
          headerSpacing = 4.5;
          headerColor = [79, 70, 229];
        }

        checkPageBreak(headerSpacing + 2);
        updateY(getY() + 2);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(headerFontSize);
        doc.setTextColor(headerColor[0], headerColor[1], headerColor[2]);

        const headerLines = doc.splitTextToSize(headerText, maxWidth);
        headerLines.forEach((line: string) => {
          checkPageBreak(headerSpacing);
          doc.text(line, startX, getY());
          updateY(getY() + headerSpacing);
        });

        updateY(getY() + 1.5);
        return;
      }
    }

    const bulletMatch = trimmed.match(/^([-*+])\s+(.*)$/);
    if (bulletMatch) {
      const listContent = bulletMatch[2].trim();
      checkPageBreak(defaultLineHeight);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(defaultFontSize);
      doc.setTextColor(defaultColor[0], defaultColor[1], defaultColor[2]);
      doc.text("-", startX + 1, getY() + 0.2);
      
      const listWidth = maxWidth - 5;
      const segments = parseInlineMarkdown(listContent);
      const wrappedLines = wrapSegments(doc, segments, listWidth, defaultFontSize);
      
      wrappedLines.forEach((line) => {
        checkPageBreak(defaultLineHeight);
        doc.setTextColor(defaultColor[0], defaultColor[1], defaultColor[2]);
        drawLineSegments(doc, line, startX + 4.5, getY(), defaultFontSize);
        updateY(getY() + defaultLineHeight);
      });
      return;
    }

    const segments = parseInlineMarkdown(trimmed);
    const wrappedLines = wrapSegments(doc, segments, maxWidth, defaultFontSize);
    
    wrappedLines.forEach((line) => {
      checkPageBreak(defaultLineHeight);
      doc.setTextColor(defaultColor[0], defaultColor[1], defaultColor[2]);
      drawLineSegments(doc, line, startX, getY(), defaultFontSize);
      updateY(getY() + defaultLineHeight);
    });
  });

  return getY();
};

const estimateMarkdownHeight = (
  doc: any,
  text: string,
  maxWidth: number,
  options: RenderMarkdownOptions = {}
): number => {
  const defaultFontSize = options.defaultFontSize || 7.5;
  const defaultLineHeight = options.defaultLineHeight || 4.2;
  
  const cleanText = text
    .replace(/🔍/g, "")
    .replace(/💡/g, "")
    .replace(/⏱/g, "")
    .replace(/🎯/g, "")
    .replace(/📝/g, "")
    .replace(/📰/g, "")
    .replace(/🚀/g, "")
    .replace(/⭐/g, "")
    .replace(/✔️|✅/g, "")
    .replace(/❌/g, "")
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, "");

  const blocks = cleanText.split(/\r?\n/);
  let totalHeight = 0;

  blocks.forEach((block) => {
    const trimmed = block.trim();
    if (!trimmed) {
      totalHeight += defaultLineHeight * 0.5;
      return;
    }

    if (trimmed.startsWith("#")) {
      const match = trimmed.match(/^(#{1,4})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const headerText = match[2].trim();
        let headerFontSize = defaultFontSize;
        let headerSpacing = defaultLineHeight;
        
        if (level === 1) {
          headerFontSize = 13;
          headerSpacing = 7;
        } else if (level === 2) {
          headerFontSize = 11;
          headerSpacing = 6;
        } else if (level === 3) {
          headerFontSize = 9;
          headerSpacing = 5;
        } else {
          headerFontSize = 8;
          headerSpacing = 4.5;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(headerFontSize);
        const headerLines = doc.splitTextToSize(headerText, maxWidth);
        totalHeight += 2 + (headerLines.length * headerSpacing) + 1.5;
        return;
      }
    }

    const bulletMatch = trimmed.match(/^([-*+])\s+(.*)$/);
    if (bulletMatch) {
      const listContent = bulletMatch[2].trim();
      const segments = parseInlineMarkdown(listContent);
      const wrappedLines = wrapSegments(doc, segments, maxWidth - 5, defaultFontSize);
      totalHeight += wrappedLines.length * defaultLineHeight;
      return;
    }

    const segments = parseInlineMarkdown(trimmed);
    const wrappedLines = wrapSegments(doc, segments, maxWidth, defaultFontSize);
    totalHeight += wrappedLines.length * defaultLineHeight;
  });

  return totalHeight;
};

interface TaskCardProps {
  task: ResearchTask;
  onRefresh: () => void;
  id?: string;
  key?: any;
}

export default function TaskCard({ task, onRefresh, id }: TaskCardProps) {
  const { currentUser } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [phaseStates, setPhaseStates] = useState<Record<number, string>>({});
  const [studyNotes, setStudyNotes] = useState<Record<number, string>>({});
  const [editingNotesIndex, setEditingNotesIndex] = useState<number | null>(null);
  const [tempNoteText, setTempNoteText] = useState("");

  // Auto email status state
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<{ success: boolean; message: string } | null>(null);

  React.useEffect(() => {
    if (currentUser?.email && !recipientEmail) {
      setRecipientEmail(currentUser.email);
    }
  }, [currentUser, recipientEmail]);

  React.useEffect(() => {
    if (emailStatus) {
      const timer = setTimeout(() => setEmailStatus(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [emailStatus]);

  // Automatic email dispatch on task completion or failure
  React.useEffect(() => {
    if (task.status === "completed" || task.status === "failed") {
      const storageKey = `persistiq_emailed_task_${task.id}`;
      if (!localStorage.getItem(storageKey)) {
        // Mark as sent immediately to avoid race conditions/multiple requests
        localStorage.setItem(storageKey, "sent");

        let targetEmail = recipientEmail || currentUser?.email;
        if (!targetEmail && currentUser?.providerData) {
          for (const profile of currentUser.providerData) {
            if (profile.email) {
              targetEmail = profile.email;
              break;
            }
          }
        }

        if (!targetEmail || !targetEmail.includes("@") || targetEmail.includes("guest@persistiq.io")) {
          setEmailStatus({
            success: false,
            message: "Auto-send email skipped: No valid, non-guest recipient email address."
          });
          return;
        }

        tasksApi.shareEmail(task.id, targetEmail, `[Auto-Notification] Your research task has ended with status: ${task.status}.`)
          .then((res) => {
            if (res.success) {
              setEmailStatus({
                success: true,
                message: `Study guide auto-emailed successfully to ${targetEmail} 🚀`
              });
            } else {
              setEmailStatus({
                success: false,
                message: "Auto-email failed: SMTP configuration is not verified."
              });
            }
          })
          .catch((err) => {
            setEmailStatus({
              success: false,
              message: `Auto-email failed: ${err.message || err}`
            });
          });
      }
    }
  }, [task.status, task.id, currentUser, recipientEmail]);

  React.useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleShareLink = () => {
    const shareUrl = `${window.location.origin}?share=${task.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  };

  React.useEffect(() => {
    try {
      setPhaseStates(JSON.parse(task.phase_states || "{}"));
    } catch {
      setPhaseStates({});
    }
    try {
      setStudyNotes(JSON.parse(task.study_notes || "{}"));
    } catch {
      setStudyNotes({});
    }
  }, [task.phase_states, task.study_notes]);

  const handlePhaseStateChange = async (index: number, newState: string) => {
    const updated = { ...phaseStates, [index]: newState };
    setPhaseStates(updated);
    try {
      await tasksApi.updatePhases(task.id, JSON.stringify(updated));
    } catch (err) {
      console.error("Failed to save phase state:", err);
    }
  };

  const handleStartEditingNotes = (index: number) => {
    setEditingNotesIndex(index);
    setTempNoteText(studyNotes[index] || "");
  };

  const handleSaveNotes = async (index: number) => {
    const updated = { ...studyNotes, [index]: tempNoteText };
    setStudyNotes(updated);
    setEditingNotesIndex(null);
    try {
      await tasksApi.updateNotes(task.id, JSON.stringify(updated));
    } catch (err) {
      console.error("Failed to save notes:", err);
    }
  };

  const handleResume = async () => {
    setLoading(true);
    setError(null);
    try {
      await tasksApi.resume(task.id);
      onRefresh();
    } catch (e: any) {
      setError("Resume failed: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    setLoading(true);
    setError(null);
    try {
      await tasksApi.retry(task.id);
      onRefresh();
    } catch (e: any) {
      setError("Retry failed: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await tasksApi.delete(task.id);
      onRefresh();
    } catch (e: any) {
      setError("Delete failed: " + (e.message || "Unknown error"));
      setIsConfirmingDelete(false);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    setError(null);
    try {
      await tasksApi.stop(task.id);
      onRefresh();
    } catch (e: any) {
      setError("Stop failed: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleExportMarkdown = () => {
    const isArticle = task.task_type === "article";
    let md = isArticle
      ? `# Research Article: ${task.topic}\n`
      : `# Syllabus Roadmap: ${task.topic}\n`;
    md += isArticle
      ? `*Generated by Technical Writer & Researcher*\n\n`
      : `*Generated by Syllabus Architect*\n\n`;
    
    if (!isArticle && (task.duration || task.focus)) {
      md += `## Configuration\n`;
      if (task.duration) md += `- **Duration**: ${task.duration.replace("_", " ")}\n`;
      if (task.focus) md += `- **Focus**: ${task.focus}\n`;
      md += `\n`;
    }

    if (Object.keys(extractedData).length > 0) {
      md += isArticle ? `## Article Sections & Factual Findings\n\n` : `## Progressive Modules\n\n`;
      Object.entries(extractedData).forEach(([angle, data]: [string, any], i: number) => {
        const isStructured = typeof data === "object" && data !== null;
        const description = isStructured ? data.findings : (data as string);
        const stepResources = isStructured ? (data.resources || []) : [];
        const currentPhaseState = phaseStates[i] || "not_started";
        const note = studyNotes[i] || "";

        md += `### ${normalizeAngleTitle(angle, i, isArticle)}\n`;
        if (!isArticle) {
          md += `- **Status**: ${currentPhaseState.toUpperCase().replace("_", " ")}\n`;
        }
        md += `\n${description}\n\n`;

        if (stepResources.length > 0) {
          md += isArticle ? `#### Authoritative References:\n` : `#### Curated Materials:\n`;
          stepResources.forEach((res: any) => {
            md += `- [${res.title}](${res.url}) (${res.type || "resource"})\n`;
            if (res.description) md += `  *${res.description}*\n`;
          });
          md += `\n`;
        }

        if (note) {
          md += isArticle ? `#### My Research Annotations:\n` : `#### My Study Notes:\n`;
          md += `\`\`\`\n${note}\n\`\`\`\n\n`;
        }
        
        md += `---\n\n`;
      });
    }

    if (task.final_summary) {
      md += isArticle ? `## Unified Article Composition\n\n` : `## Final Synthesis\n\n`;
      md += `${task.final_summary}\n`;
    }

    // Trigger download with a highly unique filename to prevent cache & OS collision
    const cleanTopic = task.topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .substring(0, 45);
    const uniqueTime = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const prefix = isArticle ? "article" : "syllabus";
    const fileName = `${prefix}-${cleanTopic}-${uniqueTime}.md`;

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Revoke the object URL to free up memory cleanly
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const handleExportPDF = () => {
    const isArticle = task.task_type === "article";
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let y = 25;

    // Helper to check page boundary and auto-add pages
    const checkPageBreak = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - margin) {
        doc.addPage();
        y = 25;
        // Draw elegant page header line
        doc.setFillColor(99, 102, 241); // Indigo #6366f1
        doc.rect(margin, y - 8, contentWidth, 1.2, "F");
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184); // Slate 400
        doc.text(
          isArticle ? "PERSISTIQ ARTICLE AUTHOR" : "PERSISTIQ STUDY ARCHITECT",
          margin,
          y - 11
        );
        doc.text(
          `Topic: ${task.topic.substring(0, 35)}${task.topic.length > 35 ? "..." : ""}`,
          pageWidth - margin,
          y - 11,
          { align: "right" }
        );
      }
    };

    // --- Elegant Header Section ---
    // Top Brand Badge
    doc.setFillColor(238, 242, 255); // indigo-50
    doc.roundedRect(margin, y, 48, 6, 1.2, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(79, 70, 229); // indigo-600
    doc.text(isArticle ? "PERSISTIQ ARTICLE AGENT" : "PERSISTIQ STUDY AGENT", margin + 3, y + 4.2);

    // Draw the PersistIQ signature neural node icon next to the badge
    doc.setFillColor(99, 102, 241); // indigo-500
    // Center node
    doc.circle(margin + 54, y + 3, 1.1, "F");
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.25);
    // Connect to outer nodes
    doc.line(margin + 54, y + 3, margin + 51, y + 1.5);
    doc.circle(margin + 51, y + 1.5, 0.65, "F");
    
    doc.line(margin + 54, y + 3, margin + 57, y + 1.5);
    doc.circle(margin + 57, y + 1.5, 0.65, "F");

    doc.line(margin + 54, y + 3, margin + 51, y + 4.5);
    doc.circle(margin + 51, y + 4.5, 0.65, "F");

    doc.line(margin + 54, y + 3, margin + 57, y + 4.5);
    doc.circle(margin + 57, y + 4.5, 0.65, "F");

    // ID Badge on Right
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(pageWidth - margin - 16, y, 16, 6, 1.2, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`ID #${task.id}`, pageWidth - margin - 13.5, y + 4.2);

    y += 12;

    // Topic/Syllabus Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // slate-900
    const titleLines = doc.splitTextToSize(task.topic, contentWidth);
    doc.text(titleLines, margin, y);
    y += (titleLines.length * 6) + 4;

    // Study Metadata Badges
    let badgeX = margin;
    if (!isArticle && task.duration) {
      const durationLabel = `DURATION: ${task.duration.replace("_", " ").toUpperCase()}`;
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.roundedRect(badgeX, y, 46, 6, 1, 1, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text(durationLabel, badgeX + 3, y + 4.2);
      badgeX += 50;
    }

    if (!isArticle && task.focus) {
      const focusLabel = `STYLE: ${task.focus.toUpperCase()}`;
      doc.setFillColor(240, 253, 250); // teal-50
      doc.setDrawColor(204, 251, 241); // teal-100
      doc.roundedRect(badgeX, y, 42, 6, 1, 1, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(13, 148, 136); // teal-600
      doc.text(focusLabel, badgeX + 3, y + 4.2);
    } else if (isArticle) {
      doc.setFillColor(243, 244, 246); // gray-100
      doc.setDrawColor(229, 231, 235); // gray-200
      doc.roundedRect(badgeX, y, 45, 6, 1, 1, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(75, 85, 99); // gray-600
      doc.text(`TYPE: RESEARCH ARTICLE`, badgeX + 3, y + 4.2);
    }

    y += 11;

    // Section Divider
    doc.setFillColor(226, 232, 240); // slate-200
    doc.rect(margin, y, contentWidth, 0.4, "F");
    y += 8;

    // --- Progressive Syllabus Phases ---
    if (Object.keys(extractedData).length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(isArticle ? "RESEARCH FINDINGS & DRAFT OUTLINE" : "PROGRESSIVE STUDY SYLLABUS", margin, y);
      y += 6;

      Object.entries(extractedData).forEach(([angle, data]: [string, any], i: number) => {
        const isStructured = typeof data === "object" && data !== null;
        const description = isStructured ? data.findings : (data as string);
        const stepResources = isStructured ? (data.resources || []) : [];
        const currentPhaseState = phaseStates[i] || "not_started";
        const note = studyNotes[i] || "";

        const cleanAngle = normalizeAngleTitle(angle, i, isArticle);
        const cardX = margin + 11;
        const cardWidth = contentWidth - 11;

        const titleLines = doc.splitTextToSize(cleanAngle, cardWidth - 8);
        const titleHeight = titleLines.length * 4.5;

        const descriptionHeight = estimateMarkdownHeight(doc, description || "", cardWidth - 8, {
          defaultFontSize: 7.5,
          defaultLineHeight: 4.2
        });

        let stepResourcesHeight = 0;
        let wrappedSourcesLinesCount = 0;
        if (stepResources.length > 0) {
          stepResourcesHeight = 5; // header height
          stepResources.forEach((res: any) => {
            const typeLabel = res.type ? `[${res.type.toUpperCase()}] ` : "";
            const resTitle = `${typeLabel}${res.title || "Reference Material"}`;
            const resLines = doc.splitTextToSize(resTitle, cardWidth - 10);
            wrappedSourcesLinesCount += resLines.length;
          });
          stepResourcesHeight += (wrappedSourcesLinesCount * 4);
        }

        let wrappedNoteLinesCount = 0;
        let noteHeight = 0;
        if (note) {
          noteHeight = 6; // note header
          const noteLines = doc.splitTextToSize(note, cardWidth - 12);
          wrappedNoteLinesCount = noteLines.length;
          noteHeight += (wrappedNoteLinesCount * 3.5) + 3;
        }

        const cardInnerHeight = 8 + titleHeight + descriptionHeight + stepResourcesHeight + noteHeight + 6;
        const totalCardHeight = cardInnerHeight + 4; // spacing space

        checkPageBreak(totalCardHeight);

        // Status styling representation
        let statusText = "TODO";
        let statusBgColor = [241, 245, 249]; // slate-100
        let statusTextColor = [100, 116, 139]; // slate-500
        let indicatorColor = [148, 163, 184]; // slate-400

        if (currentPhaseState === "completed") {
          statusText = "COMPLETED";
          statusBgColor = [209, 250, 229]; // emerald-100
          statusTextColor = [5, 150, 105]; // emerald-600
          indicatorColor = [16, 185, 129]; // emerald-500
        } else if (currentPhaseState === "in_progress") {
          statusText = "IN PROGRESS";
          statusBgColor = [224, 231, 255]; // indigo-100
          statusTextColor = [79, 70, 229]; // indigo-600
          indicatorColor = [99, 102, 241]; // indigo-500
        }

        if (isArticle) {
          indicatorColor = [100, 116, 139]; // slate-500 for article
        }

        // Draw vertical timeline line behind
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.4);
        doc.line(margin + 4, y, margin + 4, y + totalCardHeight);

        // Draw card background container
        doc.setFillColor(250, 250, 250); // light panel slate-50
        doc.setDrawColor(241, 245, 249); // slate-100
        doc.setLineWidth(0.2);
        doc.roundedRect(cardX, y, cardWidth, cardInnerHeight, 1.2, 1.2, "FD");

        // Timeline badge circle
        const circleX = margin + 4;
        const circleY = y + 4.5;
        doc.setFillColor(indicatorColor[0], indicatorColor[1], indicatorColor[2]);
        doc.circle(circleX, circleY, 3.2, "F");

        // White border for timeline badge circle
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.4);
        doc.circle(circleX, circleY, 3.2, "D");

        // Number inside circle
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.text(`${i + 1}`, circleX, circleY + 1.1, { align: "center" });

        // Left accent stripe inside the card
        doc.setFillColor(indicatorColor[0], indicatorColor[1], indicatorColor[2]);
        doc.rect(cardX, y, 1.5, cardInnerHeight, "F");

        // Title text rendering
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59); // slate-800
        doc.text(titleLines, cardX + 4, y + 4.5);

        // Status pill on Right side of phase title (Only if not article mode)
        if (!isArticle) {
          const badgeWidth = statusText === "IN PROGRESS" ? 22 : 18;
          doc.setFillColor(statusBgColor[0], statusBgColor[1], statusBgColor[2]);
          doc.roundedRect(cardX + cardWidth - badgeWidth - 4, y + 2, badgeWidth, 5, 0.8, 0.8, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6.5);
          doc.setTextColor(statusTextColor[0], statusTextColor[1], statusTextColor[2]);
          doc.text(statusText, cardX + cardWidth - badgeWidth - 4 + (statusText === "IN PROGRESS" ? 2.5 : 3.5), y + 5.5);
        }

        let innerY = y + 4.5 + titleHeight + 1.5;

        // Draw section detailed draft write-up/overview
        let innerYCoord = { y: innerY };
        const localPageBreak = (needed: number) => {
          if (innerYCoord.y + needed > pageHeight - margin) {
            y = innerYCoord.y;
            checkPageBreak(needed);
            innerYCoord.y = y;
          }
        };

        innerY = renderMarkdownToPDF(
          doc,
          description || "",
          cardX + 4,
          innerYCoord,
          cardWidth - 8,
          localPageBreak,
          {
            defaultFontSize: 7.5,
            defaultLineHeight: 4.2,
            defaultColor: [71, 85, 105] // slate-600
          }
        );
        innerY += 2.5;

        // Draw Sources section
        if (stepResources.length > 0) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184); // slate-400
          doc.text(
            isArticle ? "AUTHORITATIVE REFERENCES & CITATIONS:" : "CURATED RESEARCH SOURCES:",
            cardX + 4,
            innerY + 1
          );
          innerY += 4.5;

          stepResources.forEach((res: any) => {
            const typeLabel = res.type ? `[${res.type.toUpperCase()}] ` : "";
            const resTitle = `${typeLabel}${res.title || "Reference Material"}`;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(79, 70, 229); // Blue indigo link
            
            const resLines = doc.splitTextToSize(resTitle, cardWidth - 10);
            resLines.forEach((line: string, lineIndex: number) => {
              doc.text(line, cardX + 6, innerY);
              // Attach clickable metadata to the PDF vector layer
              if (lineIndex === 0 && res.url) {
                const textWidth = doc.getTextWidth(line);
                doc.setDrawColor(79, 70, 229);
                doc.setLineWidth(0.1);
                doc.line(cardX + 6, innerY + 0.5, cardX + 6 + textWidth, innerY + 0.5);
                doc.link(cardX + 6, innerY - 2, textWidth, 3, { url: res.url });
              }
              innerY += 4;
            });
          });
        }

        // Draw Sticky Notes box
        if (note) {
          innerY += 1.5;
          doc.setFillColor(255, 251, 235); // amber-50
          doc.setDrawColor(252, 211, 77); // amber-300
          doc.setLineWidth(0.12);
          doc.roundedRect(cardX + 4, innerY, cardWidth - 8, (wrappedNoteLinesCount * 3.5) + 6, 1, 1, "FD");

          doc.setFont("helvetica", "bold");
          doc.setFontSize(6.5);
          doc.setTextColor(180, 83, 9); // amber-800
          doc.text(isArticle ? "RESEARCH ANNOTATION:" : "PERSONAL NOTE:", cardX + 6, innerY + 3.2);

          doc.setFont("courier", "normal"); // code/scratchpad typewriter mono style
          doc.setFontSize(7);
          doc.setTextColor(51, 65, 85);
          const noteLines = doc.splitTextToSize(note, cardWidth - 12);
          doc.text(noteLines, cardX + 6, innerY + 6.8);
        }

        y += cardInnerHeight + 4;
      });
    }

    // --- Final Synthesized Article / Synthesis Section ---
    if (task.final_summary) {
      checkPageBreak(30);
      y += 5;
      doc.setFillColor(226, 232, 240); // slate-200
      doc.rect(margin, y, contentWidth, 0.4, "F");
      y += 8;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(
        isArticle ? "FINAL SYNTHESIZED ARTICLE" : "FINAL STUDY GUIDE & SUMMARY",
        margin,
        y
      );
      y += 8;

      let finalCoord = { y: y };
      const finalPageBreak = (needed: number) => {
        if (finalCoord.y + needed > pageHeight - margin) {
          y = finalCoord.y;
          checkPageBreak(needed);
          finalCoord.y = y;
        }
      };

      y = renderMarkdownToPDF(
        doc,
        task.final_summary,
        margin,
        finalCoord,
        contentWidth,
        finalPageBreak,
        {
          defaultFontSize: 8,
          defaultLineHeight: 4.5,
          defaultColor: [51, 65, 85] // slate-700
        }
      );
      y += 4;
    }

    // --- Footer Section ---
    checkPageBreak(12);
    y += 2;
    doc.setFillColor(226, 232, 240); // slate-200
    doc.rect(margin, y, contentWidth, 0.3, "F");
    y += 5;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      isArticle
        ? "Article generated via PersistIQ Stateful AI Research & Orchestration Agent."
        : "Syllabus generated via PersistIQ Stateful AI Research & Orchestration Agent.",
      margin,
      y
    );
    doc.text(
      isArticle ? "Composed with precision & depth." : "Architected with precision & structure.",
      pageWidth - margin,
      y,
      { align: "right" }
    );

    // Save Download
    const cleanTopic = task.topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .substring(0, 45);
    const uniqueTime = new Date().toISOString().slice(0, 10);
    const prefix = isArticle ? "article" : "syllabus";
    doc.save(`${prefix}-${cleanTopic}-${uniqueTime}.pdf`);
  };

  const searchAngles = (() => {
    try {
      return JSON.parse(task.search_results || "[]");
    } catch {
      return [];
    }
  })();

  const extractedData = (() => {
    try {
      return JSON.parse(task.extracted_data || "{}");
    } catch {
      return {};
    }
  })();

  const sources = (() => {
    try {
      return JSON.parse(task.sources || "[]");
    } catch {
      return [];
    }
  })();

  return (
    <div
      id={id || `task-card-${task.id}`}
      className="bg-white border border-slate-200 shadow-xs rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition-all duration-200 animate-fade-up"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-slate-800 text-base leading-snug truncate">
            {task.topic}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">ID #{task.id}</span>
            {task.task_type === "article" ? (
              <span className="text-[9px] bg-slate-100 border border-slate-200 text-slate-500 font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                📰 Research Article
              </span>
            ) : (
              <>
                {task.duration && (
                  <span className="text-[9px] bg-slate-100 border border-slate-200 text-slate-500 font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                    ⏱ {task.duration.replace("_", " ")}
                  </span>
                )}
                {task.focus && (
                  <span className="text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-600 font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                    🎯 {task.focus}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={task.status} />
        </div>
      </div>

      {/* Progress */}
      <ProgressBar step={task.current_step} />
      {getStepMessage(task.current_step, task.status) && (
        <p className="text-[11px] text-slate-500 mt-1 font-medium select-none">
          {getStepMessage(task.current_step, task.status)}
        </p>
      )}

      {/* Auto-Retry notification */}
      {task.status !== "failed" && task.status !== "cancelled" && task.error_message && task.error_message.includes("Auto-retrying") && (
        <div className="mt-2 text-[10px] bg-amber-50 border border-amber-100 text-amber-600 px-2.5 py-1.5 rounded-xl flex items-center gap-2 animate-pulse shadow-xs">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <span className="font-semibold select-none">{task.error_message}</span>
        </div>
      )}

      {/* Inline Safe Notification System for Operation Failures */}
      {error && (
        <div className="mt-2 text-xs bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-xl flex items-center justify-between animate-fade-in shadow-xs">
          <span className="font-medium">{error}</span>
          <button 
            onClick={() => setError(null)} 
            className="text-red-400 hover:text-red-600 transition-colors cursor-pointer text-xs ml-2 flex items-center justify-center w-4 h-4 rounded-full hover:bg-red-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Auto-send Email Notification Popup */}
      {emailStatus && (
        <div className={`mt-2 text-xs border px-3 py-2 rounded-xl flex items-center justify-between animate-fade-in shadow-xs ${
          emailStatus.success 
            ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
            : "bg-red-50 border-red-250 text-red-750"
        }`}>
          <span className="font-medium">{emailStatus.message}</span>
          <button 
            onClick={() => setEmailStatus(null)} 
            className={`transition-colors cursor-pointer text-xs ml-2 flex items-center justify-center w-4 h-4 rounded-full ${
              emailStatus.success 
                ? "text-emerald-400 hover:text-emerald-600 hover:bg-emerald-100" 
                : "text-red-450 hover:text-red-600 hover:bg-red-100"
            }`}
          >
            ✕
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          {task.status === "awaiting_approval" && (
            <button
              id={`approve-btn-${task.id}`}
              onClick={handleResume}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
                         bg-indigo-500 text-white hover:bg-indigo-600 active:scale-95
                         transition-all duration-150 disabled:opacity-60 shadow-sm shadow-indigo-200 cursor-pointer"
            >
              <Play size={12} /> Approve & Continue
            </button>
          )}
          {["searching", "extracting", "summarizing", "pending"].includes(task.status) && (
            <button
              id={`stop-btn-${task.id}`}
              onClick={handleStop}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
                         bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 hover:text-rose-700 active:scale-95
                         transition-all duration-150 disabled:opacity-60 cursor-pointer shadow-sm shadow-rose-50"
            >
              <Square size={11} className="fill-current" /> Stop Researching
            </button>
          )}
          {(task.status === "failed" || task.status === "cancelled") && !isConfirmingDelete && (
            <button
              id={`retry-btn-${task.id}`}
              onClick={handleRetry}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold
                         bg-amber-500 text-white hover:bg-amber-600 active:scale-95
                         transition-all duration-150 disabled:opacity-60 shadow-sm shadow-amber-200 cursor-pointer"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> {task.status === "cancelled" ? "Restart Research" : "Retry"}
            </button>
          )}

          {isConfirmingDelete ? (
            <div className="flex items-center gap-1 bg-red-50 border border-red-150 px-2 py-1 rounded-xl animate-fade-in shadow-xs">
              <span className="text-[10px] text-red-700 font-semibold mr-1.5 select-none">Delete?</span>
              <button
                id={`confirm-delete-btn-${task.id}`}
                onClick={handleDeleteConfirm}
                disabled={loading}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold
                           bg-red-500 hover:bg-red-600 text-white shadow-xs
                           transition-all duration-150 active:scale-95 cursor-pointer disabled:opacity-60"
              >
                <Trash2 size={10} /> Yes
              </button>
              <button
                onClick={() => setIsConfirmingDelete(false)}
                disabled={loading}
                className="flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-bold
                           bg-slate-200 hover:bg-slate-300 text-slate-600
                           transition-all duration-150 active:scale-95 cursor-pointer"
                title="Cancel delete"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              id={`delete-btn-${task.id}`}
              onClick={() => setIsConfirmingDelete(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium
                         text-red-400 hover:bg-red-50 hover:text-red-600
                         transition-all duration-150 active:scale-95 cursor-pointer"
              title="Delete research roadmap"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>

        {/* Expand & Export controls */}
        <div className="flex items-center gap-3">
          {Object.keys(extractedData).length > 0 && (
            <>
              {task.task_type !== "article" && (
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white
                             px-2.5 py-1 rounded-lg shadow-sm transition-colors duration-150 cursor-pointer font-semibold"
                  title="Export custom styled Syllabus PDF"
                >
                  <Download size={13} /> Export PDF
                </button>
              )}
              <button
                onClick={handleShareLink}
                className={`flex items-center gap-1.5 text-xs transition-all duration-150 cursor-pointer font-medium px-2 py-1 rounded-md ${
                  shareCopied
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200 font-bold"
                    : "text-slate-500 hover:text-indigo-600"
                }`}
                title={task.task_type === "article" ? "Copy share link for this article" : "Copy share link for this learning roadmap"}
              >
                {shareCopied ? <Check size={13} /> : <Share2 size={13} />}
                {shareCopied ? "Copied!" : "Share Link"}
              </button>

            </>
          )}

          {(task.search_results || task.final_summary || task.error_message) && (
            <button
              id={`expand-btn-${task.id}`}
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600
                         transition-colors duration-150 cursor-pointer font-medium"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {expanded ? "Hide" : "View"} details
            </button>
          )}
        </div>
      </div>



      {/* Expanded details */}
      {expanded && (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          {/* Error */}
          {task.error_message && (
            <div className="rounded-xl p-3 border border-red-200 bg-red-50/50">
              <div className="flex items-center gap-1.5 text-red-600 font-semibold text-xs mb-1">
                <AlertCircle size={12} /> Error
              </div>
              <p className="text-xs text-red-500">{task.error_message}</p>
              {task.retry_count > 0 && (
                <p className="text-[10px] text-slate-400 mt-1">
                  Retried {task.retry_count}× so far
                </p>
              )}
            </div>
          )}

          {/* NotebookLM Grounded Sources Grid */}
          {sources.length > 0 && (
            <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1">
                <BookOpen size={11} className="text-indigo-500" /> Grounded Sources ({sources.length})
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sources.map((s: { title: string; url: string }, i: number) => {
                  let hostname = "web-source";
                  try {
                    hostname = new URL(s.url).hostname;
                  } catch {
                    hostname = "web-source";
                  }
                  return (
                    <a
                      key={i}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 p-2 rounded-lg bg-white border border-slate-200/60 hover:border-indigo-300 hover:shadow-2xs transition-all duration-150 group"
                    >
                      <div className="w-5 h-5 rounded bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 shrink-0 mt-0.5 border border-slate-100">
                        <Globe size={10} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-slate-700 truncate group-hover:text-indigo-600 leading-tight">
                          {s.title}
                        </p>
                        <p className="text-[9px] text-slate-400 truncate flex items-center gap-0.5 mt-0.5">
                          {hostname}
                          <ExternalLink size={7} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </p>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search angles */}
          {searchAngles.length > 0 && Object.keys(extractedData).length === 0 && (
            <div className="bg-indigo-50/30 rounded-xl p-4 border border-indigo-100/50">
              <p className="text-xs font-bold text-indigo-700 mb-3 uppercase tracking-wider flex items-center gap-1.5">
                <ArrowRight size={13} className="text-indigo-500" />{" "}
                {task.task_type === "article" ? "Article Outline Drafted" : "Syllabus Framework Drafted"}
              </p>
              <div className="space-y-3 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-indigo-100">
                {searchAngles.map((a: string, i: number) => (
                  <div key={i} className="flex items-start gap-3 relative z-10">
                    <span
                      className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 border-2 border-white shadow-xs
                                     flex items-center justify-center text-xs font-bold shrink-0 font-mono"
                    >
                      {i + 1}
                    </span>
                    <p className="text-xs font-medium text-slate-700 mt-1">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extracted findings (Syllabus with Curated resources) */}
          {Object.keys(extractedData).length > 0 && (
            <div className="space-y-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {task.task_type === "article" ? "Section-by-Section Research & Draft" : "Step-by-Step Learning Syllabus"}
              </p>
              <div className="space-y-4 relative before:absolute before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-100">
                {Object.entries(extractedData).map(([angle, data]: [string, any], i: number) => {
                  const isStructured = typeof data === "object" && data !== null;
                  const description = isStructured ? data.findings : (data as string);
                  const stepResources = isStructured ? (data.resources || []) : [];
                  const currentPhaseState = phaseStates[i] || "not_started";

                  return (
                    <div key={i} className="flex gap-4 relative">
                      {/* Left timeline badge */}
                      <div className="flex flex-col items-center shrink-0">
                        <div className={`w-8 h-8 rounded-full font-mono font-bold text-xs flex items-center justify-center shadow-md border-2 border-white relative z-10 transition-all ${
                          task.task_type === "article"
                            ? "bg-slate-700 text-slate-100 shadow-slate-100"
                            : currentPhaseState === "completed"
                            ? "bg-emerald-500 text-white shadow-emerald-100"
                            : currentPhaseState === "in_progress"
                            ? "bg-indigo-500 text-white shadow-indigo-100 animate-pulse"
                            : "bg-slate-300 text-slate-700 shadow-slate-100"
                        }`}>
                          {i + 1}
                        </div>
                      </div>

                      {/* Content Card */}
                      <div className="flex-1 bg-slate-50/45 border border-slate-100 rounded-xl p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100/50">
                          <h4 className="text-xs font-bold text-slate-800 leading-snug">
                            {normalizeAngleTitle(angle, i, task.task_type === "article")}
                          </h4>
                          {/* Phase state controllers */}
                          {task.task_type !== "article" && (
                            <div className="flex items-center gap-1.5 shrink-0 bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/40">
                              <button
                                onClick={() => handlePhaseStateChange(i, "not_started")}
                                className={`px-2 py-0.5 text-[8px] font-bold uppercase rounded transition-all cursor-pointer ${
                                  currentPhaseState === "not_started"
                                    ? "bg-white text-slate-700 shadow-2xs font-extrabold"
                                    : "text-slate-400 hover:text-slate-600"
                                }`}
                              >
                                Todo
                              </button>
                              <button
                                onClick={() => handlePhaseStateChange(i, "in_progress")}
                                className={`px-2 py-0.5 text-[8px] font-bold uppercase rounded transition-all cursor-pointer ${
                                  currentPhaseState === "in_progress"
                                    ? "bg-indigo-500 text-white shadow-2xs font-extrabold"
                                    : "text-slate-400 hover:text-indigo-500"
                                }`}
                              >
                                Doing
                              </button>
                              <button
                                onClick={() => handlePhaseStateChange(i, "completed")}
                                className={`px-2 py-0.5 text-[8px] font-bold uppercase rounded transition-all cursor-pointer ${
                                  currentPhaseState === "completed"
                                    ? "bg-emerald-500 text-white shadow-2xs font-extrabold"
                                    : "text-slate-400 hover:text-emerald-500"
                                }`}
                              >
                                Done
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-slate-600 leading-relaxed mb-3 font-sans">
                          <ReactMarkdown
                            components={{
                              h3: ({node, ...props}) => <h3 className="text-xs font-bold text-indigo-700 mt-3 first:mt-0 mb-1 uppercase tracking-wider flex items-center gap-1" {...props} />,
                              p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2 space-y-0.5" {...props} />,
                              li: ({node, ...props}) => <li className="text-slate-600" {...props} />,
                              pre: ({node, ...props}) => (
                                <div className="w-full overflow-x-auto my-3 bg-slate-950 text-slate-100 rounded-lg p-3 font-mono text-xs shadow-md border border-slate-800 scrollbar-thin">
                                  <pre className="whitespace-pre overflow-x-auto" {...props} />
                                </div>
                              ),
                              code: ({node, className, children, ...props}: any) => {
                                const match = /language-(\w+)/.exec(className || "");
                                const inline = !match;
                                return inline ? (
                                  <code className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold" {...props}>{children}</code>
                                ) : (
                                  <code className="block whitespace-pre font-mono" {...props}>{children}</code>
                                );
                              }
                            }}
                          >
                            {description.replace(/\\n/g, "\n")}
                          </ReactMarkdown>
                        </div>

                        {/* Milestones Resource list */}
                        {stepResources.length > 0 && (
                           <div className="space-y-2 mt-2 pt-3 border-t border-slate-200/50">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {task.task_type === "article" ? "Authoritative References & Citations" : "Handpicked Study Materials"}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {stepResources.map((res: any, idx: number) => {
                                // Match types to icons and classes
                                let IconComp = Globe;
                                let badgeClass = "bg-slate-100 text-slate-600";
                                let typeLabel = res.type || "resource";

                                if (res.type === "video") {
                                  IconComp = Video;
                                  badgeClass = "bg-rose-50 text-rose-600 border border-rose-100";
                                } else if (res.type === "documentation") {
                                  IconComp = BookOpen;
                                  badgeClass = "bg-sky-50 text-sky-700 border border-sky-100";
                                } else if (res.type === "article") {
                                  IconComp = FileText;
                                  badgeClass = "bg-amber-50 text-amber-700 border border-amber-100";
                                } else if (res.type === "interactive") {
                                  IconComp = Code;
                                  badgeClass = "bg-indigo-50 text-indigo-700 border border-indigo-100";
                                }

                                return (
                                  <a
                                    key={idx}
                                    href={res.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block p-2.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-2xs transition-all duration-150 group"
                                  >
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md flex items-center gap-1 ${badgeClass}`}>
                                        <IconComp size={8} />
                                        {typeLabel}
                                      </span>
                                    </div>
                                    <p className="text-[11px] font-bold text-slate-700 line-clamp-1 group-hover:text-indigo-600 leading-tight">
                                      {res.title}
                                    </p>
                                    {res.description && (
                                      <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5 leading-normal">
                                        {res.description}
                                      </p>
                                    )}
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Phase Notes & Scratchpad */}
                        <div className="mt-3 pt-3 border-t border-slate-200/50">
                          {editingNotesIndex === i ? (
                            <div className="space-y-2">
                              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                {task.task_type === "article" ? "Section Research Annotations" : "Phase Notes & Scratchpad"}
                              </label>
                              <textarea
                                value={tempNoteText}
                                onChange={(e) => setTempNoteText(e.target.value)}
                                placeholder={task.task_type === "article" ? "Annotate with notes, quotes, or inline edits for this section..." : "Write down key takeaways, code snippets, or ideas..."}
                                rows={4}
                                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono text-slate-700"
                              />
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => setEditingNotesIndex(null)}
                                  className="px-2.5 py-1 text-[10px] font-medium text-slate-400 hover:text-slate-600 rounded bg-slate-100 cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleSaveNotes(i)}
                                  className="px-2.5 py-1 text-[10px] font-bold text-white bg-indigo-500 hover:bg-indigo-600 rounded shadow-xs cursor-pointer"
                                >
                                  {task.task_type === "article" ? "Save Annotation" : "Save Note"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                {studyNotes[i] ? (
                                  <div className="bg-amber-50/40 border border-amber-100 p-2 rounded-lg">
                                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                                      📝 {task.task_type === "article" ? "Research Annotation" : "Study Note"}
                                    </p>
                                    <p className="text-xs text-slate-600 font-mono whitespace-pre-wrap line-clamp-3">
                                      {studyNotes[i]}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic font-mono">
                                    {task.task_type === "article" ? "No research annotations created for this section." : "No study notes created for this phase."}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleStartEditingNotes(i)}
                                className="px-2 py-1 text-[9px] font-bold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded transition-all cursor-pointer whitespace-nowrap shrink-0 self-end"
                              >
                                {studyNotes[i]
                                  ? (task.task_type === "article" ? "Edit Annotation" : "Edit Note")
                                  : (task.task_type === "article" ? "+ Add Annotation" : "+ Add Note")}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Awaiting approval notice */}
          {task.status === "awaiting_approval" && (
            <div className="rounded-xl p-3 border border-amber-200 bg-amber-50/50">
              <div className="flex items-center gap-1.5 text-amber-600 font-semibold text-xs mb-1">
                <Pause size={12} /> Human Review Required
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {task.task_type === "article"
                  ? "Research outline & findings are drafted. Please review the section points above, then click 'Approve & Continue' to instruct the writer agent to assemble and synthesize the final complete article."
                  : "Research extraction is complete. Please review the findings above, then click 'Approve & Continue' to instruct the agent to generate the final summary."}
              </p>
            </div>
          )}

          {/* Final summary */}
          {task.final_summary && (
            <div>
              <div className="flex items-center gap-1.5 text-emerald-600 font-semibold text-xs mb-2 uppercase tracking-wider">
                <CheckCircle2 size={12} /> {task.task_type === "article" ? "Finished Article Composition" : "Final Synthesis"}
              </div>
              <div className="rounded-xl p-4 border border-emerald-100 bg-emerald-50/10">
                <div className="text-sm text-slate-700 leading-relaxed font-sans space-y-3">
                  <ReactMarkdown
                    components={{
                      h1: ({node, ...props}) => <h1 className="text-lg font-bold text-slate-900 mt-4 mb-2 border-b pb-1 first:mt-0" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-base font-bold text-slate-900 mt-4 mb-2" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-sm font-bold text-slate-800 mt-3 mb-1" {...props} />,
                      p: ({node, ...props}) => <p className="mb-3 leading-relaxed last:mb-0" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />,
                      li: ({node, ...props}) => <li className="text-slate-700" {...props} />,
                      strong: ({node, ...props}) => <strong className="font-bold text-slate-900" {...props} />,
                      pre: ({node, ...props}) => (
                        <div className="w-full overflow-x-auto my-3 bg-slate-950 text-slate-100 rounded-lg p-3 font-mono text-xs shadow-md border border-slate-800 scrollbar-thin">
                          <pre className="whitespace-pre overflow-x-auto" {...props} />
                        </div>
                      ),
                      code: ({node, className, children, ...props}: any) => {
                        const match = /language-(\w+)/.exec(className || "");
                        const inline = !match;
                        return inline ? (
                          <code className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold" {...props}>{children}</code>
                        ) : (
                          <code className="block whitespace-pre font-mono" {...props}>{children}</code>
                        );
                      }
                    }}
                  >
                    {task.final_summary?.replace(/\\n/g, "\n")}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
