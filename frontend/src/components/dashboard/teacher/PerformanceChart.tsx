import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { type Student } from '../../../services/studentService';
import { type ClassGrade } from '../../../services/gradeService';
import PillSelect, { type PillOption } from '../../ui/PillSelect';
import { useAuth } from '../../../contexts/AuthContext';


import { resultService } from '../../../services/resultsService';

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

// Helper functions
const getGradeIndex = (grade: string | undefined): number => {
  if (!grade) return -1;
  const upper = grade.toUpperCase();
  if (upper.includes('III') || upper.includes('3')) return 0;
  if (upper.includes('IV') || upper.includes('4')) return 1;
  if (upper.includes('V ') || upper.endsWith(' V') || (upper.includes('5') && !upper.includes('6'))) return 2;
  if (upper.includes('VI') || upper.includes('6')) return 3;
  return -1;
};



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

  // Fetch real reading results from MongoDB
  useEffect(() => {
    const labels = ['Grade III', 'Grade IV', 'Grade V', 'Grade VI'];
    
    // For parent accounts, use the passed data prop instead of fetching from database
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

    const fetchReadingResults = async () => {
      try {
        console.log('Fetching reading results for teacher:', currentUser.uid);
        const results = await resultService.getReadingSessionResults(currentUser.uid);
        console.log('Fetched reading results:', results.length);
        
        // Process the results to compute averages by grade
        const oralSums = [0,0,0,0];
        const oralCounts = [0,0,0,0];
        const compSums = [0,0,0,0];
        const compCounts = [0,0,0,0];
        const levelSums = [0,0,0,0];
        const levelCounts = [0,0,0,0];
        
        results.forEach(result => {
          // Map grade to index - we need to get grade name from gradeId
          // For now, we'll use a simple mapping or get it from the grades array
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
          
          // Process comprehension score
          if (typeof result.comprehension === 'number') {
            compSums[gradeIndex] += Math.max(0, Math.min(100, result.comprehension));
            compCounts[gradeIndex] += 1;
          }
          
          // Process reading level - we'll derive it from oral reading score since readingLevel field doesn't exist
          if (typeof result.oralReadingScore === 'number') {
            const levelValue = result.oralReadingScore >= 97 ? 3 : result.oralReadingScore >= 90 ? 2 : 1;
            levelSums[gradeIndex] += levelValue;
            levelCounts[gradeIndex] += 1;
          }
        });
        
        // Calculate averages
        const oralScores = oralSums.map((sum, i) => oralCounts[i] > 0 ? Math.round(sum / oralCounts[i]) : 0);
        const compScores = compSums.map((sum, i) => compCounts[i] > 0 ? Math.round(sum / compCounts[i]) : 0);
        const levelScores = levelSums.map((sum, i) => levelCounts[i] > 0 ? Math.round(sum / levelCounts[i]) : 2);
        
        console.log('Computed scores:', { oralScores, compScores, levelScores });
        
        setComputedData({
          assessmentPeriods: labels,
          oralReadingScores: oralScores,
          comprehensionScores: compScores,
          readingLevels: levelScores
        });
        
      } catch (error) {
        console.error('Error fetching reading results:', error);
        setComputedData({ 
          assessmentPeriods: labels, 
          oralReadingScores: [], 
          comprehensionScores: [], 
          readingLevels: [] 
        });
      }
    };

    fetchReadingResults();
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