import { jsPDF } from "jspdf";

type PdfField = {
  label: string;
  value: string;
};

type PdfVariantComparison = {
  label: string;
  regime: string;
  totalTax: string;
  difference: string;
  highlight: string;
};

type PdfChartDatum = {
  label: string;
  value: number;
  color: string;
  accentLabel?: string;
};

export type PremiumPdfPayload = {
  title: string;
  clientName: string;
  reportDate: string;
  cabinetName: string;
  summary: {
    situation: string;
    problem: string;
    recommendation: string;
    estimatedGain: string;
  };
  currentSituation: {
    revenus: PdfField[];
    fortune: PdfField[];
    charges: PdfField[];
    fiscalite: PdfField[];
  };
  taxDetails: PdfField[];
  recommendedTaxDetails?: PdfField[];
  variants: PdfVariantComparison[];
  realEstate: {
    currentRegime: string;
    reformedRegime: string;
    impact: string;
    bullets: string[];
  };
  optimisations: PdfField[];
  charts?: {
    variantComparison?: PdfChartDatum[];
    taxBreakdown?: PdfChartDatum[];
    patrimonyStructure?: PdfChartDatum[];
  };
  finalRecommendation: {
    intro: string;
    logicParagraphs?: string[];
    priorities: string[];
    vigilance: string[];
    conclusion: string;
    useDynamicBlocks?: boolean;
  };
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 52;
const MARGIN_Y = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const DARK = "#11263f";
const ACCENT = "#b88a44";
const TEXT = "#233548";
const MUTED = "#68788b";
const LINE = "#d9dee5";
const SOFT = "#f7f4ef";
const WHITE = "#ffffff";

type TocEntry = {
  title: string;
  pageNumber: number;
};

type ChartDatum = {
  label: string;
  value: number;
  color: string;
  accentLabel?: string;
};

type StructuredConclusionSection = {
  title: string;
  lead: string;
  body: string;
};

type ExecutiveDecisionItem = {
  title: string;
  text: string;
};

type OperationalOptimisationItem = {
  title: string;
  value: string;
  effect: string;
};

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function setText(doc: jsPDF, color: string) {
  const { r, g, b } = hexToRgb(color);
  doc.setTextColor(r, g, b);
}

function setFill(doc: jsPDF, color: string) {
  const { r, g, b } = hexToRgb(color);
  doc.setFillColor(r, g, b);
}

function setDraw(doc: jsPDF, color: string) {
  const { r, g, b } = hexToRgb(color);
  doc.setDrawColor(r, g, b);
}

function normalizeSwissNumber(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return trimmed;
  }

  const sign = trimmed.startsWith("+") || trimmed.startsWith("-") ? trimmed[0] : "";
  let compact = trimmed
    .replace(/^[+-]\s*/, "")
    .replace(/[’]/g, "'")
    .replace(/[^\d\s'.,/]/g, "")
    .replace(/\s+/g, "")
    .replace(/\/+/g, "");

  compact = compact.replace(/[.,](?=\d{3}\b)/g, "");
  compact = compact.replace(/'/g, "");

  const parsed = Number.parseFloat(compact.replace(",", "."));
  if (!Number.isFinite(parsed)) {
    const digits = compact.replace(/[^\d]/g, "");
    if (!digits) {
      return trimmed;
    }

    const groupedFallback = digits.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    return `${sign}${groupedFallback}`;
  }

  const roundedDigits = String(Math.round(parsed));
  if (!roundedDigits) {
    return trimmed;
  }

  const grouped = roundedDigits.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `${sign}${grouped}`;
}

function parseCurrencyNumber(input: string) {
  const normalized = input
    .replace(/\s/g, "")
    .replace(/CHF/gi, "")
    .replace(/'/g, "")
    .replace(/[’]/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePdfText(input: string) {
  let text = input.replace(/[\u00A0\u202F]/g, " ").replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();
  const protectedDates: string[] = [];

  text = text.replace(/\b(\d{2})\.(\d{2})\.(\d)[' ]?(\d{3})\b/g, "$1.$2.$3$4");
  text = text.replace(/\b\d{2}\.\d{2}\.\d{4}\b/g, (match) => {
    protectedDates.push(match);
    return `__DATE_${protectedDates.length - 1}__`;
  });

  text = text.replace(
    /([+-]?\d[\d\s'.,/]*)(?:\s*CHF)/g,
    (_fullMatch, numberPart: string) => `${normalizeSwissNumber(numberPart)} CHF`
  );

  text = text.replace(/([+-]?\d(?=[\d\s'.,/]*[\s'.,/])[\d\s'.,/]{2,}\d)/g, (match) => {
    if (match.includes("CHF")) {
      return match;
    }

    const candidate = normalizeSwissNumber(match);
    return candidate.length >= 4 ? candidate : match;
  });

  const replacements: Array<[RegExp, string]> = [
    [/\bFIPLA Dashboard\b/g, "FIPLA Dashboard"],
    [/\bResume\b/g, "Résumé"],
    [/\bresume\b/g, "résumé"],
    [/\bImpot\b/g, "Impôt"],
    [/\bimpot\b/g, "impôt"],
    [/\bFiscalite\b/g, "Fiscalité"],
    [/\bfiscalite\b/g, "fiscalité"],
    [/\bTresorerie\b/g, "Trésorerie"],
    [/\btresorerie\b/g, "trésorerie"],
    [/\bReforme\b/g, "Réforme"],
    [/\breforme\b/g, "réforme"],
    [/\bStrategie\b/g, "Stratégie"],
    [/\bstrategie\b/g, "stratégie"],
    [/\bDeductions\b/g, "Déductions"],
    [/\bdeductions\b/g, "déductions"],
    [/\bDeduction\b/g, "Déduction"],
    [/\bdeduction\b/g, "déduction"],
    [/\bMaitrise\b/g, "Maîtrise"],
    [/\bmaitrise\b/g, "maîtrise"],
    [/\bRecommandee\b/g, "Recommandée"],
    [/\brecommandee\b/g, "recommandée"],
    [/\bStrategique\b/g, "Stratégique"],
    [/\bstrategique\b/g, "stratégique"],
    [/\bElegante\b/g, "Élégante"],
    [/\belegante\b/g, "élégante"],
    [/\bStructuree\b/g, "Structurée"],
    [/\bstructuree\b/g, "structurée"],
    [/\bFacon\b/g, "Façon"],
    [/\bfacon\b/g, "façon"],
    [/\bMethodique\b/g, "Méthodique"],
    [/\bmethodique\b/g, "méthodique"],
    [/\bPrevoyance\b/g, "Prévoyance"],
    [/\bprevoyance\b/g, "prévoyance"],
    [/\bReduisent\b/g, "Réduisent"],
    [/\breduisent\b/g, "réduisent"],
    [/\bPrivilegie\b/g, "Privilégie"],
    [/\bprivilegie\b/g, "privilégie"],
    [/\bequilibre\b/g, "équilibre"],
    [/\bEquilibre\b/g, "Équilibre"],
    [/\bOEUVRE\b/g, "ŒUVRE"],
    [/\bOeuvre\b/g, "Œuvre"],
    [/\boeuvre\b/g, "œuvre"],
    [/L imp[oô]t/g, "L'impôt"],
    [/l imp[oô]t/g, "l'impôt"],
    [/\ba remettre\b/g, "à remettre"],
    [/\ba partir\b/g, "à partir"],
    [/\ba la\b/g, "à la"],
    [/\ba l'/g, "à l'"],
  ];

  replacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });

  text = text.replace(/__DATE_(\d+)__/g, (_match, index: string) => protectedDates[Number(index)] ?? "");

  return text;
}

function splitText(doc: jsPDF, text: string, width: number) {
  return doc.splitTextToSize(normalizePdfText(text), width) as string[];
}

function splitTextByParagraphs(doc: jsPDF, text: string, width: number) {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => normalizePdfText(paragraph))
    .filter(Boolean)
    .map((paragraph) => doc.splitTextToSize(paragraph, width) as string[]);
}

function drawTextLines(
  doc: jsPDF,
  lines: string[],
  x: number,
  y: number,
  options?: { lineHeight?: number; align?: "left" | "right" | "center"; maxWidth?: number }
) {
  const lineHeight = options?.lineHeight ?? 14;

  lines.forEach((line, index) => {
    doc.text(line, x, y + index * lineHeight, {
      align: options?.align,
      maxWidth: options?.maxWidth,
    });
  });
}

function fitTextBlock(
  doc: jsPDF,
  text: string,
  width: number,
  options?: { maxFontSize?: number; minFontSize?: number; maxLines?: number }
) {
  const maxFontSize = options?.maxFontSize ?? 16;
  const minFontSize = options?.minFontSize ?? 9;
  const maxLines = options?.maxLines ?? 2;

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 0.5) {
    doc.setFontSize(fontSize);
    const lines = splitText(doc, text, width);
    if (lines.length <= maxLines) {
      return { fontSize, lines };
    }
  }

  doc.setFontSize(minFontSize);
  return {
    fontSize: minFontSize,
    lines: splitText(doc, text, width),
  };
}

function fitTitleBlock(
  doc: jsPDF,
  text: string,
  width: number,
  options?: { maxFontSize?: number; minFontSize?: number; maxLines?: number }
) {
  const fitted = fitTextBlock(doc, normalizePdfText(text).toUpperCase(), width, {
    maxFontSize: options?.maxFontSize ?? 10.5,
    minFontSize: options?.minFontSize ?? 8.25,
    maxLines: options?.maxLines ?? 3,
  });

  return {
    fontSize: fitted.fontSize,
    lines: fitted.lines,
    lineHeight: Math.max(10, fitted.fontSize + 2),
  };
}

function splitSentences(text: string) {
  return normalizePdfText(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function clampTextLines(doc: jsPDF, text: string, width: number, maxLines: number) {
  const lines = splitText(doc, text, width);

  if (lines.length <= maxLines) {
    return lines;
  }

  const truncated = lines.slice(0, maxLines);
  const last = truncated[maxLines - 1] ?? "";
  truncated[maxLines - 1] = `${last.replace(/[. ]+$/g, "")}...`;
  return truncated;
}

function buildExecutiveDecisionItems(payload: PremiumPdfPayload): ExecutiveDecisionItem[] {
  return [
    {
      title: "Situation actuelle",
      text: payload.summary.situation,
    },
    {
      title: "Recommandation",
      text: payload.summary.recommendation,
    },
    {
      title: "Impact fiscal",
      text: `Gain estimé ${payload.summary.estimatedGain}.`,
    },
    {
      title: "Décision",
      text: `Retenir la variante recommandée et engager une mise en œuvre structurée, lisible et documentée.`,
    },
  ];
}

function drawExecutiveDecisionPanel(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  items: ExecutiveDecisionItem[]
) {
  const paddingX = 18;
  const innerWidth = width - paddingX * 2;
  const rowGap = 12;
  const rowHeight = 64;
  const titleY = y + 24;

  drawRect(doc, x, y, width, 56 + items.length * rowHeight + (items.length - 1) * rowGap, WHITE);
  setDraw(doc, LINE);
  doc.roundedRect(x, y, width, 56 + items.length * rowHeight + (items.length - 1) * rowGap, 12, 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setText(doc, DARK);
  doc.text("LECTURE DÉCISIONNELLE", x + paddingX, titleY);

  let rowY = y + 42;
  items.forEach((item, index) => {
    drawRect(doc, x + paddingX, rowY, innerWidth, rowHeight, SOFT);
    setDraw(doc, LINE);
    doc.roundedRect(x + paddingX, rowY, innerWidth, rowHeight, 10, 10);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.75);
    setText(doc, ACCENT);
    doc.text("•", x + paddingX + 14, rowY + 20);
    setText(doc, DARK);
    doc.text(normalizePdfText(item.title).toUpperCase(), x + paddingX + 28, rowY + 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setText(doc, TEXT);
    drawTextLines(
      doc,
      clampTextLines(doc, item.text, innerWidth - 36, 2),
      x + paddingX + 28,
      rowY + 38,
      {
        lineHeight: 14,
        maxWidth: innerWidth - 36,
      }
    );

    rowY += rowHeight + (index < items.length - 1 ? rowGap : 0);
  });

  return 56 + items.length * rowHeight + (items.length - 1) * rowGap;
}

function buildOperationalOptimisationItems(fields: PdfField[]): OperationalOptimisationItem[] {
  return fields.map((field) => {
    const normalizedLabel = normalizePdfText(field.label).toLowerCase();

    if (normalizedLabel.includes("3e pilier")) {
      return {
        title: "3e pilier",
        value: field.value,
        effect:
          field.value.startsWith("0")
            ? "Aucun versement complémentaire n'est actuellement activé dans cette variante."
            : "Versement activé avec effet direct sur la base imposable et sur la discipline d'épargne.",
      };
    }

    if (normalizedLabel.includes("lpp")) {
      return {
        title: "Rachat LPP",
        value: field.value,
        effect:
          field.value.startsWith("0")
            ? "Aucun rachat n'est retenu à ce stade ; le levier reste à analyser selon la capacité et l'horizon."
            : "Rachat planifié pour renforcer la prévoyance et améliorer l'efficacité fiscale du dossier.",
      };
    }

    if (normalizedLabel.includes("ajustement")) {
      return {
        title: "Ajustement manuel",
        value: field.value,
        effect:
          field.value.startsWith("0") || field.value.startsWith("+0") || field.value.startsWith("-0")
            ? "Aucun ajustement complémentaire n'est nécessaire dans la configuration recommandée."
            : "Ajustement intégré à la projection pour affiner le revenu retenu et stabiliser la trajectoire.",
      };
    }

    return {
      title: "Autres leviers",
      value: "Action qualitative",
      effect: field.value,
    };
  });
}

function drawOperationalOptimisationPanel(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  fields: PdfField[]
) {
  const items = buildOperationalOptimisationItems(fields);
  const paddingX = 20;
  const innerWidth = width - paddingX * 2;
  const rowGap = 14;

  const rowHeights = items.map((item) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.75);
    const effectLines = splitText(doc, item.effect, innerWidth - 106);
    return Math.max(76, 38 + effectLines.length * 13);
  });

  const panelHeight =
    52 + rowHeights.reduce((sum, height) => sum + height, 0) + Math.max(0, items.length - 1) * rowGap;

  drawRect(doc, x, y, width, panelHeight, WHITE);
  setDraw(doc, LINE);
  doc.roundedRect(x, y, width, panelHeight, 12, 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setText(doc, DARK);
  doc.text(normalizePdfText(title), x + paddingX, y + 24);

  let rowY = y + 48;
  items.forEach((item, index) => {
    const rowHeight = rowHeights[index];
    drawRect(doc, x + paddingX, rowY, innerWidth, rowHeight, SOFT);
    setDraw(doc, LINE);
    doc.roundedRect(x + paddingX, rowY, innerWidth, rowHeight, 10, 10);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    setText(doc, ACCENT);
    doc.text(normalizePdfText(item.title).toUpperCase(), x + paddingX + 14, rowY + 20);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.25);
    setText(doc, DARK);
    doc.text(normalizePdfText(item.value), x + width - paddingX - 14, rowY + 20, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.75);
    setText(doc, TEXT);
    drawTextLines(doc, splitText(doc, item.effect, innerWidth - 28), x + paddingX + 14, rowY + 40, {
      lineHeight: 13,
      maxWidth: innerWidth - 28,
    });

    rowY += rowHeight + rowGap;
  });

  return panelHeight;
}

function buildDecisionNarrative(payload: PremiumPdfPayload) {
  return normalizePdfText(
    `${payload.finalRecommendation.intro} ${payload.summary.recommendation} La recommandation proposée s'inscrit dans une logique de cohérence patrimoniale globale : elle vise à améliorer la lisibilité du dossier, à préserver la liquidité disponible et à sécuriser les arbitrages qui produisent un effet fiscal tangible sans dénaturer la stratégie retenue.`
  );
}

function buildClosingNarrative(payload: PremiumPdfPayload) {
  return normalizePdfText(
    `${payload.finalRecommendation.conclusion} La mise en oeuvre peut être conduite avec méthode, en priorisant d'abord les mesures immédiatement activables, puis les ajustements plus structurants. L'enjeu est de conserver une trajectoire cohérente entre protection patrimoniale, maîtrise fiscale et qualité de détention des actifs, afin que chaque décision reste compréhensible, documentée et soutenable dans le temps.`
  );
}

function buildDetailedPriorities(priorities: string[]) {
  const prefixes = [
    "Court terme",
    "Mise en oeuvre",
    "Moyen terme",
    "Suivi patrimonial",
  ];

  return priorities.map((item, index) =>
    normalizePdfText(
      `${prefixes[index] ?? "Pilotage"} : ${item}. L'action doit être séquencée dans le temps et suivie au regard de son effet attendu.`
    )
  );
}

function buildDetailedVigilance(vigilance: string[]) {
  return vigilance.map((item) =>
    normalizePdfText(
      `${item}. Le contrôle de cohérence documentaire et patrimoniale doit rester constant afin d'éviter tout effet fiscal non souhaité.`
    )
  );
}

function getDynamicRecommendationLogicText(payload: PremiumPdfPayload) {
  if (payload.finalRecommendation.useDynamicBlocks) {
    const logicParagraphs = (payload.finalRecommendation.logicParagraphs ?? [])
      .map((paragraph) => normalizePdfText(paragraph))
      .filter(Boolean);

    if (logicParagraphs.length > 0) {
      return logicParagraphs.join("\n\n");
    }
  }

  return buildDecisionNarrative(payload);
}

function getDynamicRecommendationPriorities(payload: PremiumPdfPayload) {
  if (payload.finalRecommendation.useDynamicBlocks) {
    const priorities = payload.finalRecommendation.priorities
      .map((item) => normalizePdfText(item))
      .filter(Boolean);

    if (priorities.length > 0) {
      return priorities;
    }
  }

  return buildDetailedPriorities(payload.finalRecommendation.priorities);
}

function getDynamicRecommendationVigilance(payload: PremiumPdfPayload) {
  if (payload.finalRecommendation.useDynamicBlocks) {
    const vigilance = payload.finalRecommendation.vigilance
      .map((item) => normalizePdfText(item))
      .filter(Boolean);

    if (vigilance.length > 0) {
      return vigilance;
    }
  }

  return buildDetailedVigilance(payload.finalRecommendation.vigilance);
}

function getDynamicRecommendationConclusion(payload: PremiumPdfPayload) {
  if (payload.finalRecommendation.useDynamicBlocks) {
    const conclusion = payload.finalRecommendation.conclusion
      .split(/\n\s*\n/)
      .map((paragraph) => normalizePdfText(paragraph))
      .filter(Boolean)
      .join("\n\n");

    if (conclusion) {
      return conclusion;
    }
  }

  return buildClosingNarrative(payload);
}

function drawRect(doc: jsPDF, x: number, y: number, width: number, height: number, fill: string) {
  setFill(doc, fill);
  doc.roundedRect(x, y, width, height, 12, 12, "F");
}

function drawPageChrome(doc: jsPDF, pageNumber: number, title: string) {
  setDraw(doc, LINE);
  doc.setLineWidth(1);
  doc.line(MARGIN_X, MARGIN_Y - 18, PAGE_WIDTH - MARGIN_X, MARGIN_Y - 18);
  doc.line(
    MARGIN_X,
    PAGE_HEIGHT - MARGIN_Y + 10,
    PAGE_WIDTH - MARGIN_X,
    PAGE_HEIGHT - MARGIN_Y + 10
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText(doc, MUTED);
  doc.text(normalizePdfText(title), MARGIN_X, PAGE_HEIGHT - MARGIN_Y + 28);
  doc.text(String(pageNumber).padStart(2, "0"), PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - MARGIN_Y + 28, {
    align: "right",
  });
}

function addPageTitle(doc: jsPDF, pageNumber: number, title: string, subtitle: string) {
  drawPageChrome(doc, pageNumber, "FIPLA Dashboard");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setText(doc, ACCENT);
  doc.text(`PAGE ${String(pageNumber).padStart(2, "0")}`, MARGIN_X, MARGIN_Y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  setText(doc, DARK);
  doc.text(normalizePdfText(title), MARGIN_X, MARGIN_Y + 32);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  setText(doc, MUTED);
  doc.text(splitText(doc, subtitle, CONTENT_WIDTH), MARGIN_X, MARGIN_Y + 56);
}

function drawTableOfContents(doc: jsPDF, pageNumber: number, entries: TocEntry[]) {
  doc.setPage(pageNumber);
  addPageTitle(
    doc,
    pageNumber,
    "Table des matières",
    "Repères de lecture du rapport pour accéder rapidement aux grandes sections du document."
  );

  const startY = 168;
  const rowHeight = 34;
  const titleX = MARGIN_X;
  const pageX = PAGE_WIDTH - MARGIN_X;
  const dotStartX = MARGIN_X + 190;
  const dotEndX = PAGE_WIDTH - MARGIN_X - 28;

  entries.forEach((entry, index) => {
    const rowY = startY + index * rowHeight;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    setText(doc, TEXT);
    doc.text(normalizePdfText(entry.title), titleX, rowY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    setText(doc, DARK);
    doc.text(String(entry.pageNumber), pageX, rowY, { align: "right" });

    setDraw(doc, LINE);
    doc.setLineWidth(0.8);
    doc.setLineDashPattern([1, 2], 0);
    doc.line(dotStartX, rowY - 4, dotEndX, rowY - 4);
    doc.setLineDashPattern([], 0);
  });
}

function drawInfoBlock(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  body: string,
  options?: {
    fill?: string;
    titleColor?: string;
    bodyColor?: string;
    minHeight?: number;
    paddingX?: number;
    titleOffsetY?: number;
    bodyOffsetY?: number;
    lineHeight?: number;
    bodyFontSize?: number;
    bodyWidth?: number;
    paragraphGap?: number;
    preserveParagraphs?: boolean;
  }
) {
  const paddingX = options?.paddingX ?? 15;
  const lineHeight = options?.lineHeight ?? 16;
  const bodyFontSize = options?.bodyFontSize ?? 10.5;
  const innerWidth = options?.bodyWidth ?? width - paddingX * 2;
  const paragraphGap = options?.paragraphGap ?? 8;
  const titleBlock = fitTitleBlock(doc, title, innerWidth);
  const titleBaseY = y + (options?.titleOffsetY ?? 22);
  const titleHeight = titleBlock.lines.length * titleBlock.lineHeight;
  const bodyStartY = Math.max(y + (options?.bodyOffsetY ?? 50), titleBaseY + titleHeight + 12);
  doc.setFontSize(bodyFontSize);
  const paragraphs = options?.preserveParagraphs
    ? splitTextByParagraphs(doc, body, innerWidth)
    : [splitText(doc, body, innerWidth)];
  const bodyHeight =
    paragraphs.reduce((total, paragraphLines) => total + paragraphLines.length * lineHeight, 0) +
    Math.max(0, paragraphs.length - 1) * paragraphGap;
  const blockHeight = Math.max(options?.minHeight ?? 104, bodyStartY - y + bodyHeight + 14);

  drawRect(doc, x, y, width, blockHeight, options?.fill ?? WHITE);
  setDraw(doc, LINE);
  doc.roundedRect(x, y, width, blockHeight, 12, 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(titleBlock.fontSize);
  setText(doc, options?.titleColor ?? DARK);
  drawTextLines(doc, titleBlock.lines, x + paddingX, titleBaseY, {
    lineHeight: titleBlock.lineHeight,
    maxWidth: innerWidth,
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(bodyFontSize);
  setText(doc, options?.bodyColor ?? TEXT);
  let paragraphY = bodyStartY;
  paragraphs.forEach((paragraphLines, index) => {
    drawTextLines(doc, paragraphLines, x + paddingX, paragraphY, {
      lineHeight,
      maxWidth: innerWidth,
    });
    paragraphY += paragraphLines.length * lineHeight;
    if (index < paragraphs.length - 1) {
      paragraphY += paragraphGap;
    }
  });

  return blockHeight;
}

function inferConclusionSectionTitle(paragraph: string, index: number) {
  const text = normalizePdfText(paragraph).toLowerCase();

  if (index === 0) {
    return "Décision retenue";
  }
  if (text.includes("pilotée dans le temps") || text.includes("long terme") || text.includes("décisions futures")) {
    return "Vision de long terme";
  }
  if (text.includes("famil") || text.includes("enfants") || text.includes("prévoyance")) {
    return "Cadre familial";
  }
  if (text.includes("immobili") || text.includes("patrimoniale cohérente")) {
    return "Cohérence patrimoniale";
  }
  if (text.includes("mise en œuvre") || text.includes("mise en oeuvre")) {
    return "Mise en œuvre";
  }

  return `Point clé ${index + 1}`;
}

function buildStructuredConclusionSections(body: string) {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => normalizePdfText(paragraph).trim())
    .filter(Boolean)
    .map((paragraph, index) => {
      const sentenceMatch = paragraph.match(/^.*?[.!?](?:\s|$)/);
      const lead = sentenceMatch ? sentenceMatch[0].trim() : paragraph;
      const remainder = paragraph.slice(lead.length).trim();

      return {
        title: inferConclusionSectionTitle(paragraph, index),
        lead,
        body: remainder,
      };
    });
}

function getStructuredConclusionSectionHeight(
  doc: jsPDF,
  section: StructuredConclusionSection,
  width: number,
  options?: {
    titleFontSize?: number;
    leadFontSize?: number;
    bodyFontSize?: number;
    titleLineHeight?: number;
    leadLineHeight?: number;
    bodyLineHeight?: number;
  }
) {
  const titleFontSize = options?.titleFontSize ?? 10.5;
  const leadFontSize = options?.leadFontSize ?? 10.5;
  const bodyFontSize = options?.bodyFontSize ?? 10.5;
  const titleLineHeight = options?.titleLineHeight ?? 14;
  const leadLineHeight = options?.leadLineHeight ?? 18;
  const bodyLineHeight = options?.bodyLineHeight ?? 18;
  const bodyBulletGap = 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(titleFontSize);
  const titleLines = splitText(doc, section.title.toUpperCase(), width - 18);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(leadFontSize);
  const leadLines = splitText(doc, section.lead, width - 18);

  const bodySentences = splitSentences(section.body);
  const bodyHeight = bodySentences.reduce((total, sentence) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodyFontSize);
    const bodyLines = splitText(doc, sentence, width - 32);
    return total + bodyLines.length * bodyLineHeight + bodyBulletGap;
  }, 0);

  return (
    titleLines.length * titleLineHeight +
    10 +
    leadLines.length * leadLineHeight +
    (bodyHeight > 0 ? 8 + bodyHeight : 0) +
    18
  );
}

function getStructuredConclusionBlockHeight(
  doc: jsPDF,
  width: number,
  title: string,
  body: string,
  options?: {
    minHeight?: number;
    paddingX?: number;
    titleOffsetY?: number;
    bodyOffsetY?: number;
    titleFontSize?: number;
    leadFontSize?: number;
    bodyFontSize?: number;
    titleLineHeight?: number;
    leadLineHeight?: number;
    bodyLineHeight?: number;
    sectionGap?: number;
  }
) {
  const paddingX = options?.paddingX ?? 24;
  const innerWidth = width - paddingX * 2;
  const titleBlock = fitTitleBlock(doc, title, innerWidth);
  const titleBaseY = options?.titleOffsetY ?? 22;
  const titleHeight = titleBlock.lines.length * titleBlock.lineHeight;
  const bodyStartOffset = Math.max(options?.bodyOffsetY ?? 54, titleBaseY + titleHeight + 14);
  const sections = buildStructuredConclusionSections(body);
  const sectionGap = options?.sectionGap ?? 18;
  const sectionsHeight =
    sections.reduce(
      (total, section) =>
        total +
        getStructuredConclusionSectionHeight(doc, section, innerWidth, options),
      0
    ) +
    Math.max(0, sections.length - 1) * sectionGap;

  return Math.max(options?.minHeight ?? 160, bodyStartOffset + sectionsHeight + 12);
}

function drawStructuredConclusionBlock(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  body: string,
  options?: {
    fill?: string;
    minHeight?: number;
    paddingX?: number;
    titleOffsetY?: number;
    bodyOffsetY?: number;
    titleFontSize?: number;
    leadFontSize?: number;
    bodyFontSize?: number;
    titleLineHeight?: number;
    leadLineHeight?: number;
    bodyLineHeight?: number;
    sectionGap?: number;
  }
) {
  const paddingX = options?.paddingX ?? 24;
  const innerWidth = width - paddingX * 2;
  const titleBlock = fitTitleBlock(doc, title, innerWidth);
  const titleBaseY = y + (options?.titleOffsetY ?? 22);
  const titleHeight = titleBlock.lines.length * titleBlock.lineHeight;
  const bodyStartY = Math.max(y + (options?.bodyOffsetY ?? 54), titleBaseY + titleHeight + 14);
  const blockHeight = getStructuredConclusionBlockHeight(doc, width, title, body, options);
  const sections = buildStructuredConclusionSections(body);
  const sectionGap = options?.sectionGap ?? 18;
  const sectionTitleFontSize = options?.titleFontSize ?? 10.25;
  const leadFontSize = options?.leadFontSize ?? 10.75;
  const bodyFontSize = options?.bodyFontSize ?? 10.5;
  const sectionTitleLineHeight = options?.titleLineHeight ?? 14;
  const leadLineHeight = options?.leadLineHeight ?? 18;
  const bodyLineHeight = options?.bodyLineHeight ?? 18;
  const bodyBulletGap = 8;

  drawRect(doc, x, y, width, blockHeight, options?.fill ?? SOFT);
  setDraw(doc, LINE);
  doc.roundedRect(x, y, width, blockHeight, 12, 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(titleBlock.fontSize);
  setText(doc, DARK);
  drawTextLines(doc, titleBlock.lines, x + paddingX, titleBaseY, {
    lineHeight: titleBlock.lineHeight,
    maxWidth: innerWidth,
  });

  let sectionY = bodyStartY;
  sections.forEach((section, index) => {
    if (index > 0) {
      setDraw(doc, LINE);
      doc.line(x + paddingX, sectionY - 10, x + width - paddingX, sectionY - 10);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(sectionTitleFontSize);
    setText(doc, ACCENT);
    doc.text("•", x + paddingX, sectionY);
    setText(doc, DARK);
    drawTextLines(doc, splitText(doc, section.title.toUpperCase(), innerWidth - 18), x + paddingX + 14, sectionY, {
      lineHeight: sectionTitleLineHeight,
      maxWidth: innerWidth - 18,
    });

    const titleLines = splitText(doc, section.title.toUpperCase(), innerWidth - 18);
    const leadY = sectionY + titleLines.length * sectionTitleLineHeight + 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(leadFontSize);
    setText(doc, TEXT);
    const leadLines = splitText(doc, section.lead, innerWidth - 18);
    drawTextLines(doc, leadLines, x + paddingX + 14, leadY, {
      lineHeight: leadLineHeight,
      maxWidth: innerWidth - 18,
    });

    let nextY = leadY + leadLines.length * leadLineHeight;

    if (section.body) {
      let bodyY = nextY + 8;
      splitSentences(section.body).forEach((sentence) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        setText(doc, ACCENT);
        doc.text("•", x + paddingX + 14, bodyY);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(bodyFontSize);
        setText(doc, TEXT);
        const bodyLines = splitText(doc, sentence, innerWidth - 32);
        drawTextLines(doc, bodyLines, x + paddingX + 28, bodyY, {
          lineHeight: bodyLineHeight,
          maxWidth: innerWidth - 32,
        });
        bodyY += bodyLines.length * bodyLineHeight + bodyBulletGap;
      });
      nextY = bodyY - bodyBulletGap;
    }

    sectionY = nextY + sectionGap;
  });

  return blockHeight;
}

function getInfoBlockHeight(
  doc: jsPDF,
  width: number,
  title: string,
  body: string,
  options?: {
    minHeight?: number;
    paddingX?: number;
    titleOffsetY?: number;
    bodyOffsetY?: number;
    lineHeight?: number;
    bodyFontSize?: number;
    bodyWidth?: number;
    paragraphGap?: number;
    preserveParagraphs?: boolean;
  }
) {
  const paddingX = options?.paddingX ?? 15;
  const lineHeight = options?.lineHeight ?? 16;
  const bodyFontSize = options?.bodyFontSize ?? 10.5;
  const innerWidth = options?.bodyWidth ?? width - paddingX * 2;
  const paragraphGap = options?.paragraphGap ?? 8;
  const titleBlock = fitTitleBlock(doc, title, innerWidth);
  const titleBaseY = options?.titleOffsetY ?? 22;
  const titleHeight = titleBlock.lines.length * titleBlock.lineHeight;
  const bodyStartOffset = Math.max(options?.bodyOffsetY ?? 50, titleBaseY + titleHeight + 12);
  doc.setFontSize(bodyFontSize);
  const paragraphs = options?.preserveParagraphs
    ? splitTextByParagraphs(doc, body, innerWidth)
    : [splitText(doc, body, innerWidth)];
  const bodyHeight =
    paragraphs.reduce((total, paragraphLines) => total + paragraphLines.length * lineHeight, 0) +
    Math.max(0, paragraphs.length - 1) * paragraphGap;

  return Math.max(options?.minHeight ?? 104, bodyStartOffset + bodyHeight + 14);
}

function drawFieldPanel(doc: jsPDF, x: number, y: number, width: number, title: string, fields: PdfField[]) {
  const innerPadding = 14;
  const titleLines = splitText(doc, title, width - innerPadding * 2);
  const labelWidth = width * 0.34;
  const valueWidth = width * 0.44;
  const rowHeights = fields.map((field) => {
    const labelLines = splitText(doc, field.label, labelWidth);
    const valueLines = splitText(doc, field.value, valueWidth);
    return Math.max(labelLines.length, valueLines.length) * 13 + 18;
  });
  const panelHeight = 34 + titleLines.length * 14 + rowHeights.reduce((sum, height) => sum + height, 0);

  drawRect(doc, x, y, width, panelHeight, WHITE);
  setDraw(doc, LINE);
  doc.roundedRect(x, y, width, panelHeight, 12, 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setText(doc, DARK);
  drawTextLines(doc, titleLines, x + innerPadding, y + 24, { lineHeight: 14, maxWidth: width - innerPadding * 2 });

  let rowY = y + 22 + titleLines.length * 14 + 12;

  fields.forEach((field, index) => {
    const labelLines = splitText(doc, field.label, labelWidth);
    const valueLines = splitText(doc, field.value, valueWidth);
    const rowHeight = rowHeights[index];

    if (index > 0) {
      setDraw(doc, LINE);
      doc.line(x + innerPadding, rowY, x + width - innerPadding, rowY);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setText(doc, MUTED);
    drawTextLines(doc, labelLines, x + innerPadding, rowY + 15, { lineHeight: 13, maxWidth: labelWidth });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(doc, TEXT);
    drawTextLines(doc, valueLines, x + width - innerPadding, rowY + 15, {
      lineHeight: 13,
      align: "right",
      maxWidth: valueWidth,
    });

    rowY += rowHeight;
  });

  return panelHeight;
}

function drawMetricBand(doc: jsPDF, y: number, metrics: PdfField[]) {
  const gap = 10;
  const boxWidth = (CONTENT_WIDTH - gap * (metrics.length - 1)) / metrics.length;
  const preparedMetrics = metrics.map((metric) => {
    const labelLines = splitText(doc, metric.label, boxWidth - 24);
    doc.setFont("helvetica", "bold");
    const fittedValue = fitTextBlock(doc, metric.value, boxWidth - 24, {
      maxFontSize: 15.5,
      minFontSize: 10.5,
      maxLines: 3,
    });

    return { metric, labelLines, fittedValue };
  });
  const maxLabelLines = Math.max(...preparedMetrics.map((metric) => metric.labelLines.length), 1);
  const maxValueLines = Math.max(...preparedMetrics.map((metric) => metric.fittedValue.lines.length), 1);
  const labelY = y + 20;
  const valueY = labelY + maxLabelLines * 12 + 14;
  const boxHeight = Math.max(110, valueY - y + maxValueLines * 16 + 18);

  preparedMetrics.forEach(({ labelLines, fittedValue }, index) => {
    const x = MARGIN_X + index * (boxWidth + gap);

    drawRect(doc, x, y, boxWidth, boxHeight, SOFT);
    setDraw(doc, LINE);
    doc.roundedRect(x, y, boxWidth, boxHeight, 12, 12);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    setText(doc, MUTED);
    drawTextLines(
      doc,
      labelLines.map((line) => normalizePdfText(line).toUpperCase()),
      x + 12,
      labelY,
      { lineHeight: 12, maxWidth: boxWidth - 24 }
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(fittedValue.fontSize);
    setText(doc, DARK);
    drawTextLines(doc, fittedValue.lines, x + 12, valueY, {
      lineHeight: 16,
      maxWidth: boxWidth - 24,
    });
  });

  return boxHeight;
}

function drawBulletPanel(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  items: string[],
  options?: { minHeight?: number; paddingX?: number; topOffset?: number; lineHeight?: number }
) {
  const paddingX = options?.paddingX ?? 16;
  const lineHeight = options?.lineHeight ?? 15;
  const wrappedItems = items.map((item) => splitText(doc, item, width - (paddingX + 20) - 14));
  const contentHeight = wrappedItems.reduce((total, item) => total + item.length * lineHeight + 14, 0);
  const panelHeight = Math.max(options?.minHeight ?? 132, (options?.topOffset ?? 54) + contentHeight);

  drawRect(doc, x, y, width, panelHeight, WHITE);
  setDraw(doc, LINE);
  doc.roundedRect(x, y, width, panelHeight, 12, 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setText(doc, DARK);
  doc.text(normalizePdfText(title), x + paddingX, y + 24);

  let itemY = y + (options?.topOffset ?? 54);

  wrappedItems.forEach((item) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    setText(doc, ACCENT);
    doc.text("•", x + paddingX, itemY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.25);
    setText(doc, TEXT);
    drawTextLines(doc, item, x + paddingX + 14, itemY, {
      lineHeight,
      maxWidth: width - (paddingX + 20) - 14,
    });
    itemY += item.length * lineHeight + 14;
  });

  return panelHeight;
}

function getBulletPanelHeight(
  doc: jsPDF,
  width: number,
  items: string[],
  options?: { minHeight?: number; paddingX?: number; topOffset?: number; lineHeight?: number }
) {
  const paddingX = options?.paddingX ?? 16;
  const lineHeight = options?.lineHeight ?? 15;
  const wrappedItems = items.map((item) => splitText(doc, item, width - (paddingX + 20) - 14));
  const contentHeight = wrappedItems.reduce((total, item) => total + item.length * lineHeight + 14, 0);

  return Math.max(options?.minHeight ?? 132, (options?.topOffset ?? 54) + contentHeight);
}

function splitBulletItemsByHeight(
  doc: jsPDF,
  width: number,
  items: string[],
  maxHeight: number,
  options?: { minHeight?: number; paddingX?: number; topOffset?: number; lineHeight?: number }
) {
  const chunks: string[][] = [];
  let currentChunk: string[] = [];

  items.forEach((item) => {
    const nextChunk = [...currentChunk, item];
    const nextHeight = getBulletPanelHeight(doc, width, nextChunk, {
      ...options,
      minHeight: 0,
    });

    if (currentChunk.length > 0 && nextHeight > maxHeight) {
      chunks.push(currentChunk);
      currentChunk = [item];
      return;
    }

    currentChunk = nextChunk;
  });

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function splitStructuredConclusionSectionsByHeight(
  doc: jsPDF,
  width: number,
  body: string,
  maxHeight: number,
  options?: {
    paddingX?: number;
    bodyOffsetY?: number;
    titleOffsetY?: number;
    minHeight?: number;
    titleFontSize?: number;
    leadFontSize?: number;
    bodyFontSize?: number;
    titleLineHeight?: number;
    leadLineHeight?: number;
    bodyLineHeight?: number;
    sectionGap?: number;
  }
) {
  const paddingX = options?.paddingX ?? 24;
  const innerWidth = width - paddingX * 2;
  const titleBlock = fitTitleBlock(doc, "Conclusion et mise en oeuvre", innerWidth);
  const titleBaseY = options?.titleOffsetY ?? 22;
  const titleHeight = titleBlock.lines.length * titleBlock.lineHeight;
  const bodyOffsetY = Math.max(options?.bodyOffsetY ?? 54, titleBaseY + titleHeight + 14);
  const availableHeight = Math.max(80, maxHeight - bodyOffsetY - 12);
  const sections = buildStructuredConclusionSections(body);
  const sectionGap = options?.sectionGap ?? 18;
  const chunks: StructuredConclusionSection[][] = [];
  let currentChunk: StructuredConclusionSection[] = [];
  let currentHeight = 0;

  sections.forEach((section) => {
    const sectionHeight = getStructuredConclusionSectionHeight(doc, section, innerWidth, options);
    const nextHeight =
      currentChunk.length === 0 ? sectionHeight : currentHeight + sectionGap + sectionHeight;

    if (currentChunk.length > 0 && nextHeight > availableHeight) {
      chunks.push(currentChunk);
      currentChunk = [section];
      currentHeight = sectionHeight;
      return;
    }

    currentChunk.push(section);
    currentHeight = nextHeight;
  });

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks.map((chunk) =>
    chunk
      .map((section) => [section.lead, section.body].filter(Boolean).join(" ").trim())
      .join("\n\n")
  );
}

function drawVariantTable(doc: jsPDF, y: number, variants: PdfVariantComparison[]) {
  const headers = ["Variante", "Régime", "Impôt total", "Différence", "Lecture"];
  const widths = [160, 74, 96, 74, 87];
  const tableWidth = widths.reduce((sum, width) => sum + width, 0);
  const startX = MARGIN_X;
  const headerHeight = 34;

  drawRect(doc, startX, y, tableWidth, headerHeight, DARK);
  let cursorX = startX;

  headers.forEach((header, index) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    setText(doc, WHITE);
    doc.text(normalizePdfText(header), cursorX + 10, y + 21);
    cursorX += widths[index];
  });

  let rowY = y + headerHeight + 8;

  variants.forEach((variant) => {
    const values = [
      variant.label,
      variant.regime,
      variant.totalTax,
      variant.difference,
      variant.highlight,
    ];

    const wrappedCells = values.map((value, index) => splitText(doc, value, widths[index] - 18));
    const rowHeight = Math.max(
      34,
      ...wrappedCells.map((lines) => Math.max(1, lines.length) * 12 + 12)
    );
    const fill = variant.highlight === "Meilleure option" ? SOFT : WHITE;

    drawRect(doc, startX, rowY, tableWidth, rowHeight, fill);
    setDraw(doc, LINE);
    doc.roundedRect(startX, rowY, tableWidth, rowHeight, 10, 10);

    cursorX = startX;
    wrappedCells.forEach((lines, index) => {
      doc.setFont("helvetica", index === 0 || index === 4 ? "bold" : "normal");
      doc.setFontSize(9.5);
      setText(doc, TEXT);
      doc.text(lines, cursorX + 10, rowY + 15);
      cursorX += widths[index];
    });

    rowY += rowHeight + 8;
  });
}

function drawChartPanel(doc: jsPDF, x: number, y: number, width: number, height: number, title: string, subtitle?: string) {
  drawRect(doc, x, y, width, height, WHITE);
  setDraw(doc, LINE);
  doc.roundedRect(x, y, width, height, 12, 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setText(doc, DARK);
  doc.text(normalizePdfText(title), x + 16, y + 24);

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    setText(doc, MUTED);
    drawTextLines(doc, splitText(doc, subtitle, width - 32), x + 16, y + 42, {
      lineHeight: 12,
      maxWidth: width - 32,
    });
  }
}

function getVariantComparisonChartData(payload: PremiumPdfPayload) {
  const providedData = (payload.charts?.variantComparison ?? []).filter((item) => item.value > 0);

  if (providedData.length > 0) {
    return providedData;
  }

  const parsedVariants = payload.variants
    .map((variant) => ({
      ...variant,
      numericTax: parseCurrencyNumber(variant.totalTax),
    }))
    .filter((variant) => variant.numericTax > 0);

  const baseVariant = parsedVariants[0] ?? null;
  const recommendedVariant =
    parsedVariants.find((variant) => variant.highlight === "Meilleure option") ?? baseVariant;
  const intermediaryVariant =
    parsedVariants.find(
      (variant) => variant.label !== baseVariant?.label && variant.label !== recommendedVariant?.label
    ) ?? null;

  return [baseVariant, intermediaryVariant, recommendedVariant]
    .filter((variant): variant is NonNullable<typeof variant> => Boolean(variant))
    .map((variant) => ({
      label: variant.label,
      value: variant.numericTax,
      color:
        variant.highlight === "Meilleure option"
          ? "#2f7d5a"
          : variant === baseVariant
            ? "#94a3b8"
            : "#3b82f6",
      accentLabel:
        variant.highlight === "Meilleure option"
          ? "Recommandée"
          : variant === baseVariant
            ? "Base"
            : "Alternative",
    }));
}

function getTaxBreakdownChartData(payload: PremiumPdfPayload) {
  const providedData = (payload.charts?.taxBreakdown ?? []).filter((item) => item.value > 0);

  if (providedData.length > 0) {
    return providedData;
  }

  const sourceDetails = payload.recommendedTaxDetails ?? payload.taxDetails;

  return [
    {
      label: sourceDetails[0]?.label ?? "Impôt fédéral",
      value: parseCurrencyNumber(sourceDetails[0]?.value ?? "0"),
      color: "#1f4c7a",
    },
    {
      label: sourceDetails[1]?.label ?? "Impôt cantonal / communal",
      value: parseCurrencyNumber(sourceDetails[1]?.value ?? "0"),
      color: "#6b7280",
    },
    {
      label: sourceDetails[2]?.label ?? "Impôt sur la fortune",
      value: parseCurrencyNumber(sourceDetails[2]?.value ?? "0"),
      color: "#b88a44",
    },
  ].filter((item) => item.value > 0);
}

function getPatrimonyStructureChartData(payload: PremiumPdfPayload) {
  return (payload.charts?.patrimonyStructure ?? []).filter((item) => item.value > 0);
}

function drawVariantBarChart(doc: jsPDF, x: number, y: number, width: number, height: number, data: ChartDatum[]) {
  drawChartPanel(
    doc,
    x,
    y,
    width,
    height,
    "Comparaison visuelle des variantes",
    "Lecture immédiate de l'impôt total entre la base et la variante recommandée."
  );

  const chartData = data.filter((item) => item.value > 0);
  if (chartData.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setText(doc, MUTED);
    doc.text("Aucune donnée suffisante pour afficher le graphique.", x + 16, y + 86);
    return;
  }

  const chartTop = y + 62;
  const chartBottom = y + height - 42;
  const chartLeft = x + 28;
  const chartRight = x + width - 28;
  const maxValue = Math.max(...chartData.map((item) => item.value), 1);
  const innerWidth = chartRight - chartLeft;
  const baselineY = chartBottom;
  const barWidth = Math.min(62, innerWidth / (chartData.length * 1.7));
  const gap = chartData.length > 1 ? (innerWidth - barWidth * chartData.length) / (chartData.length - 1) : 0;

  setDraw(doc, LINE);
  doc.setLineWidth(1);
  doc.line(chartLeft, baselineY, chartRight, baselineY);

  chartData.forEach((item, index) => {
    const barHeight = Math.max(12, ((chartBottom - chartTop - 18) * item.value) / maxValue);
    const barX = chartLeft + index * (barWidth + gap);
    const barY = baselineY - barHeight;

    drawRect(doc, barX, barY, barWidth, barHeight, item.color);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(doc, DARK);
    drawTextLines(
      doc,
      splitText(doc, normalizeSwissNumber(String(Math.round(item.value))) + " CHF", 84),
      barX + barWidth / 2,
      barY - 8,
      {
        lineHeight: 10,
        align: "center",
        maxWidth: 84,
      }
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setText(doc, MUTED);
    drawTextLines(
      doc,
      splitText(doc, item.label, Math.max(78, barWidth + 26)),
      barX + barWidth / 2,
      baselineY + 16,
      {
        lineHeight: 10,
        align: "center",
        maxWidth: Math.max(78, barWidth + 26),
      }
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setText(doc, item.color);
    doc.text(item.accentLabel ?? "", barX + barWidth / 2, baselineY + 36, { align: "center" });
  });
}

function drawDonutChart(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    title: string;
    subtitle: string;
    totalLabel: string;
    data: ChartDatum[];
  }
) {
  drawChartPanel(
    doc,
    x,
    y,
    width,
    height,
    options.title,
    options.subtitle
  );

  const validData = options.data.filter((item) => item.value > 0);
  if (validData.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    setText(doc, MUTED);
    doc.text("Aucune donnée suffisante pour afficher le graphique.", x + 16, y + 86);
    return;
  }

  const total = validData.reduce((sum, item) => sum + item.value, 0);
  const centerX = x + 126;
  const centerY = y + 126;
  const radius = 54;
  const ringThickness = 18;
  const legendX = x + 228;
  const legendY = y + 88;

  setDraw(doc, "#e5e7eb");
  setText(doc, "#e5e7eb");

  let currentAngle = -Math.PI / 2;
  validData.forEach((item) => {
    const sweep = (item.value / total) * Math.PI * 2;
    const steps = Math.max(18, Math.ceil(sweep / 0.08));
    const step = sweep / steps;
    const { r, g, b } = hexToRgb(item.color);
    doc.setFillColor(r, g, b);

    for (let index = 0; index <= steps; index += 1) {
      const angle = currentAngle + step * index;
      const pointX = centerX + Math.cos(angle) * radius;
      const pointY = centerY + Math.sin(angle) * radius;
      doc.circle(pointX, pointY, ringThickness / 2, "F");
    }

    currentAngle += sweep;
  });

  setFill(doc, WHITE);
  doc.circle(centerX, centerY, radius - ringThickness, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  setText(doc, DARK);
  doc.text(normalizeSwissNumber(String(Math.round(total))) + " CHF", centerX, centerY - 2, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setText(doc, MUTED);
  doc.text(normalizePdfText(options.totalLabel), centerX, centerY + 16, { align: "center" });

  validData.forEach((item, index) => {
    const rowY = legendY + index * 40;
    drawRect(doc, legendX, rowY - 10, 12, 12, item.color);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    setText(doc, DARK);
    doc.text(normalizePdfText(item.label), legendX + 20, rowY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setText(doc, MUTED);
    doc.text(normalizeSwissNumber(String(Math.round(item.value))) + " CHF", legendX + 20, rowY + 14);
  });
}

function drawTaxDonutChart(doc: jsPDF, x: number, y: number, width: number, height: number, data: ChartDatum[]) {
  drawDonutChart(doc, x, y, width, height, {
    title: "Répartition de l'impôt",
    subtitle: "Visualisation de la charge fiscale entre IFD, cantonal / communal et fortune.",
    totalLabel: "Impôt total",
    data,
  });
}

function drawPatrimonyDonutChart(doc: jsPDF, x: number, y: number, width: number, height: number, data: ChartDatum[]) {
  drawDonutChart(doc, x, y, width, height, {
    title: "Structure patrimoniale",
    subtitle: "Répartition actuelle entre liquidités, immobilier, titres et prévoyance.",
    totalLabel: "Patrimoine total",
    data,
  });
}

export function generatePremiumPdf(payload: PremiumPdfPayload) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const sectionPages = {
    executiveSummary: 0,
    currentSituation: 0,
    taxDetails: 0,
    variantComparison: 0,
    realEstateAnalysis: 0,
    optimisations: 0,
    finalRecommendation: 0,
  };
  let currentPageNumber = 1;
  const variantComparisonChartData = getVariantComparisonChartData(payload);
  const taxBreakdownChartData = getTaxBreakdownChartData(payload);
  const patrimonyStructureChartData = getPatrimonyStructureChartData(payload);

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");

  drawRect(doc, MARGIN_X, 78, CONTENT_WIDTH, 230, DARK);
  drawRect(doc, MARGIN_X, 332, 160, 2, ACCENT);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setText(doc, ACCENT);
  doc.text(normalizePdfText(payload.cabinetName).toUpperCase(), MARGIN_X + 26, 110);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  setText(doc, WHITE);
  doc.text(normalizePdfText(payload.title), MARGIN_X + 26, 174);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  setText(doc, "#dbe3ec");
  doc.text("Rapport de conseil patrimonial et fiscal", MARGIN_X + 26, 206);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  setText(doc, WHITE);
  doc.text(normalizePdfText(payload.clientName || "Client non renseigné"), MARGIN_X + 26, 260);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  setText(doc, "#dbe3ec");
  doc.text(normalizePdfText(payload.reportDate), MARGIN_X + 26, 284);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  setText(doc, MUTED);
  doc.text(
    splitText(
      doc,
      "Document de présentation destiné au client. Mise en forme premium, lecture orientée décision et données issues de FIPLA Dashboard.",
      320
    ),
    MARGIN_X,
    392
  );
  drawPageChrome(doc, 1, "FIPLA Dashboard");

  doc.addPage();
  currentPageNumber += 1;
  const tocPageNumber = currentPageNumber;

  doc.addPage();
  currentPageNumber += 1;
  sectionPages.executiveSummary = currentPageNumber;
  addPageTitle(
    doc,
    currentPageNumber,
    "Résumé exécutif",
    "Une lecture claire, élégante et immédiatement exploitable pour éclairer la décision patrimoniale."
  );
  const executiveDecisionHeight = drawExecutiveDecisionPanel(
    doc,
    MARGIN_X,
    160,
    CONTENT_WIDTH,
    buildExecutiveDecisionItems(payload)
  );
  const synthesisY = 160 + executiveDecisionHeight + 22;
  const gainWidth = 192;
  const gainCardGap = 18;
  const recommendationWidth = CONTENT_WIDTH - gainWidth - 72;
  const recommendationLines = splitText(doc, payload.summary.recommendation, recommendationWidth);
  const recommendationHeight = recommendationLines.length * 17;
  const fittedGain = fitTextBlock(doc, payload.summary.estimatedGain, gainWidth - 32, {
    maxFontSize: 24,
    minFontSize: 12,
    maxLines: 2,
  });
  const gainDescriptionFit = fitTextBlock(
    doc,
    "Lecture synthétique de l’effet attendu à partir des variantes simulées.",
    gainWidth - 32,
    {
      maxFontSize: 9.5,
      minFontSize: 8,
      maxLines: 2,
    }
  );
  const gainDescriptionLines = gainDescriptionFit.lines;
  const gainAmountHeight = fittedGain.lines.length * 18;
  const gainDescriptionHeight = gainDescriptionLines.length * 12;
  const gainHeight = Math.max(156, 86 + gainAmountHeight + 14 + gainDescriptionHeight + 22);
  const synthesisHeight = Math.max(170, 68 + recommendationHeight, gainHeight + 18);

  drawRect(doc, MARGIN_X, synthesisY, CONTENT_WIDTH, synthesisHeight, WHITE);
  setDraw(doc, LINE);
  doc.roundedRect(MARGIN_X, synthesisY, CONTENT_WIDTH, synthesisHeight, 12, 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  setText(doc, DARK);
  doc.text("SYNTHÈSE DÉCISIONNELLE", MARGIN_X + 18, synthesisY + 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  setText(doc, TEXT);
  drawTextLines(doc, recommendationLines, MARGIN_X + 18, synthesisY + 56, {
    lineHeight: 17,
    maxWidth: recommendationWidth,
  });

  const gainX = MARGIN_X + CONTENT_WIDTH - gainWidth - gainCardGap;
  const gainY = synthesisY + Math.max(18, (synthesisHeight - gainHeight) / 2);
  const gainAmountY = gainY + 68;
  const gainDescriptionY = gainAmountY + gainAmountHeight + 18;
  drawRect(doc, gainX, gainY, gainWidth, gainHeight, DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setText(doc, ACCENT);
  doc.text("GAIN ESTIMÉ", gainX + 20, gainY + 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fittedGain.fontSize);
  setText(doc, WHITE);
  drawTextLines(doc, fittedGain.lines, gainX + 20, gainAmountY, {
    lineHeight: 18,
    maxWidth: gainWidth - 32,
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(gainDescriptionFit.fontSize);
  setText(doc, "#dbe3ec");
  drawTextLines(
    doc,
    gainDescriptionLines,
    gainX + 20,
    gainDescriptionY,
    {
      lineHeight: 12,
      maxWidth: gainWidth - 32,
    }
  );
  const summaryChartY = synthesisY + synthesisHeight + 18;
  const summaryChartHeight = Math.min(172, PAGE_HEIGHT - MARGIN_Y - 34 - summaryChartY);

  if (variantComparisonChartData.length > 0 && summaryChartHeight >= 136) {
    drawVariantBarChart(doc, MARGIN_X, summaryChartY, CONTENT_WIDTH, summaryChartHeight, variantComparisonChartData);
  }

  doc.addPage();
  currentPageNumber += 1;
  sectionPages.currentSituation = currentPageNumber;
  addPageTitle(
    doc,
    currentPageNumber,
    "Situation actuelle",
    "Présentation synthétique des grands équilibres du dossier : revenus, fortune, charges, fiscalité et détail fiscal."
  );
  const metricBandHeight = drawMetricBand(doc, 150, payload.taxDetails);
  const columnGap = 18;
  const panelWidth = (CONTENT_WIDTH - columnGap) / 2;
  const topRowY = 150 + metricBandHeight + 28;
  const topLeftHeight = drawFieldPanel(doc, MARGIN_X, topRowY, panelWidth, "Revenus", payload.currentSituation.revenus);
  const topRightHeight = drawFieldPanel(
    doc,
    MARGIN_X + panelWidth + columnGap,
    topRowY,
    panelWidth,
    "Fortune",
    payload.currentSituation.fortune
  );
  const secondRowY = topRowY + Math.max(topLeftHeight, topRightHeight) + 20;
  drawFieldPanel(doc, MARGIN_X, secondRowY, panelWidth, "Charges", payload.currentSituation.charges);
  drawFieldPanel(
    doc,
    MARGIN_X + panelWidth + columnGap,
    secondRowY,
    panelWidth,
    "Fiscalité",
    payload.currentSituation.fiscalite
  );

  if (patrimonyStructureChartData.length > 0) {
    doc.addPage();
    currentPageNumber += 1;
    addPageTitle(
      doc,
      currentPageNumber,
      "Situation actuelle",
      "Lecture visuelle de la structure patrimoniale actuelle entre liquidités, immobilier, titres et prévoyance."
    );
    drawPatrimonyDonutChart(doc, MARGIN_X, 174, CONTENT_WIDTH, 286, patrimonyStructureChartData);
  }

  doc.addPage();
  currentPageNumber += 1;
  sectionPages.taxDetails = currentPageNumber;
  const bestVariant = payload.variants.find((variant) => variant.highlight === "Meilleure option");
  addPageTitle(
    doc,
    currentPageNumber,
    "Projection fiscale recommandée",
    `Lecture projetée de la fiscalité pour ${normalizePdfText(bestVariant?.label || "la variante recommandée")}.`
  );
  drawMetricBand(doc, 154, payload.recommendedTaxDetails ?? payload.taxDetails);
  drawTaxDonutChart(
    doc,
    MARGIN_X,
    286,
    CONTENT_WIDTH,
    268,
    taxBreakdownChartData
  );

  doc.addPage();
  currentPageNumber += 1;
  sectionPages.variantComparison = currentPageNumber;
  addPageTitle(
    doc,
    currentPageNumber,
    "Comparaison des variantes",
    "Lecture comparative de la base et des scénarios simulés pour visualiser le point d'arrivée."
  );
  drawRect(doc, MARGIN_X, 146, CONTENT_WIDTH, 82, SOFT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setText(doc, ACCENT);
  doc.text("MEILLEURE VARIANTE", MARGIN_X + 16, 170);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  setText(doc, DARK);
  doc.text(normalizePdfText(bestVariant?.label || "À confirmer"), MARGIN_X + 16, 202);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  setText(doc, MUTED);
  doc.text(normalizePdfText(bestVariant?.difference || "Différence indisponible"), MARGIN_X + 16, 220);
  drawVariantTable(doc, 248, payload.variants);

  doc.addPage();
  currentPageNumber += 1;
  sectionPages.realEstateAnalysis = currentPageNumber;
  sectionPages.optimisations = currentPageNumber;
  addPageTitle(
    doc,
    currentPageNumber,
    "Analyse immobilière et optimisations",
    "Lecture concentrée sur le levier immobilier et sur les actions d'optimisation activées dans le dossier."
  );
  const leftWidth = 214;
  const rightWidth = CONTENT_WIDTH - leftWidth - 18;
  const leftX = MARGIN_X;
  const rightX = MARGIN_X + leftWidth + 18;
  const estateOne = drawInfoBlock(doc, leftX, 154, leftWidth, "Régime actuel", payload.realEstate.currentRegime, {
    minHeight: 102,
  });
  const estateTwo = drawInfoBlock(
    doc,
    leftX,
    154 + estateOne + 14,
    leftWidth,
    "Régime réformé",
    payload.realEstate.reformedRegime,
    {
      fill: SOFT,
      minHeight: 102,
    }
  );
  drawInfoBlock(doc, leftX, 154 + estateOne + 14 + estateTwo + 14, leftWidth, "Delta de base imposable immobilière", payload.realEstate.impact, {
    minHeight: 80,
  });
  const bulletsHeight = drawBulletPanel(doc, rightX, 154, rightWidth, "Points de lecture", payload.realEstate.bullets);
  drawOperationalOptimisationPanel(
    doc,
    rightX,
    154 + bulletsHeight + 18,
    rightWidth,
    "Optimisations activées",
    payload.optimisations
  );

  doc.addPage();
  currentPageNumber += 1;
  sectionPages.finalRecommendation = currentPageNumber;
  addPageTitle(
    doc,
    currentPageNumber,
    "Recommandation finale",
    "Synthèse de conseil rédigée dans un registre client, hiérarchisée et directement exploitable en rendez-vous."
  );
  const advisoryNarrative = getDynamicRecommendationLogicText(payload);
  const closingNarrative = getDynamicRecommendationConclusion(payload);
  const detailedPriorities = getDynamicRecommendationPriorities(payload);
  const detailedVigilance = getDynamicRecommendationVigilance(payload);
  const page6TopBaseY = 188;
  const page6IntroSpacer = 24;
  const page6Gap = 18;
  const page6SafeBottomY = PAGE_HEIGHT - MARGIN_Y - 48;
  const introOptions = {
    minHeight: 142,
    paddingX: 20,
    bodyOffsetY: 56,
    lineHeight: 19,
    bodyFontSize: 10.25,
    paragraphGap: 14,
    preserveParagraphs: true,
  };
  const bulletOptions = {
    minHeight: 188,
    paddingX: 18,
    topOffset: 56,
    lineHeight: 15.5,
  };
  const conclusionOptions = {
    minHeight: 168,
    paddingX: 26,
    bodyOffsetY: 62,
    lineHeight: 20,
    bodyFontSize: 10.75,
    paragraphGap: 20,
    preserveParagraphs: true,
  };
  const columnWidth = (CONTENT_WIDTH - 18) / 2;
  const introEstimatedHeight = getInfoBlockHeight(
    doc,
    CONTENT_WIDTH,
    "Logique de recommandation",
    advisoryNarrative,
    introOptions
  );
  const prioritiesEstimatedHeight = getBulletPanelHeight(
    doc,
    columnWidth,
    detailedPriorities,
    bulletOptions
  );
  const vigilanceEstimatedHeight = getBulletPanelHeight(
    doc,
    columnWidth,
    detailedVigilance,
    bulletOptions
  );
  const conclusionEstimatedHeight = getStructuredConclusionBlockHeight(
    doc,
    CONTENT_WIDTH,
    "Conclusion et mise en oeuvre",
    closingNarrative,
    conclusionOptions
  );
  const estimatedPage6Bottom =
    page6TopBaseY +
    page6IntroSpacer +
    introEstimatedHeight +
    page6Gap +
    Math.max(prioritiesEstimatedHeight, vigilanceEstimatedHeight) +
    page6Gap +
    conclusionEstimatedHeight;
  const page6TopY =
    Math.max(126, page6TopBaseY - Math.max(0, estimatedPage6Bottom - page6SafeBottomY)) +
    page6IntroSpacer;
  const introHeight = drawInfoBlock(
    doc,
    MARGIN_X,
    page6TopY,
    CONTENT_WIDTH,
    "Logique de recommandation",
    advisoryNarrative,
    {
      fill: DARK,
      titleColor: ACCENT,
      bodyColor: WHITE,
      ...introOptions,
    }
  );
  const page6BulletsStartY = page6TopY + introHeight + page6Gap;
  const bulletsBlockHeight = Math.max(prioritiesEstimatedHeight, vigilanceEstimatedHeight);
  const page6CanFitAll =
    page6BulletsStartY + bulletsBlockHeight + page6Gap + conclusionEstimatedHeight <= page6SafeBottomY;

  if (page6CanFitAll) {
    const prioritiesHeight = drawBulletPanel(
      doc,
      MARGIN_X,
      page6BulletsStartY,
      columnWidth,
      "Priorités d’action",
      detailedPriorities,
      {
        ...bulletOptions,
      }
    );
    const vigilanceHeight = drawBulletPanel(
      doc,
      MARGIN_X + columnWidth + 18,
      page6BulletsStartY,
      columnWidth,
      "Points de vigilance",
      detailedVigilance,
      {
        ...bulletOptions,
      }
    );
    const conclusionY = page6BulletsStartY + Math.max(prioritiesHeight, vigilanceHeight) + page6Gap;
    drawStructuredConclusionBlock(
      doc,
      MARGIN_X,
      conclusionY,
      CONTENT_WIDTH,
      "Conclusion et mise en oeuvre",
      closingNarrative,
      {
        fill: SOFT,
        ...conclusionOptions,
      }
    );
  } else {
    const continuationTopY = 170;
    const continuationSafeBottomY = PAGE_HEIGHT - MARGIN_Y - 48;
    const availableSectionHeight = continuationSafeBottomY - continuationTopY;
    const fullWidthBulletOptions = {
      ...bulletOptions,
      minHeight: 0,
      paddingX: 20,
      topOffset: 56,
      lineHeight: 16,
    };
    const priorityChunks = splitBulletItemsByHeight(
      doc,
      CONTENT_WIDTH,
      detailedPriorities,
      availableSectionHeight,
      fullWidthBulletOptions
    );
    const vigilanceChunks = splitBulletItemsByHeight(
      doc,
      CONTENT_WIDTH,
      detailedVigilance,
      availableSectionHeight,
      fullWidthBulletOptions
    );
    const conclusionChunks = splitStructuredConclusionSectionsByHeight(
      doc,
      CONTENT_WIDTH,
      closingNarrative,
      availableSectionHeight,
      conclusionOptions
    );

    const startContinuationPage = (subtitle: string) => {
      doc.addPage();
      currentPageNumber += 1;
      addPageTitle(doc, currentPageNumber, "Recommandation finale", subtitle);
      return continuationTopY;
    };

    const renderBulletChunks = (title: string, chunks: string[][], subtitle: string) => {
      chunks.forEach((chunk, index) => {
        const sectionY = startContinuationPage(
          index === 0 ? subtitle : `${subtitle} (suite).`
        );
        drawBulletPanel(doc, MARGIN_X, sectionY, CONTENT_WIDTH, title, chunk, {
          ...fullWidthBulletOptions,
        });
      });
    };

    renderBulletChunks(
      "Priorités d’action",
      priorityChunks,
      "Suite de la synthèse avec les priorités d’action détaillées."
    );
    renderBulletChunks(
      "Points de vigilance",
      vigilanceChunks,
      "Suite de la synthèse avec les points de vigilance à retenir."
    );

    conclusionChunks.forEach((chunk, index) => {
      const sectionY = startContinuationPage(
        index === 0
          ? "Conclusion de mise en œuvre dans un format lisible et aéré."
          : "Conclusion de mise en œuvre (suite)."
      );
      drawStructuredConclusionBlock(
        doc,
        MARGIN_X,
        sectionY,
        CONTENT_WIDTH,
        "Conclusion et mise en oeuvre",
        chunk,
        {
          fill: SOFT,
          ...conclusionOptions,
        }
      );
    });
  }

  const safeClientName = payload.clientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  drawTableOfContents(doc, tocPageNumber, [
    { title: "Résumé exécutif", pageNumber: sectionPages.executiveSummary },
    { title: "Situation actuelle", pageNumber: sectionPages.currentSituation },
    { title: "Projection fiscale recommandée", pageNumber: sectionPages.taxDetails },
    { title: "Comparaison des variantes", pageNumber: sectionPages.variantComparison },
    { title: "Analyse immobilière", pageNumber: sectionPages.realEstateAnalysis },
    { title: "Optimisations", pageNumber: sectionPages.optimisations },
    { title: "Recommandation finale", pageNumber: sectionPages.finalRecommendation },
  ]);
  doc.save(`fipla-dashboard-${safeClientName || "client"}.pdf`);
}
