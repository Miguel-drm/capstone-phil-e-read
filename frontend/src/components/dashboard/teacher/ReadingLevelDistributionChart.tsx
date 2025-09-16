import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

const ReadingLevelDistributionChart: React.FC = () => {
  const pieChartRef = useRef<HTMLDivElement>(null);
  const pieChartInstance = useRef<echarts.ECharts | null>(null);

  // Mock data for reading level distribution
  const readingLevelData = [
    { value: 18, name: 'Instructional', itemStyle: { color: '#22c55e' } }, // green
    { value: 12, name: 'Independent', itemStyle: { color: '#3b82f6' } }, // blue
    { value: 7, name: 'Frustration', itemStyle: { color: '#facc15' } } // yellow
  ];

  useEffect(() => {
    if (pieChartRef.current) {
      pieChartInstance.current = echarts.init(pieChartRef.current);

      const option = {
        backgroundColor: 'transparent',
        title: {
          text: 'Reading Level Distribution',
          left: 'center',
          top: 10,
          textStyle: {
            fontSize: 16,
            fontWeight: '600',
          }
        },
        tooltip: {
          show: false
        },
        legend: {
          orient: 'horizontal',
          bottom: 10,
          left: 'center',
          data: readingLevelData.map(d => d.name),
          textStyle: {
            fontSize: 12,
            fontWeight: '600',
            color: '#374151',
          },
          itemGap: 20,
          icon: 'circle',
        },
        series: [
          {
            name: 'Reading Level',
            type: 'pie',
            radius: ['50%', '70%'],
            center: ['50%', '50%'],
            itemStyle: {
              borderColor: '#fff',
              borderWidth: 5,
              borderRadius: 8,
              shadowBlur: 10,
              shadowColor: 'rgba(0,0,0,0.08)'
            },
            label: {
              show: false, 
              position: 'center'
            },
            emphasis: {
              label: {
                show: true,
                fontSize: '24',
                fontWeight: 'bold',
                formatter: `{d}%`
              }
            },
            labelLine: {
              show: false
            },
            data: readingLevelData,
          }
        ]
      };
      pieChartInstance.current.setOption(option);
      const resizeHandler = () => pieChartInstance.current?.resize();
      window.addEventListener('resize', resizeHandler);
      return () => {
        window.removeEventListener('resize', resizeHandler);
        pieChartInstance.current?.dispose();
      };
    }
  }, []);

  return (
    <div className="bg-white rounded-2xl shadow-md p-4 transition-all duration-300 hover:shadow-lg h-full flex flex-col">
      <div className="flex-1 flex flex-col justify-between">
       
        <div className="flex-1 flex flex-col justify-center">
          <div ref={pieChartRef} className="w-full h-64 sm:h-72"></div>
        </div>
      </div>
    </div>
  );
};

export default ReadingLevelDistributionChart;
