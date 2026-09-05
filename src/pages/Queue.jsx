import QueueBoard from '../components/QueueBoard.jsx';

export default function Queue() {
    return (
        <div className="datapad-wrapper datapad-wrapper--xwide">
            <div className="datapad-screen">
                <a href="/" className="back-link">&larr; Back to directory</a>
                <h1><i className="fa-solid fa-list-check" /> Commission Queue</h1>
                <div id="queue-board"><QueueBoard /></div>
            </div>
        </div>
    );
}
