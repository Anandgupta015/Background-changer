/*  script.js
    Pointer-events based drag & resize, robust against leaving canvas.
    Freeze only happens when Apply Background & Position is clicked.
*/

/* ---------- DOM ---------- */
const upload = document.getElementById("upload");
const preview = document.getElementById("preview");
const removeBtn = document.getElementById("removeBtn");
const bgColorInput = document.getElementById("bgColor");
const applyBgBtn = document.getElementById("applyBg");
const unlockBtn = document.getElementById("unlockBtn");
const downloadBtn = document.getElementById("downloadBtn");
const canvas = document.getElementById("canvas");
const bgImageUpload = document.getElementById("bgImageUpload");
/* ✅ New button for removing background image */
const removeBgImageBtn = document.getElementById("removeBgImageBtn");

const ctx = canvas.getContext("2d");

/* ---------- State ---------- */
let uploadedImage = null;
let bgRemovedImageURL = null;

let fgImg = new Image();
let bgImg = new Image();

// foreground position/size (in canvas coordinate space)
let fgPos = { x: 60, y: 60 };
let fgSize = { width: 200, height: 200 };

let dragging = false;
let resizing = false;
let dragOffset = { x: 0, y: 0 };
const resizeHandleSize = 16;

let isFinalized = false; // freeze flag

/* ---------- Helpers ---------- */
function resetCanvasSize(width, height) {
  canvas.width = Math.max(300, Math.round(width));
  canvas.height = Math.max(200, Math.round(height));
}

function drawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (bgImg && bgImg.src && bgImg.complete) {
    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = bgColorInput.value || "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (fgImg && fgImg.src && fgImg.complete) {
    ctx.drawImage(fgImg, fgPos.x, fgPos.y, fgSize.width, fgSize.height);

    if (!isFinalized) {
      // resize handle
      ctx.fillStyle = "#007bff";
      ctx.fillRect(
        fgPos.x + fgSize.width - resizeHandleSize,
        fgPos.y + fgSize.height - resizeHandleSize,
        resizeHandleSize,
        resizeHandleSize
      );
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        fgPos.x + fgSize.width - resizeHandleSize,
        fgPos.y + fgSize.height - resizeHandleSize,
        resizeHandleSize,
        resizeHandleSize
      );
    }
  } else {
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

/* continuous draw */
(function animate() {
  requestAnimationFrame(animate);
  drawCanvas();
})();

/* ---------- Events: Upload / Remove / Background ---------- */

upload.addEventListener("change", () => {
  const file = upload.files && upload.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    preview.src = reader.result;
    uploadedImage = reader.result;
    canvas.width = canvas.width;
  };
  reader.readAsDataURL(file);
});

removeBtn.addEventListener("click", async () => {
  if (!uploadedImage) {
    alert("Upload an image first.");
    return;
  }
  removeBtn.textContent = "Removing...";
  removeBtn.disabled = true;

  try {
    const base64Data = uploadedImage.split(",")[1];
    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": "Nd1EYC4h4TM8J223gv83z5Ms",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image_file_b64: base64Data, size: "auto" }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      alert("Removebg error: " + (err?.errors?.[0]?.title || response.statusText));
      return;
    }

    const blob = await response.blob();
    bgRemovedImageURL = URL.createObjectURL(blob);

    fgImg = new Image();
    fgImg.onload = () => {
      const maxW = Math.min(800, fgImg.width);
      const scale = Math.min(1, maxW / fgImg.width);
      fgSize.width = fgImg.width * scale;
      fgSize.height = fgImg.height * scale;
      fgPos = { x: 40, y: 40 };

      resetCanvasSize(fgSize.width + 120, fgSize.height + 120);
      isFinalized = false;
      unlockBtn.style.display = "none";
    };
    fgImg.src = bgRemovedImageURL;
    preview.src = bgRemovedImageURL;
  } catch (err) {
    console.error(err);
    alert("Failed to remove background. Check API key/network.");
  } finally {
    removeBtn.textContent = "Remove Background";
    removeBtn.disabled = false;
  }
});

