import GalleryIndexGrid from '../components/GalleryIndexGrid.jsx';
import Panel from '../components/Panel.jsx';
import WaveText from '../components/WaveText.jsx';

export default function Gallery() {
    return (
        <div className="page-teal">
            <Panel wide>
                <a href="/" className="back-link">&larr; Back to directory</a>
                <WaveText as="h1" text="Character Gallery" />
                <div id="gallery-index"><GalleryIndexGrid /></div>
            </Panel>
        </div>
    );
}
