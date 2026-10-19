import apiKeys from "./hidden.js";
const geminiApiKey = apiKeys.geminiApiKey;
const claudeApiKey = apiKeys.claudeApiKey;

// Helper function to create and download the resulting CSV file
function createFileAndDownload(filename, content) {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Sends a PDF file directly to Claude's API to extract all text/content.
 * 
 * @param {FormData} form 
 * @returns {Promise<string>} The extracted text content
 */
async function PDFToJson(form) {
    const file = form.get("file");
    if (!file) throw new Error("No PDF file found in form data.");

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "x-api-key": claudeApiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
            "dangerously-allow-browser": "true"
        },
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
                            text: "Extract all text and content from this syllabus document accurately and completely."
                        }
                    ]
                }
            ]
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Claude API Error: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    return result.content[0].text;
}

/**
 * Sends extracted syllabus text to Claude to generate a structured CSV.
 * 
 * @param {string} markdownExport 
 * @returns {Promise<string>} Clean CSV string
 */
async function JsonToCSV(markdownExport) {
    if (!markdownExport) throw new Error("No syllabus content provided.");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "x-api-key": claudeApiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
            "dangerously-allow-browser": "true"
        },
        body: JSON.stringify({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 4096,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Extract all assignments from the following syllabus content into CSV format.

Use EXACTLY these column headers:
Due Date, Class, Assignment Name, Assignment Type, Checkbox

Rules:
- Default 'Checkbox' column value to false for all rows.
- Output ONLY pure, valid CSV data.
- Do NOT include markdown code fences (\`\`\`csv), headers, or extra conversational text.

Syllabus Content:
${markdownExport}`
                        }
                    ]
                }
            ]
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Claude API Error: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    const rawCsv = result.content[0].text;
    
    // Clean code blocks if present
    return rawCsv.replace(/```csv|```/g, "").trim();
}

// Complete Event Listener Flow
document.getElementById("file_input").addEventListener("change", async (event) => {
    const fileUploaded = event.target.files[0];
    if (!fileUploaded) {
        return;
    }    

    try {
        // 1. Prepare form data with uploaded PDF
        const form = new FormData();
        form.append('purpose', 'ocr');
        form.append('file', new File([fileUploaded], `${fileUploaded.name}`));

        // 2. Process PDF to extract text content
        const markdownContent = await PDFToJson(form);

        // 3. Send text to Claude to generate CSV rows
        const csvData = await JsonToCSV(markdownContent);

        // 4. Trigger download of assignments.csv
        createFileAndDownload("downloadable.csv", csvData);
    } catch (err) {
        console.error("Error processing file:", err);
    }
});