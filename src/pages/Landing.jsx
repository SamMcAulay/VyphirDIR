import BlueskyFeed from '../components/BlueskyFeed.jsx';
import CharacterGalleryStrip from '../components/CharacterGalleryStrip.jsx';
import CommissionsPreviewStrip from '../components/CommissionsPreviewStrip.jsx';
import Panel from '../components/Panel.jsx';
import WaveText from '../components/WaveText.jsx';
import { usePopClick } from '../hooks/usePopClick.js';

function LinkButton({ href, icon, children }) {
    const pop = usePopClick();
    return (
        <a href={href} className={`link-btn pop-clickable ${pop.className}`.trim()} onPointerUp={pop.onPointerUp}>
            <i className={icon} /> {children}
        </a>
    );
}

function CtaButton({ href, icon, children }) {
    const pop = usePopClick();
    return (
        <a href={href} className={`commissions-cta pop-clickable ${pop.className}`.trim()} onPointerUp={pop.onPointerUp}>
            <i className={icon} /> {children}
        </a>
    );
}

export default function Landing() {
    return (
        <div className="page-pink">
            <Panel>
                <div className="sys-header">
                    <div className="status-light" />
                    <span>KITTPAD_OS v1.MEOW</span>
                    <span><i className="fa-solid fa-battery-full" /></span>
                </div>

                <div className="profile">
                    <div className="avatar-frame">
                        <img src="https://f2.toyhou.se/file/f2-toyhou-se/images/113402324_irRXncxlu389pbc.png?1768418401" alt="Profile" className="avatar" />
                    </div>
                    <WaveText as="h1" text="Sam" />
                    <p>Genius, billionaire, playboy, philanthropist, cat</p>
                </div>

                <div>
                    <div className="links-grid">
                        <LinkButton href="https://www.instagram.com/vyphir" icon="fa-brands fa-instagram">Instagram</LinkButton>
                        <LinkButton href="https://x.com/Vyphirr" icon="fa-brands fa-x-twitter">Twitter</LinkButton>
                        <LinkButton href="https://bsky.app/profile/samisaderp.bsky.social" icon="fa-brands fa-bluesky">Bluesky</LinkButton>
                        <LinkButton href="https://t.me/Samisaderp#" icon="fa-brands fa-telegram">Telegram</LinkButton>
                        <LinkButton href="https://toyhou.se/samisaderp/characters" icon="fa-solid fa-box-open">Toyhouse</LinkButton>
                        <LinkButton href="https://steamcommunity.com/profiles/76561199191219060/" icon="fa-brands fa-steam">Steam</LinkButton>
                    </div>
                </div>

                <div>
                    <WaveText as="h2" className="section-title" text="Character Archives" />
                    <CtaButton href="/gallery/" icon="fa-solid fa-image">View All Characters</CtaButton>
                    <CharacterGalleryStrip />
                </div>

                <div>
                    <WaveText as="h2" className="section-title" text="Commissions" />
                    <CtaButton href="/commissions/" icon="fa-solid fa-palette">View Commissions</CtaButton>
                    <CommissionsPreviewStrip />
                </div>

                <div>
                    <WaveText as="h2" className="section-title" text="Comms Feed" />
                    <h3 className="bsky-init-heading">Latest from Bluesky</h3>
                    <div className="feed-container" id="bsky-feed">
                        <BlueskyFeed handle="samisaderp.bsky.social" />
                    </div>
                </div>
            </Panel>
        </div>
    );
}
