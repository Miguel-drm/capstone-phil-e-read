import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { type Student } from '../../../services/studentService';
import { type ClassGrade } from '../../../services/gradeService';
import PillSelect, { type PillOption } from '../../ui/PillSelect';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../config/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { shouldSuppressFirestoreError } from '../../../services/authService';

interface PerformanceChartProps {
  data: {
    assessmentPeriods: string[];
    oralReadingScores: number[];
    comprehensionScores: number[];
    readingLevels: string[]; // Independent, Instructional, Frustration
  };
  grades: ClassGrade[];
  students: Student[];
  title?: string;
  targetLine?: number; // important target benchmark percentage
  showStaticStudentInfo?: boolean; // For parent dashboard - show static student info instead of dropdowns
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ data, grades, students, title, targetLine, showStaticStudentInfo = false }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<'oral' | 'comprehension' | 'reading-level'>('oral');
  const { currentUser, userRole } = useAuth();

  // realtime computed data
  const [computedData, setComputedData] = useState<{
    assessmentPeriods: string[];
    oralReadingScores: number[];
    comprehensionScores: number[];
    readingLevels: number[]; // numeric buckets 1..3 for charting
  }>({
    assessmentPeriods: ['Grade III', 'Grade IV', 'Grade V', 'Grade VI'],
    oralReadingScores: [],
    comprehensionScores: [],
    readingLevels: []
  });

  // For parent accounts, prioritize the passed data prop over computed data
  const shouldUsePassedData = userRole === 'parent' && data && (
    (Array.isArray(data.assessmentPeriods) && data.assessmentPeriods.length > 0) ||
    (Array.isArray(data.oralReadingScores) && data.oralReadingScores.length > 0) ||
    (Array.isArray(data.comprehensionScores) && data.comprehensionScores.length > 0) ||
    (Array.isArray(data.readingLevels) && data.readingLevels.length > 0)
  );

  const safeData = {
    assessmentPeriods: shouldUsePassedData ? (data.assessmentPeriods || []) : (computedData.assessmentPeriods.length ? computedData.assessmentPeriods : (Array.isArray(data?.assessmentPeriods) ? data.assessmentPeriods : [])),
    oralReadingScores: shouldUsePassedData ? (data.oralReadingScores || []) : (computedData.oralReadingScores.length ? computedData.oralReadingScores : (Array.isArray(data?.oralReadingScores) ? data.oralReadingScores : [])),
    comprehensionScores: shouldUsePassedData ? (data.comprehensionScores || []) : (computedData.comprehensionScores.length ? computedData.comprehensionScores : (Array.isArray(data?.comprehensionScores) ? data.comprehensionScores : [])),
    readingLevels: shouldUsePassedData ? (data.readingLevels as any as number[] || []) : (computedData.readingLevels.length ? computedData.readingLevels : (Array.isArray(data?.readingLevels) ? (data.readingLevels as any as number[]) : [])),
  };
  const safeGrades = Array.isArray(grades) ? grades : [];
  const safeStudents = Array.isArray(students) ? students : [];

  // Get current data based on selected metric
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
        // Convert string reading levels to numeric values for chart
        const readingLevelsData = shouldUsePassedData && data.readingLevels ? data.readingLevels : safeData.readingLevels;
        const numericReadingLevels = readingLevelsData.map((level: any) => {
          if (typeof level === 'string') {
            const lower = level.toLowerCase();
            if (lower.includes('independent')) return 3;
            if (lower.includes('instructional')) return 2;
            if (lower.includes('frustration')) return 1;
            return 2; // default to Instructional
          }
          return level;
        });
        
        return {
          data: numericReadingLevels,
          name: 'Reading Level',
          color: '#f59e0b',
          yAxisMax: 3,
          yAxisMin: 1,
          formatter: (value: number) => {
            switch (value) {
              case 3: return 'Independent';
              case 2: return 'Instructional';
              case 1: return 'Frustration';
              default: return 'Instructional';
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

  // Default to first grade if available
  useEffect(() => {
    if (Array.isArray(grades) && grades.length > 0 && !selectedGrade) {
      setSelectedGrade(grades[0].id || '');
    }
    // Only depend on grades to avoid infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grades]);

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

  // Realtime subscription to results for selected filters -> compute data arrays
  useEffect(() => {
    const labels = ['Grade III', 'Grade IV', 'Grade V', 'Grade VI'];
    
    // For parent accounts, use the passed data prop instead of fetching from Firestore
    if (userRole === 'parent') {
      // Don't set computedData for parents - let safeData use the passed data prop
      return;
    }
    
    // For other non-teacher roles, set empty data
    if (userRole && userRole !== 'teacher') {
      setComputedData({ assessmentPeriods: labels, oralReadingScores: [], comprehensionScores: [], readingLevels: [] });
      return;
    }
    if (!currentUser?.uid) return;
    const labelIndex = (gradeName: string | undefined): number => {
      if (!gradeName) return -1;
      const upper = gradeName.toUpperCase();
      if (upper.includes('III')) return 0;
      if (upper.includes('IV')) return 1;
      if (upper.includes('V ')) return 2; // space to avoid VI
      if (upper.endsWith(' V')) return 2;
      if (upper.includes('VI')) return 3;
      return -1;
    };

    const gradeIdToName = new Map<string, string>();
    (Array.isArray(grades) ? grades : []).forEach(g => { if (g.id) gradeIdToName.set(g.id, g.name); });

    const conditions = [where('teacherId', '==', currentUser.uid)];
    if (selectedStudent) conditions.push(where('studentId', '==', selectedStudent));
    else if (selectedGrade) conditions.push(where('gradeId', '==', selectedGrade));

    const col = collection(db, 'readingResults');
    const q = query(col, ...conditions);
    const unsub = onSnapshot(q, (snap) => {
      const oralSums = [0,0,0,0];
      const oralCounts = [0,0,0,0];
      const compSums = [0,0,0,0];
      const compCounts = [0,0,0,0];
      const levelSums = [0,0,0,0];
      const levelCounts = [0,0,0,0];
      snap.forEach(ds => {
        const d: any = ds.data();
        const gName = d.gradeName || gradeIdToName.get(d.gradeId) || '';
        const idx = labelIndex(gName);
        if (idx < 0) return;
        const accuracy: number | undefined = d.oralReadingScore ?? d.accuracy ?? d.score;
        if (typeof accuracy === 'number') {
          oralSums[idx] += Math.max(0, Math.min(100, accuracy));
          oralCounts[idx] += 1;
        }
        const comp: number | undefined = d.comprehension ?? (typeof d.correctAnswers === 'number' && typeof d.totalQuestions === 'number' && d.totalQuestions > 0 ? (d.correctAnswers / d.totalQuestions) * 100 : undefined);
        if (typeof comp === 'number') {
          compSums[idx] += Math.max(0, Math.min(100, comp));
          compCounts[idx] += 1;
        }
        // reading level mapping
        const levelName: string | undefined = d.readingLevel || d.level || d.readingLevelName;
        let levelVal: number | undefined;
        if (typeof levelName === 'string') {
          const name = levelName.toLowerCase();
          if (name.startsWith('independent')) levelVal = 3;
          else if (name.startsWith('instruction')) levelVal = 2;
          else levelVal = 1;
        } else if (typeof accuracy === 'number') {
          if (accuracy >= 97) levelVal = 3; else if (accuracy >= 90) levelVal = 2; else levelVal = 1;
        }
        if (typeof levelVal === 'number') {
          levelSums[idx] += levelVal;
          levelCounts[idx] += 1;
        }
      });

      const avg = (s: number[], c: number[]) => s.map((v,i)=> c[i] ? Number((v/c[i]).toFixed(2)) : 0);
      
      // Create complete horizontal line by filling missing data points
      const createHorizontalLine = (data: number[], defaultValue: number = 80) => {
        const result = [...data];
        // If we have any data, use the first non-zero value for all points
        const firstValue = data.find(val => val > 0) || defaultValue;
        return result.map(val => val > 0 ? val : firstValue);
      };
      
      const oralScores = avg(oralSums, oralCounts);
      const compScores = avg(compSums, compCounts);
      const levelScores = avg(levelSums, levelCounts);
      
      setComputedData({
        assessmentPeriods: labels,
        oralReadingScores: createHorizontalLine(oralScores),
        comprehensionScores: createHorizontalLine(compScores),
        readingLevels: createHorizontalLine(levelScores, 2)
      });
    }, (err) => {
      const code = (err as any)?.code as string | undefined;
      if (shouldSuppressFirestoreError() || code === 'permission-denied' || code === 'unauthenticated') {
        // Quietly fall back to empty data for users without access or during sign-out
        setComputedData({ assessmentPeriods: labels, oralReadingScores: [], comprehensionScores: [], readingLevels: [] });
        return;
      }
      console.warn('PerformanceChart subscribe error:', err);
      setComputedData({ assessmentPeriods: labels, oralReadingScores: [], comprehensionScores: [], readingLevels: [] });
    });

    return () => unsub();
  }, [userRole, currentUser?.uid, selectedGrade, selectedStudent, grades]);

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
          },
          formatter: function(params: any) {
            let result = `<div class=\"font-semibold text-gray-800 mb-2\">${params[0].axisValue}</div>`;
            params.forEach((param: any) => {
              const color = param.color;
              const value = param.value;
              const name = param.seriesName || 'Score';
              result += `
                <div class=\"flex items-center justify-between mb-1\">\n                  <div class=\"flex items-center\">\n                    <div class=\"w-3 h-3 rounded-full mr-2\" style=\"background-color: ${color}\"></div>\n                    <span class=\"text-gray-600\">${name}</span>\n                  </div>\n                  <span class=\"font-semibold text-gray-800\">${value}%</span>\n                </div>
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
            formatter: typeof currentMetric.formatter === 'function' ? currentMetric.formatter : currentMetric.formatter
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
          // For reading level, only show the three specific levels
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
        chartInstance.current?.resize();
      };

      // Resize on window size changes
      window.addEventListener('resize', resizeHandler);

      // Also resize when the container's size changes (e.g., sidebar collapse)
      let observer: ResizeObserver | null = null;
      if (typeof ResizeObserver !== 'undefined' && chartRef.current?.parentElement) {
        observer = new ResizeObserver(() => resizeHandler());
        observer.observe(chartRef.current.parentElement);
      }

      return () => {
        window.removeEventListener('resize', resizeHandler);
        if (observer) observer.disconnect();
        chartInstance.current?.dispose();
      };
    }
  }, [data, selectedMetric]);

  return (
    <div className="bg-white rounded-2xl p-3 transition-all duration-300 overflow-hidden flex flex-col h-full w-full">
      <div className="p-3 flex flex-col flex-1 w-full">
        <div className="flex flex-col lg:grid lg:grid-cols-3 lg:items-center mb-3 lg:mb-4 space-y-2 lg:space-y-0">
          <h3 className="text-base md:text-lg font-semibold text-[#2C3E50] whitespace-nowrap pr-3 flex-shrink-0">{title || 'Student Reading Progress'}</h3>
          {/* Metric Toggle Buttons - perfectly centered in column 2 */}
          <div className="flex justify-center lg:justify-center lg:col-start-2">
            <div role="tablist" aria-label="Metric selector" className="inline-flex items-center bg-gray-100 rounded-full p-1 shadow-inner max-w-fit flex-wrap sm:flex-nowrap gap-1">
              <button
                type="button"
                role="tab"
                aria-selected={selectedMetric === 'oral'}
                onClick={() => setSelectedMetric('oral')}
                className={`px-2 py-1.5 text-xs rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400 whitespace-nowrap ${
                  selectedMetric === 'oral'
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
                className={`px-2 py-1.5 text-xs rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-400 whitespace-nowrap ${
                  selectedMetric === 'comprehension'
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
                className={`px-3 py-1.5 text-xs rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-400 whitespace-nowrap ${
                  selectedMetric === 'reading-level'
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

          {/* Grade and Student Selectors - always right aligned in column 3 */}
          <div className="lg:justify-self-end">
            <div className="inline-flex items-center bg-gray-100 rounded-full p-1 shadow-inner gap-1 max-w-full overflow-hidden">
              {showStaticStudentInfo ? (
                // Static student info display for parent dashboard
                safeStudents.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 bg-white rounded-full border border-gray-200">
                    <span className="font-medium">
                      {safeStudents[0].grade || 'Grade'} - Section
                    </span>
                  </div>
                )
              ) : (
                // Dropdown selectors for teacher dashboard
                <>
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
                </>
              )}
            </div>
          </div>
        </div>
        <div ref={chartRef} className="w-full flex-1 min-h-80 h-full" />
      </div>
    </div>
  );
};

export default PerformanceChart; 