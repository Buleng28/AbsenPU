import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from 'chart.js';
import { User } from '../types';

ChartJS.register(ArcElement, Tooltip, Legend, Title);

interface DivisionPieChartProps {
    users: User[];
}

// Normalize division names (merge similar ones)
const normalizeDivision = (division?: string): string => {
    if (!division) return 'Umum';
    const normalized = division.toLowerCase().trim();
    if (normalized.includes('arsip')) return 'Arsiparis';
    if (normalized.includes('diklat')) return 'Pranata Diklat';
    if (normalized.includes('komputer')) return 'Pranata Komputer';
    return division.trim();
};

const DivisionPieChart: React.FC<DivisionPieChartProps> = ({ users }) => {
    const interns = users.filter(u => u.role === 'intern');

    const divisionCounts: { [key: string]: number } = {};
    interns.forEach(u => {
        const div = normalizeDivision(u.division);
        // Skip IT division
        if (div.toLowerCase().includes('it')) return;
        divisionCounts[div] = (divisionCounts[div] || 0) + 1;
    });

    // Convert to arrays, ensure Arsiparis is combined
    const labels = Object.keys(divisionCounts);
    const dataValues = Object.values(divisionCounts);

    // Color palette (red, yellow, blue, black) - cycle if more divisions
    const baseColors = [
        'rgba(239, 68, 68, 0.9)',   // red
        'rgba(234, 179, 8, 0.9)',   // yellow
        'rgba(59, 130, 246, 0.9)',  // blue
        'rgba(17, 24, 39, 0.9)'     // black
    ];

    const backgroundColor = labels.map((_, idx) => baseColors[idx % baseColors.length]);
    const borderColor = backgroundColor.map(c => c.replace('0.9', '1'));

    const data = {
        labels: labels,
        datasets: [
            {
                label: 'Jumlah Peserta',
                data: dataValues,
                backgroundColor,
                borderColor,
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
                    padding: 16,
                    font: { size: 12 },
                    color: '#64748b'
                }
            },
            title: {
                display: true,
                text: 'Distribusi Peserta per Divisi',
                align: 'start' as const,
                color: '#1e293b',
                font: { size: 14, weight: 'bold' as const },
                padding: { bottom: 10 }
            },
        },
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border dark:border-slate-800 shadow-sm h-full max-h-[300px]">
            <div className="h-full">
                {interns.length > 0 ? (
                    <Doughnut data={data} options={options} />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">Tidak ada data peserta.</div>
                )}
            </div>
        </div>
    );
};

export default DivisionPieChart;
