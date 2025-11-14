import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { type Student } from '../../../services/studentService';
import { useAuth } from '../../../contexts/AuthContext';
import { isrResultService } from '../../../services/ISRresultService';
import ParentLoader from '../../parent/ParentLoader';

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
  const [forceChartInit, setForceChartInit] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { currentUser, userRole } = useAuth();

  // Helper function to generate default periods (last 6 months)
  const generateDefaultPeriods = (): string[] => {
    const periods: string[] = [];
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const periodName = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      periods.push(periodName);
    }
    return periods;
  };

  // Parent-specific computed data from real database (100% database-dependent)
  const [computedData, setComputedData] = useState<{
    assessmentPeriods: string[];
    oralReadingScores: number[];
    comprehensionScores: number[];
    readingLevels: number[];
  }>({
    assessmentPeriods: generateDefaultPeriods(), // Always initialize with default periods
    oralReadingScores: [0, 0, 0, 0, 0, 0], // Initialize with zeros for flat line
    comprehensionScores: [0, 0, 0, 0, 0, 0],
    readingLevels: [0, 0, 0, 0, 0, 0]
  });

  // Use computed data from database (100% database-dependent)
  // Always prioritize computedData which comes from real database ISR results
  // Always ensure we have periods and data arrays (even if all zeros for flat line)
  const defaultPeriods = generateDefaultPeriods();
  const safeData = {
    assessmentPeriods: computedData.assessmentPeriods.length > 0 
      ? computedData.assessmentPeriods 
      : (data.assessmentPeriods?.length > 0 ? data.assessmentPeriods : defaultPeriods),
    oralReadingScores: computedData.oralReadingScores.length > 0
      ? computedData.oralReadingScores
      : (data.oralReadingScores?.length > 0 ? data.oralReadingScores : [0, 0, 0, 0, 0, 0]),
    comprehensionScores: computedData.comprehensionScores.length > 0
      ? computedData.comprehensionScores
      : (data.comprehensionScores?.length > 0 ? data.comprehensionScores : [0, 0, 0, 0, 0, 0]),
    readingLevels: computedData.readingLevels.length > 0
      ? computedData.readingLevels
      : (data.readingLevels?.map(level => {
          const lower = String(level).toLowerCase();
          if (lower.includes('independent')) return 2;
          if (lower.includes('instructional')) return 1;
          if (lower.includes('frustration')) return 0;
          return 0;
        }) || [0, 0, 0, 0, 0, 0])
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

  // Get current metric data for chart rendering (same as TeacherProgressChart)
  const getCurrentData = () => {
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
          yAxisMax: 2,
          yAxisMin: 0,
          formatter: (value: number) => {
            switch (value) {
              case 2: return 'Independent';
              case 1: return 'Instructional';
              case 0: return 'Frustration';
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

  const currentMetric = getCurrentData();

  // Helper function to convert hex color to rgba
  const hexToRgba = (hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

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
          // Still set default periods with zeros to show flat line
          const defaultPeriods = generateDefaultPeriods();
          setComputedData({
            assessmentPeriods: defaultPeriods,
            oralReadingScores: [0, 0, 0, 0, 0, 0],
            comprehensionScores: [0, 0, 0, 0, 0, 0],
            readingLevels: [0, 0, 0, 0, 0, 0]
          });
          setLastUpdated(new Date());
          return;
        }

        // Get the selected child (first child for now)
        const selectedChild = students[0];
        if (!selectedChild?.id) {
          console.warn('ParentProgressChart: Selected child has no ID');
          // Still set default periods with zeros to show flat line
          const defaultPeriods = generateDefaultPeriods();
          setComputedData({
            assessmentPeriods: defaultPeriods,
            oralReadingScores: [0, 0, 0, 0, 0, 0],
            comprehensionScores: [0, 0, 0, 0, 0, 0],
            readingLevels: [0, 0, 0, 0, 0, 0]
          });
          setLastUpdated(new Date());
          return;
        }

        console.log('ParentProgressChart: Fetching ISR results from database for child:', selectedChild.name, 'ID:', selectedChild.id);

        // Fetch ISR results from database (100% database-dependent)
        // Pass both studentId and studentName to help with ID matching issues
        let isrResults: any[] = [];
        try {
          isrResults = await isrResultService.getISRResultsByStudent(selectedChild.id, selectedChild.name);
          console.log(`ParentProgressChart: Fetched ${isrResults.length} ISR result(s) from database for ${selectedChild.name} (ID: ${selectedChild.id})`);
          
          // Log detailed information about fetched results
          if (isrResults.length > 0) {
            console.log('ParentProgressChart: Fetched ISR results details:', {
              totalResults: isrResults.length,
              studentIds: [...new Set(isrResults.map((r: any) => r.studentId))],
              studentNames: [...new Set(isrResults.map((r: any) => r.studentName))],
              dateRange: {
                earliest: isrResults[0]?.assessmentDate || isrResults[0]?.createdAt,
                latest: isrResults[isrResults.length - 1]?.assessmentDate || isrResults[isrResults.length - 1]?.createdAt
              },
              sampleResult: {
                studentId: isrResults[0].studentId,
                studentName: isrResults[0].studentName,
                assessmentDate: isrResults[0].assessmentDate,
                partA: {
                  percentage: isrResults[0].partA?.percentage,
                  comprehensionLevel: isrResults[0].partA?.comprehensionLevel
                },
                partB: {
                  wordReadingScore: isrResults[0].partB?.wordReadingScore,
                  wordReadingLevel: isrResults[0].partB?.wordReadingLevel
                }
              }
            });
          } else {
            console.warn(`⚠️ ParentProgressChart: No ISR results found for ${selectedChild.name} (ID: ${selectedChild.id})`);
          }
        } catch (error) {
          console.error('ParentProgressChart: Error fetching ISR results:', error);
          isrResults = [];
        }

        // Process ISR results into chart data format
        // Each ISR result contains:
        // - partA.comprehensionLevel: 'Independent' | 'Instructional' | 'Frustration'
        // - partA.percentage: comprehension score (0-100)
        // - partB.wordReadingLevel: 'Independent' | 'Instructional' | 'Frustration'
        // - partB.wordReadingScore: oral reading score (0-100)
        // - assessmentDate: date when assessment was taken
        const processedResults = isrResults.map((isrResult: any) => {
          const partA = isrResult.partA || {};
          const partB = isrResult.partB || {};
          
          // Get date from assessmentDate (when reading session was completed) or createdAt
          const assessmentDate = isrResult.assessmentDate || isrResult.createdAt || new Date();
          
          // Convert reading level to numeric value for chart
          const wordReadingLevel = partB.wordReadingLevel || '';
          const comprehensionLevel = partA.comprehensionLevel || '';
          
          let readingLevelValue = 0; // Default to Frustration
          const wordLevelLower = String(wordReadingLevel).toLowerCase().trim();
          if (wordLevelLower === 'independent' || wordLevelLower.includes('independent')) {
            readingLevelValue = 2;
          } else if (wordLevelLower === 'instructional' || wordLevelLower.includes('instructional')) {
            readingLevelValue = 1;
          }
          
          return {
            date: assessmentDate,
            createdAt: assessmentDate,
            assessmentDate: assessmentDate,
            // Oral reading score from partB.wordReadingScore (accuracy percentage)
            oralReadingScore: partB.wordReadingScore || 0,
            // Comprehension score from partA.percentage
            comprehension: partA.percentage || 0,
            // Reading level as numeric (0=Frustration, 1=Instructional, 2=Independent)
            readingLevel: readingLevelValue,
            readingLevelText: wordReadingLevel || 'Frustration',
            // Store raw data for debugging
            rawData: {
              partA: partA,
              partB: partB,
              wordReadingLevel: wordReadingLevel,
              comprehensionLevel: comprehensionLevel
            }
          };
        }).sort((a, b) => {
          // Sort chronologically (oldest first)
          const dateA = new Date(a.date || a.createdAt || a.assessmentDate || 0);
          const dateB = new Date(b.date || b.createdAt || b.assessmentDate || 0);
          return dateA.getTime() - dateB.getTime();
        });

        console.log('ParentProgressChart: Processed ISR results:', {
          totalResults: processedResults.length,
          results: processedResults.map(r => ({
            date: r.date,
            oralReadingScore: r.oralReadingScore,
            comprehension: r.comprehension,
            readingLevel: r.readingLevel,
            readingLevelText: r.readingLevelText
          }))
        });

        // Create time-based periods (last 6 months) - ALWAYS generate periods even if no data
        const periods: string[] = [];
        const oralScores: number[] = [];
        const compScores: number[] = [];
        const readingLevels: number[] = [];

        const now = new Date();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Always generate 6 months of periods for consistent chart display
        for (let i = 5; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const periodName = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
          periods.push(periodName);

          // Find results for this period (using assessmentDate from database)
          const periodResults = processedResults.filter(result => {
            try {
              const resultDate = new Date(result.date || result.assessmentDate || result.createdAt || 0);
              if (isNaN(resultDate.getTime())) {
                console.warn('ParentProgressChart: Invalid date in result:', result);
                return false;
              }
              const matches = resultDate.getMonth() === date.getMonth() && resultDate.getFullYear() === date.getFullYear();
              
              // Log when we find matches for debugging
              if (matches) {
                console.log(`ParentProgressChart: Matched result for period ${periodName}:`, {
                  resultDate: resultDate.toISOString(),
                  periodDate: date.toISOString(),
                  oralScore: result.oralReadingScore,
                  compScore: result.comprehension,
                  readingLevel: result.readingLevelText
                });
              }
              
              return matches;
            } catch (e) {
              console.warn('ParentProgressChart: Error parsing date:', e, result);
              return false;
            }
          });

          // Calculate averages for this period from ISR database results
          let oralSum = 0, oralCount = 0;
          let compSum = 0, compCount = 0;
          let levelSum = 0, levelCount = 0;

          periodResults.forEach(result => {
            // Process oral reading scores from ISR database (partB.wordReadingScore)
            // Include 0 values as they are valid scores
            if (typeof result.oralReadingScore === 'number' && !isNaN(result.oralReadingScore)) {
              oralSum += Math.max(0, Math.min(100, result.oralReadingScore));
              oralCount += 1;
            }

            // Process comprehension scores from ISR database (partA.percentage)
            // Include 0 values as they are valid scores
            if (typeof result.comprehension === 'number' && !isNaN(result.comprehension)) {
              compSum += Math.max(0, Math.min(100, result.comprehension));
              compCount += 1;
            }

            // Process reading levels from ISR database (already converted to numeric: 0=Frustration, 1=Instructional, 2=Independent)
            // Include 0 values as they represent "Frustration" level
            if (typeof result.readingLevel === 'number' && !isNaN(result.readingLevel)) {
              levelSum += result.readingLevel;
              levelCount += 1;
            }
          });

          // Calculate averages for this period
          const avgOral = oralCount > 0 ? Math.round(oralSum / oralCount) : 0;
          const avgComp = compCount > 0 ? Math.round(compSum / compCount) : 0;
          const avgLevel = levelCount > 0 ? Math.round(levelSum / levelCount) : 0;
          
          oralScores.push(avgOral);
          compScores.push(avgComp);
          readingLevels.push(avgLevel);
          
          // Log period data for debugging
          if (periodResults.length > 0) {
            console.log(`ParentProgressChart: Period ${periodName}:`, {
              resultsCount: periodResults.length,
              avgOral: avgOral,
              avgComp: avgComp,
              avgLevel: avgLevel,
              levelText: avgLevel === 2 ? 'Independent' : avgLevel === 1 ? 'Instructional' : 'Frustration'
            });
          }
        }

        console.log('ParentProgressChart: Final chart data (100% database-dependent):', {
          periods: periods,
          oralScores: oralScores,
          compScores: compScores,
          readingLevels: readingLevels,
          totalDataPoints: processedResults.length
        });

        setComputedData({
          assessmentPeriods: periods,
          oralReadingScores: oralScores,
          comprehensionScores: compScores,
          readingLevels: readingLevels
        });

        setLastUpdated(new Date());
      } catch (error) {
        console.error('ParentProgressChart: Error fetching child reading results:', error);
        // On error, still set default periods with zeros to show flat line
        const defaultPeriods = generateDefaultPeriods();
        setComputedData({
          assessmentPeriods: defaultPeriods,
          oralReadingScores: [0, 0, 0, 0, 0, 0],
          comprehensionScores: [0, 0, 0, 0, 0, 0],
          readingLevels: [0, 0, 0, 0, 0, 0]
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

  // Initialize and update chart (same structure as TeacherProgressChart)
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
  }, [safeData, selectedMetric, currentMetric, forceChartInit, computedData]);

  return (
    <div className="bg-white rounded-2xl p-3 transition-all duration-300 overflow-hidden flex flex-col h-full w-full">
      <div className="p-3 flex flex-col flex-1 w-full">
        <div className="flex flex-col lg:grid lg:grid-cols-3 lg:items-center mb-3 lg:mb-4 space-y-2 lg:space-y-0">
          <div className="flex items-center gap-3">
            <h3 className="text-base md:text-lg font-semibold text-[#2C3E50] whitespace-nowrap flex-shrink-0">
              {title}
            </h3>
            {/* Real-time indicator */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
              <span className="text-xs text-gray-500">
                {isRefreshing ? 'Updating...' : 'Live'}
              </span>
            </div>
          </div>

          {/* Metric Toggle Buttons - centered (same as TeacherProgressChart) */}
          <div className="flex justify-center lg:justify-center lg:col-start-2">
            <div role="tablist" aria-label="Metric selector" className="inline-flex items-center bg-gray-100 rounded-full p-1 shadow-inner max-w-fit flex-wrap sm:flex-nowrap gap-1">
              <button
                type="button"
                role="tab"
                aria-selected={selectedMetric === 'oral'}
                onClick={() => setSelectedMetric('oral')}
                className={`px-2 py-1.5 text-xs rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400 whitespace-nowrap ${selectedMetric === 'oral'
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
                className={`px-2 py-1.5 text-xs rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-400 whitespace-nowrap ${selectedMetric === 'comprehension'
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
                className={`px-3 py-1.5 text-xs rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-400 whitespace-nowrap ${selectedMetric === 'reading-level'
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
                <i className={`fas fa-sync-alt text-sm ${isRefreshing ? 'animate-spin' : ''}`}></i>
              </button>

              {/* Child Info */}
              {students.length > 0 && (
                <div className="text-sm text-gray-600">
                  {students[0].name} - {students[0].grade}
                </div>
              )}
            </div>

            {/* Last Updated Timestamp with Freshness Indicator */}
            <div className="text-xs text-gray-500 mt-1 text-right">
              <div className="flex items-center justify-end gap-1">
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

        {/* Chart Container - Always Rendered */}
        <div className="w-full flex-1 min-h-80 h-full relative">
          <div ref={chartRef} className="w-full h-full" style={{ minHeight: '320px' }} />

          {/* Chart Loading/Retry Overlay - Only show if chart hasn't initialized yet */}
          {!chartInstance.current && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90">
                <div className="text-center text-gray-500">
                  <ParentLoader label="Loading Chart..." size="sm" />
                  <p className="text-sm mb-4">Preparing your child's progress data</p>
                  <button
                    onClick={() => {
                      console.log('ParentProgressChart: Manual initialization triggered');
                      setForceChartInit(prev => prev + 1);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <i className="fas fa-sync-alt mr-2"></i>
                    Retry Chart Loading
                  </button>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ParentProgressChart;