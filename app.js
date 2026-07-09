(function () {
  "use strict";

  const MAX_IMAGE_SIDE = 1200;
  const JPEG_QUALITY = 0.58;
  const OUTPUT_FILE_NAME = "releve-photographique-76-rue-gerard-philipe-amilly-21-07-2026.pdf";

  const state = {
    photos: [],
    buyersSigned: false,
    agentSigned: false
  };

  const els = {
    visitDate: document.getElementById("visitDate"),
    startTime: document.getElementById("startTime"),
    endTime: document.getElementById("endTime"),
    propertyAddress: document.getElementById("propertyAddress"),
    buyersName: document.getElementById("buyersName"),
    agentName: document.getElementById("agentName"),
    agencyName: document.getElementById("agencyName"),
    photoInput: document.getElementById("photoInput"),
    photoPreview: document.getElementById("photoPreview"),
    photoCount: document.getElementById("photoCount"),
    clearPhotosBtn: document.getElementById("clearPhotosBtn"),
    buyersSignature: document.getElementById("buyersSignature"),
    agentSignature: document.getElementById("agentSignature"),
    agentRefusesSignature: document.getElementById("agentRefusesSignature"),
    clearBuyersSignature: document.getElementById("clearBuyersSignature"),
    clearAgentSignature: document.getElementById("clearAgentSignature"),
    generatePdfBtn: document.getElementById("generatePdfBtn"),
    messageBox: document.getElementById("messageBox"),
    progressWrap: document.querySelector(".progress-wrap"),
    progressBar: document.getElementById("progressBar"),
    progressText: document.getElementById("progressText"),
    progressPercent: document.getElementById("progressPercent")
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function init() {
    setupSignaturePad(els.buyersSignature, "buyersSigned");
    setupSignaturePad(els.agentSignature, "agentSigned");
    els.photoInput.addEventListener("change", handlePhotoSelection);
    els.clearPhotosBtn.addEventListener("click", clearPhotos);
    els.clearBuyersSignature.addEventListener("click", () => clearSignature(els.buyersSignature, "buyersSigned"));
    els.clearAgentSignature.addEventListener("click", () => clearSignature(els.agentSignature, "agentSigned"));
    els.agentRefusesSignature.addEventListener("change", handleAgentRefusalChange);
    els.generatePdfBtn.addEventListener("click", generatePdf);
    renderPhotos();
  }

  function handleAgentRefusalChange() {
    if (els.agentRefusesSignature.checked) {
      clearSignature(els.agentSignature, "agentSigned");
    }
  }

  async function handlePhotoSelection(event) {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/"));
    if (!files.length) {
      return;
    }

    setMessage("Chargement des photos en cours...", "");
    for (const file of files) {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const previewUrl = URL.createObjectURL(file);
      const takenAt = await readPhotoTakenAt(file);
      state.photos.push({ id, file, previewUrl, name: file.name, takenAt });
      await nextFrame();
    }

    els.photoInput.value = "";
    renderPhotos();
    setMessage(`${state.photos.length} photo(s) prete(s).`, "success");
  }

  function renderPhotos() {
    els.photoCount.textContent = `${state.photos.length} photo${state.photos.length > 1 ? "s" : ""} chargee${state.photos.length > 1 ? "s" : ""}`;
    els.photoPreview.innerHTML = "";

    state.photos.forEach((photo, index) => {
      const card = document.createElement("article");
      card.className = "photo-card";
      card.innerHTML = `
        <img src="${photo.previewUrl}" alt="Photo ${index + 1}">
        <div class="photo-meta">
          <span>Photo ${index + 1} - ${formatPhotoMetaLabel(photo.takenAt)}</span>
          <button class="remove-photo" type="button" aria-label="Supprimer la photo ${index + 1}">X</button>
        </div>
      `;
      card.querySelector("button").addEventListener("click", () => removePhoto(photo.id));
      els.photoPreview.appendChild(card);
    });
  }

  function removePhoto(id) {
    const photo = state.photos.find((item) => item.id === id);
    if (photo) {
      URL.revokeObjectURL(photo.previewUrl);
    }
    state.photos = state.photos.filter((item) => item.id !== id);
    renderPhotos();
  }

  function clearPhotos() {
    state.photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    state.photos = [];
    renderPhotos();
    setMessage("Toutes les photos ont ete supprimees.", "");
  }

  function setupSignaturePad(canvas, stateKey) {
    const context = canvas.getContext("2d");
    clearCanvas(canvas);

    let drawing = false;
    let lastPoint = null;

    const start = (event) => {
      event.preventDefault();
      if (stateKey === "agentSigned") {
        els.agentRefusesSignature.checked = false;
      }
      drawing = true;
      lastPoint = getCanvasPoint(canvas, event);
      context.beginPath();
      context.arc(lastPoint.x, lastPoint.y, 1.8, 0, Math.PI * 2);
      context.fillStyle = "#111827";
      context.fill();
      state[stateKey] = true;
    };

    const draw = (event) => {
      if (!drawing) {
        return;
      }
      event.preventDefault();
      const point = getCanvasPoint(canvas, event);
      context.beginPath();
      context.moveTo(lastPoint.x, lastPoint.y);
      context.lineTo(point.x, point.y);
      context.strokeStyle = "#111827";
      context.lineWidth = 3.2;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.stroke();
      lastPoint = point;
      state[stateKey] = true;
    };

    const stop = () => {
      drawing = false;
      lastPoint = null;
    };

    canvas.addEventListener("pointerdown", start);
    canvas.addEventListener("pointermove", draw);
    canvas.addEventListener("pointerup", stop);
    canvas.addEventListener("pointerleave", stop);
    canvas.addEventListener("pointercancel", stop);
  }

  function clearSignature(canvas, stateKey) {
    clearCanvas(canvas);
    state[stateKey] = false;
  }

  function clearCanvas(canvas) {
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  function getCanvasPoint(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height
    };
  }

  async function generatePdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      setMessage("Le module PDF n'est pas encore charge. Reessayez dans quelques secondes.", "error");
      return;
    }

    const validation = validateBeforeGeneration();
    if (!validation.ok) {
      setMessage(validation.message, "error");
      return;
    }

    els.generatePdfBtn.disabled = true;
    setProgress(0, "Preparation du PDF");
    setMessage("", "");

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const data = collectFormData();
      addCoverPage(doc, data);
      doc.addPage();
      addCompromisAnnexPage(doc);

      for (let index = 0; index < state.photos.length; index += 1) {
        const photo = state.photos[index];
        const image = await compressImage(photo.file);
        doc.addPage();
        addPhotoPage(doc, image, data, photo, index + 1, state.photos.length);
        setProgress(Math.round(((index + 1) / state.photos.length) * 86), `Traitement photo ${index + 1} / ${state.photos.length}`);
        await nextFrame();
      }

      doc.addPage();
      addFinalPage(doc, data);
      setProgress(96, "Finalisation");
      doc.save(OUTPUT_FILE_NAME);
      setProgress(100, "PDF genere");
      setMessage("PDF genere avec succes.", "success");
    } catch (error) {
      console.error(error);
      setMessage("Une erreur est survenue pendant la generation du PDF. Essayez avec moins de photos ou rechargez la page.", "error");
    } finally {
      els.generatePdfBtn.disabled = false;
    }
  }

  function validateBeforeGeneration() {
    if (!state.photos.length) {
      return { ok: false, message: "Ajoutez au moins une photo avant de generer le PDF." };
    }
    if (!state.buyersSigned) {
      return { ok: false, message: "La signature des acheteurs est obligatoire." };
    }
    if (!state.agentSigned && !els.agentRefusesSignature.checked) {
      return { ok: false, message: "Signez pour l'agent immobilier ou cochez que l'agent n'a pas souhaite signer." };
    }
    return { ok: true };
  }

  function collectFormData() {
    const generationDate = new Date();
    return {
      visitDate: formatFrenchDate(els.visitDate.value),
      startTime: els.startTime.value || "",
      endTime: els.endTime.value || "",
      propertyAddress: els.propertyAddress.value.trim(),
      buyersName: els.buyersName.value.trim(),
      agentName: els.agentName.value.trim(),
      agencyName: els.agencyName.value.trim(),
      agentRefusesSignature: els.agentRefusesSignature.checked,
      generationDate,
      generationLabel: generationDate.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
    };
  }

  function addCoverPage(doc, data) {
    drawPageFrame(doc);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("RELEVE PHOTOGRAPHIQUE CONTRADICTOIRE", 105, 34, { align: "center", maxWidth: 174 });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    const lines = [
      `Photos prises dans le cadre de la visite prealable a la signature de l'acte authentique et/ou de la remise des cles du bien situe ${data.propertyAddress}.`,
      "Le present document a pour objet de conserver une trace photographique de l'etat apparent interieur et exterieur du bien a la date indiquee.",
      `Presents lors de la visite :\n- Acheteurs : ${data.buyersName}\n- Agent immobilier : ${data.agentName}, representant l'agence ${data.agencyName}`,
      "Déclaration des parties\nLes signataires reconnaissent que les photographies figurant dans le présent document ont été prises contradictoirement lors de la visite du bien immobilier situé au 76 rue Gérard Philipe à Amilly, avant la signature de l'acte authentique et/ou la remise des clés. Les photographies reflètent l'état apparent du bien au moment de leur réalisation. La signature du présent document atteste uniquement de leur prise en présence des signataires et ne vaut pas reconnaissance d'une responsabilité juridique sur les éventuelles anomalies constatées.",
      "Le present document constitue un releve photographique contradictoire etabli a titre de preuve de l'etat apparent du bien a la date indiquee. Il ne vaut pas constat d'huissier ni constat de commissaire de justice.",
      "Les signataires declarent que les photographies integrees au present document ont ete prises dans le cadre de la visite du bien mentionne ci-dessus, a la date et aux horaires indiques."
    ];

    let y = 54;
    lines.forEach((paragraph) => {
      const wrapped = doc.splitTextToSize(paragraph, 170);
      doc.text(wrapped, 20, y);
      y += wrapped.length * 5.2 + 7;
    });

    addInfoBlock(doc, data, 20, 244);
  }

  function addCompromisAnnexPage(doc) {
    drawPageFrame(doc);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Annexe 1 - Extraits du compromis de vente", 20, 30, { maxWidth: 170 });

    let y = 50;
    y = addAnnexSection(doc, "Clause : État d'occupation", [
      "Le VENDEUR déclare que les biens objets des présentes seront libres de toute location ou occupation le jour de l'entrée en jouissance. Les biens à vendre, y compris les annexes, seront totalement débarrassés de tout objet quelconque à l'exception, le cas échéant, des meubles compris dans la présente vente. Le VENDEUR déclare qu'il occupe le bien objet des présentes."
    ], y);

    y = addAnnexSection(doc, "Clause : Mise en état des biens", [
      "Le VENDEUR s'engage, pour le jour de la réitération des présentes par acte authentique, à nettoyer les sols, murs, portes, vitrages et fenêtres, équipements sanitaires et de cuisine, à évacuer les déchets, à vider les biens et ses éventuelles annexes de tout objet.",
      "S'il en existe, il s'engage à entretenir les extérieurs : tonte de la pelouse, taille des haies, entretien des espaces fleuris et de jardinage, désherbage des allées et terrasses, évacuation des déchets verts, etc.",
      "À défaut, les coûts de nettoyage intérieur, extérieur, évacuation d'objet(s), entretien de jardin, pourraient être mis à sa charge."
    ], y);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(10.5);
    const note = doc.splitTextToSize(
      "Les photographies figurant dans le présent document ont été réalisées afin de documenter l'état apparent du bien au regard des obligations prévues au compromis de vente reproduites ci-dessus.",
      170
    );
    doc.text(note, 20, y + 4);
  }

  function addAnnexSection(doc, title, paragraphs, y) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, 20, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    paragraphs.forEach((paragraph) => {
      const lines = doc.splitTextToSize(paragraph, 170);
      doc.text(lines, 20, y);
      y += lines.length * 5.2 + 7;
    });

    return y + 3;
  }

  function addPhotoPage(doc, image, data, photo, photoNumber, totalPhotos) {
    drawPageFrame(doc);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(data.propertyAddress, 15, 15, { maxWidth: 142 });
    doc.text(`Photo ${photoNumber} / ${totalPhotos}`, 195, 15, { align: "right" });

    const box = { x: 15, y: 28, width: 180, height: 226 };
    const fitted = fitImage(image.width, image.height, box.width, box.height);
    const imageX = box.x + fitted.x;
    const imageY = box.y + fitted.y;
    doc.addImage(image.dataUrl, "JPEG", imageX, imageY, fitted.width, fitted.height, undefined, "FAST");
    addPhotoOverlay(doc, photo, photoNumber, imageX, imageY, fitted.width, fitted.height);

    doc.setDrawColor(210, 218, 227);
    doc.rect(box.x, box.y, box.width, box.height);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text("Document signe en page finale", 105, 268, { align: "center" });
  }

  function addPhotoOverlay(doc, photo, photoNumber, x, y, width, height) {
    const overlayText = `Photo n°${photoNumber} / ${formatPhotoDate(photo.takenAt)} / ${formatPhotoTime(photo.takenAt)}`;
    const overlayHeight = 8;
    const overlayY = y + height - overlayHeight - 2;
    doc.setFillColor(255, 255, 255);
    doc.rect(x + 2, overlayY, width - 4, overlayHeight, "F");
    doc.setTextColor(20, 28, 38);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(overlayText, x + 4, overlayY + 5.4, { maxWidth: width - 8 });
  }

  function addFinalPage(doc, data) {
    drawPageFrame(doc);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Page finale avec signatures", 20, 30);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const summary = [
      `Date de visite : ${data.visitDate}`,
      `Horaires : ${data.startTime || "Non indique"} - ${data.endTime || "Non indique"}`,
      `Adresse : ${data.propertyAddress}`,
      `Acheteurs : ${data.buyersName}`,
      `Agent immobilier : ${data.agentName}, ${data.agencyName}`,
      `Statut signature agent : ${data.agentRefusesSignature ? "n'a pas souhaite signer" : "signature recueillie"}`,
      `Date et heure de generation du PDF : ${data.generationLabel}`,
      "Document genere localement dans le navigateur. Aucune photographie n'est transmise a un serveur."
    ];
    doc.text(summary, 20, 48, { maxWidth: 170 });

    addSignatureImage(doc, "Signature acheteurs", data.buyersName, els.buyersSignature, 20, 108);
    if (data.agentRefusesSignature) {
      addAgentRefusalBlock(doc, data, 20, 184);
    } else {
      addSignatureImage(doc, "Signature agent immobilier", `${data.agentName}, ${data.agencyName}`, els.agentSignature, 20, 184);
    }
  }

  function addAgentRefusalBlock(doc, data, x, y) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Signature agent immobilier", x, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`${data.agentName}, ${data.agencyName}`, x, y + 6);
    doc.setDrawColor(190, 200, 212);
    doc.rect(x, y + 10, 170, 38);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text(
      "L'agent immobilier present n'a pas souhaite signer le present releve photographique.",
      x + 4,
      y + 25,
      { maxWidth: 162 }
    );
  }

  function addSignatureImage(doc, title, subtitle, canvas, x, y) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, x, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(subtitle, x, y + 6);
    doc.setDrawColor(190, 200, 212);
    doc.rect(x, y + 10, 170, 48);
    doc.addImage(canvas.toDataURL("image/jpeg", 0.85), "JPEG", x + 2, y + 12, 166, 44);
  }

  function addInfoBlock(doc, data, x, y) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Informations", x, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text([
      `Date : ${data.visitDate}`,
      `Heure de debut : ${data.startTime || "Non indiquee"}`,
      `Heure de fin : ${data.endTime || "Non indiquee"}`,
      `Adresse : ${data.propertyAddress}`
    ], x, y + 8);
  }

  function drawPageFrame(doc) {
    doc.setDrawColor(222, 228, 236);
    doc.setLineWidth(0.4);
    doc.rect(10, 10, 190, 277);
  }

  async function compressImage(file) {
    const bitmap = await loadImage(file);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    if (bitmap.close) {
      bitmap.close();
    }

    return {
      dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY),
      width,
      height
    };
  }

  async function readPhotoTakenAt(file) {
    const exifDate = await readExifDate(file);
    if (exifDate) {
      return exifDate;
    }
    if (file.lastModified) {
      return new Date(file.lastModified);
    }
    return new Date();
  }

  async function readExifDate(file) {
    if (!/jpe?g$/i.test(file.name) && file.type !== "image/jpeg") {
      return null;
    }

    try {
      const buffer = await file.slice(0, 256 * 1024).arrayBuffer();
      const view = new DataView(buffer);
      if (view.getUint16(0, false) !== 0xffd8) {
        return null;
      }

      let offset = 2;
      while (offset + 4 < view.byteLength) {
        const marker = view.getUint16(offset, false);
        offset += 2;
        if ((marker & 0xff00) !== 0xff00) {
          return null;
        }

        const size = view.getUint16(offset, false);
        offset += 2;
        if (marker === 0xffe1 && readAscii(view, offset, 6) === "Exif\0\0") {
          return parseExifBlock(view, offset + 6, size - 8);
        }
        offset += size - 2;
      }
    } catch (error) {
      console.warn("Lecture EXIF impossible pour cette photo.", error);
    }
    return null;
  }

  function parseExifBlock(view, tiffStart, length) {
    const littleEndian = readAscii(view, tiffStart, 2) === "II";
    const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
    const ifd0 = readIfdTags(view, tiffStart, tiffStart + firstIfdOffset, littleEndian, length);
    const exifIfdOffset = ifd0.get(0x8769);
    let dateText = ifd0.get(0x0132);

    if (exifIfdOffset) {
      const exifTags = readIfdTags(view, tiffStart, tiffStart + exifIfdOffset, littleEndian, length);
      dateText = exifTags.get(0x9003) || exifTags.get(0x9004) || dateText;
    }

    return parseExifDateString(dateText);
  }

  function readIfdTags(view, tiffStart, ifdOffset, littleEndian, length) {
    const tags = new Map();
    if (ifdOffset < tiffStart || ifdOffset + 2 > tiffStart + length) {
      return tags;
    }

    const entryCount = view.getUint16(ifdOffset, littleEndian);
    for (let index = 0; index < entryCount; index += 1) {
      const entry = ifdOffset + 2 + index * 12;
      if (entry + 12 > tiffStart + length) {
        break;
      }

      const tag = view.getUint16(entry, littleEndian);
      const type = view.getUint16(entry + 2, littleEndian);
      const count = view.getUint32(entry + 4, littleEndian);
      const valueOffset = view.getUint32(entry + 8, littleEndian);

      if (type === 2) {
        const inlineOffset = count <= 4 ? entry + 8 : tiffStart + valueOffset;
        tags.set(tag, readAscii(view, inlineOffset, count).replace(/\0/g, "").trim());
      } else if (type === 4) {
        tags.set(tag, valueOffset);
      }
    }
    return tags;
  }

  function parseExifDateString(value) {
    if (!value) {
      return null;
    }
    const match = value.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!match) {
      return null;
    }
    const [, year, month, day, hour, minute, second = "00"] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  }

  function readAscii(view, offset, length) {
    let text = "";
    const safeLength = Math.max(0, Math.min(length, view.byteLength - offset));
    for (let index = 0; index < safeLength; index += 1) {
      text += String.fromCharCode(view.getUint8(offset + index));
    }
    return text;
  }

  async function loadImage(file) {
    if ("createImageBitmap" in window) {
      try {
        return await createImageBitmap(file, { imageOrientation: "from-image" });
      } catch (error) {
        console.warn("createImageBitmap indisponible pour cette image, fallback HTMLImageElement.", error);
      }
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Impossible de charger l'image ${file.name}`));
      };
      img.src = url;
    });
  }

  function fitImage(imageWidth, imageHeight, maxWidth, maxHeight) {
    const ratio = Math.min(maxWidth / imageWidth, maxHeight / imageHeight);
    const width = imageWidth * ratio;
    const height = imageHeight * ratio;
    return {
      width,
      height,
      x: (maxWidth - width) / 2,
      y: (maxHeight - height) / 2
    };
  }

  function formatFrenchDate(value) {
    if (!value) {
      return "";
    }
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }

  function formatPhotoMetaLabel(date) {
    return `${formatPhotoDate(date)} ${formatPhotoTime(date)}`;
  }

  function formatPhotoDate(date) {
    return date.toLocaleDateString("fr-FR");
  }

  function formatPhotoTime(date) {
    return `${date.getHours()}h${String(date.getMinutes()).padStart(2, "0")}`;
  }

  function setMessage(message, type) {
    els.messageBox.textContent = message;
    els.messageBox.className = `message ${type || ""}`.trim();
  }

  function setProgress(value, text) {
    els.progressWrap.hidden = false;
    els.progressBar.value = value;
    els.progressText.textContent = text;
    els.progressPercent.textContent = `${value} %`;
  }

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }
})();
