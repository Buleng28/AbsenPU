import React from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from 'chart.js';
import { User } from '../types';

ChartJS.register(ArcElement, Tooltip, Legend, Title);

interface DivisionPieChartProps {
    users: User[];
}

const DivisionPieChart: React.FC<DivisionPieChartProps> = ({ users }) => {
    const interns = users.filter(u => u.role === 'intern');

    const divisionCounts: { [key: string]: number } = {};
    interns.forEach(u => {
        const div = u.division || 'Umum';
        divisionCounts[div] = (divisionCounts[div] || 0) + 1;
    });

    const labels = Object.keys(divisionCounts);
    const dataValues = Object.values(divisionCounts);

    const data = {
        labels: labels,
        datasets: [
            {
                label: 'Jumlah Peserta',
                data: dataValues,
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',  // biru
                    'rgba(234, 179, 8, 0.8)',   // kuning
                    'rgba(239, 68, 68, 0.8)',   // merah
                    'rgba(31, 41, 55, 0.8)',    // hitam/slate-900
                    'rgba(59, 130, 246, 0.6)',  // biru lebih terang
                    'rgba(234, 179, 8, 0.6)',   // kuning lebih terang
                ],
                borderColor: [
                    'rgba(37, 99, 235, 1)',     // biru gelap
                    'rgba(202, 138, 4, 1)',     // kuning gelap
                    'rgba(220, 38, 38, 1)',     // merah gelap
                    'rgba(0, 0, 0, 1)',         // hitam
                    'rgba(37, 99, 235, 1)',     // biru gelap
                    'rgba(202, 138, 4, 1)',     // kuning gelap
                ],
                borderWidth: 2,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right' as const,
                labels: {
                    usePointStyle: true,
                    pointStyle: 'circle',
                    padding: 20,
                    font: { size: 11 },
                    color: '#64748b'
                }
            },
            title: {
                display: true,
                text: 'Distribusi Peserta per Divisi',
                align: 'start' as const,
                color: '#1e293b',
                font: { size: 14, weight: 'bold' as const },
                padding: { bottom: 20 }
            },
        },
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border dark:border-slate-800 shadow-sm h-full max-h-[300px]">
            <div className="h-full">
                {interns.length > 0 ? (
                    <Pie data={data} options={options} />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">Tidak ada data peserta.</div>
                )}
            </div>
        </div>
    );
};

export default DivisionPieChart;
