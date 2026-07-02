import React, { useState, useEffect } from "react";
import {
  Brain,
  BookOpen,
  ExternalLink,
  Globe,
  Video,
  FileText,
  Code,
  ArrowRight,
  Download,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  Share2,
  Copy,
  Check,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { ResearchTask, tasksApi } from "../lib/api";
import ReactMarkdown from "react-markdown";
import ProgressBar from "./ProgressBar";
import StatusBadge from "./StatusBadge";

const normalizeAngleTitle = (angle: string, i: number, isArticle: boolean) => {
  const clean = angle.replace(/^(section|phase)\s*\d+[:\-]?\s*/i, "").trim();
  return isArticle ? `Section ${i + 1}: ${clean}` : `Phase ${i + 1}: ${clean}`;
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

interface SharedRoadmapProps {
  taskId: number;
  onGoHome: () => void;
}

export default function SharedRoadmap({ taskId, onGoHome }: SharedRoadmapProps) {
  const [task, setTask] = useState<ResearchTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Use localStorage to let the guest track their own study progress on this shared roadmap
  const [phaseStates, setPhaseStates] = useState<Record<number, string>>({});
  const [studyNotes, setStudyNotes] = useState<Record<number, string>>({});
  const [editingNotesIndex, setEditingNotesIndex] = useState<number | null>(null);
  const [tempNoteText, setTempNoteText] = useState("");

  useEffect(() => {
    async function loadSharedRoadmap() {
      setLoading(true);
      setError(null);
      try {
        const data = await tasksApi.getOne(taskId);
        setTask(data);

        // Load phase states from local storage, fallback to the original database states
        const localPhasesKey = `persistiq_shared_phases_${taskId}`;
        const localPhases = localStorage.getItem(localPhasesKey);
        if (localPhases) {
          try {
            setPhaseStates(JSON.parse(localPhases));
          } catch {
            setPhaseStates({});
          }
        } else {
          try {
            setPhaseStates(JSON.parse(data.phase_states || "{}"));
          } catch {
            setPhaseStates({});
          }
        }

        // Load study notes from local storage, fallback to the original database notes
        const localNotesKey = `persistiq_shared_notes_${taskId}`;
        const localNotes = localStorage.getItem(localNotesKey);
        if (localNotes) {
          try {
            setStudyNotes(JSON.parse(localNotes));
          } catch {
            setStudyNotes({});
          }
        } else {
          try {
            setStudyNotes(JSON.parse(data.study_notes || "{}"));
          } catch {
            setStudyNotes({});
          }
        }
      } catch (err: any) {
        console.error("Error loading shared task:", err);
        setError(err.message || "Could not retrieve the shared learning roadmap.");
      } finally {
        setLoading(false);
      }
    }
    loadSharedRoadmap();
  }, [taskId]);

  const handlePhaseStateChange = (index: number, newState: string) => {
    const updated = { ...phaseStates, [index]: newState };
    setPhaseStates(updated);
    localStorage.setItem(`persistiq_shared_phases_${taskId}`, JSON.stringify(updated));
  };

  const handleStartEditingNotes = (index: number) => {
    setEditingNotesIndex(index);
    setTempNoteText(studyNotes[index] || "");
  };

  const handleSaveNotes = (index: number) => {
    const updated = { ...studyNotes, [index]: tempNoteText };
    setStudyNotes(updated);
    localStorage.setItem(`persistiq_shared_notes_${taskId}`, JSON.stringify(updated));
    setEditingNotesIndex(null);
  };

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}?share=${taskId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleExportMarkdown = () => {
    if (!task) return;
    const isArticle = task.task_type === "article";
    const extractedData = (() => {
      try {
        return JSON.parse(task.extracted_data || "{}");
      } catch {
        return {};
      }
    })();

    let md = isArticle
      ? `# Research Article: ${task.topic}\n`
      : `# Syllabus Roadmap: ${task.topic}\n`;
    md += isArticle
      ? `*Generated by Technical Writer & Researcher - Shared Link*\n\n`
      : `*Generated by Syllabus Architect - Shared Link*\n\n`;
    
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

    const cleanTopic = task.topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .substring(0, 45);
    const prefix = isArticle ? "shared-article" : "shared-syllabus";
    const fileName = `${prefix}-${cleanTopic}.md`;

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const handleExportPDF = () => {
    if (!task) return;
    const isArticle = task.task_type === "article";
    const extractedData = (() => {
      try {
        return JSON.parse(task.extracted_data || "{}");
      } catch {
        return {};
      }
    })();

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

    const checkPageBreak = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - margin) {
        doc.addPage();
        y = 25;
        doc.setFillColor(99, 102, 241);
        doc.rect(margin, y - 8, contentWidth, 1.2, "F");
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
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

    // Brand Header
    doc.setFillColor(238, 242, 255);
    doc.roundedRect(margin, y, 48, 6, 1.2, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(79, 70, 229);
    doc.text(isArticle ? "PERSISTIQ ARTICLE AGENT" : "PERSISTIQ STUDY AGENT", margin + 3, y + 4.2);

    doc.setFillColor(99, 102, 241);
    doc.circle(margin + 54, y + 3, 1.1, "F");
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.25);
    doc.line(margin + 54, y + 3, margin + 51, y + 1.5);
    doc.circle(margin + 51, y + 1.5, 0.65, "F");
    doc.line(margin + 54, y + 3, margin + 57, y + 1.5);
    doc.circle(margin + 57, y + 1.5, 0.65, "F");

    y += 12;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    const titleLines = doc.splitTextToSize(task.topic, contentWidth);
    doc.text(titleLines, margin, y);
    y += (titleLines.length * 6) + 4;

    if (!isArticle && task.duration) {
      const durationLabel = `DURATION: ${task.duration.replace("_", " ").toUpperCase()}`;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, 46, 6, 1, 1, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(durationLabel, margin + 3, y + 4.2);
    } else if (isArticle) {
      doc.setFillColor(243, 244, 246); // gray-100
      doc.setDrawColor(229, 231, 235); // gray-200
      doc.roundedRect(margin, y, 45, 6, 1, 1, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(75, 85, 99); // gray-600
      doc.text(`TYPE: RESEARCH ARTICLE`, margin + 3, y + 4.2);
    }

    y += 11;

    doc.setFillColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, 0.4, "F");
    y += 8;

    if (Object.keys(extractedData).length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(100, 116, 139);
      doc.text(isArticle ? "RESEARCH FINDINGS & DRAFT OUTLINE" : "SHARED STUDY SYLLABUS", margin, y);
      y += 8;

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
          doc.text(isArticle ? "RESEARCH ANNOTATION:" : "PERSONAL GUEST NOTE:", cardX + 6, innerY + 3.2);

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

    checkPageBreak(12);
    y += 2;
    doc.setFillColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, 0.3, "F");
    y += 5;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
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

    const cleanTopic = task.topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .substring(0, 45);
    const prefix = isArticle ? "shared-article" : "shared-syllabus";
    doc.save(`${prefix}-${cleanTopic}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 min-h-screen">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100 shadow-sm animate-pulse">
            <Brain size={32} className="text-indigo-600 animate-spin-slow" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-slate-800 text-base">Loading Shared Roadmap...</h3>
            <p className="text-xs text-slate-400 font-medium">Fetching public syllabus data from PersistIQ DB</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 min-h-screen">
        <div className="max-w-md w-full bg-white border border-slate-200 shadow-sm rounded-2xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center mx-auto">
            <AlertCircle size={24} />
          </div>
          <div>
            <h3 className="font-display font-bold text-slate-800 text-lg">Failed to Load Roadmap</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              {error || "The requested study syllabus could not be found or has been deleted."}
            </p>
          </div>
          <button
            onClick={onGoHome}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-colors"
          >
            Go to Home Page
          </button>
        </div>
      </div>
    );
  }

  const extractedData = (() => {
    try {
      return JSON.parse(task.extracted_data || "{}");
    } catch {
      return {};
    }
  })();

  const isCompleted = task.status === "done";
  const isArticle = task.task_type === "article";

  return (
    <div className="min-h-screen w-full bg-slate-50 font-sans text-slate-900 flex flex-col overflow-y-auto">
      {/* Top Banner / Navigation */}
      <header className="sticky top-0 z-20 h-14 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-4 sm:px-6 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onGoHome}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title="Back to Platform"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-indigo-600 animate-pulse" />
            <span className="font-display font-extrabold text-sm text-slate-800 tracking-tight">PersistIQ</span>
          </div>
          <span className="h-4 w-px bg-slate-200"></span>
          <span className="text-[10px] bg-indigo-50 border border-indigo-100/50 text-indigo-600 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
            {isArticle ? "Shared Article" : "Shared Syllabus"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLink}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg border transition-all cursor-pointer font-semibold ${
              copied
                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            {copied ? <Check size={12} /> : <Share2 size={12} />}
            <span className="hidden xs:inline">
              {copied ? "Link Copied!" : isArticle ? "Share Article" : "Share Syllabus"}
            </span>
            <span className="inline xs:hidden">{copied ? "Copied" : "Share"}</span>
          </button>

          <button
            onClick={onGoHome}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 sm:px-4 sm:py-1.5 rounded-lg cursor-pointer shadow-sm shadow-indigo-100 flex items-center gap-1.5 transition-all"
          >
            <span>{isArticle ? "Write Mine" : "Create Mine"}</span>
            <Sparkles size={11} className="animate-pulse" />
          </button>
        </div>
      </header>

      {/* Main Roadmap Contents */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Course Intro Card */}
        <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-5 md:p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded-md">ID #{task.id}</span>
                {isArticle ? (
                  <span className="text-[9px] bg-gray-100 border border-gray-200 text-gray-600 font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
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
              <h1 className="font-display font-black text-slate-800 text-lg sm:text-2xl leading-tight">
                {task.topic}
              </h1>
            </div>
            <div className="shrink-0">
              <StatusBadge status={task.status} />
            </div>
          </div>

          <ProgressBar step={task.current_step} />

          {/* Download buttons */}
          {Object.keys(extractedData).length > 0 && !isArticle && (
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer font-semibold"
                title="Export custom styled PDF matching the website UI"
              >
                <Download size={13} /> Export PDF
              </button>
            </div>
          )}
        </div>

        {/* Study Modules */}
        {Object.keys(extractedData).length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              {isArticle ? "Section-by-Section Research & Draft" : "Step-by-Step Study Guide"}
            </h2>
            <div className="space-y-4 relative before:absolute before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200/60">
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
                        isArticle
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
                    <div className="flex-1 bg-white border border-slate-200/85 rounded-2xl p-4 sm:p-5 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-2 border-b border-slate-100">
                        <h4 className="text-sm font-bold text-slate-800 leading-snug">
                          {normalizeAngleTitle(angle, i, isArticle)}
                        </h4>
                        {/* Phase state controllers */}
                        {!isArticle && (
                          <div className="flex items-center gap-1.5 shrink-0 bg-slate-50 p-0.5 rounded-lg border border-slate-200/40 self-start sm:self-center">
                            <button
                              onClick={() => handlePhaseStateChange(i, "not_started")}
                              className={`px-2 py-0.5 text-[8px] font-bold uppercase rounded transition-all cursor-pointer ${
                                currentPhaseState === "not_started"
                                  ? "bg-white text-slate-700 shadow-2xs font-extrabold border border-slate-200/50"
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
                      
                      <div className="text-xs text-slate-600 leading-relaxed mb-4 font-sans">
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
                            code: ({node, inline, ...props}: any) => {
                              return inline ? (
                                <code className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold" {...props} />
                              ) : (
                                <code className="block whitespace-pre font-mono" {...props} />
                              );
                            }
                          }}
                        >
                          {description}
                        </ReactMarkdown>
                      </div>

                      {/* Milestones Resource list */}
                      {stepResources.length > 0 && (
                        <div className="space-y-2 mt-2 pt-3 border-t border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {isArticle ? "Authoritative References & Citations" : "Handpicked Study Materials"}
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {stepResources.map((res: any, idx: number) => {
                              let IconComp = Globe;
                              let badgeClass = "bg-slate-100 text-slate-600";
                              let typeLabel = res.type || "resource";

                              if (res.type === "video") {
                                IconComp = Video;
                                badgeClass = "bg-rose-50 text-rose-600 border border-rose-100/50";
                              } else if (res.type === "documentation") {
                                IconComp = BookOpen;
                                badgeClass = "bg-sky-50 text-sky-700 border border-sky-100/50";
                              } else if (res.type === "article") {
                                IconComp = FileText;
                                badgeClass = "bg-amber-50 text-amber-700 border border-amber-100/50";
                              } else if (res.type === "interactive") {
                                IconComp = Code;
                                badgeClass = "bg-indigo-50 text-indigo-700 border border-indigo-100/50";
                              }

                              return (
                                <a
                                  key={idx}
                                  href={res.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block p-3 rounded-xl bg-slate-50/50 border border-slate-100 hover:border-indigo-400 hover:bg-white hover:shadow-2xs transition-all duration-150 group"
                                >
                                  <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md flex items-center gap-1 ${badgeClass}`}>
                                      <IconComp size={8} />
                                      {typeLabel}
                                    </span>
                                    <ExternalLink size={10} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
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
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        {editingNotesIndex === i ? (
                          <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {isArticle ? "My Research Annotations & Highlights" : "My Study Notes & Notebook"}
                            </label>
                            <textarea
                              value={tempNoteText}
                              onChange={(e) => setTempNoteText(e.target.value)}
                              placeholder={isArticle ? "Write down research notes, source annotations, or key excerpts..." : "Write down key takeaways, code snippets, or notes..."}
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
                                {isArticle ? "Save Annotation" : "Save Note"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {studyNotes[i] ? (
                                <div className="bg-amber-50/40 border border-amber-100 p-2.5 rounded-xl">
                                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    📝 {isArticle ? "Guest Research Annotation" : "Guest Study Note"}
                                  </p>
                                  <p className="text-xs text-slate-600 font-mono whitespace-pre-wrap line-clamp-3">
                                    {studyNotes[i]}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic font-mono">
                                  {isArticle ? "No research annotations written yet for this section." : "No personal study notes written yet for this module."}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => handleStartEditingNotes(i)}
                              className="px-2.5 py-1 text-[9px] font-bold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 self-end"
                            >
                              {studyNotes[i] ? (isArticle ? "Edit Annotation" : "Edit Note") : (isArticle ? "+ Add Annotation" : "+ Add Note")}
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
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-2">
            <AlertCircle size={24} className="text-amber-500 mx-auto" />
            <h4 className="font-semibold text-slate-800 text-sm">
              {isArticle ? "Article drafting in progress" : "Roadmap building in progress"}
            </h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {isArticle 
                ? "This research article is still fetching search results and drafting paragraphs. Please refresh this page in a moment."
                : "This roadmap is still fetching search results and extracting data. Please refresh this page in a moment."}
            </p>
          </div>
        )}

        {/* Final Synthesis */}
        {task.final_summary && (
          <div className="bg-white border border-slate-200 shadow-xs rounded-2xl p-5 md:p-6 space-y-3">
            <div className="flex items-center gap-1.5 text-emerald-600 font-semibold text-xs uppercase tracking-wider">
              <CheckCircle2 size={12} /> {isArticle ? "Finished Article Composition" : "Final Syllabus Synthesis"}
            </div>
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
                  code: ({node, inline, ...props}: any) => {
                    return inline ? (
                      <code className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold" {...props} />
                    ) : (
                      <code className="block whitespace-pre font-mono" {...props} />
                    );
                  }
                }}
              >
                {task.final_summary}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Inspired CTA Box */}
        <div className="bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg shadow-indigo-100">
          <div className="relative z-10 space-y-4 max-w-lg">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/20 backdrop-blur-xs rounded-full text-[10px] font-bold uppercase tracking-wider">
              <Sparkles size={11} /> {isArticle ? "Powered by AI Research & Writer Agent" : "Powered by AI Syllabus Architect"}
            </div>
            <h3 className="font-display font-black text-lg sm:text-2xl leading-snug">
              {isArticle ? "Inspired by this research article? Write your own!" : "Inspired by this study syllabus? Build your own!"}
            </h3>
            <p className="text-xs text-indigo-100 leading-relaxed">
              {isArticle 
                ? "PersistIQ is a stateful research planner that writes premium, section-by-section detailed articles for any topic from scratch, compiling verified resources and materials from around the web."
                : "PersistIQ is a stateful research planner that designs premium, step-by-step masterclasses for any skill or subject from scratch, curating verified materials from around the web."}
            </p>
            <button
              onClick={onGoHome}
              className="inline-flex items-center gap-2 bg-white text-indigo-600 hover:bg-slate-100 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer active:scale-95"
            >
              {isArticle ? "Write My Research Article" : "Build My Learning Roadmap"}
              <ArrowRight size={13} />
            </button>
          </div>
          <div className="absolute right-[-10%] bottom-[-10%] opacity-20 pointer-events-none">
            <Brain size={200} className="text-white" />
          </div>
        </div>
      </main>

      {/* Shared Footer */}
      <footer className="mt-auto py-6 bg-slate-900 border-t border-slate-800 text-center space-y-2">
        <p className="text-[11px] text-slate-400 font-mono">
          {isArticle 
            ? "PERSISTIQ STATEFUL RESEARCH & WRITING ENGINE © 2026"
            : "PERSISTIQ STATEFUL SYLLABUS BUILDER © 2026"}
        </p>
        <p className="text-[10px] text-slate-500">
          Created with high-craft design and responsive modular layout.
        </p>
      </footer>
    </div>
  );
}
