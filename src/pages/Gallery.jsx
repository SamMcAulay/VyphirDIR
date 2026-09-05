import GalleryIndexGrid from '../components/GalleryIndexGrid.jsx';

export default function Gallery() {
    return (
        <div className="datapad-wrapper datapad-wrapper--wide">
            <div className="datapad-screen">
                <a href="/" className="back-link">&larr; Back to directory</a>
                <h1><i className="fa-solid fa-image" /> Character Gallery</h1>
                <div id="gallery-index"><GalleryIndexGrid /></div>
            </div>
        </div>
    );
}
