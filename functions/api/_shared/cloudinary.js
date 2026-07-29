async function sha1Hex(message) {
    const data = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

export async function uploadImage(file, { cloudName, apiKey, apiSecret, folder }) {
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = crypto.randomUUID();
    const paramsToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}`;
    const signature = await sha1Hex(paramsToSign + apiSecret);

    const form = new FormData();
    form.append('file', file);
    form.append('api_key', apiKey);
    form.append('timestamp', String(timestamp));
    form.append('signature', signature);
    form.append('folder', folder);
    form.append('public_id', publicId);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: form,
    });

    if (!response.ok) {
        throw new Error(`Cloudinary upload failed: ${response.status} ${await response.text()}`);
    }

    const result = await response.json();
    return result.secure_url;
}
