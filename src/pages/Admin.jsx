import { useEffect, useState } from 'react';
import AdminCharacters from '../components/admin/AdminCharacters.jsx';
import AdminCommissionsInfo from '../components/admin/AdminCommissionsInfo.jsx';
import AdminPastWork from '../components/admin/AdminPastWork.jsx';
import AdminQueue from '../components/admin/AdminQueue.jsx';
import AdminTos from '../components/admin/AdminTos.jsx';

export default function Admin() {
    const [pastWork, setPastWork] = useState([]);
    const [savedPastWorkOrder, setSavedPastWorkOrder] = useState([]);

    useEffect(() => {
        fetch('/data/commissions.json')
            .then((r) => r.json())
            .then((d) => {
                const work = d.pastWork || [];
                setPastWork(work);
                setSavedPastWorkOrder(work.map((e) => e.url));
            })
            .catch((error) => console.error('Failed to load current commissions data:', error));
    }, []);

    return (
        <>
            <h1>Vyphir Admin</h1>
            <AdminCharacters />
            <AdminCommissionsInfo />
            <AdminPastWork
                pastWork={pastWork}
                setPastWork={setPastWork}
                savedOrder={savedPastWorkOrder}
                setSavedOrder={setSavedPastWorkOrder}
            />
            <AdminTos />
            <AdminQueue />
        </>
    );
}
