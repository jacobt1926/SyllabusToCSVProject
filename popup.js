document.getElementById("file_input").addEventListener("change", async () => {
    const fileUploaded = event.target.files[0];
    if (!fileUploaded) {
        return;
    }    
    const form = new FormData();
    form.append('purpose', 'ocr');
    form.append('file', new File([fileUploaded], `${fileUploaded.name}`));

});

