import { useEffect, useState } from 'react';
import { formatDate } from '../../shared/format-date.js';

export default function BlueskyFeed({ handle }) {
    const [state, setState] = useState({ status: 'loading', posts: [] });

    useEffect(() => {
        let cancelled = false;
        fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${handle}&limit=3`)
            .then((r) => r.json())
            .then((data) => {
                if (cancelled) return;
                const posts = (data.feed || [])
                    .map((item) => item.post?.record)
                    .filter(Boolean)
                    .map((post) => ({ text: post.text, date: formatDate(post.createdAt) }));
                setState({ status: 'ready', posts });
            })
            .catch((error) => {
                console.error(error);
                if (!cancelled) setState({ status: 'error', posts: [] });
            });
        return () => {
            cancelled = true;
        };
    }, [handle]);

    if (state.status === 'loading') {
        return <p className="feed-loading-placeholder">Loading data packets...</p>;
    }
    if (state.status === 'error') {
        return <p className="feed-error">&gt; UPLINK FAILED.</p>;
    }
    return (
        <>
            {state.posts.map((post, i) => (
                <div className="feed-entry" key={i}>
                    <div className="feed-entry-header">
                        <span className="feed-handle">@{handle}</span>
                        <span className="feed-date">{post.date}</span>
                    </div>
                    <p className="feed-text">{post.text}</p>
                </div>
            ))}
        </>
    );
}
