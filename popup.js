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


async function PDFToJson(form) {
    // 1. Extract the file from the FormData object
    const file = form.get("file"); // Adjust key if your FormData uses a different field name
    if (!file) throw new Error("No PDF file found in form data.");

    // 2. Convert the PDF File object to a Base64 string
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);

    // 3. Send the base64 PDF directly to Claude's Messages API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": claudeApiKey, "anthropic-version": "2023-06-01", "content-type": "application/json", "dangerously-allow-browser": "true" },
        body: JSON.stringify({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 4096,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "document",
                            source: {
                                type: "base64",
                                media_type: "application/pdf",
                                data: base64Data
                            }
                        },
                        {
                            type: "text",
                            text: "Extract all relevant text and key-value details from this PDF and return it as clean JSON object. Output ONLY valid JSON without markdown formatting."
                        }
                    ]
                }
            ]
        })
    });

    const result = await response.json();

    // 4. Extract and parse the returned JSON string from Claude's text content block
    const textOutput = result.content[0].text;
    return JSON.parse(textOutput);
}