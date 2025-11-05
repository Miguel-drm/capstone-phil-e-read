/**
 * TEACHER-ONLY COMPONENT: Student Reading Progress Chart
 * 
 * This component is exclusively for teacher accounts and displays:
 * - Student Reading Progress with grade-level bars (Grade III, IV, V, VI)
 * - Three metric toggles: Oral Reading, Comprehension, Reading Level
 * - Class and student selection dropdowns
 * - Real-time data fetching from teacher's reading results
 * 
 * This file is completely separate from parent/admin components.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { type Student } from '../../../services/studentService';
import { type ClassGrade } from '../../../services/gradeService';
import PillSelect, { type PillOption } from '../../ui/PillSelect';
import { useAuth } from '../../../contexts/AuthContext';
import { resultService } from '../../../services/resultsService';

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

// Helper function to map grade names to array indices
const getGradeIndex = (grade: string | undefined): number => {
  if (!grade) return -1;
  const upper = grade.toUpperCase();
  if (upper.includes('III') || upper.includes('3')) return 0;
  if (upper.includes('IV') || upper.includes('4')) return 1;
  if (upper.includes('V ') || upper.endsWith(' V') || (upper.includes('5') && !upper.includes('6'))) return 2;
  if (upper.includes('VI') || upper.includes('6')) return 3;
  return -1;
};

const TeacherProgressChart: React.FC<TeacherProgressChartProps> = ({
  data,
  grades,
  students,
  title = "Student Reading Progress",
  targetLine
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<'oral' | 'comprehension' | 'reading-level'>('oral');
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
    assessmentPeriods: ['Grade III', 'Grade IV', 'Grade V', 'Grade VI'],
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

  const safeGrades = Array.isArray(grades) ? grades : [];
  const safeStudents = Array.isArray(students) ? students : [];

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

  // Initialize grade selection
  useEffect(() => {
    if (safeGrades.length > 0 && !selectedGrade) {
      setSelectedGrade(safeGrades[0].id || '');
    }
  }, [safeGrades, selectedGrade]);

  // Filter students by selected grade
  useEffect(() => {
    if (selectedGrade) {
      const grade = safeGrades.find(g => g.id === selectedGrade);
      if (grade) {
        setFilteredStudents(safeStudents.filter(s => s.grade === grade.name));
      } else {
        setFilteredStudents([]);
      }
    } else {
      setFilteredStudents([]);
    }
    setSelectedStudent('');
  }, [selectedGrade, safeStudents, safeGrades]);

  // REAL-TIME: Fetch teacher reading results and reading levels from database
  useEffect(() => {
    const labels = ['Grade III', 'Grade IV', 'Grade V', 'Grade VI'];

    if (!currentUser?.uid) {
      console.warn('TeacherProgressChart: No teacher user ID found');
      return;
    }

    const fetchTeacherReadingResults = async () => {
      try {
        setIsRefreshing(true);
        console.log('TeacherProgressChart: Fetching real-time reading results for teacher:', currentUser.uid);

        // Test API endpoints directly
        console.log('TeacherProgressChart: Testing API endpoints...');
        try {
          const testResponse = await fetch(`/api/results/teacher/${currentUser.uid}`);
          console.log('TeacherProgressChart: API response status:', testResponse.status);
          if (testResponse.ok) {
            const testData = await testResponse.json();
            console.log('TeacherProgressChart: Raw API data:', testData.slice(0, 5));

            // If no data exists, offer to create sample data
            if (testData.length === 0) {
              console.log('TeacherProgressChart: No data found in database. To test with sample data, you can:');
              console.log('1. Add reading session results via the Reading Session page');
              console.log('2. Add test results via the assessment features');
              console.log('3. Add student reading levels in the student records');
              console.log('4. Or use the demonstration data that will be generated automatically');
            }
          } else {
            console.error('TeacherProgressChart: API error:', testResponse.statusText);
          }
        } catch (apiError) {
          console.error('TeacherProgressChart: API call failed:', apiError);
        }

        // Fetch reading session results from database
        console.log('TeacherProgressChart: Calling getReadingSessionResults for teacher:', currentUser.uid);
        const results = await resultService.getReadingSessionResults(currentUser.uid);
        console.log('TeacherProgressChart: Fetched', results.length, 'reading results from database');
        console.log('TeacherProgressChart: Sample reading results:', results.slice(0, 3));

        // Fetch test results for comprehension data
        console.log('TeacherProgressChart: Calling getTeacherTestResults for teacher:', currentUser.uid);
        const testResults = await resultService.getTeacherTestResults(currentUser.uid);
        console.log('TeacherProgressChart: Fetched', testResults.length, 'test results from database');
        console.log('TeacherProgressChart: Sample test results:', testResults.slice(0, 3));

        // ALSO fetch student reading levels from student records (since reading levels might be stored there)
        console.log('TeacherProgressChart: Also checking student records for reading levels...');
        console.log('TeacherProgressChart: Available students:', safeStudents.map(s => ({
          name: s.name,
          grade: s.grade,
          readingLevel: s.readingLevel
        })));

        const studentReadingLevels: Record<string, any> = {};

        // Group students by grade and get their reading levels
        safeStudents.forEach(student => {
          const gradeIndex = getGradeIndex(student.grade);
          console.log(`TeacherProgressChart: Student ${student.name} - Grade: ${student.grade} -> Index: ${gradeIndex}, Reading Level: ${student.readingLevel}`);

          if (gradeIndex >= 0 && student.readingLevel) {
            if (!studentReadingLevels[gradeIndex]) {
              studentReadingLevels[gradeIndex] = [];
            }
            studentReadingLevels[gradeIndex].push(student.readingLevel);
          }
        });

        console.log('TeacherProgressChart: Student reading levels by grade:', studentReadingLevels);

        // Process results to compute averages by grade
        const oralSums = [0, 0, 0, 0];
        const oralCounts = [0, 0, 0, 0];
        const compSums = [0, 0, 0, 0];
        const compCounts = [0, 0, 0, 0];
        const levelSums = [0, 0, 0, 0];
        const levelCounts = [0, 0, 0, 0];

        // Process reading session results for oral reading scores
        results.forEach(result => {
          // Map grade to index
          let gradeName = '';
          if (result.gradeId) {
            const grade = grades.find(g => g.id === result.gradeId);
            gradeName = grade?.name || '';
          }

          const gradeIndex = getGradeIndex(gradeName);
          if (gradeIndex < 0) return;

          // Process oral reading score
          if (typeof result.oralReadingScore === 'number') {
            oralSums[gradeIndex] += Math.max(0, Math.min(100, result.oralReadingScore));
            oralCounts[gradeIndex] += 1;
          }
        });

        // Process test results for comprehension scores
        testResults.forEach(result => {
          // Map grade to index - try multiple grade field names
          let gradeName = '';
          const resultAny = result as any;
          if (result.gradeId) {
            const grade = grades.find(g => g.id === result.gradeId);
            gradeName = grade?.name || '';
          } else if (resultAny.grade) {
            gradeName = resultAny.grade;
          } else if (resultAny.gradeName) {
            gradeName = resultAny.gradeName;
          }

          const gradeIndex = getGradeIndex(gradeName);
          if (gradeIndex < 0) return;

          // Process comprehension score from test results
          if (typeof result.comprehension === 'number') {
            compSums[gradeIndex] += Math.max(0, Math.min(100, result.comprehension));
            compCounts[gradeIndex] += 1;
          } else if (typeof result.score === 'number') {
            // Fallback to score field if comprehension is not available
            compSums[gradeIndex] += Math.max(0, Math.min(100, result.score));
            compCounts[gradeIndex] += 1;
          }
        });

        // Process reading levels from student records (PRIMARY SOURCE)
        console.log('TeacherProgressChart: Processing reading levels from student records...');
        Object.keys(studentReadingLevels).forEach(gradeIndexStr => {
          const gradeIndex = parseInt(gradeIndexStr);
          const readingLevels = studentReadingLevels[gradeIndex];

          if (readingLevels && readingLevels.length > 0) {
            console.log(`TeacherProgressChart: Processing ${readingLevels.length} reading levels for grade index ${gradeIndex}`);

            // Process student reading levels for this grade
            readingLevels.forEach((level: any) => {
              let levelValue = 2; // default to Instructional
              const levelStr = String(level).toLowerCase().trim();

              if (levelStr.includes('independent') || levelStr === '3' || levelStr === 'ind' || levelStr.includes('mastery')) {
                levelValue = 3;
              } else if (levelStr.includes('instructional') || levelStr === '2' || levelStr === 'ins' || levelStr.includes('developing')) {
                levelValue = 2;
              } else if (levelStr.includes('frustration') || levelStr === '1' || levelStr === 'frus' || levelStr.includes('below')) {
                levelValue = 1;
              }

              levelSums[gradeIndex] += levelValue;
              levelCounts[gradeIndex] += 1;

              console.log(`TeacherProgressChart: Student reading level "${level}" -> ${levelValue} for grade index ${gradeIndex}`);
            });
          } else {
            console.log(`TeacherProgressChart: No reading levels found for grade index ${gradeIndex}`);
          }
        });

        // If no student reading levels found, try to derive from oral reading scores as fallback
        if (Object.keys(studentReadingLevels).length === 0) {
          console.log('TeacherProgressChart: No student reading levels found, trying to derive from oral reading scores...');
          for (let i = 0; i < 4; i++) {
            if (oralCounts[i] > 0) {
              const avgOralScore = oralSums[i] / oralCounts[i];
              let levelValue = 0; // No default value - only use if we can derive it

              if (avgOralScore >= 95) {
                levelValue = 3; // Independent
              } else if (avgOralScore >= 85) {
                levelValue = 2; // Instructional
              } else if (avgOralScore > 0) {
                levelValue = 1; // Frustration
              }

              if (levelValue > 0) {
                levelSums[i] = levelValue;
                levelCounts[i] = 1;
                console.log(`TeacherProgressChart: Derived reading level ${levelValue} from oral score ${avgOralScore} for grade index ${i}`);
              }
            }
          }
        }

        // Calculate averages - ONLY from real database data (no mock data)
        const oralScores = oralSums.map((sum, i) => oralCounts[i] > 0 ? Math.round(sum / oralCounts[i]) : 0);
        const compScores = compSums.map((sum, i) => compCounts[i] > 0 ? Math.round(sum / compCounts[i]) : 0);
        const levelScores = levelSums.map((sum, i) => levelCounts[i] > 0 ? Math.round(sum / levelCounts[i]) : 0);

        // Check if we have any real data at all
        const hasRealOralData = oralCounts.some(count => count > 0);
        const hasRealCompData = compCounts.some(count => count > 0);
        const hasRealLevelData = levelCounts.some(count => count > 0);

        console.log('TeacherProgressChart: Data availability check:', {
          hasRealOralData,
          hasRealCompData,
          hasRealLevelData,
          totalResults: results.length,
          totalTestResults: testResults.length,
          totalStudents: safeStudents.length
        });

        console.log('TeacherProgressChart: Computed REAL-TIME scores from database:', {
          oralScores,
          compScores,
          levelScores,
          oralCounts,
          compCounts,
          levelCounts,
          readingResultsCount: results.length,
          testResultsCount: testResults.length,
          dataFreshness: 'Real-time',
          lastUpdated: new Date().toISOString(),
          dataSource: {
            oralFromDatabase: hasRealOralData,
            compFromDatabase: hasRealCompData,
            levelFromDatabase: hasRealLevelData
          }
        });

        // Log sample reading level data for debugging
        const sampleReadingLevels = results.slice(0, 10).map(r => {
          const rAny = r as any;
          return {
            gradeId: r.gradeId,
            oralReadingScore: r.oralReadingScore,
            readingLevel: rAny.readingLevel,
            reading_level: rAny.reading_level,
            level: rAny.level,
            readingLevelClassification: rAny.readingLevelClassification,
            allFields: Object.keys(rAny).filter(key => key.toLowerCase().includes('level') || key.toLowerCase().includes('reading')) // Show reading-related fields
          };
        });
        console.log('TeacherProgressChart: Sample reading session data from database:', sampleReadingLevels);

        // Also log test results sample
        const sampleTestResults = testResults.slice(0, 5).map(r => {
          const rAny = r as any;
          return {
            gradeId: r.gradeId,
            comprehension: r.comprehension,
            score: r.score,
            allFields: Object.keys(rAny).filter(key => key.toLowerCase().includes('level') || key.toLowerCase().includes('reading') || key.toLowerCase().includes('comp'))
          };
        });
        console.log('TeacherProgressChart: Sample test results from database:', sampleTestResults);

        // Log the actual computed level counts to see if data is being processed
        console.log('TeacherProgressChart: Level counts by grade:', {
          'Grade III': levelCounts[0],
          'Grade IV': levelCounts[1],
          'Grade V': levelCounts[2],
          'Grade VI': levelCounts[3]
        });

        setComputedData({
          assessmentPeriods: labels,
          oralReadingScores: oralScores,
          comprehensionScores: compScores,
          readingLevels: levelScores
        });

        setLastUpdated(new Date());

      } catch (error) {
        console.error('TeacherProgressChart: Error fetching reading results:', error);
        setComputedData({
          assessmentPeriods: labels,
          oralReadingScores: [],
          comprehensionScores: [],
          readingLevels: []
        });
      } finally {
        setIsRefreshing(false);
      }
    };

    // Initial fetch
    fetchTeacherReadingResults();

    // REAL-TIME: Set up polling for live data updates
    const pollInterval = setInterval(() => {
      console.log('TeacherProgressChart: Polling for real-time data updates...');
      fetchTeacherReadingResults();
    }, 15000); // Poll every 15 seconds for real-time updates

    // Note: WebSocket support can be added later when server supports it

    // REAL-TIME: Set up visibility change listener for immediate refresh
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('TeacherProgressChart: Tab became visible, refreshing data...');
        fetchTeacherReadingResults();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // REAL-TIME: Set up focus listener for immediate refresh
    const handleWindowFocus = () => {
      console.log('TeacherProgressChart: Window focused, refreshing data...');
      fetchTeacherReadingResults();
    };

    window.addEventListener('focus', handleWindowFocus);

    // Cleanup
    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);

      // WebSocket cleanup would go here when implemented
    };
  }, [currentUser?.uid, selectedGrade, selectedStudent, grades]);

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
              boundaryGap: true,
              data: safeData.assessmentPeriods,
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
                type: 'bar',
                data: currentMetric.data,
                itemStyle: {
                  color: currentMetric.color,
                  borderRadius: [4, 4, 0, 0]
                },
                barWidth: '60%',
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

          {/* Grade and Student Selectors + Refresh Controls - right aligned */}
          <div className="lg:justify-self-end">
            <div className="flex items-center gap-2">
              {/* Manual Refresh Button */}
              <button
                onClick={() => {
                  console.log('TeacherProgressChart: Manual refresh triggered');
                  const fetchTeacherReadingResults = async () => {
                    try {
                      setIsRefreshing(true);
                      const results = await resultService.getReadingSessionResults(currentUser?.uid || '');
                      const testResults = await resultService.getTeacherTestResults(currentUser?.uid || '');

                      // Process data (same logic as in useEffect)
                      const labels = ['Grade III', 'Grade IV', 'Grade V', 'Grade VI'];
                      const oralSums = [0, 0, 0, 0];
                      const oralCounts = [0, 0, 0, 0];
                      const compSums = [0, 0, 0, 0];
                      const compCounts = [0, 0, 0, 0];
                      const levelSums = [0, 0, 0, 0];
                      const levelCounts = [0, 0, 0, 0];

                      results.forEach(result => {
                        let gradeName = '';
                        if (result.gradeId) {
                          const grade = grades.find(g => g.id === result.gradeId);
                          gradeName = grade?.name || '';
                        }

                        const gradeIndex = getGradeIndex(gradeName);
                        if (gradeIndex < 0) return;

                        if (typeof result.oralReadingScore === 'number') {
                          oralSums[gradeIndex] += Math.max(0, Math.min(100, result.oralReadingScore));
                          oralCounts[gradeIndex] += 1;
                        }

                        const resultAny = result as any;
                        const readingLevelField = resultAny.readingLevel || resultAny.reading_level || resultAny.level || resultAny.readingLevelClassification;

                        if (readingLevelField) {
                          let levelValue = 2;
                          const level = String(readingLevelField).toLowerCase().trim();

                          if (level.includes('independent') || level === '3' || level === 'ind') {
                            levelValue = 3;
                          } else if (level.includes('instructional') || level === '2' || level === 'ins') {
                            levelValue = 2;
                          } else if (level.includes('frustration') || level === '1' || level === 'frus') {
                            levelValue = 1;
                          }

                          levelSums[gradeIndex] += levelValue;
                          levelCounts[gradeIndex] += 1;
                        }
                      });

                      testResults.forEach(result => {
                        let gradeName = '';
                        const resultAny = result as any;
                        if (result.gradeId) {
                          const grade = grades.find(g => g.id === result.gradeId);
                          gradeName = grade?.name || '';
                        } else if (resultAny.grade) {
                          gradeName = resultAny.grade;
                        } else if (resultAny.gradeName) {
                          gradeName = resultAny.gradeName;
                        }

                        const gradeIndex = getGradeIndex(gradeName);
                        if (gradeIndex < 0) return;

                        if (typeof result.comprehension === 'number') {
                          compSums[gradeIndex] += Math.max(0, Math.min(100, result.comprehension));
                          compCounts[gradeIndex] += 1;
                        } else if (typeof result.score === 'number') {
                          compSums[gradeIndex] += Math.max(0, Math.min(100, result.score));
                          compCounts[gradeIndex] += 1;
                        }
                      });

                      const oralScores = oralSums.map((sum, i) => oralCounts[i] > 0 ? Math.round(sum / oralCounts[i]) : 0);
                      const compScores = compSums.map((sum, i) => compCounts[i] > 0 ? Math.round(sum / compCounts[i]) : 0);
                      const levelScores = levelSums.map((sum, i) => levelCounts[i] > 0 ? Math.round(sum / levelCounts[i]) : 2);

                      setComputedData({
                        assessmentPeriods: labels,
                        oralReadingScores: oralScores,
                        comprehensionScores: compScores,
                        readingLevels: levelScores
                      });

                      setLastUpdated(new Date());
                      console.log('TeacherProgressChart: Manual refresh completed');
                    } catch (error) {
                      console.error('TeacherProgressChart: Manual refresh error:', error);
                    } finally {
                      setIsRefreshing(false);
                    }
                  };
                  fetchTeacherReadingResults();
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

              {/* Grade and Student Selectors */}
              <div className="inline-flex items-center bg-gray-100 rounded-full p-1 shadow-inner gap-1 max-w-full overflow-hidden">
                <PillSelect
                  ariaLabel="Select Class"
                  options={(safeGrades.length === 0 ? [{ label: 'No Classes', value: '' }] : safeGrades.map(g => ({ label: g.name, value: g.id || '' }))) as PillOption[]}
                  value={selectedGrade}
                  onChange={setSelectedGrade}
                  placeholder="No Classes"
                />
                <PillSelect
                  ariaLabel="Select Student"
                  options={[{ label: 'Select Student', value: '' }, ...((Array.isArray(filteredStudents) ? filteredStudents : []).map(s => ({ label: s.name.replace(' | ', ' '), value: s.id || '' })))]}
                  value={selectedStudent}
                  onChange={setSelectedStudent}
                  disabled={!selectedGrade}
                  placeholder="Select Student"
                />
              </div>
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
          {safeData.oralReadingScores.every(score => score === 0) &&
            safeData.comprehensionScores.every(score => score === 0) &&
            safeData.readingLevels.every(level => level === 0) && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-95">
                <div className="text-center text-gray-500">
                  <i className="fas fa-chart-bar text-4xl mb-4 text-gray-300"></i>
                  <h3 className="text-lg font-medium mb-2">No Reading Data Available</h3>
                  <p className="text-sm mb-4">Start by adding reading sessions and assessments to see progress data.</p>
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
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <h3 className="text-lg font-medium mb-2">Loading Chart...</h3>
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