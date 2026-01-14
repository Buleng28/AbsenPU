import React from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from 'chart.js';
import { DashboardStats } from '../types';

ChartJS.register(ArcElement, Tooltip, Legend, Title);

interface DailyStatusChartProps {
  stats: DashboardStats | null;
}

const DailyStatusChart: React.FC<DailyStatusChartProps> = ({ stats }) => {
  const data = {
    labels: ['Hadir Tepat Waktu', 'Terlambat', 'Alpa'],
    datasets: [
      {
        label: 'Peserta',
        data: [
          (stats?.presentToday || 0) - (stats?.lateToday || 0),
          stats?.lateToday || 0,
          stats?.alpaToday || 0,
        ],
        backgroundColor: [
          'rgba(59, 130, 246, 0.7)',  // blue-500
          'rgba(239, 68, 68, 0.7)',   // red-500
          'rgba(107, 114, 128, 0.7)', // gray-500
        ],
        borderColor: [
          'rgba(59, 130, 246, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(107, 114, 128, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
            color: '#64748b' // text-slate-500
        }
      },
      title: {
        display: true,
        text: 'Distribusi Kehadiran Hari Ini',
        color: '#1e293b', // text-slate-800
        font: {
            size: 16,
            weight: 'bold' as const
        }
      },
    },
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border dark:border-slate-800 shadow-sm relative h-96">
      {stats ? (
        <Pie data={data} options={options} />
      ) : (
        <div className="flex items-center justify-center h-full">
          <p className="text-slate-400">Memuat data chart...</p>
        </div>
      )}
    </div>
  );
};

export default DailyStatusChart;
