const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5-5";
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const KEY_STORAGE = "masterlistAnthropicApiKey";

const fileInput = document.getElementById("file_input");
const fileName = document.getElementById("file_name");
const apiKeyInput = document.getElementById("api_key");
const rememberKey = document.getElementById("remember_key");
const convertButton = document.getElementById("convert");
const statusBox = document.getElementById("status");
const dropZone = document.getElementById("drop_zone");

function showStatus(message, type) {
  statusBox.textContent = message;
  statusBox.className = `status show ${type}`;
}

function resetStatus() {
  statusBox.textContent = "";
  statusBox.className = "status";
}

chrome.storage?.local.get(KEY_STORAGE, (stored) => {
  if (chrome.runtime.lastError) return;
  if (stored[KEY_STORAGE]) {
    apiKeyInput.value = stored[KEY_STORAGE];
    rememberKey.checked = true;
  }
});

document.getElementById("toggle_key").addEventListener("click", (event) => {
  const visible = apiKeyInput.type === "password";
  apiKeyInput.type = visible ? "text" : "password";
  event.currentTarget.textContent = visible ? "Hide" : "Show";
});

rememberKey.addEventListener("change", () => {
  if (rememberKey.checked && apiKeyInput.value.trim()) {
    chrome.storage.local.set({ [KEY_STORAGE]: apiKeyInput.value.trim() });
  } else {
    chrome.storage.local.remove(KEY_STORAGE);
  }
});

apiKeyInput.addEventListener("input", () => {
  if (rememberKey.checked) chrome.storage.local.set({ [KEY_STORAGE]: apiKeyInput.value.trim() });
});

fileInput.addEventListener("change", () => {
  resetStatus();
  fileName.textContent = fileInput.files[0]?.name ?? "";
});

for (const eventName of ["dragenter", "dragover"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("drag");
  });
}
for (const eventName of ["dragleave", "drop"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("drag");
  });
}
dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer.files[0];
  if (!file) return;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  fileInput.files = transfer.files;
  fileInput.dispatchEvent(new Event("change", { bubbles: true }));
});

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("The PDF could not be read. Try selecting it again."));
    reader.readAsDataURL(file);
  });
}

function csvSafeName(name) {
  return name.replace(/\.pdf$/i, "").replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "") || "syllabus";
}

function downloadCsv(filename, content) {
  const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function extractAssignments(file, apiKey) {
  const base64 = await toBase64(file);
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
          { type: "text", text: `Read this course syllabus and extract every assignment, exam, quiz, project, reading, and other dated course task. Return only valid CSV with exactly these columns, in this order: Due Date, Class, Assignment Name, Assignment Type, Checkbox. Use the syllabus course name for Class when available; leave unknown due dates blank; use ISO YYYY-MM-DD dates only when the year is clear from the document; otherwise preserve the stated month and day. Set Checkbox to false for each row. Quote and escape CSV fields correctly. Do not include markdown fences or explanatory text. If no assignments can be found, return only the header row.` },
        ],
      }],
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = result.error?.message || `Anthropic returned an error (${response.status}).`;
    if (response.status === 401) throw new Error("That API key was not accepted. Check it and try again.");
    if (response.status === 413) throw new Error("This PDF is too large to send. Try a smaller file.");
    throw new Error(message);
  }
  const csv = result.content?.filter((part) => part.type === "text").map((part) => part.text).join("\n").trim();
  if (!csv) throw new Error("No CSV came back. Try another syllabus or check the API response.");
  const cleaned = csv.replace(/^```(?:csv)?\s*/i, "").replace(/\s*```$/, "").trim();
  const header = cleaned.split(/\r?\n/, 1)[0].replace(/^\uFEFF/, "").trim();
  if (header !== "Due Date, Class, Assignment Name, Assignment Type, Checkbox") {
    throw new Error("The response was not a valid assignment CSV. Please try again.");
  }
  return cleaned;
}

convertButton.addEventListener("click", async () => {
  const file = fileInput.files[0];
  const apiKey = apiKeyInput.value.trim();
  resetStatus();

  if (!apiKey) return showStatus("Add your Anthropic API key to get started.", "error");
  if (!file) return showStatus("Choose a syllabus PDF first.", "error");
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return showStatus("Please choose a PDF file.", "error");
  if (file.size > MAX_FILE_SIZE) return showStatus("This PDF is over 20 MB. Choose a smaller file.", "error");

  convertButton.disabled = true;
  convertButton.textContent = "Reading your syllabus…";
  showStatus("Extracting assignments from your PDF. This can take a little while.", "loading");
  try {
    const csv = await extractAssignments(file, apiKey);
    const rows = csv.split(/\r?\n/).length - 1;
    downloadCsv(`${csvSafeName(file.name)}-assignments.csv`, csv);
    showStatus(`Your CSV is ready${rows > 0 ? ` with ${rows} assignment${rows === 1 ? "" : "s"}` : " (no dated assignments were found)"}.`, "success");
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "Something went wrong. Please try again.", "error");
  } finally {
    convertButton.disabled = false;
    convertButton.textContent = "Create my CSV";
  }
});
