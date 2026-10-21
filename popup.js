import apiKeys from "./hidden.js";
const geminiApiKey = apiKeys.geminiApiKey;
const mistralApiKey = apiKeys.mistralApiKey;

document.getElementById('file-upload').addEventListener('change', async () => {
    const fileUploaded = event.target.files[0];
    if (!fileUploaded) {
        return;
    }

    const form = new FormData();
    form.append('purpose', 'ocr');
    form.append('file', new File([fileUploaded], `${fileUploaded.name}`));  

    const fileId = await PDFToJson(form);
    const fileURL = await getURL(fileId);
    const ocrJson = await OCRAPICall(fileURL);


    let markdownExport = "";
    for (const element of ocrJson.pages) {
        markdownExport += element.markdown + " ";
    }

    const geminiJson = await JsonToCSV(markdownExport);
    let csvContent = geminiJson.candidates[0].content.parts[0].text;
    csvContent = csvContent.trim()

    createFileAndDownload('downloadable.csv', csvContent.slice(6).slice(0, -3));
});

/**
 * Convert a PDF to a JSON object
 * 
 * @param {FormData} form 
 * @returns {Promise<Object>}
 */
async function PDFToJson(form) {
    const uploadedPDF = await fetch('https://api.mistral.ai/v1/files', {
        method: 'POST',
        headers: {
            "Authorization": `Bearer ${mistralApiKey}`
        },
        body: form,
    });

    const PDFJson = await uploadedPDF.json(); 
    return PDFJson.id
}


async function getURL(fileId) {
     const response = await fetch(`https://api.mistral.ai/v1/files/${fileId}/url?expiry=24`, {
            method: 'GET',
            headers: {
                "Accept": "application/json",
                "Authorization": `Bearer ${mistralApiKey}`
            }
        })

    const responseJSON = await response.json();
    return responseJSON.url;
}


async function OCRAPICall(fileURL) {
    const OCRCall = await fetch('https://api.mistral.ai/v1/ocr', {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${mistralApiKey}`
        },
        body: JSON.stringify({
            model: 'mistral-ocr-latest',
            document: {
                type: 'document_url',
                document_url: fileURL
            }
        })
    });

    const data = await OCRCall.json();
    return data;
}


async function JsonToCSV(markdownExport) {

    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiApiKey}`

    const prompt = `Extract all syllabus assignments and due dates from the provided text into a clean CSV format.
    Use the following exact column headers:
    Due Date, Class, Assignment Name, Assignment Type, Checkbox

    Do not include markdown code block backticks (e.g. \`\`\`csv), conversational text, or explanations—return ONLY the raw CSV text.

    Syllabus Content:
    ${markdownExport}`;
    


    const convertCSV = await fetch(geminiEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [
                {
                    parts: [
                        {
                            text: prompt
                        }
                    ]
                }
            ]
        })
    });

    const data = await convertCSV.json();
    return data

}

function createFileAndDownload(filename, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    const p = document.createElement('p');
    p.innerHTML = filename;
    link.append(p);
}