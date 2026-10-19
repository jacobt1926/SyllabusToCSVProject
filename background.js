import apiKeys from "./hidden.js"
const claudeApiKey = apiKeys.claudeApiKey;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "parsePdfWithClaude") {
        fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": claudeApiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
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
                                    data: request.base64Data
                                }
                            },
                            {
                                type: "text",
                                text: "Extract all relevant text and key-value details from this PDF and return it as clean JSON object. Output ONLY valid JSON without markdown formatting or code blocks."
                            }
                        ]
                    }
                ]
            })
        })
        .then(res => res.json())
        .then(result => {
            const textOutput = result.content[0].text;
            // Clean up Markdown backticks if Claude wraps JSON in standard markdown blocks
            const cleanedJson = textOutput.replace(/```json|```/g, "").trim();
            sendResponse({ data: JSON.parse(cleanedJson) });
        })
        .catch(err => sendResponse({ error: err.message }));

        return true; // Keep message channel open for async response
    }
});