bgImageUpload.addEventListener("change", () => {
  const file = bgImageUpload.files && bgImageUpload.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    bgImg = new Image();
    bgImg.onload = () => {
      resetCanvasSize(Math.min(bgImg.width, 1200), Math.min(bgImg.height, 800));
      isFinalized = false;
      unlockBtn.style.display = "none";
    };
    bgImg.src = reader.result;
  };
  reader.readAsDataURL(file);
});

/* ✅ Remove background image feature */
removeBgImageBtn.addEventListener("click", () => {
  if (!bgImg || !bgImg.src) {
    alert("No background image to remove.");
    return;
  }
  bgImg = new Image(); // reset
  resetCanvasSize(fgSize.width + 120, fgSize.height + 120);
  isFinalized = false;
  unlockBtn.style.display = "none";
  drawCanvas();
});

bgColorInput.addEventListener("input", () => {
  isFinalized = false;
  unlockBtn.style.display = "none";
});

/* ---------- Pointer-based Drag & Resize ---------- */
canvas.addEventListener("pointerdown", (e) => {
  if (isFinalized) return;
  if (e.button && e.button !== 0) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const handleX = fgPos.x + fgSize.width - resizeHandleSize;
  const handleY = fgPos.y + fgSize.height - resizeHandleSize;
  const onHandle =
    x >= handleX &&
    x <= handleX + resizeHandleSize &&
    y >= handleY &&
    y <= handleY + resizeHandleSize;

  if (onHandle) {
    resizing = true;
    canvas.setPointerCapture(e.pointerId);
  } else if (
    x >= fgPos.x &&
    x <= fgPos.x + fgSize.width &&
    y >= fgPos.y &&
    y <= fgPos.y + fgSize.height
  ) {
    dragging = true;
    dragOffset.x = x - fgPos.x;
    dragOffset.y = y - fgPos.y;
    canvas.setPointerCapture(e.pointerId);
  }
});

canvas.addEventListener("pointermove", (e) => {
  if (isFinalized) return;
  if (!dragging && !resizing) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (dragging) {
    fgPos.x = x - dragOffset.x;
    fgPos.y = y - dragOffset.y;
    fgPos.x = Math.max(-fgSize.width * 0.8, Math.min(fgPos.x, canvas.width - fgSize.width * 0.2));
    fgPos.y = Math.max(-fgSize.height * 0.8, Math.min(fgPos.y, canvas.height - fgSize.height * 0.2));
  } else if (resizing) {
    let newW = Math.max(40, x - fgPos.x);
    let newH = Math.max(40, y - fgPos.y);

    // ✅ Maintain aspect ratio
    if (fgImg && fgImg.width && fgImg.height) {
      const aspect = fgImg.width / fgImg.height;
      if (newW / newH > aspect) {
        newW = newH * aspect;
      } else {
        newH = newW / aspect;
      }
    }

    fgSize.width = newW;
    fgSize.height = newH;
  }
});

function releasePointer(e) {
  if (dragging || resizing) {
    dragging = false;
    resizing = false;
    try {
      canvas.releasePointerCapture && canvas.releasePointerCapture(e.pointerId);
    } catch {}
  }
}

canvas.addEventListener("pointerup", releasePointer);
window.addEventListener("pointerup", releasePointer);

/* ---------- Freeze / Apply / Unlock / Download ---------- */
applyBgBtn.addEventListener("click", () => {
  if (!fgImg || !fgImg.src) {
    alert("Remove background first (or load a foreground).");
    return;
  }
  preview.src = canvas.toDataURL("image/png");

  isFinalized = true;
  unlockBtn.style.display = "inline-block";
  alert("Background applied & position finalized — editing locked. Click Unlock to edit again.");
});

unlockBtn.addEventListener("click", () => {
  isFinalized = false;
  unlockBtn.style.display = "none";
});

/* ✅ Download Fix */
downloadBtn.addEventListener("click", () => {
  if (!canvas.width || !canvas.height) {
    alert("Nothing to download. Arrange image first.");
    return;
  }

  // Force redraw before download
  drawCanvas();

  canvas.toBlob((blob) => {
    if (!blob) {
      alert("Failed to export image.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "edited-image.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, "image/png");
});
