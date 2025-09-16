import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { type Student } from '../../../services/studentService';
import { type ClassGrade } from '../../../services/gradeService';

interface PerformanceChartProps {
  data: {
    weeks: string[];
    studentScores: number[];
    classAverages: number[];
  };
  grades: ClassGrade[];
  students: Student[];
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ data, grades, students }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);

  const safeData = {
    weeks: Array.isArray(data?.weeks) ? data.weeks : [],
    studentScores: Array.isArray(data?.studentScores) ? data.studentScores : [],
    classAverages: Array.isArray(data?.classAverages) ? data.classAverages : [],
  };
  const safeGrades = Array.isArray(grades) ? grades : [];
  const safeStudents = Array.isArray(students) ? students : [];

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
          data: ['Average Score', 'Class Average'],
          textStyle: {
            fontSize: 12,
            color: '#6b7280'
          },
          itemGap: 20,
          top: 10
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
          boundaryGap: false,
          data: safeData.weeks,
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
            name: 'Average Score',
            type: 'line',
            data: safeData.studentScores,
            smooth: true,
            symbol: 'circle',
            symbolSize: 8,
            lineStyle: {
              width: 3,
              color: '#3b82f6'
            },
            itemStyle: {
              color: '#3b82f6',
              borderWidth: 2,
              borderColor: '#ffffff'
            },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(59, 130, 246, 0.2)' },
                  { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }
                ]
              }
            }
          },
          {
            name: 'Class Average',
            type: 'line',
            data: safeData.classAverages,
            smooth: true,
            symbol: 'circle',
            symbolSize: 8,
            lineStyle: {
              width: 3,
              color: '#10b981'
            },
            itemStyle: {
              color: '#10b981',
              borderWidth: 2,
              borderColor: '#ffffff'
            },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(16, 185, 129, 0.2)' },
                  { offset: 1, color: 'rgba(16, 185, 129, 0.05)' }
                ]
              }
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
    <div className="bg-white rounded-2xl shadow-md p-4 transition-all duration-300 hover:shadow-lg">
      <div className="p-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 lg:mb-6 space-y-3 sm:space-y-0">
          <h3 className="text-base md:text-lg font-semibold text-[#2C3E50]">Students Performance</h3>
          <div className="flex items-center space-x-2">
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="px-2 py-1 text-xs border rounded-md"
            >
              {safeGrades.length === 0 && <option value="">No Classes</option>}
              {safeGrades.map((grade) => (
                <option key={grade.id} value={grade.id}>{grade.name}</option>
              ))}
            </select>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="px-2 py-1 text-xs border rounded-md"
              disabled={!selectedGrade}
            >
              <option value="">Select Student</option>
              {(Array.isArray(filteredStudents) ? filteredStudents : []).map((student) => (
                <option key={student.id} value={student.id}>{student.name.replace(' | ', ' ')}</option>
              ))}
            </select>
          </div>
        </div>
        <div ref={chartRef} className="w-full h-64 sm:h-72" />
      </div>
    </div>
  );
};

export default PerformanceChart; 