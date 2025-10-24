import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { 
  DocumentTextIcon, 
  UserIcon, 
  AcademicCapIcon, 
  CalendarIcon,
  ArrowLeftIcon,
  PrinterIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

interface ISRData {
  id: string;
  gradeId: string;
  classId: string;
  teacherId: string;
  teacherName: string;
  gradeName: string;
  className: string;
  students: Array<{
    id: string;
    name: string;
    readingLevel: string;
    performance: any;
  }>;
  createdAt: string;
  reportData: any;
}

const ISRReport: React.FC = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const [isrData, setIsrData] = useState<ISRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (reportId) {
      fetchISRData();
    }
  }, [reportId]);

  const fetchISRData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching ISR data for report ID:', reportId);

      // Try to fetch from different possible collections
      const possibleCollections = [
        'classISRReports',
        'isrReports', 
        'teacherReports',
        'reports',
        'notifications',
        'inboxMessages'
      ];

      let reportData = null;
      let foundCollection = '';

      for (const collectionName of possibleCollections) {
        try {
          console.log(`Trying collection: ${collectionName}`);
          const docRef = doc(db, collectionName, reportId);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            reportData = { id: docSnap.id, ...docSnap.data() };
            foundCollection = collectionName;
            console.log(`Found data in collection: ${collectionName}`, reportData);
            break;
          } else {
            console.log(`No document found in collection: ${collectionName}`);
          }
        } catch (err) {
          console.log(`Collection ${collectionName} not found or error:`, err);
        }
      }

      if (reportData) {
        // Transform the data to match our expected structure
        const transformedData: ISRData = {
          id: reportData.id,
          gradeId: reportData.gradeId || reportData.data?.gradeId || '',
          classId: reportData.classId || reportData.data?.classId || '',
          teacherId: reportData.teacherId || reportData.data?.teacherId || '',
          teacherName: reportData.teacherName || reportData.data?.teacherName || reportData.senderName || 'Unknown Teacher',
          gradeName: reportData.gradeName || reportData.data?.gradeName || 'Unknown Grade',
          className: reportData.className || reportData.data?.className || 'Unknown Class',
          students: reportData.students || reportData.data?.students || [],
          createdAt: reportData.createdAt || reportData.data?.createdAt || new Date().toISOString(),
          reportData: reportData.reportData || reportData.data?.reportData || reportData
        };
        
        console.log('Transformed data:', transformedData);
        setIsrData(transformedData);
      } else {
        // Create a mock ISR report for demonstration
        console.log('No data found, creating mock ISR report for demonstration');
        const mockData: ISRData = {
          id: reportId || 'mock-report',
          gradeId: 'mock-grade',
          classId: 'mock-class',
          teacherId: 'mock-teacher',
          teacherName: 'Juan Dela Cruz',
          gradeName: 'Grade 4',
          className: 'Athen',
          students: [
            { id: '1', name: 'Student 1', readingLevel: 'Independent', performance: { score: 85 } },
            { id: '2', name: 'Student 2', readingLevel: 'Instructional', performance: { score: 70 } },
            { id: '3', name: 'Student 3', readingLevel: 'Frustration', performance: { score: 45 } },
            { id: '4', name: 'Student 4', readingLevel: 'Independent', performance: { score: 90 } },
            { id: '5', name: 'Student 5', readingLevel: 'Instructional', performance: { score: 75 } }
          ],
          createdAt: new Date().toISOString(),
          reportData: { mock: true }
        };
        
        setIsrData(mockData);
      }
    } catch (err) {
      console.error('Error fetching ISR data:', err);
      setError('Failed to load ISR report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // Create a downloadable version of the report
    const element = document.createElement('a');
    const file = new Blob([document.getElementById('isr-content')?.innerHTML || ''], {type: 'text/html'});
    element.href = URL.createObjectURL(file);
    element.download = `ISR-Report-${reportId}.html`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleBack = () => {
    navigate('/admin/reports');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading ISR Report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
          <button
            onClick={handleBack}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Back to Reports
          </button>
        </div>
      </div>
    );
  }

  if (!isrData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No ISR data available</p>
          <button
            onClick={handleBack}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Back to Reports
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeftIcon className="h-5 w-5" />
                Back to Reports
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <div className="flex items-center gap-2">
                <DocumentTextIcon className="h-6 w-6 text-blue-600" />
                <h1 className="text-xl font-semibold text-gray-900">
                  Class ISR Report
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <PrinterIcon className="h-4 w-4" />
                Print
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Download
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div id="isr-content" className="bg-white rounded-lg shadow-sm border">
          {/* Report Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Individual Summary Record (ISR)
                </h2>
                <p className="text-gray-600 mt-1">
                  Grade {isrData.gradeName} - {isrData.className}
                </p>
                {isrData.reportData?.mock && (
                  <div className="mt-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Demo Data - This is a sample ISR report
                    </span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">
                  Generated on {new Date(isrData.createdAt).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-500">
                  by {isrData.teacherName}
                </p>
              </div>
            </div>
          </div>

          {/* Report Content */}
          <div className="px-6 py-6">
            {/* Class Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AcademicCapIcon className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-900">Grade Level</h3>
                </div>
                <p className="text-blue-700">{isrData.gradeName}</p>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <UserIcon className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-900">Class</h3>
                </div>
                <p className="text-green-700">{isrData.className}</p>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <UserIcon className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold text-purple-900">Teacher</h3>
                </div>
                <p className="text-purple-700">{isrData.teacherName}</p>
              </div>
            </div>

            {/* Students List */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Student Performance Summary
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Student Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reading Level
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Performance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {isrData.students?.map((student, index) => (
                      <tr key={student.id || index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {student.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.readingLevel || 'Not assessed'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {student.performance ? 'Available' : 'Not available'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Active
                          </span>
                        </td>
                      </tr>
                    )) || (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                          No student data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Report Summary */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Report Summary
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">
                    <strong>Total Students:</strong> {isrData.students?.length || 0}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Report ID:</strong> {isrData.id}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">
                    <strong>Generated:</strong> {new Date(isrData.createdAt).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Teacher:</strong> {isrData.teacherName}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ISRReport;
