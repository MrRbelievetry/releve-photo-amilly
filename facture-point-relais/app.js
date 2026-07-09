import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs";
import { PDFDocument, StandardFonts, rgb } from "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm";

const pdfInput = document.querySelector("#pdf-input");
const fileName = document.querySelector("#file-name");
const form = document.querySelector("#invoice-form");
const relayAddress = document.querySelector("#relay-address");
const generateButton = document.querySelector("#generate-button");
const downloadButton = document.querySelector("#download-button");
const statusLine = document.querySelector("#status");

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

let generatedPdfUrl = "";
let generatedFileName = "facture-adresse-relais.pdf";

pdfInput.addEventListener("change", () => {
  const file = pdfInput.files?.[0];
  fileName.textContent = file ? file.name : "Aucun fichier sélectionné";
  clearGeneratedPdf();
  setStatus("");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = pdfInput.files?.[0];
  const address = relayAddress.value.trim();

  if (!file) {
    setStatus("Sélectionnez une facture PDF.", true);
    return;
  }

  if (!address) {
    setStatus("Collez l'adresse du point relais.", true);
    return;
  }

  try {
    generateButton.disabled = true;
    downloadButton.disabled = true;
    setStatus("Génération de la facture en cours...");

    const sourceBytes = await file.arrayBuffer();
    const deliveryBlock = await findDeliveryBlock(sourceBytes);
    const modifiedBytes = await replaceDeliveryAddress(sourceBytes, deliveryBlock, address);

    clearGeneratedPdf();
    const blob = new Blob([modifiedBytes], { type: "application/pdf" });
    generatedPdfUrl = URL.createObjectURL(blob);
    generatedFileName = buildOutputName(file.name);

    downloadButton.disabled = false;
    downloadPdf();
    setStatus("Facture générée. Le téléchargement a été lancé automatiquement.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Impossible de générer la facture.", true);
  } finally {
    generateButton.disabled = false;
  }
});

downloadButton.addEventListener("click", downloadPdf);

async function findDeliveryBlock(sourceBytes) {
  const loadingTask = pdfjsLib.getDocument({ data: sourceBytes.slice(0) });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const textContent = await page.getTextContent();
  const items = textContent.items.map((item) => normalizeTextItem(item, viewport.height));

  const deliveryTitle = findText(items, "adresse de livraison");
  const billingTitle = findText(items, "adresse de facturation");

  if (!deliveryTitle) {
    throw new Error('Le bloc "Adresse de livraison" est introuvable dans ce PDF.');
  }

  const fontSize = clamp(deliveryTitle.fontSize || 10.5, 8, 13);
  const lineHeight = fontSize * 1.25;
  const gapAfterTitle = lineHeight * 2;
  const firstLineY = deliveryTitle.pdfY - gapAfterTitle;
  const blockWidth = billingTitle
    ? clamp(billingTitle.x - deliveryTitle.x - 14, 120, 190)
    : 170;

  return {
    pageIndex: 0,
    x: deliveryTitle.x,
    titleY: deliveryTitle.pdfY,
    firstLineY,
    fontSize,
    lineHeight,
    width: blockWidth,
    oldLineCount: countExistingAddressLines(items, deliveryTitle, billingTitle),
  };
}

function normalizeTextItem(item, pageHeight) {
  const [, b, c, d, x, rawY] = item.transform;
  const fontSize = Math.hypot(b, d) || Math.abs(item.height) || 10.5;
  const text = normalizeText(item.str);
  const pdfY = rawY < pageHeight / 2 ? pageHeight - rawY : rawY;

  return {
    text,
    rawText: item.str,
    x,
    rawY,
    pdfY,
    fontSize: Math.hypot(c, d) || fontSize,
    width: item.width || 0,
  };
}

function findText(items, expected) {
  return items.find((item) => item.text === expected) || null;
}

function countExistingAddressLines(items, deliveryTitle, billingTitle) {
  const left = deliveryTitle.x - 2;
  const right = billingTitle ? billingTitle.x - 8 : deliveryTitle.x + 180;
  const top = deliveryTitle.pdfY - deliveryTitle.fontSize * 1.4;
  const bottom = deliveryTitle.pdfY - deliveryTitle.fontSize * 12;

  const lines = items.filter((item) => {
    return item.x >= left && item.x < right && item.pdfY < top && item.pdfY > bottom;
  });

  return Math.max(lines.length, 6);
}

async function replaceDeliveryAddress(sourceBytes, deliveryBlock, address) {
  const pdfDoc = await PDFDocument.load(sourceBytes);
  const page = pdfDoc.getPages()[deliveryBlock.pageIndex];
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const lines = wrapAddress(address, font, deliveryBlock.fontSize, deliveryBlock.width);
  const effectiveFontSize = fitFontSize(lines, font, deliveryBlock.width, deliveryBlock.fontSize);
  const lineHeight = effectiveFontSize * 1.25;
  const firstLineY = deliveryBlock.titleY - lineHeight * 2;
  const lineCount = Math.max(lines.length, deliveryBlock.oldLineCount, 7);
  const maskTop = deliveryBlock.titleY - lineHeight * 1.35;
  const maskBottom = firstLineY - lineHeight * (lineCount - 0.2);

  page.drawRectangle({
    x: deliveryBlock.x - 2,
    y: maskBottom,
    width: deliveryBlock.width + 8,
    height: maskTop - maskBottom,
    color: rgb(1, 1, 1),
  });

  lines.forEach((line, index) => {
    const isFirstLine = index === 0 && /^point\s+de\s+retrait$/i.test(line);
    page.drawText(line, {
      x: deliveryBlock.x,
      y: firstLineY - index * lineHeight,
      size: effectiveFontSize,
      font: isFirstLine ? fontBold : font,
      color: rgb(0, 0, 0),
    });
  });

  return pdfDoc.save();
}

function wrapAddress(address, font, fontSize, maxWidth) {
  const cleanLines = address
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return cleanLines.flatMap((line) => wrapLine(line, font, fontSize, maxWidth));
}

function wrapLine(line, font, fontSize, maxWidth) {
  if (font.widthOfTextAtSize(line, fontSize) <= maxWidth) {
    return [line];
  }

  const words = line.split(/\s+/);
  const wrapped = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
      current = next;
      return;
    }

    if (current) wrapped.push(current);
    current = word;
  });

  if (current) wrapped.push(current);
  return wrapped;
}

function fitFontSize(lines, font, maxWidth, preferredSize) {
  let size = preferredSize;
  while (size > 8) {
    const fits = lines.every((line) => font.widthOfTextAtSize(line, size) <= maxWidth);
    if (fits && lines.length <= 9) return size;
    size -= 0.5;
  }
  return size;
}

function downloadPdf() {
  if (!generatedPdfUrl) return;

  const link = document.createElement("a");
  link.href = generatedPdfUrl;
  link.download = generatedFileName;
  document.body.append(link);
  link.click();
  link.remove();
}

function clearGeneratedPdf() {
  if (generatedPdfUrl) {
    URL.revokeObjectURL(generatedPdfUrl);
    generatedPdfUrl = "";
  }
  downloadButton.disabled = true;
}

function setStatus(message, isError = false) {
  statusLine.textContent = message;
  statusLine.classList.toggle("error", isError);
}

function buildOutputName(name) {
  const base = name.replace(/\.pdf$/i, "");
  return `${base || "facture"}-adresse-relais.pdf`;
}

function normalizeText(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
