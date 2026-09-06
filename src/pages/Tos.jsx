import Panel from '../components/Panel.jsx';
import TosPointList from '../components/TosPointList.jsx';
import WaveText from '../components/WaveText.jsx';

export default function Tos() {
    return (
        <div className="page-lavender">
            <Panel wide>
                <a href="/" className="back-link">&larr; Back to directory</a>
                <WaveText as="h1" text="Terms of Service" />
                <div id="tos-points"><TosPointList /></div>
            </Panel>
        </div>
    );
}
