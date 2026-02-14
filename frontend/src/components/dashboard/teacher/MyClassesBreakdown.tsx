import React, { useState } from 'react';
import { type ClassGrade } from '../../../services/gradeService';
import { type Student } from '../../../services/studentService';

interface MyClassesBreakdownProps {
  classes: ClassGrade[];
  students: Student[];
}

const MyClassesBreakdown: React.FC<MyClassesBreakdownProps> = ({ classes, students }) => {
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  // Calculate students per class
  const classData = classes.map(grade => {
    const studentsInClass = students.filter(student => student.grade === grade.name);
    const total = students.length || 1; // Prevent division by zero
    const percentage = total > 0 ? parseFloat(((studentsInClass.length / total) * 100).toFixed(1)) : 0;
    
    return {
      name: grade.name,
      count: studentsInClass.length,
      color: getClassColor(grade.name),
      lightColor: getClassLightColor(grade.name),
      percentage
    };
  });

  // Sort by count (highest first)
  const sortedData = [...classData].sort((a, b) => b.count - a.count);
  const total = students.length;
  const largestClass = classData.reduce((prev, current) => 
    (prev.count > current.count) ? prev : current,
    classData[0] || { name: '', count: 0, color: '#3b82f6', lightColor: '#e0e7ff', percentage: 0 }
  );

  const displayClass = selectedClass 
    ? classData.find(d => d.name === selectedClass) || largestClass
    : largestClass;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md p-6 h-full flex flex-col transition-all duration-300 hover:shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">My Classes Breakdown</h3>
          <p className="text-sm text-gray-500">Distribution of students across your classes</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">{total}</div>
          <div className="text-xs text-gray-500">Total Students</div>
        </div>
      </div>

      {/* Chart + List Layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6">
        {/* Donut Chart */}
        <div className="flex-1 flex items-center justify-center">
          {classes.length > 0 ? (
            <div className="relative w-48 h-48">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                  cx="50"
                  cy="50"
                  r="35"
                  fill="none"
                  stroke="#f3f4f6"
                  strokeWidth="6"
                  strokeLinecap="butt"
                />
                
                {/* Data segments */}
                {classData.map((segment, index) => {
                  const safeTotal = total > 0 ? total : 1;
                  const startAngle = classData.slice(0, index).reduce((acc, curr) => 
                    acc + ((curr.count || 0) / safeTotal) * 360, 0
                  );
                  const endAngle = startAngle + ((segment.count || 0) / safeTotal) * 360;
                  const isSelected = selectedClass === segment.name;
                  const isLargestClass = segment.count === Math.max(...classData.map(d => d.count));
                  const shouldHighlight = isSelected || (!selectedClass && isLargestClass);
                  
                  const startRad = (startAngle - 90) * Math.PI / 180;
                  const endRad = (endAngle - 90) * Math.PI / 180;
                  
                  const x1 = 50 + 35 * Math.cos(startRad);
                  const y1 = 50 + 35 * Math.sin(startRad);
                  const x2 = 50 + 35 * Math.cos(endRad);
                  const y2 = 50 + 35 * Math.sin(endRad);
                  
                  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
                  
                  const pathData = [
                    `M ${x1} ${y1}`,
                    `A 35 35 0 ${largeArcFlag} 1 ${x2} ${y2}`
                  ].join(" ");
                  
                  return (
                    <path
                      key={segment.name}
                      d={pathData}
                      fill="none"
                      stroke={shouldHighlight ? segment.color : segment.lightColor}
                      strokeWidth="6"
                      strokeLinecap="butt"
                      className={`cursor-pointer transition-all duration-200 ${
                        shouldHighlight ? 'opacity-100' : 'opacity-50 hover:opacity-70'
                      }`}
                      onClick={() => setSelectedClass(segment.name)}
                    />
                  );
                })}
              </svg>
              
              {/* Center text */}
              <div 
                className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer"
                onClick={() => setSelectedClass(null)}
                title="Click to reset selection"
              >
                <div 
                  className="text-3xl font-bold mb-1"
                  style={{ color: displayClass.color }}
                >
                  {Number.isFinite(displayClass.percentage) ? displayClass.percentage.toFixed(1) : '0.0'}%
                </div>
                <div 
                  className="text-sm font-medium text-center"
                  style={{ color: displayClass.color }}
                >
                  {displayClass.count} Students
                </div>
                <div className="text-xs text-gray-500 text-center mt-1">
                  {displayClass.name}
                </div>
                <div className="text-xs text-gray-400 text-center mt-0.5">
                  of {total} total
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500">
              <div className="text-lg mb-2">📚</div>
              <div className="text-sm">No classes found</div>
              <div className="text-xs text-gray-400 mt-1">Create classes to see breakdown</div>
            </div>
          )}
        </div>

        {/* Class List */}
        <div className="flex-1 space-y-3">
          {sortedData.length > 0 ? (
            sortedData.map((segment, index) => {
              const isSelected = selectedClass === segment.name;
              const isTopClass = index === 0;
              
              return (
                <div
                  key={segment.name}
                  onClick={() => setSelectedClass(segment.name)}
                  className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all duration-300 ${
                    isSelected 
                      ? 'ring-2 ring-offset-2 shadow-md' 
                      : 'hover:shadow-sm hover:bg-gray-50'
                  } border`}
                  style={{
                    backgroundColor: isSelected ? segment.lightColor : 'white',
                    borderColor: isSelected ? segment.color : '#e5e7eb'
                  }}
                >
                  {/* Left side - Class info */}
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: segment.color }}
                    >
                      <div 
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: 'white' }}
                      />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">{segment.name}</span>
                        {isTopClass && (
                          <span 
                            className="px-2 py-0.5 rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: segment.color }}
                          >
                            #1
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">{segment.percentage.toFixed(1)}% of total</div>
                    </div>
                  </div>

                  {/* Right side - Count and progress */}
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">{segment.count}</div>
                      <div className="text-xs text-gray-500">students</div>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${segment.percentage}%`,
                          backgroundColor: segment.color
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center text-gray-500 py-8">
              <div className="text-sm">No classes available</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper function to assign colors to classes
function getClassColor(className: string): string {
  // Blue-forward palette
  const colors = [
    '#3b82f6', // primary blue
    '#2563eb', // slightly darker
    '#60a5fa', // light blue
    '#1d4ed8', // deep blue
    '#38bdf8', // cyan blue
    '#0ea5e9', // sky blue
    '#1e40af', // navy
    '#93c5fd', // pale blue
  ];
  
  // Use class name to deterministically assign color
  const index = className.charCodeAt(0) % colors.length;
  return colors[index];
}

function getClassLightColor(className: string): string {
  // Matching light tints for hover/selection
  const lightColors = [
    '#e0e7ff',
    '#dbeafe',
    '#eff6ff',
    '#e0f2fe',
    '#f0f9ff',
    '#e2e8f0',
    '#e5e7eb',
    '#f1f5f9',
  ];
  
  const index = className.charCodeAt(0) % lightColors.length;
  return lightColors[index];
}

export default MyClassesBreakdown;

