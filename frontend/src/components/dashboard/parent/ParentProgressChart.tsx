/**
 * PARENT-ONLY COMPONENT: Child Progress Chart
 * 
 * This component displays a simplified progress view for parents
 * to track their children's reading progress without teacher-specific features.
 */

import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { type Student } from '../../../services/studentService';

interface ParentProgressChartProps {
  data: {
    assessmentPeriods: string[];
    oralReadingScores: number[];
    comprehensionScores: number[];
    readingLevels: string[];
  };
  students: Student[];
  title?: string;
}

const ParentProgressChart: React.FC<ParentProgressChartProps> = ({ 
  data, 
  students, 
  title = "Child's Reading Progress" 
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (chartRef.current) {
      chartInstance.current = echarts.init(chartRef.current);
      
      const option = {
        animation: true,
        animationDuration: 1000,
        animationEasing: 'cubicOut' as const,
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          textStyle: {
            color: '#374151'
          }
        },
        legend: {
          data: ['Reading Score', 'Comprehension'],
          textStyle: {
            fontSize: 12,
            color: '#6b7280'
          },
          itemGap: 10,
          top: 15,
          left: 'center'
        },
        grid: {
          left: '3%',
          right: '3%',
          bottom: '8%',
          top: '20%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          boundaryGap: true,
          data: data.assessmentPeriods || [],
          axisLabel: {
            fontSize: 11,
            color: '#6b7280',
            rotate: 0
          },
          axisLine: {
            lineStyle: {
              color: '#e5e7eb'
            }
          },
          axisTick: {
            show: false
          }
        },
        yAxis: {
          type: 'value',
          max: 100,
          min: 0,
          axisLabel: {
            fontSize: 11,
            color: '#6b7280',
            formatter: '{value}%'
          },
          axisLine: {
            show: false
          },
          axisTick: {
            show: false
          },
          splitLine: {
            lineStyle: {
              color: '#f3f4f6',
              type: 'dashed'
            }
          }
        },
        series: [
          {
            name: 'Reading Score',
            type: 'line',
            data: data.oralReadingScores || [],
            smooth: true,
            lineStyle: {
              color: '#3b82f6',
              width: 3
            },
            itemStyle: {
              color: '#3b82f6'
            },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                  { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }
                ]
              }
            }
          },
          {
            name: 'Comprehension',
            type: 'line',
            data: data.comprehensionScores || [],
            smooth: true,
            lineStyle: {
              color: '#10b981',
              width: 3
            },
            itemStyle: {
              color: '#10b981'
            }
          }
        ]
      };
      
      chartInstance.current.setOption(option);

      const resizeHandler = () => {
        chartInstance.current?.resize();
      };

      window.addEventListener('resize', resizeHandler);

      return () => {
        window.removeEventListener('resize', resizeHandler);
        chartInstance.current?.dispose();
      };
    }
  }, [data]);

  return (
    <div className="bg-white rounded-2xl p-4 transition-all duration-300 overflow-hidden flex flex-col h-full w-full">
      <div className="p-3 flex flex-col flex-1 w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base md:text-lg font-semibold text-[#2C3E50]">{title}</h3>
          {students.length > 0 && (
            <div className="text-sm text-gray-600">
              {students[0].name} - {students[0].grade}
            </div>
          )}
        </div>
        <div ref={chartRef} className="w-full flex-1 min-h-80 h-full" />
      </div>
    </div>
  );
};

export default ParentProgressChart;