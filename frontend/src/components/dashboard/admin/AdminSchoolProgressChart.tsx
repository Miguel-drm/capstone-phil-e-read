/**
 * ADMIN-ONLY COMPONENT: School-Wide Reading Progress Chart
 * 
 * This component is exclusively for admin accounts and displays:
 * - School-wide Reading Progress with grade-level bars (Grade III, IV, V, VI)
 * - Three metric toggles: Oral Reading, Comprehension, Reading Level
 * - Real-time data fetching from all teachers' reading results
 * 
 * This file mimics TeacherProgressChart but for system-wide admin view.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { useAuth } from '../../../contexts/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';

interface AdminSchoolProgressChartProps {
  data: {
    assessmentPeriods: string[];
    oralReadingScores: number[];
    comprehensionScores: number[];
    readingLevels: string[];
  };
  grades: any[];
  students: any[];
  title?: string;
  targetLine?: number;
}

// Helper function to map grade names to array indices
const getGradeIndex = (grade: string | undefined): number => {
  if (!grade) return -1;
  const upper = grade.toUpperCase();

  console.log(`🔍 AdminSchoolProgressChart: Mapping grade "${grade}" (upper: "${upper}") to index...`);

  // Handle "Grade 4 - Narra" format and other variations
  if (upper.includes('III') || upper.includes('3') || upper.includes('GRADE 3')) {
    console.log(`✅ Mapped "${grade}" to Grade III (index 0)`);
    return 0;
  }
  if (upper.includes('IV') || upper.includes('4') || upper.includes('GRADE 4')) {
    console.log(`✅ Mapped "${grade}" to Grade IV (index 1)`);
    return 1;
  }
  if (upper.includes('V ') || upper.endsWith(' V') || (upper.includes('5') && !upper.includes('6')) || upper.includes('GRADE 5')) {
    console.log(`✅ Mapped "${grade}" to Grade V (index 2)`);
    return 2;
  }
  if (upper.includes('VI') || upper.includes('6') || upper.includes('GRADE 6')) {
    console.log(`✅ Mapped "${grade}" to Grade VI (index 3)`);
    return 3;
  }

  console.log(`❌ Could not map grade "${grade}" to any index`);
  return -1;
};

const AdminSchoolProgressChart: React.FC<AdminSchoolProgressChartProps> = ({
  grades: _grades,
  students,
  title = "Reading Progress (My School)",
  targetLine
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<'oral' | 'comprehension' | 'reading-level'>('oral');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [forceChartInit, setForceChartInit] = useState(0);
  const { userRole } = useAuth();

  // STRICT ADMIN-ONLY ACCESS CONTROL
  if (userRole !== 'admin') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-md p-6 text-center transition-all duration-300">
        <div className="text-red-500">
          <i className="fas fa-shield-alt text-3xl mb-3"></i>
          <h3 className="text-lg font-semibold mb-2">Admin Access Required</h3>
          <p>This school-wide reading progress component is exclusively for admin accounts.</p>
          <p className="text-sm mt-2">Current role: {userRole || 'Unknown'}</p>
        </div>
      </div>
    );
  }

  // Admin-specific computed data from real database (system-wide)
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

  // Use only computed data from real database (no mock data, no fallback)
  const safeData = {
    assessmentPeriods: computedData.assessmentPeriods,
    oralReadingScores: computedData.oralReadingScores,
    comprehensionScores: computedData.comprehensionScores,
    readingLevels: computedData.readingLevels
  };

  const safeStudents = Array.isArray(students) ? students : [];

  // Debug: Log when props change
  useEffect(() => {
    console.log(`🔄 AdminSchoolProgressChart: Props updated - ${safeStudents.length} students, ${_grades.length} grades`);
    if (safeStudents.length > 0) {
      console.log('📚 AdminSchoolProgressChart: Sample students:', safeStudents.slice(0, 3).map(s => ({
        name: s.name,
        grade: s.grade,
        readingLevel: s.readingLevel
      })));
    }
    if (_grades.length > 0) {
      console.log('📊 AdminSchoolProgressChart: Sample grades:', _grades.slice(0, 3).map(g => ({
        id: g.id,
        name: g.name
      })));
    }
  }, [safeStudents.length, _grades.length]);

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

  // REAL-TIME: Fetch system-wide reading results and reading levels from database (EXACT COPY OF TEACHER LOGIC BUT SYSTEM-WIDE)
  useEffect(() => {
    const labels = ['Grade III', 'Grade IV', 'Grade V', 'Grade VI'];

    const fetchSystemWideReadingResults = async () => {
      try {
        setIsRefreshing(true);
        console.log('AdminSchoolProgressChart: Fetching real-time system-wide reading results...');

        // Test API endpoints directly (EXACT COPY FROM TEACHER)
        console.log('AdminSchoolProgressChart: Testing API endpoints...');

        // Get all teachers first for system-wide approach
        const teachersSnap = await getDocs(collection(db, 'users'));
        const teacherIds: string[] = [];

        teachersSnap.forEach(doc => {
          const userData = doc.data();
          if (userData.role === 'teacher') {
            teacherIds.push(doc.id);
          }
        });

        console.log(`AdminSchoolProgressChart: Found ${teacherIds.length} teachers in system`);

        // Use grades from props (passed from AdminDashboard)
        console.log('AdminSchoolProgressChart: Using grades from props:', _grades);

        // Test admin API endpoints to get ALL data from database
        try {
          console.log('AdminSchoolProgressChart: Testing admin API endpoints for ALL data...');
          const adminResponse = await fetch('/api/admin/results/all');
          console.log('AdminSchoolProgressChart: Admin API response status:', adminResponse.status);
          if (adminResponse.ok) {
            const allData = await adminResponse.json();
            console.log('AdminSchoolProgressChart: ALL Raw API data:', allData.slice(0, 5));
            console.log(`AdminSchoolProgressChart: Total results in database: ${allData.length}`);

            // If no data exists, offer to create sample data
            if (allData.length === 0) {
              console.log('AdminSchoolProgressChart: No data found in database. To test with sample data, you can:');
              console.log('1. Add reading session results via the Reading Session page');
              console.log('2. Add test results via the assessment features');
              console.log('3. Add student reading levels in the student records');
              console.log('4. Or use the demonstration data that will be generated automatically');
            }
          } else {
            console.error('AdminSchoolProgressChart: Admin API error:', adminResponse.statusText);
          }
        } catch (apiError) {
          console.error('AdminSchoolProgressChart: Admin API call failed:', apiError);
        }

        // Also test individual teacher endpoints
        if (teacherIds.length > 0) {
          try {
            const testResponse = await fetch(`/api/results/teacher/${teacherIds[0]}`);
            console.log('AdminSchoolProgressChart: Sample teacher API response status:', testResponse.status);
            if (testResponse.ok) {
              const testData = await testResponse.json();
              console.log('AdminSchoolProgressChart: Sample teacher data:', testData.slice(0, 3));
            }
          } catch (apiError) {
            console.error('AdminSchoolProgressChart: Sample teacher API call failed:', apiError);
          }
        }

        // Use students from props (passed from AdminDashboard)
        console.log('AdminSchoolProgressChart: Using students from props:', safeStudents.map(s => ({
          name: s.name,
          grade: s.grade,
          readingLevel: s.readingLevel
        })));

        const studentReadingLevels: Record<string, any> = {};

        // Group ALL students by grade and get their reading levels
        safeStudents.forEach(student => {
          const gradeIndex = getGradeIndex(student.grade);
          console.log(`AdminSchoolProgressChart: Student ${student.name} - Grade: ${student.grade} -> Index: ${gradeIndex}, Reading Level: ${student.readingLevel}`);

          if (gradeIndex >= 0 && student.readingLevel) {
            if (!studentReadingLevels[gradeIndex]) {
              studentReadingLevels[gradeIndex] = [];
            }
            studentReadingLevels[gradeIndex].push(student.readingLevel);
          }
        });

        console.log('AdminSchoolProgressChart: Student reading levels by grade:', studentReadingLevels);

        // Process results to compute averages by grade (EXACT COPY FROM TEACHER)
        const oralSums = [0, 0, 0, 0];
        const oralCounts = [0, 0, 0, 0];
        const compSums = [0, 0, 0, 0];
        const compCounts = [0, 0, 0, 0];
        const levelSums = [0, 0, 0, 0];
        const levelCounts = [0, 0, 0, 0];

        // SYSTEM-WIDE: Get ALL data from all students across all classes
        let allReadingResults: any[] = [];
        let allTestResults: any[] = [];

        // Fetch ISR results for ALL students in the system
        try {
          const { isrResultService } = await import('../../../services/ISRresultService');

          // Fetch results for each student
          for (const student of safeStudents) {
            if (student.id) {
              try {
                const studentResults = await isrResultService.getISRResultsByStudent(student.id);

                // Transform ISR results into reading results format
                const readingResults = studentResults.map(result => ({
                  studentId: result.studentId,
                  gradeId: student.gradeId,
                  grade: student.grade,
                  oralReadingScore: result.partB?.wordReadingScore || 0,
                  readingLevel: result.partB?.wordReadingLevel || 'Instructional',
                  createdAt: result.createdAt || result.assessmentDate,
                }));

                // Transform ISR results into test results format (comprehension)
                const testResults = studentResults.map(result => ({
                  studentId: result.studentId,
                  gradeId: student.gradeId,
                  grade: student.grade,
                  comprehension: result.partA?.percentage || 0,
                  score: result.partA?.percentage || 0,
                  createdAt: result.createdAt || result.assessmentDate,
                }));

                allReadingResults.push(...readingResults);
                allTestResults.push(...testResults);
              } catch (error) {
                console.warn(`Error fetching results for student ${student.name}:`, error);
              }
            }
          }

          console.log(`AdminSchoolProgressChart: Fetched ${allReadingResults.length} reading results from ${safeStudents.length} students`);
        } catch (error) {
          console.error('AdminSchoolProgressChart: Error fetching ISR results:', error);
        }

        console.log(`AdminSchoolProgressChart: Total reading results: ${allReadingResults.length}`);
        console.log(`AdminSchoolProgressChart: Total test results: ${allTestResults.length}`);
        console.log('AdminSchoolProgressChart: Sample reading results:', allReadingResults.slice(0, 3));
        console.log('AdminSchoolProgressChart: Sample test results:', allTestResults.slice(0, 3));

        // Process ALL reading session results for oral reading scores
        allReadingResults.forEach(result => {

          // Map grade to index using grades from props OR direct grade fields
          let gradeName = '';
          if (result.gradeId && _grades.length > 0) {
            const grade = _grades.find(g => g.id === result.gradeId);
            gradeName = grade?.name || grade?.gradeName || grade?.grade || '';
          } else {
            // Fallback: use direct grade fields from result
            const resultAny = result as any;
            gradeName = result.grade || result.gradeName || resultAny.grade || resultAny.gradeName || '';
          }

          console.log(`📖 Reading result grade mapping: gradeId=${result.gradeId}, gradeName="${gradeName}", oralScore=${result.oralReadingScore}`);

          const gradeIndex = getGradeIndex(gradeName);
          if (gradeIndex < 0) return;

          // Process oral reading score
          if (typeof result.oralReadingScore === 'number') {
            oralSums[gradeIndex] += Math.max(0, Math.min(100, result.oralReadingScore));
            oralCounts[gradeIndex] += 1;
          }
        });

        // Process ALL test results for comprehension scores
        allTestResults.forEach(result => {
          // Map grade to index - try multiple grade field names using grades from props OR direct fields
          let gradeName = '';
          const resultAny = result as any;
          if (result.gradeId && _grades.length > 0) {
            const grade = _grades.find(g => g.id === result.gradeId);
            gradeName = grade?.name || grade?.gradeName || grade?.grade || '';
          } else if (resultAny.grade) {
            gradeName = resultAny.grade;
          } else if (resultAny.gradeName) {
            gradeName = resultAny.gradeName;
          } else {
            // Additional fallback: use direct grade fields from result
            gradeName = result.grade || result.gradeName || '';
          }

          console.log(`📈 Test result grade mapping: gradeId=${result.gradeId}, gradeName="${gradeName}", comprehension=${result.comprehension}, score=${result.score}`);

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

        // Process reading levels from student records (PRIMARY SOURCE) (EXACT COPY FROM TEACHER)
        console.log('AdminSchoolProgressChart: Processing reading levels from student records...');
        Object.keys(studentReadingLevels).forEach(gradeIndexStr => {
          const gradeIndex = parseInt(gradeIndexStr);
          const readingLevels = studentReadingLevels[gradeIndex];

          if (readingLevels && readingLevels.length > 0) {
            console.log(`AdminSchoolProgressChart: Processing ${readingLevels.length} reading levels for grade index ${gradeIndex}`);

            // Process student reading levels for this grade (EXACT COPY FROM TEACHER)
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

              console.log(`AdminSchoolProgressChart: Student reading level "${level}" -> ${levelValue} for grade index ${gradeIndex}`);
            });
          } else {
            console.log(`AdminSchoolProgressChart: No reading levels found for grade index ${gradeIndex}`);
          }
        });

        // If no student reading levels found, try to derive from oral reading scores as fallback (EXACT COPY FROM TEACHER)
        if (Object.keys(studentReadingLevels).length === 0) {
          console.log('AdminSchoolProgressChart: No student reading levels found, trying to derive from oral reading scores...');
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
                console.log(`AdminSchoolProgressChart: Derived reading level ${levelValue} from oral score ${avgOralScore} for grade index ${i}`);
              }
            }
          }
        }

        // Calculate averages - ONLY from real database data (no mock data) (EXACT COPY FROM TEACHER)
        const oralScores = oralSums.map((sum, i) => oralCounts[i] > 0 ? Math.round(sum / oralCounts[i]) : 0);
        const compScores = compSums.map((sum, i) => compCounts[i] > 0 ? Math.round(sum / compCounts[i]) : 0);
        const levelScores = levelSums.map((sum, i) => levelCounts[i] > 0 ? Math.round(sum / levelCounts[i]) : 0);

        // Check if we have any real data at all (EXACT COPY FROM TEACHER)
        const hasRealOralData = oralCounts.some(count => count > 0);
        const hasRealCompData = compCounts.some(count => count > 0);
        const hasRealLevelData = levelCounts.some(count => count > 0);

        console.log('AdminSchoolProgressChart: Data availability check:', {
          hasRealOralData,
          hasRealCompData,
          hasRealLevelData,
          totalTeachers: teacherIds.length,
          totalStudents: safeStudents.length
        });

        console.log('AdminSchoolProgressChart: Computed REAL-TIME system-wide scores from database:', {
          oralScores,
          compScores,
          levelScores,
          oralCounts,
          compCounts,
          levelCounts,
          totalTeachers: teacherIds.length,
          dataFreshness: 'Real-time',
          lastUpdated: new Date().toISOString(),
          dataSource: {
            oralFromDatabase: hasRealOralData,
            compFromDatabase: hasRealCompData,
            levelFromDatabase: hasRealLevelData
          }
        });

        // Results fetching removed - MongoDB results service no longer available
        const allResults: any[] = [];

        const sampleReadingLevels = allResults.slice(0, 10).map(r => {
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
        console.log('AdminSchoolProgressChart: Sample reading session data from database:', sampleReadingLevels);

        // Log test results sample using already fetched data
        const sampleTestResults = allTestResults.slice(0, 5).map(r => {
          const rAny = r as any;
          return {
            gradeId: r.gradeId,
            comprehension: r.comprehension,
            score: r.score,
            allFields: Object.keys(rAny).filter(key => key.toLowerCase().includes('level') || key.toLowerCase().includes('reading') || key.toLowerCase().includes('comp'))
          };
        });
        console.log('AdminSchoolProgressChart: Sample test results from database:', sampleTestResults);

        // Log the actual computed level counts to see if data is being processed (EXACT COPY FROM TEACHER)
        console.log('AdminSchoolProgressChart: Level counts by grade:', {
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
        console.error('AdminSchoolProgressChart: Error fetching system-wide reading results:', error);
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
    fetchSystemWideReadingResults();

    // REAL-TIME: Set up polling for live data updates
    const pollInterval = setInterval(() => {
      console.log('AdminSchoolProgressChart: Polling for real-time data updates...');
      fetchSystemWideReadingResults();
    }, 15000); // Poll every 15 seconds for real-time updates

    // REAL-TIME: Set up visibility change listener for immediate refresh
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('AdminSchoolProgressChart: Tab became visible, refreshing data...');
        fetchSystemWideReadingResults();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // REAL-TIME: Set up focus listener for immediate refresh
    const handleWindowFocus = () => {
      console.log('AdminSchoolProgressChart: Window focused, refreshing data...');
      fetchSystemWideReadingResults();
    };

    window.addEventListener('focus', handleWindowFocus);

    // Cleanup
    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [safeStudents, _grades]); // Re-run when students or grades change

  // Initialize and update chart
  useEffect(() => {
    if (chartRef.current) {
      try {
        // Check if the container has proper dimensions
        const containerWidth = chartRef.current.clientWidth;
        const containerHeight = chartRef.current.clientHeight;

        if (containerWidth === 0 || containerHeight === 0) {
          console.warn('AdminSchoolProgressChart: Container has zero dimensions, setting up observer for when it becomes visible');

          // Set up a ResizeObserver to initialize the chart when the container gets proper dimensions
          let resizeObserver: ResizeObserver | null = null;

          if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver((entries) => {
              for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0 && !chartInstance.current) {
                  console.log('AdminSchoolProgressChart: Container now has dimensions, initializing chart');
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
                console.log('AdminSchoolProgressChart: Container dimensions available after retry, initializing chart');
                initializeChart();
                return;
              }

              retryCount++;
              if (retryCount < maxRetries) {
                setTimeout(retryInitialization, 100 * retryCount); // Increasing delay
              } else {
                console.warn('AdminSchoolProgressChart: Max retries reached, container still has zero dimensions');
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
            console.warn('AdminSchoolProgressChart: Container still has zero dimensions, skipping chart initialization');
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
            console.log('AdminSchoolProgressChart: No data available, skipping chart initialization');
            return;
          }

          console.log(`AdminSchoolProgressChart: Initializing chart with dimensions ${width}x${height}`);
          chartInstance.current = echarts.init(chartRef.current);

          const option = {
            animation: true,
            animationDuration: 1000,
            animationEasing: 'cubicOut' as const,
            tooltip: {
              trigger: 'axis',
              formatter: (params: any) => {
                const value = params[0].value;
                const displayValue = selectedMetric === 'reading-level'
                  ? (typeof currentMetric.formatter === 'function' ? currentMetric.formatter(value) : `${value}`)
                  : `${value}%`;
                return `${params[0].axisValue}<br/>${currentMetric.name}: <b>${displayValue}</b>`;
              }
            },
            grid: {
              left: '2%',
              right: '2%',
              bottom: '8%',
              top: '3%',
              containLabel: true
            },
            xAxis: {
              type: 'category',
              boundaryGap: false,
              data: safeData.assessmentPeriods,
              axisLabel: {
                color: '#6b7280',
                fontSize: 11
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
                formatter: (val: number) => {
                  if (selectedMetric === 'reading-level') {
                    if (val === 3) return 'Independent';
                    if (val === 2) return 'Instructional';
                    if (val === 1) return 'Frustration';
                    return '';
                  }
                  return typeof currentMetric.formatter === 'function' ? currentMetric.formatter(val) : `${val}`;
                }
              },
              axisLine: {
                show: false
              },
              axisTick: {
                show: false
              },
              splitLine: {
                lineStyle: {
                  color: '#f3f4f6'
                }
              }
            },
            series: [
              {
                name: currentMetric.name,
                type: 'line',
                data: currentMetric.data,
                smooth: true,
                symbol: 'circle',
                symbolSize: 12,
                lineStyle: {
                  width: 4,
                  color: currentMetric.color
                },
                itemStyle: {
                  color: currentMetric.color,
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
                      { offset: 0, color: `${currentMetric.color}40` },
                      { offset: 1, color: `${currentMetric.color}10` }
                    ]
                  }
                },
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
              console.warn('AdminSchoolProgressChart: Error during resize:', error);
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
              console.warn('AdminSchoolProgressChart: Error during cleanup:', error);
            }
          };
        }
      } catch (error) {
        console.error('AdminSchoolProgressChart: Error initializing chart:', error);
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
          console.log('AdminSchoolProgressChart: Page became visible, checking if chart needs initialization');
          // Trigger re-render by updating a dependency
          setLastUpdated(new Date());
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md p-6 transition-all duration-300 hover:shadow-lg overflow-hidden flex flex-col h-full w-full">
      <div className="flex flex-col flex-1 w-full">
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

          {/* Refresh Controls - right aligned */}
          <div className="lg:justify-self-end">
            <div className="flex items-center gap-2">
              {/* Manual Refresh Button */}
              <button
                onClick={() => {
                  console.log('AdminSchoolProgressChart: Manual refresh triggered');
                  setLastUpdated(new Date());
                  setForceChartInit(prev => prev + 1);
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
        <div className="w-full flex-1 h-full relative" style={{ minHeight: '400px' }}>
          <div ref={chartRef} className="w-full h-full" style={{ minHeight: '400px' }} />

          {/* No Data Overlay */}
          {safeData.oralReadingScores.every(score => score === 0) &&
            safeData.comprehensionScores.every(score => score === 0) &&
            safeData.readingLevels.every(level => level === 0) && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-95">
                <div className="text-center text-gray-500">
                  <i className="fas fa-chart-bar text-4xl mb-4 text-gray-300"></i>
                  <h3 className="text-lg font-medium mb-2">No Reading Data Available</h3>
                  <p className="text-sm mb-4">Start by adding reading sessions and assessments to see school-wide progress data.</p>
                  <div className="text-xs text-gray-400">
                    <p>• Teachers add reading sessions to track oral reading scores</p>
                    <p>• Teachers add comprehension tests to track understanding</p>
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
                  <p className="text-sm mb-4">Preparing your school-wide reading progress data</p>
                  <button
                    onClick={() => {
                      console.log('AdminSchoolProgressChart: Manual initialization triggered');
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

export default AdminSchoolProgressChart;