import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';

interface ClassPerformanceChartProps {
  classNames: string[];
  classAverages: number[];
  className: string;
  isLoading?: boolean;
}

const ClassPerformanceChart: React.FC<ClassPerformanceChartProps> = ({ classNames, classAverages, className, isLoading = false }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [visibleClasses, setVisibleClasses] = useState<Set<string>>(new Set(classNames));

  // Ensure all classes are visible by default whenever the list of classes changes
  useEffect(() => {
    if (classNames.length > 0 && visibleClasses.size !== classNames.length) {
      setVisibleClasses(new Set(classNames));
    }
  }, [classNames]);

  const toggleClassVisibility = (className: string) => {
    setVisibleClasses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(className)) {
        newSet.delete(className);
      } else {
        newSet.add(className);
      }
      return newSet;
    });
  };

  // Removed global Show/Hide All per requirement that data is shown by default

  // Initialize once
  useEffect(() => {
    if (!chartRef.current) return;

    const existing = echarts.getInstanceByDom(chartRef.current);
    chartInstance.current = existing || echarts.init(chartRef.current);

    const resizeHandler = () => chartInstance.current?.resize();
    window.addEventListener('resize', resizeHandler);
    return () => {
      window.removeEventListener('resize', resizeHandler);
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  // Update options on data change
  useEffect(() => {
    if (!chartInstance.current) return;

    // Handle loading state
    if (isLoading) {
      const loadingOption = {
        title: {
          text: 'Loading...',
          left: 'center',
          top: 'middle',
          textStyle: { color: '#6b7280', fontSize: 14 }
        }
      } as any;
      chartInstance.current.setOption(loadingOption, { notMerge: true, lazyUpdate: true });
      return;
    }

    // Handle empty data
    if (classNames.length === 0 || classAverages.length === 0) {
      const emptyOption = {
        title: {
          text: 'No class data available',
          left: 'center',
          top: 'middle',
          textStyle: { color: '#6b7280', fontSize: 14 }
        }
      } as any;
      chartInstance.current.setOption(emptyOption, { notMerge: true, lazyUpdate: true });
      return;
    }

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
          },
          formatter: function(params: any) {
            let result = `<div class=\"font-semibold text-gray-800 mb-2\">${params[0].axisValue}</div>`;
            params.forEach((param: any) => {
              const color = param.color;
              const value = param.value;
              const name = param.seriesName;
              result += `
                <div class=\"flex items-center justify-between mb-1\">\n                  <div class=\"flex items-center\">\n                    <div class=\"w-3 h-3 rounded-full mr-2\" style=\"background-color: ${color}\"></div>\n                    <span class=\"text-gray-600\">${name}</span>\n                  </div>\n                  <span class=\"font-semibold text-gray-800\">${value}%</span>\n                </div>
              `;
            });
            return result;
          }
        },
        legend: {
          show: false
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '8%',
          top: '15%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          boundaryGap: true,
          data: classNames,
          axisLabel: {
            fontSize: 11,
            color: '#6b7280',
            rotate: classNames.length > 4 ? 45 : 0,
            interval: 0
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
            name: 'Class Performance',
            type: 'bar',
            data: classAverages.map((average, index) => {
              const colors = [
                '#10b981', // Green
                '#3b82f6', // Blue
                '#f59e0b', // Amber
                '#ef4444', // Red
                '#8b5cf6', // Purple
                '#06b6d4', // Cyan
                '#84cc16', // Lime
                '#f97316'  // Orange
              ];
              const color = colors[index % colors.length];
              const isVisible = visibleClasses.has(classNames[index]);
              
              return {
                value: isVisible ? average : 0,
                itemStyle: {
                  color: isVisible ? {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                      { offset: 0, color: color },
                      { offset: 1, color: `${color}80` }
                    ]
                  } : '#e5e7eb',
                  borderRadius: [4, 4, 0, 0],
                  shadowBlur: isVisible ? 4 : 0,
                  shadowColor: isVisible ? color : 'transparent',
                  opacity: isVisible ? 1 : 0.3
                },
                emphasis: {
                  itemStyle: {
                    shadowBlur: isVisible ? 8 : 0,
                    shadowColor: isVisible ? color : 'transparent'
                  }
                }
              };
            }),
            barWidth: '60%',
            barGap: '10%',
            label: {
              show: true,
              position: 'top',
              formatter: (params: any) => {
                const index = params.dataIndex;
                return visibleClasses.has(classNames[index]) ? `${params.value}%` : '';
              },
              fontSize: 12,
              fontWeight: 'bold',
              color: '#374151'
            }
          }
        ]
      } as any;
    chartInstance.current.setOption(option, { notMerge: true, lazyUpdate: true });
  }, [classNames, classAverages, className, isLoading, visibleClasses]);

  return (
    <div className="bg-white rounded-2xl p-4 transition-all duration-300">
      <div className="p-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 lg:mb-6 space-y-3 sm:space-y-0">
          <div>
            <h3 className="text-base md:text-lg font-semibold text-[#2C3E50]">Class Performance</h3>
            <p className="text-xs md:text-sm text-gray-500 mt-1">Average performance scores by class</p>
          </div>
          {/* No Show/Hide All button per requirement */}
          <div className="flex flex-wrap gap-2">
            {classNames.map((className, index) => {
              const colors = [
                '#10b981', '#3b82f6', '#f59e0b', '#ef4444', 
                '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
              ];
              const color = colors[index % colors.length];
              const isVisible = visibleClasses.has(className);
              
              return (
                <button
                  key={className}
                  onClick={() => toggleClassVisibility(className)}
                  className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 hover:scale-105 ${
                    isVisible 
                      ? 'bg-gray-100 text-gray-700' 
                      : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                  }`}
                >
                  <div 
                    className={`w-3 h-3 rounded-full transition-all duration-200 ${
                      isVisible ? '' : 'opacity-50'
                    }`}
                    style={{ backgroundColor: color }}
                  ></div>
                  <span className="text-xs">{className}</span>
                  {isVisible && (
                    <svg className="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div ref={chartRef} className="w-full h-64 sm:h-72" />
      </div>
    </div>
  );
};

export default ClassPerformanceChart; 