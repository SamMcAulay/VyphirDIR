import Panel from '../components/Panel.jsx';
import QueueBoard from '../components/QueueBoard.jsx';
import WaveText from '../components/WaveText.jsx';

export default function Queue() {
    return (
        <div className="page-tabby">
            <Panel xwide>
                <a href="/" className="back-link">&larr; Back to directory</a>
                <WaveText as="h1" text="Commission Queue" />
                <div id="queue-board"><QueueBoard /></div>
            </Panel>
        </div>
    );
}
