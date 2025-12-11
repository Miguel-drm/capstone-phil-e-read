import React, { useEffect, useState, useRef } from 'react';
import * as echarts from 'echarts';
import { type Student } from '../../../services/studentService';
import { useAuth } from '../../../contexts/AuthContext';

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
  const [selectedMetric, setSelectedMetric] = useState<'oral' | 'comprehension' | 'reading-level'>('oral');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { currentUser, userRole } = useAuth();

  // Parent-specific computed data from real database (100% database-dependent)
  const [computedData, setComputedData] = useState<{
    assessmentPeriods: string[];
    oralReadingScores: number[];
    comprehensionScores: number[];
    readingLevels: number[];
  }>({
    assessmentPeriods: [],
    oralReadingScores: [],
    comprehensionScores: [],
    readingLevels: []
  });

  // Use computed data from database (100% database-dependent)
  // Always prioritize computedData which comes from real database ISR results
  const safeData = {
    assessmentPeriods: computedData.assessmentPeriods.length ? computedData.assessmentPeriods : (data.assessmentPeriods || []),
    oralReadingScores: computedData.oralReadingScores.length ? computedData.oralReadingScores : (data.oralReadingScores || []),
    comprehensionScores: computedData.comprehensionScores.length ? computedData.comprehensionScores : (data.comprehensionScores || []),
    readingLevels: computedData.readingLevels.length ? computedData.readingLevels : (data.readingLevels?.map(level => {
      const lower = String(level).toLowerCase();
      if (lower.includes('independent')) return 3;
      if (lower.includes('instructional')) return 2;
      if (lower.includes('frustration')) return 1;
      return 0;
    }) || [])
  };
  
  // Debug: Log safeData to verify it has values
  if (safeData.oralReadingScores.length > 0 || safeData.comprehensionScores.length > 0 || safeData.readingLevels.length > 0) {
    console.log('ParentProgressChart: safeData has values:', {
      periodsCount: safeData.assessmentPeriods.length,
      oralScores: safeData.oralReadingScores,
      compScores: safeData.comprehensionScores,
      readingLevels: safeData.readingLevels,
      hasOralData: safeData.oralReadingScores.some(s => s > 0),
      hasCompData: safeData.comprehensionScores.some(s => s > 0),
      hasLevelData: safeData.readingLevels.some(l => l > 0)
    });
  }

  // OLD CHART CODE - Not needed for card display
  /* const getCurrentData = () => {
    switch (selectedMetric) {
      case 'oral':
        return {
          data: safeData.oralReadingScores,
          name: 'Oral Reading Fluency',
          color: '#3b82f6',
          yAxisMax: 100,
          yAxisMin: 0,
          formatter: '{value}%'
        };
      case 'comprehension':
        return {
          data: safeData.comprehensionScores,
          name: 'Comprehension Score',
          color: '#10b981',
          yAxisMax: 100,
          yAxisMin: 0,
          formatter: '{value}%'
        };
      case 'reading-level':
        return {
          data: safeData.readingLevels,
          name: 'Reading Level',
          color: '#f59e0b',
          yAxisMax: 3,
          yAxisMin: 0,
          formatter: (value: number) => {
            switch (value) {
              case 3: return 'Independent';
              case 2: return 'Instructional';
              case 1: return 'Frustration';
              case 0: return 'No Data';
              default: return 'No Data';
            }
          }
        };
      default:
        return {
          data: safeData.oralReadingScores,
          name: 'Oral Reading Fluency',
          color: '#3b82f6',
          yAxisMax: 100,
          yAxisMin: 0,
          formatter: '{value}%'
        };
    }
  };

  const currentMetric = getCurrentData(); */

  // REAL-TIME: Fetch parent's children reading results from database
  useEffect(() => {
    if (!currentUser?.uid || userRole !== 'parent') {
      console.warn('ParentProgressChart: No parent user ID found or not parent role');
      return;
    }

    const fetchParentChildrenData = async () => {
      try {
        setIsRefreshing(true);
        console.log('ParentProgressChart: Fetching real-time reading results for parent:', currentUser.uid);

        if (students.length === 0) {
          console.log('ParentProgressChart: No children connected to parent account');
          setComputedData({
            assessmentPeriods: [],
            oralReadingScores: [],
            comprehensionScores: [],
            readingLevels: []
          });
          setLastUpdated(new Date());
          return;
        }

        // Get the selected child (first child for now)
        const selectedChild = students[0];
        if (!selectedChild?.id) {
          console.warn('ParentProgressChart: Selected child has no ID');
          setComputedData({
            assessmentPeriods: [],
            oralReadingScores: [],
            comprehensionScores: [],
            readingLevels: []
          });
          setLastUpdated(new Date());
          return;
        }

        // RESTORED: Fetch ISR results from MongoDB
        const { isrResultService } = await import('../../../services/ISRresultService');
        const isrResults = await isrResultService.getISRResultsByStudent(selectedChild.id!);
        
        console.log(`📊 Fetched ${isrResults.length} ISR results for child ${selectedChild.name}`);

        // Get the last 10 sessions (or all if less than 10) to show progress over time
        const sortedResults = isrResults.sort((a, b) =>
          new Date(a.createdAt || a.assessmentDate || 0).getTime() - new Date(b.createdAt || b.assessmentDate || 0).getTime()
        );

        // Take up to 10 most recent sessions
        const recentResults = sortedResults.slice(-10);
        
        // Extract data from all sessions
        const sessionLabels: string[] = [];
        const oralScores: number[] = [];
        const compScores: number[] = [];
        const levelScores: number[] = [];

        recentResults.forEach((result, index) => {
          // Create session label
          sessionLabels.push(`Session ${index + 1}`);
          
          // Oral reading score from Part B
          let oralScore = 0;
          if (result.partB?.wordReadingScore) {
            oralScore = Math.max(0, Math.min(100, result.partB.wordReadingScore));
          }
          oralScores.push(oralScore);

          // Comprehension score from Part A
          let compScore = 0;
          if (result.partA?.percentage) {
            compScore = Math.max(0, Math.min(100, result.partA.percentage));
          }
          compScores.push(compScore);

          // Reading level from Part B (use 0-3 scale)
          let levelScore = 0;
          if (result.partB?.wordReadingLevel) {
            const level = String(result.partB.wordReadingLevel).toLowerCase().trim();
            if (level.includes('independent')) levelScore = 3;
            else if (level.includes('instructional')) levelScore = 2;
            else if (level.includes('frustration')) levelScore = 1;
            else levelScore = 2;
          } else {
            // Derive from oral reading score
            if (oralScore >= 95) levelScore = 3;
            else if (oralScore >= 85) levelScore = 2;
            else if (oralScore > 0) levelScore = 1;
            else levelScore = 0;
          }
          levelScores.push(levelScore);
        });

        // Add baseline at the END (right side)
        if (recentResults.length > 0) {
          sessionLabels.push('Baseline');
          oralScores.push(0);
          compScores.push(0);
          levelScores.push(0);
        }
        
        console.log(`📊 ParentProgressChart: Processed ${recentResults.length} sessions`);
        console.log(`   Oral scores: ${oralScores.join(', ')}`);
        console.log(`   Comp scores: ${compScores.join(', ')}`);
        console.log(`   Level scores: ${levelScores.join(', ')}`);

        setComputedData({
          assessmentPeriods: sessionLabels,
          oralReadingScores: oralScores,
          comprehensionScores: compScores,
          readingLevels: levelScores
        });

        setLastUpdated(new Date());
      } catch (error) {
        console.error('ParentProgressChart: Error fetching child reading results:', error);
        setComputedData({
          assessmentPeriods: [],
          oralReadingScores: [],
          comprehensionScores: [],
          readingLevels: []
        });
        setLastUpdated(new Date());
      } finally {
        setIsRefreshing(false);
      }
    };

    fetchParentChildrenData();

    // Set up polling for live data updates
    const pollInterval = setInterval(fetchParentChildrenData, 30000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [currentUser?.uid, userRole, students, refreshTrigger]);

  // Initialize line chart
  useEffect(() => {
    if (!chartRef.current) return;

    // Initialize chart
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    // Get current metric data
    let chartData: number[] = [];
    let chartColor = '#3b82f6';
    let chartName = 'Score';
    let yMax = 100;
    let formatter = (val: number) => `${val}%`;

    if (selectedMetric === 'oral') {
      chartData = safeData.oralReadingScores;
      chartColor = '#3b82f6';
      chartName = 'Oral Reading Fluency';
      yMax = 100;
      formatter = (val: number) => `${val}%`;
    } else if (selectedMetric === 'comprehension') {
      chartData = safeData.comprehensionScores;
      chartColor = '#10b981';
      chartName = 'Comprehension Score';
      yMax = 100;
      formatter = (val: number) => `${val}%`;
    } else {
      chartData = safeData.readingLevels;
      chartColor = '#f59e0b';
      chartName = 'Reading Level';
      yMax = 3;
      formatter = (val: number) => {
        if (val === 3) return 'Independent';
        if (val === 2) return 'Instructional';
        if (val === 1) return 'Frustration';
        return 'No Data';
      };
    }

    // Responsive sizing
    const containerWidth = chartRef.current?.clientWidth || window.innerWidth;
    const isMobile = containerWidth < 640;
    const isTablet = containerWidth < 1024;
    const labelFontSize = isMobile ? 11 : isTablet ? 13 : 15;
    const symbolSize = isMobile ? 8 : 12;
    const lineWidth = isMobile ? 3 : 4;
    const gridLeftRight = isMobile ? '7%' : '4%';
    const gridBottom = isMobile ? '16%' : '9%';
    const maxLabels = isMobile ? 3 : isTablet ? 6 : 10;
    const labelInterval = Math.max(1, Math.ceil((safeData.assessmentPeriods.length || 1) / maxLabels));

    const option = {
      grid: {
        left: gridLeftRight,
        right: gridLeftRight,
        bottom: gridBottom,
        top: isMobile ? '6%' : '4%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: safeData.assessmentPeriods,
        boundaryGap: true,
        axisLabel: {
          color: '#6b7280',
          fontSize: labelFontSize,
          interval: labelInterval,
          align: 'center'
        },
        axisLine: {
          lineStyle: { color: '#e5e7eb' }
        }
      },
      yAxis: {
        type: 'value',
        max: yMax,
        min: 0,
        interval: selectedMetric === 'reading-level' ? 1 : undefined,
        axisLabel: {
          color: '#6b7280',
          fontSize: labelFontSize,
          formatter: (val: number) => {
            if (selectedMetric === 'reading-level') {
              if (val === 3) return 'Independent';
              if (val === 2) return 'Instructional';
              if (val === 1) return 'Frustration';
              return ''; // Hide "No Data" label
            }
            return formatter(val);
          }
        },
        splitLine: {
          lineStyle: { color: '#f3f4f6' }
        }
      },
      series: [{
        name: chartName,
        type: 'line',
        data: chartData,
        smooth: true,
        symbol: 'circle',
        symbolSize,
        lineStyle: {
          width: lineWidth,
          color: chartColor
        },
        itemStyle: {
          color: chartColor,
          borderWidth: 2,
          borderColor: '#fff'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${chartColor}40` },
              { offset: 1, color: `${chartColor}10` }
            ]
          }
        }
      }],
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const value = params[0].value;
          const displayValue = selectedMetric === 'reading-level' ? formatter(value) : `${Number(value).toFixed(2)}%`;
          return `${params[0].axisValue}<br/>${chartName}: <b>${displayValue}</b>`;
        }
      },
      animation: true,
      animationDuration: 800,
      animationEasing: 'cubicOut' as const
    };

    chartInstance.current.setOption(option);

    // Handle resize
    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    let resizeObserver: ResizeObserver | null = null;
    if (chartRef.current) {
      resizeObserver = new ResizeObserver(() => handleResize());
      resizeObserver.observe(chartRef.current);
      if (chartRef.current.parentElement) {
        resizeObserver.observe(chartRef.current.parentElement);
      }
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [safeData, selectedMetric]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  /* OLD CHART CODE REMOVED
  useEffect(() => {
    if (chartRef.current) {
      try {
        const containerWidth = chartRef.current.clientWidth;
        const containerHeight = chartRef.current.clientHeight;

        if (containerWidth === 0 || containerHeight === 0) {
          console.warn('ParentProgressChart: Container has zero dimensions, setting up observer');

          let resizeObserver: ResizeObserver | null = null;
          if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver((entries) => {
              for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0 && !chartInstance.current) {
                  initializeChart();
                  if (resizeObserver) {
                    resizeObserver.disconnect();
                  }
                  break;
                }
              }
            });
            resizeObserver.observe(chartRef.current);
          }

          return () => {
            if (resizeObserver) {
              resizeObserver.disconnect();
            }
          };
        }

        initializeChart();

        function initializeChart() {
          if (!chartRef.current) return;

          const width = chartRef.current.clientWidth;
          const height = chartRef.current.clientHeight;

          if (width === 0 || height === 0) {
            console.warn('ParentProgressChart: Container still has zero dimensions, skipping chart initialization');
            return;
          }

          if (chartInstance.current) {
            chartInstance.current.dispose();
          }

          console.log(`ParentProgressChart: Initializing chart with dimensions ${width}x${height}`);
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
              },
              formatter: function (params: any) {
                let result = `<div class="font-semibold text-gray-800 mb-2">${params[0].axisValue}</div>`;
                params.forEach((param: any) => {
                  const color = param.color;
                  const value = param.value;
                  const name = param.seriesName || 'Score';
                  const displayValue = selectedMetric === 'reading-level'
                    ? (typeof currentMetric.formatter === 'function' ? currentMetric.formatter(value) : `${value}`)
                    : `${value}%`;
                  result += `
                <div class="flex items-center justify-between mb-1">
                  <div class="flex items-center">
                    <div class="w-3 h-3 rounded-full mr-2" style="background-color: ${color}"></div>
                    <span class="text-gray-600">${name}</span>
                  </div>
                  <span class="font-semibold text-gray-800">${displayValue}</span>
                </div>
              `;
                });
                return result;
              }
            },
            legend: {
              data: [currentMetric.name],
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
              top: '15%',
              containLabel: true
            },
            xAxis: {
              type: 'category',
              boundaryGap: false,
              data: safeData.assessmentPeriods,
              axisLabel: {
                show: false, // Hide session labels
                fontSize: 11,
                color: '#6b7280',
                rotate: 0,
                interval: 0,
                formatter: (value: string) => {
                  // Format month labels more compactly
                  if (value && value.length > 8) {
                    const parts = value.split(' ');
                    if (parts.length === 2) {
                      return `${parts[0]} ${parts[1].slice(-2)}`;
                    }
                  }
                  return value;
                }
              },
              axisLine: {
                lineStyle: {
                  color: '#e5e7eb',
                  width: 1
                }
              },
              axisTick: {
                show: true,
                alignWithLabel: true,
                lineStyle: {
                  color: '#e5e7eb'
                }
              },
              splitLine: {
                show: false
              }
            },
            yAxis: {
              type: 'value',
              max: currentMetric.yAxisMax,
              min: currentMetric.yAxisMin,
              axisLabel: {
                fontSize: 11,
                color: '#6b7280',
                formatter: typeof currentMetric.formatter === 'function' ? currentMetric.formatter : (val: number) => `${val}`
              },
              axisLine: {
                show: false
              },
              axisTick: {
                show: false
              },
              splitLine: {
                show: true,
                lineStyle: {
                  color: '#f3f4f6',
                  type: 'dashed',
                  width: 1
                }
              },
              // For reading level, show specific level labels
              ...(selectedMetric === 'reading-level' ? {
                interval: 1,
                axisLabel: {
                  fontSize: 11,
                  color: '#6b7280',
                  formatter: (value: number) => {
                    switch (value) {
                      case 2: return 'Independent';
                      case 1: return 'Instructional';
                      case 0: return 'Frustration';
                      default: return '';
                    }
                  }
                }
              } : {})
            },
            series: [
              {
                name: currentMetric.name,
                type: 'line',
                data: currentMetric.data,
                smooth: true,
                symbol: 'circle',
                symbolSize: 8,
                lineStyle: {
                  color: currentMetric.color,
                  width: 3
                },
                itemStyle: {
                  color: currentMetric.color,
                  borderColor: '#fff',
                  borderWidth: 2
                },
                areaStyle: {
                  color: {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                      {
                        offset: 0,
                        color: hexToRgba(currentMetric.color, 0.25)
                      },
                      {
                        offset: 1,
                        color: hexToRgba(currentMetric.color, 0.06)
                      }
                    ]
                  }
                },
                emphasis: {
                  focus: 'series',
                  itemStyle: {
                    borderColor: currentMetric.color,
                    borderWidth: 3,
                    shadowBlur: 10,
                    shadowColor: currentMetric.color
                  }
                }
              }
            ]
          };

          // Set chart option with database data
          chartInstance.current.setOption(option, true); // true = notMerge, replace all data
          
          console.log('ParentProgressChart: Chart option set with data:', {
            periods: safeData.assessmentPeriods.length,
            currentMetric: selectedMetric,
            dataPoints: currentMetric.data.length,
            hasData: currentMetric.data.some((d: number) => d > 0)
          });

          const resizeHandler = () => {
            try {
              chartInstance.current?.resize();
            } catch (error) {
              console.warn('ParentProgressChart: Error during resize:', error);
            }
          };

          window.addEventListener('resize', resizeHandler);

          let observer: ResizeObserver | null = null;
          if (typeof ResizeObserver !== 'undefined' && chartRef.current?.parentElement) {
            observer = new ResizeObserver(() => resizeHandler());
            observer.observe(chartRef.current.parentElement);
          }

          return () => {
            try {
              window.removeEventListener('resize', resizeHandler);
              if (observer) {
                observer.disconnect();
              }
              if (chartInstance.current) {
                chartInstance.current.dispose();
                chartInstance.current = null;
              }
            } catch (error) {
              console.warn('ParentProgressChart: Error during cleanup:', error);
            }
          };
        }
      } catch (error) {
        console.error('ParentProgressChart: Error initializing chart:', error);
      }
      }
  }, [safeData, selectedMetric, currentMetric, forceChartInit]);
  */

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md p-6 transition-all duration-300 hover:shadow-lg overflow-hidden flex flex-col h-full w-full">
      <div className="flex flex-col flex-1 w-full gap-2">
        <div className="flex flex-col lg:grid lg:grid-cols-3 lg:items-center gap-2 lg:gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <h3 className="text-lg md:text-xl font-semibold text-[#2C3E50] whitespace-nowrap flex-shrink-0">
              {title}
            </h3>
            {/* Real-time indicator */}
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isRefreshing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
              <span className="text-sm sm:text-base text-gray-500">
                {isRefreshing ? 'Updating...' : 'Live'}
              </span>
            </div>
          </div>

          {/* Metric Toggle Buttons - centered (same as TeacherProgressChart) */}
          <div className="flex justify-center lg:justify-center lg:col-start-2">
            <div role="tablist" aria-label="Metric selector" className="inline-flex items-center bg-gray-100 rounded-full p-1 shadow-inner max-w-full flex-wrap sm:flex-nowrap gap-1">
              <button
                type="button"
                role="tab"
                aria-selected={selectedMetric === 'oral'}
                onClick={() => setSelectedMetric('oral')}
                className={`px-3 py-2 text-sm sm:text-base rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400 whitespace-nowrap ${selectedMetric === 'oral'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-white'
                  }`}
                title="Show Oral Reading (0-100%)"
              >
                <span className="hidden sm:inline">Oral Reading</span>
                <span className="sm:hidden">Oral</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={selectedMetric === 'comprehension'}
                onClick={() => setSelectedMetric('comprehension')}
                className={`px-3 py-2 text-sm sm:text-base rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-400 whitespace-nowrap ${selectedMetric === 'comprehension'
                  ? 'bg-green-600 text-white shadow'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-white'
                  }`}
                title="Show Comprehension (0-100%)"
              >
                <span className="hidden sm:inline">Comprehension</span>
                <span className="sm:hidden">Comp</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={selectedMetric === 'reading-level'}
                onClick={() => setSelectedMetric('reading-level')}
                className={`px-3 py-2 text-sm sm:text-base rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-400 whitespace-nowrap ${selectedMetric === 'reading-level'
                  ? 'bg-orange-500 text-white shadow'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-white'
                  }`}
                title="Show Reading Level (Independent / Instructional / Frustration)"
              >
                <span className="hidden sm:inline">Reading Level</span>
                <span className="sm:hidden">Level</span>
              </button>
            </div>
          </div>

          {/* Child Info + Refresh Controls - right aligned */}
          <div className="lg:justify-self-end">
            <div className="flex items-center gap-2">
              {/* Manual Refresh Button */}
              <button
                onClick={() => {
                  console.log('ParentProgressChart: Manual refresh triggered');
                  // Trigger useEffect to refetch data by updating refreshTrigger
                  setRefreshTrigger(prev => prev + 1);
                }}
                disabled={isRefreshing}
                className={`p-2 rounded-lg transition-colors ${isRefreshing
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                title={isRefreshing ? "Refreshing..." : "Refresh data"}
              >
                <i className={`fas fa-sync-alt text-lg ${isRefreshing ? 'animate-spin' : ''}`}></i>
              </button>

              {/* Child Info */}
              {students.length > 0 && (
                <div className="text-lg text-gray-600">
                  {students[0].name} - {students[0].grade}
                </div>
              )}
            </div>

            {/* Last Updated Timestamp with Freshness Indicator */}
            <div className="text-base text-gray-500 mt-1 text-right">
              <div className="flex items-center justify-end gap-1 text-sm sm:text-base">
                <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
                {(() => {
                  const minutesAgo = Math.floor((new Date().getTime() - lastUpdated.getTime()) / 60000);
                  if (minutesAgo < 1) {
                    return <span className="text-green-600 font-medium">• Just now</span>;
                  } else if (minutesAgo < 5) {
                    return <span className="text-green-600">• {minutesAgo}m ago</span>;
                  } else if (minutesAgo < 15) {
                    return <span className="text-yellow-600">• {minutesAgo}m ago</span>;
                  } else {
                    return <span className="text-red-600">• {minutesAgo}m ago</span>;
                  }
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* Line Chart Display - Responsive height */}
        <div className="w-full flex-1 h-full relative">
          <div
            ref={chartRef}
            className="w-full h-full"
            style={{ minHeight: '200px', height: 'clamp(200px, 32vh, 360px)' }}
          />

          {/* No Data Overlay */}
          {safeData.oralReadingScores.every(score => score === 0) &&
            safeData.comprehensionScores.every(score => score === 0) &&
            safeData.readingLevels.every(level => level === 0) && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-95">
                <div className="text-center text-gray-500">
                  <i className="fas fa-book-reader text-4xl mb-4 text-gray-300"></i>
                  <h3 className="text-2xl font-medium mb-2">Your Child's Reading Journey Starts Here</h3>
                  <p className="text-lg mb-4">Reading progress will appear here as your child completes activities with their teacher.</p>
                  <div className="text-base text-gray-400">
                    <p>• Track reading skills as they grow</p>
                    <p>• See comprehension improvements</p>
                    <p>• Updates happen automatically</p>
                  </div>
                </div>
              </div>
            )}

        </div>
      </div>
    </div>
  );
};

export default ParentProgressChart;