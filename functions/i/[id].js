import { escapeHtml } from '../../shared/escape-html.js';
import { extractImageId } from '../../shared/image-id.js';

const CSP = "default-src 'self'; script-src 'self' https://unpkg.com 'sha256-AhZyvNDdNRAqtFnGIp3LP8YpNDaE+qnvQ7qQk+5LG08='; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'self'; object-src 'none'; base-uri 'self';";

export function findImageById(charactersData, commissionsData, id) {
    for (const character of (charactersData?.characters || [])) {
        for (const image of (character.images || [])) {
            if (extractImageId(image.url) === id) {
                return {
                    kind: 'character',
                    url: image.url,
                    nsfw: Boolean(image.nsfw),
                    title: character.name,
                    description: character.bio || '',
                    backHref: `/gallery/${character.slug}/`,
                };
            }
        }
    }

    for (const item of (commissionsData?.pastWork || [])) {
        if (extractImageId(item.url) === id) {
            const isGiftArt = Boolean(item.giftArt);
            return {
                kind: 'commission',
                url: item.url,
                nsfw: Boolean(item.nsfw),
                title: isGiftArt ? 'Gift Art — Vyphir' : 'Commission — Vyphir',
                description: item.caption || (isGiftArt ? 'Past gift art' : 'Past commission work'),
                backHref: '/commissions/',
            };
        }
    }

    return null;
}

function renderErrorPage(message) {
    const safeMessage = escapeHtml(message);
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeMessage} | Vyphir</title>
    <link href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Quicksand:wght@500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <div class="datapad-wrapper">
        <div class="datapad-screen">
            <p class="feed-error">${safeMessage}</p>
            <a href="/" class="back-link">&larr; Back to directory</a>
        </div>
    </div>
</body>
</html>`;
}

function renderPermalinkPage({ title, description, url, nsfw, backHref }, requestUrl) {
    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml((description || '').split('\n')[0].slice(0, 200));
    const safeUrl = escapeHtml(url);
    const safeBackHref = escapeHtml(backHref);
    const safePageUrl = escapeHtml(requestUrl);
    const wrapClass = nsfw ? 'char-image-wrap nsfw-blur' : 'char-image-wrap';
    const nsfwAttr = nsfw ? ' data-nsfw="true"' : '';
    const shareTags = nsfw
        ? `<meta name="twitter:card" content="summary">`
        : `<meta property="og:image" content="${safeUrl}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${safeUrl}">`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${safePageUrl}">
    <meta property="og:title" content="${safeTitle}">
    <meta property="og:description" content="${safeDescription}">
    ${shareTags}
    <title>${safeTitle} | Vyphir</title>
    <link href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Quicksand:wght@500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/styles.css">
    <script type="importmap">
    { "imports": { "three": "https://unpkg.com/three@0.160.0/build/three.module.js" } }
    </script>
    <script type="module" src="/background.js"></script>
</head>
<body>
    <canvas id="webgl-canvas"></canvas>

    <div class="datapad-wrapper">
        <div class="datapad-screen">
            <a href="${safeBackHref}" class="back-link">&larr; Back</a>
            <h1>${safeTitle}</h1>
            <div class="${wrapClass}"${nsfwAttr}>
                <img src="${safeUrl}" alt="${safeTitle}">
            </div>
            <button type="button" id="copy-link-btn" class="permalink-copy-btn">Copy Link</button>
            <a href="/" class="permalink-explore-link">Explore more &rarr;</a>
        </div>
    </div>
    <script type="module" src="/gallery/permalink.js"></script>
</body>
</html>`;
}

export async function onRequestGet(context) {
    const { request, params } = context;
    const id = params.id;
    const origin = new URL(request.url).origin;

    let charactersData;
    let commissionsData;
    try {
        const [charactersRes, commissionsRes] = await Promise.all([
            fetch(`${origin}/data/characters.json`),
            fetch(`${origin}/data/commissions.json`),
        ]);
        charactersData = await charactersRes.json();
        commissionsData = await commissionsRes.json();
    } catch (error) {
        return new Response(renderErrorPage('Image data unavailable'), {
            status: 500,
            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP },
        });
    }

    const info = findImageById(charactersData, commissionsData, id);
    if (!info) {
        return new Response(renderErrorPage('Image not found'), {
            status: 404,
            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP },
        });
    }

    return new Response(renderPermalinkPage(info, request.url), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP },
    });
}
