import NsfwBlurImage from './NsfwBlurImage.jsx';

export default function PastWorkGrid({ items }) {
    return (
        <>
            {items.map((item, i) => (
                <div className="past-work-card" key={i}>
                    <NsfwBlurImage src={item.url} nsfw={Boolean(item.nsfw)} alt={item.caption || (item.giftArt ? 'Past gift art' : 'Past commission work')} />
                    {item.caption && <p>{item.caption}</p>}
                </div>
            ))}
        </>
    );
}
