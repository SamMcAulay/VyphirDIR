import BlueskyFeed from '../components/BlueskyFeed.jsx';
import CharacterGalleryStrip from '../components/CharacterGalleryStrip.jsx';
import CommissionsPreviewStrip from '../components/CommissionsPreviewStrip.jsx';

export default function Landing() {
    return (
        <div className="datapad-wrapper">
            <div className="datapad-screen">
                <div className="sys-header">
                    <div className="status-light" />
                    <span>KITTPAD_OS v1.MEOW</span>
                    <span><i className="fa-solid fa-battery-full" /></span>
                </div>

                <div className="profile">
                    <div className="avatar-frame">
                        <img src="https://f2.toyhou.se/file/f2-toyhou-se/images/113402324_irRXncxlu389pbc.png?1768418401" alt="Profile" className="avatar" />
                    </div>
                    <h1>Sam</h1>
                    <p>Genius, billionaire, playboy, philanthropist, cat</p>
                </div>

                <div>
                    <div className="links-grid">
                        <a href="https://www.instagram.com/vyphir" className="link-btn"><i className="fa-brands fa-instagram" /> Instagram</a>
                        <a href="https://x.com/Vyphirr" className="link-btn"><i className="fa-brands fa-x-twitter" /> Twitter</a>
                        <a href="https://bsky.app/profile/samisaderp.bsky.social" className="link-btn"><i className="fa-brands fa-bluesky" /> Bluesky</a>
                        <a href="https://t.me/Samisaderp#" className="link-btn"><i className="fa-brands fa-telegram" /> Telegram</a>
                        <a href="https://toyhou.se/samisaderp/characters" className="link-btn"><i className="fa-solid fa-box-open" /> Toyhouse</a>
                        <a href="https://steamcommunity.com/profiles/76561199191219060/" className="link-btn"><i className="fa-brands fa-steam" /> Steam</a>
                    </div>
                </div>

                <div>
                    <h2 className="section-title"><i className="fa-solid fa-image" /> Character Archives</h2>
                    <a href="/gallery/" className="commissions-cta"><i className="fa-solid fa-image" /> View All Characters</a>
                    <CharacterGalleryStrip />
                </div>

                <div>
                    <h2 className="section-title"><i className="fa-solid fa-palette" /> Commissions</h2>
                    <a href="/commissions/" className="commissions-cta"><i className="fa-solid fa-palette" /> View Commissions</a>
                    <CommissionsPreviewStrip />
                </div>

                <div>
                    <h2 className="section-title"><i className="fa-solid fa-satellite-dish" /> Comms Feed</h2>
                    <h3 className="bsky-init-heading">&gt; INITIALIZING BLUESKY LINK...</h3>
                    <div className="feed-container" id="bsky-feed">
                        <BlueskyFeed handle="samisaderp.bsky.social" />
                    </div>
                </div>
            </div>
        </div>
    );
}
