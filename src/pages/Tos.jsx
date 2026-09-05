import TosPointList from '../components/TosPointList.jsx';

export default function Tos() {
    return (
        <div className="datapad-wrapper datapad-wrapper--wide">
            <div className="datapad-screen">
                <a href="/" className="back-link">&larr; Back to directory</a>
                <h1><i className="fa-solid fa-scroll" /> Terms of Service</h1>
                <div id="tos-points"><TosPointList /></div>
            </div>
        </div>
    );
}
