/**
 * TEACHER-ONLY COMPONENT: Student Reading Progress Chart
 * 
 * This component is exclusively for teacher accounts and displays:
 * - Student Reading Progress with class and student selection
 * - Three metric toggles: Oral Reading, Comprehension, Reading Level
 * - Real-time data fetching with optimized performance
 * - Class-based student filtering
 * 
 * Features:
 * - Class dropdown to select specific classes
 * - Student dropdown filtered by selected class
 * - Individual student progress tracking
 * - Aggregated class progress when "All Students" is selected
 * - Optimized data fetching and caching
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as echarts from 'echarts';
import { type Student } from '../../../services/studentService';
import { type ClassGrade } from '../../../services/gradeService';
import PillSelect, { type PillOption } from '../../ui/PillSelect';
import { useAuth } from '../../../contexts/AuthContext';
import TeacherLoader from '../../teacher/TeacherLoader';

interface TeacherProgressChartProps {
  data: {
    assessmentPeriods: string[];
    oralReadingScores: number[];
    comprehensionScores: number[];
    readingLevels: string[];
  };
  grades: ClassGrade[];
  students: Student[];
  title?: string;
  targetLine?: number;
}



const TeacherProgressChart: React.FC<TeacherProgressChartProps> = ({
  data,
  grades,
  students,
  title = "Student Reading Progress",
  targetLine
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const dataCache = useRef<Map<string, any>>(new Map());

  // State management
  const [selectedMetric, setSelectedMetric] = useState<'oral' | 'comprehension' | 'reading-level'>('oral');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [forceChartInit, setForceChartInit] = useState(0);
  const { currentUser, userRole } = useAuth();

  // STRICT TEACHER-ONLY ACCESS CONTROL
  if (userRole !== 'teacher') {
    return (
      <div className="bg-white rounded-2xl p-6 text-center border-2 border-red-200">
        <div className="text-red-500">
          <i className="fas fa-user-shield text-3xl mb-3"></i>
          <h3 className="text-lg font-semibold mb-2">Teacher Access Required</h3>
          <p>This Student Reading Progress component is exclusively for teacher accounts.</p>
          <p className="text-sm mt-2">Current role: {userRole || 'Unknown'}</p>
        </div>
      </div>
    );
  }

  // Teacher-specific computed data from real database
  const [computedData, setComputedData] = useState<{
    assessmentPeriods: string[];
    oralReadingScores: number[];
    comprehensionScores: number[];
    readingLevels: number[];
  }>({
    assessmentPeriods: ['Latest Session'],
    oralReadingScores: [],
    comprehensionScores: [],
    readingLevels: []
  });

  // Use computed data for teachers, fallback to passed data (no mock data)
  const safeData = {
    assessmentPeriods: computedData.assessmentPeriods.length ? computedData.assessmentPeriods : (data.assessmentPeriods || []),
    oralReadingScores: computedData.oralReadingScores.length ? computedData.oralReadingScores : (data.oralReadingScores || []),
    comprehensionScores: computedData.comprehensionScores.length ? computedData.comprehensionScores : (data.comprehensionScores || []),
    readingLevels: computedData.readingLevels.length ? computedData.readingLevels : (data.readingLevels?.map(level => {
      const lower = level.toLowerCase();
      if (lower.includes('independent')) return 3;
      if (lower.includes('instructional')) return 2;
      if (lower.includes('frustration')) return 1;
      return 0; // Return 0 instead of default 2 to show no data
    }) || [])
  };

  // Memoized safe data
  const safeGrades = useMemo(() => Array.isArray(grades) ? grades : [], [grades]);
  const safeStudents = useMemo(() => Array.isArray(students) ? students : [], [students]);

  // Memoized filtered students based on selected class
  const filteredStudents = useMemo(() => {
    if (!selectedClass) return safeStudents;

    const selectedGrade = safeGrades.find(g => g.id === selectedClass);
    if (!selectedGrade) return [];

    return safeStudents.filter(student => {
      if (!student.grade || !selectedGrade.name) return false;

      const studentGrade = student.grade.toLowerCase().trim();
      const gradeName = selectedGrade.name.toLowerCase().trim();

      // Multiple matching strategies for better compatibility
      return studentGrade === gradeName ||
        studentGrade.includes(gradeName) ||
        gradeName.includes(studentGrade) ||
        (student as any).gradeId === selectedGrade.id;
    });
  }, [selectedClass, safeStudents, safeGrades]);

  // Auto-select first class if none selected
  useEffect(() => {
    if (safeGrades.length > 0 && !selectedClass) {
      setSelectedClass(safeGrades[0].id || '');
    }
  }, [safeGrades, selectedClass]);

  // Reset student selection when class changes
  useEffect(() => {
    if (selectedStudent) {
      const isStudentInClass = filteredStudents.some(s => s.id === selectedStudent);
      if (!isStudentInClass) {
        setSelectedStudent('');
      }
    }
  }, [selectedClass, filteredStudents, selectedStudent]);

  // Get current metric data for chart rendering
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
          yAxisMax: 3,
          yAxisMin: 0, // Allow 0 to show no data
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

  const currentMetric = getCurrentData();



  // Optimized data fetching with caching
  const fetchStudentData = useCallback(async (studentId: string) => {
    const cacheKey = `student-${studentId}`;
    const cached = dataCache.current.get(cacheKey);

    // Return cached data if it's less than 5 minutes old
    if (cached && (Date.now() - cached.timestamp) < 5 * 60 * 1000) {
      return cached.data;
    }

    try {
      // RESTORED: Fetch ISR results from MongoDB
      const { isrResultService } = await import('../../../services/ISRresultService');
      const isrResults = await isrResultService.getISRResultsByStudent(studentId);
      
      console.log(`📊 Fetched ${isrResults.length} ISR results for student ${studentId}`);
      
      // Transform ISR results into reading results format
      const readingResults = isrResults.map(result => ({
        studentId: result.studentId,
        oralReadingScore: result.partB?.wordReadingScore || 0,
        readingLevel: result.partB?.wordReadingLevel || 'Instructional',
        createdAt: result.createdAt || result.assessmentDate,
        sessionDate: result.assessmentDate || result.createdAt,
        miscues: result.partB?.miscues?.totalMiscues || 0,
        wordsRead: result.partB?.wordsInPassage || 0,
      }));
      
      // Transform ISR results into test results format (comprehension)
      const testResults = isrResults.map(result => ({
        studentId: result.studentId,
        comprehension: result.partA?.percentage || 0,
        score: result.partA?.percentage || 0,
        createdAt: result.createdAt || result.assessmentDate,
        testDate: result.assessmentDate || result.createdAt,
      }));
      
      const data = { readingResults, testResults };
      dataCache.current.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.warn(`Error fetching data for student ${studentId}:`, error);
      return { readingResults: [], testResults: [] };
    }
  }, []);

  // Process student data into chart format
  const processStudentData = useCallback((readingResults: any[], testResults: any[]) => {
    // Sort to get the most recent results
    const sortedReadingResults = readingResults.sort((a, b) =>
      new Date(b.createdAt || b.sessionDate || 0).getTime() - new Date(a.createdAt || a.sessionDate || 0).getTime()
    );

    const sortedTestResults = testResults.sort((a, b) =>
      new Date(b.createdAt || b.testDate || 0).getTime() - new Date(a.createdAt || a.testDate || 0).getTime()
    );

    // Get only the LATEST (most recent) session
    const latestReadingResult = sortedReadingResults[0];
    const latestTestResult = sortedTestResults[0];

    // Single data point for the latest session
    let oralScore = 0;
    let compScore = 0;
    let levelScore = 0;

    // Oral reading score from latest result
    if (latestReadingResult?.oralReadingScore) {
      oralScore = Math.max(0, Math.min(100, latestReadingResult.oralReadingScore));
    }

    // Comprehension score from latest result
    if (latestTestResult?.comprehension) {
      compScore = Math.max(0, Math.min(100, latestTestResult.comprehension));
    } else if (latestTestResult?.score) {
      compScore = Math.max(0, Math.min(100, latestTestResult.score));
    }

    // Reading level from latest result
    if (latestReadingResult) {
      const readingLevelField = latestReadingResult.readingLevel || latestReadingResult.reading_level || latestReadingResult.level;
      if (readingLevelField) {
        const level = String(readingLevelField).toLowerCase().trim();
        if (level.includes('independent')) levelScore = 3;
        else if (level.includes('instructional')) levelScore = 2;
        else if (level.includes('frustration')) levelScore = 1;
        else levelScore = 0;
      } else {
        // Derive from oral reading score
        if (oralScore >= 95) levelScore = 3;
        else if (oralScore >= 85) levelScore = 2;
        else if (oralScore > 0) levelScore = 1;
        else levelScore = 0;
      }
    }

    // Return single session data
    return {
      assessmentPeriods: ['Latest Session'],
      oralReadingScores: [oralScore],
      comprehensionScores: [compScore],
      readingLevels: [levelScore]
    };
  }, []);

  // Main data fetching effect
  useEffect(() => {
    if (!currentUser?.uid) {
      console.warn('TeacherProgressChart: No teacher user ID found');
      return;
    }

    const fetchData = async () => {
      try {
        setIsRefreshing(true);

        if (!selectedStudent) {
          // No student selected - show empty data
          setComputedData({
            assessmentPeriods: ['Latest Session'],
            oralReadingScores: [],
            comprehensionScores: [],
            readingLevels: []
          });
          return;
        }

        // Individual student data only (removed "All Students" aggregation)
        const { readingResults, testResults } = await fetchStudentData(selectedStudent);
        const processedData = processStudentData(readingResults, testResults);
        setComputedData(processedData);

        setLastUpdated(new Date());
      } catch (error) {
        console.error('TeacherProgressChart: Error fetching data:', error);
        setComputedData({
          assessmentPeriods: ['Latest Session'],
          oralReadingScores: [],
          comprehensionScores: [],
          readingLevels: []
        });
      } finally {
        setIsRefreshing(false);
      }
    };

    fetchData();

    // Set up polling for real-time updates (reduced frequency for better performance)
    const pollInterval = setInterval(fetchData, 30000); // Poll every 30 seconds

    // Set up visibility change listener
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser?.uid, selectedStudent, selectedClass, filteredStudents, safeStudents, fetchStudentData, processStudentData]);

  // Initialize and update chart
  useEffect(() => {
    if (chartRef.current) {
      try {
        // Check if the container has proper dimensions
        const containerWidth = chartRef.current.clientWidth;
        const containerHeight = chartRef.current.clientHeight;

        if (containerWidth === 0 || containerHeight === 0) {
          console.warn('TeacherProgressChart: Container has zero dimensions, setting up observer for when it becomes visible');

          // Set up a ResizeObserver to initialize the chart when the container gets proper dimensions
          let resizeObserver: ResizeObserver | null = null;

          if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver((entries) => {
              for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0 && !chartInstance.current) {
                  console.log('TeacherProgressChart: Container now has dimensions, initializing chart');
                  initializeChart();
                  if (resizeObserver) {
                    resizeObserver.disconnect();
                  }
                  break;
                }
              }
            });
            resizeObserver.observe(chartRef.current);
          } else {
            // Fallback for browsers without ResizeObserver - multiple retry attempts
            let retryCount = 0;
            const maxRetries = 10;

            const retryInitialization = () => {
              if (chartRef.current && chartRef.current.clientWidth > 0 && chartRef.current.clientHeight > 0) {
                console.log('TeacherProgressChart: Container dimensions available after retry, initializing chart');
                initializeChart();
                return;
              }

              retryCount++;
              if (retryCount < maxRetries) {
                setTimeout(retryInitialization, 100 * retryCount); // Increasing delay
              } else {
                console.warn('TeacherProgressChart: Max retries reached, container still has zero dimensions');
              }
            };

            const initialTimeout = setTimeout(retryInitialization, 100);
            return () => clearTimeout(initialTimeout);
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

          // Double-check dimensions before initializing
          const width = chartRef.current.clientWidth;
          const height = chartRef.current.clientHeight;

          if (width === 0 || height === 0) {
            console.warn('TeacherProgressChart: Container still has zero dimensions, skipping chart initialization');
            return;
          }

          // Dispose existing chart instance if it exists
          if (chartInstance.current) {
            chartInstance.current.dispose();
          }

          // Check if we have data to display
          const hasData = safeData.oralReadingScores.some(score => score > 0) ||
            safeData.comprehensionScores.some(score => score > 0) ||
            safeData.readingLevels.some(level => level > 0);

          if (!hasData) {
            console.log('TeacherProgressChart: No data available, skipping chart initialization');
            return;
          }

          console.log(`TeacherProgressChart: Initializing chart with dimensions ${width}x${height}`);
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
                show: false // Hide session labels
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
                show: false
              },
              // For reading level, show specific level labels
              ...(selectedMetric === 'reading-level' ? {
                interval: 1,
                axisLabel: {
                  fontSize: 11,
                  color: '#6b7280',
                  formatter: (value: number) => {
                    switch (value) {
                      case 3: return 'Independent';
                      case 2: return 'Instructional';
                      case 1: return 'Frustration';
                      case 0: return 'No Data';
                      default: return '';
                    }
                  }
                }
              } : {})
            },
            series: [
              {
                name: currentMetric.name,
                type: 'custom',
                renderItem: (params: any, api: any) => {
                  const value = api.value(0);
                  
                  // Calculate right triangle dimensions with better proportions
                  const chartHeight = params.coordSys.height;
                  const chartWidth = params.coordSys.width;
                  
                  // Use more of the chart width for better visibility
                  const leftX = params.coordSys.x + chartWidth * 0.05; // Start at 5%
                  const rightX = params.coordSys.x + chartWidth * 0.95; // End at 95%
                  const baseY = params.coordSys.y + chartHeight; // Bottom (y=0)
                  
                  // Left corner height based on data value (use full height range)
                  const leftHeight = (value / currentMetric.yAxisMax) * chartHeight * 0.95;
                  const leftY = baseY - leftHeight;
                  
                  return {
                    type: 'group',
                    children: [
                      // Right triangle fill with gradient
                      {
                        type: 'polygon',
                        shape: {
                          points: [
                            [leftX, leftY],      // Top left (data value height)
                            [leftX, baseY],      // Bottom left (y=0)
                            [rightX, baseY],     // Bottom right (y=0) - always at zero
                          ]
                        },
                        style: {
                          fill: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 1,
                            y2: 0,
                            colorStops: [
                              { offset: 0, color: `${currentMetric.color}90` }, // 56% opacity at left
                              { offset: 0.5, color: `${currentMetric.color}50` }, // 31% opacity at middle
                              { offset: 1, color: `${currentMetric.color}15` }  // 8% opacity at right
                            ]
                          },
                          shadowBlur: 15,
                          shadowColor: `${currentMetric.color}40`,
                          shadowOffsetY: 5
                        }
                      },
                      // Triangle outline with thicker lines
                      {
                        type: 'polygon',
                        shape: {
                          points: [
                            [leftX, leftY],      // Top left
                            [leftX, baseY],      // Bottom left
                            [rightX, baseY],     // Bottom right
                          ]
                        },
                        style: {
                          fill: 'transparent',
                          stroke: currentMetric.color,
                          lineWidth: 4,
                          shadowBlur: 8,
                          shadowColor: currentMetric.color,
                          shadowOffsetY: 2
                        }
                      },
                      // Add a highlight on the diagonal line
                      {
                        type: 'line',
                        shape: {
                          x1: leftX,
                          y1: leftY,
                          x2: rightX,
                          y2: baseY
                        },
                        style: {
                          stroke: currentMetric.color,
                          lineWidth: 5,
                          shadowBlur: 10,
                          shadowColor: '#fff',
                          shadowOffsetY: 0
                        }
                      }
                    ]
                  };
                },
                data: currentMetric.data,
                markLine: targetLine ? {
                  data: [{ yAxis: targetLine, name: 'Target' }],
                  lineStyle: { color: '#f59e0b', type: 'dashed', width: 2 },
                  label: {
                    formatter: `Target: ${targetLine}%`,
                    position: 'end',
                    distance: 5,
                    fontSize: 11,
                    color: '#f59e0b',
                    fontWeight: 'bold'
                  }
                } : undefined
              }
            ]
          };

          chartInstance.current.setOption(option);

          const resizeHandler = () => {
            try {
              chartInstance.current?.resize();
            } catch (error) {
              console.warn('TeacherProgressChart: Error during resize:', error);
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
              console.warn('TeacherProgressChart: Error during cleanup:', error);
            }
          };
        }
      } catch (error) {
        console.error('TeacherProgressChart: Error initializing chart:', error);
      }
    }
  }, [safeData, selectedMetric, currentMetric, targetLine, forceChartInit]);

  // Additional effect to handle chart visibility and initialization
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && chartRef.current && !chartInstance.current) {
        const width = chartRef.current.clientWidth;
        const height = chartRef.current.clientHeight;
        if (width > 0 && height > 0) {
          console.log('TeacherProgressChart: Page became visible, checking if chart needs initialization');
          // Trigger re-render by updating a dependency
          setLastUpdated(new Date());
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return (
    <div className="bg-white rounded-2xl p-3 transition-all duration-300 overflow-hidden flex flex-col h-full w-full">
      <div className="p-3 flex flex-col flex-1 w-full">
        <div className="flex flex-col lg:grid lg:grid-cols-3 lg:items-center mb-3 lg:mb-4 space-y-2 lg:space-y-0">
          <div className="flex items-center gap-3">
            <h3 className="text-base md:text-lg font-semibold text-[#2C3E50] whitespace-nowrap flex-shrink-0">
              {selectedStudent
                ? `${filteredStudents.find(s => s.id === selectedStudent)?.name || 'Student'}'s Progress`
                : title}
            </h3>
            {/* Real-time indicator */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
              <span className="text-xs text-gray-500">
                {isRefreshing ? 'Updating...' : 'Live'}
              </span>
            </div>
          </div>

          {/* Metric Toggle Buttons - centered */}
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

          {/* Class and Student Selectors + Refresh Controls - right aligned */}
          <div className="lg:justify-self-end">
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Class Selector */}
              <div className="inline-flex items-center bg-gray-100 rounded-full p-1 shadow-inner">
                <PillSelect
                  ariaLabel="Select Class"
                  options={safeGrades.length === 0
                    ? [{ label: 'No Classes', value: '' }]
                    : safeGrades.map(g => ({ label: g.name, value: g.id || '' }))}
                  value={selectedClass}
                  onChange={setSelectedClass}
                  placeholder="Select Class"
                />
              </div>

              {/* Student Selector */}
              <div className="inline-flex items-center bg-gray-100 rounded-full p-1 shadow-inner">
                <PillSelect
                  ariaLabel="Select Student"
                  options={(() => {
                    const options: PillOption[] = [
                      { label: 'Select Student', value: '' }
                    ];

                    if (filteredStudents.length > 0) {
                      // Add individual students only (removed "All Students" option)
                      filteredStudents.forEach(student => {
                        options.push({
                          label: `👤 ${student.name || 'Unknown Student'}`,
                          value: student.id || ''
                        });
                      });
                    }

                    return options;
                  })()}
                  value={selectedStudent}
                  onChange={setSelectedStudent}
                  disabled={filteredStudents.length === 0}
                  placeholder={filteredStudents.length === 0 ? "No Students" : "Select Student"}
                />
              </div>

              {/* Manual Refresh Button */}
              <button
                onClick={() => {
                  // Clear cache for selected student
                  if (selectedStudent) {
                    dataCache.current.delete(`student-${selectedStudent}`);
                  }
                  setLastUpdated(new Date());
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

          {/* No Data Overlay */}
          {safeStudents.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-95">
              <div className="text-center text-gray-500">
                <i className="fas fa-users text-4xl mb-4 text-gray-300"></i>
                <h3 className="text-lg font-medium mb-2">No Students Found</h3>
                <p className="text-sm mb-4">You need to add students to your classes first.</p>
                <div className="text-xs text-gray-400 mb-4">
                  <p>• Go to "Class List" in the sidebar</p>
                  <p>• Add students to your classes</p>
                  <p>• Ensure students are assigned to the correct grades</p>
                </div>
                <button
                  onClick={() => window.location.href = '/teacher/class-list'}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <i className="fas fa-plus mr-2"></i>
                  Go to Class List
                </button>
              </div>
            </div>
          ) : filteredStudents.length === 0 && selectedClass ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-95">
              <div className="text-center text-gray-500">
                <i className="fas fa-user-slash text-4xl mb-4 text-gray-300"></i>
                <h3 className="text-lg font-medium mb-2">No Students in Selected Class</h3>
                <p className="text-sm mb-4">The selected class doesn't have any students yet.</p>
                <div className="text-xs text-gray-400">
                  <p>• Select a different class from the dropdown</p>
                  <p>• Or add students to this class</p>
                </div>
              </div>
            </div>
          ) : !selectedStudent ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-95">
              <div className="text-center text-gray-500">
                <i className="fas fa-user-graduate text-4xl mb-4 text-gray-300"></i>
                <h3 className="text-lg font-medium mb-2">Select a Student</h3>
                <p className="text-sm mb-4">Choose a student to view their reading progress.</p>
                <div className="text-xs text-gray-400">
                  <p>• Choose a specific student for individual progress</p>
                  <p>• Use the class dropdown to filter students</p>
                </div>
              </div>
            </div>
          ) : (safeData.oralReadingScores.every(score => score === 0) &&
            safeData.comprehensionScores.every(score => score === 0) &&
            safeData.readingLevels.every(level => level === 0)) && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-95">
              <div className="text-center text-gray-500">
                <i className="fas fa-chart-bar text-4xl mb-4 text-gray-300"></i>
                <h3 className="text-lg font-medium mb-2">No Reading Data Available</h3>
                <p className="text-sm mb-4">
                  No reading data found for {filteredStudents.find(s => s.id === selectedStudent)?.name || 'this student'}.
                </p>
                <div className="text-xs text-gray-400">
                  <p>• Add reading sessions to track oral reading scores</p>
                  <p>• Add comprehension tests to track understanding</p>
                  <p>• Update student profiles with reading levels</p>
                </div>
              </div>
            </div>
          )}

          {/* Chart Loading/Retry Overlay */}
          {!chartInstance.current &&
            (safeData.oralReadingScores.some(score => score > 0) ||
              safeData.comprehensionScores.some(score => score > 0) ||
              safeData.readingLevels.some(level => level > 0)) && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90">
                <div className="text-center text-gray-500">
                  <TeacherLoader label="Loading Chart..." size="sm" />
                  <p className="text-sm mb-4">Preparing your reading progress data</p>
                  <button
                    onClick={() => {
                      console.log('TeacherProgressChart: Manual initialization triggered');
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

export default TeacherProgressChart;