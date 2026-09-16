import QueueBoard from '../components/QueueBoard.jsx';

export default function Queue() {
    return (
        <div className="page-tabby page-frame">
            <h1 className="sr-only">Commission Queue</h1>
            <QueueBoard />
        </div>
    );
}
