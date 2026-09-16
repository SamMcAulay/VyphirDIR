import NsfwBlurImage from './NsfwBlurImage.jsx';

export default function PastWorkGrid({ items }) {
    return (
        <ul className="square-grid past-work-grid">
            {items.map((item, i) => (
                <li key={i}>
                    <NsfwBlurImage
                        src={item.url}
                        nsfw={Boolean(item.nsfw)}
                        alt={item.caption || (item.giftArt ? 'Past gift art' : 'Past commission work')}
                    />
                </li>
            ))}
        </ul>
    );
}
