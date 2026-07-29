const API_BASE = 'https://api.github.com';

function bytesToBinaryString(bytes) {
    const CHUNK_SIZE = 0x8000;
    let result = '';
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        result += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
    }
    return result;
}

export async function getFile(path, { owner, repo, branch, token }) {
    const response = await fetch(
        `${API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
            },
        }
    );
    if (!response.ok) {
        throw new Error(`GitHub getFile failed: ${response.status} ${await response.text()}`);
    }
    const data = await response.json();
    const bytes = Uint8Array.from(atob(data.content.replace(/\s/g, '')), (c) => c.charCodeAt(0));
    const content = new TextDecoder().decode(bytes);
    return { content, sha: data.sha };
}

export async function putFile(path, content, sha, message, { owner, repo, branch, token }) {
    const response = await fetch(
        `${API_BASE}/repos/${owner}/${repo}/contents/${path}`,
        {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message,
                content: btoa(bytesToBinaryString(new TextEncoder().encode(content))),
                sha,
                branch,
            }),
        }
    );
    if (!response.ok) {
        const status = response.status;
        const error = new Error(`GitHub putFile failed: ${status} ${await response.text()}`);
        error.status = status;
        throw error;
    }
    return response.json();
}

export async function withRetryOn409(attempt) {
    try {
        return await attempt();
    } catch (error) {
        if (error.status === 409) return attempt();
        throw error;
    }
}
