import apiKeys from "./hidden.js";
const geminiApiKey = apiKeys.geminiApiKey;
const claudeApiKey = apiKeys.claudeApiKey;

document.getElementById("file_input").addEventListener("change", async () => {
    const fileUploaded = event.target.files[0];
    if (!fileUploaded) {
        return;
    }    
    const form = new FormData();
    form.append('purpose', 'ocr');
    form.append('file', new File([fileUploaded], `${fileUploaded.name}`));

});


/**
 * Reads a PDF from FormData and sends it to the background script for Claude processing
 * 
 * @param {FormData} form 
 * @returns {Promise<Object>}
 */
async function PDFToJson(form) {
    const file = form.get("file");
    if (!file) throw new Error("No PDF file found in form data.");

    // Convert file to Base64
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);

    // Send to background service worker
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { action: "parsePdfWithClaude", base64Data },
            (response) => {
                if (response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response.data);
                }
            }
        );
    });
}