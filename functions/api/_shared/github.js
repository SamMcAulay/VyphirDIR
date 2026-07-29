const API_BASE = 'https://api.github.com';

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
    const content = atob(data.content.replace(/\n/g, ''));
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
            },
            body: JSON.stringify({
                message,
                content: btoa(unescape(encodeURIComponent(content))),
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
