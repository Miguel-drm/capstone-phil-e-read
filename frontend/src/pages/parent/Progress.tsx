import React, { useState, useEffect } from 'react';
import PerformanceChart from '../../components/dashboard/teacher/PerformanceChart';
import type { Student } from '../../services/studentService';
import Loader from '../../components/Loader';
import { formatDateHuman } from '@/utils/date';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { UserGroupIcon, BookOpenIcon, ChartBarIcon, ClockIcon } from '@heroicons/react/24/outline';

interface ParentChild {
  id: string;
  name: string;
  grade: string;
  readingLevel: string;
  performance: string;
  lastAssessment: string;
  status: string;
  teacherId: string;
}

interface ReadingResult {
  id: string;
  studentId: string;
  gradeId: string;
  gradeName: string;
  teacherId: string;
  oralReadingScore?: number;
  comprehension?: number;
  readingLevel?: string;
  createdAt: any;
}

const ProgressPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [children, setChildren] = useState<ParentChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [readingResults, setReadingResults] = useState<ReadingResult[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('');

  // Fetch parent's children
  useEffect(() => {
    const fetchChildren = async () => {
      if (!currentUser?.uid) return;

      try {
        setLoading(true);
        
        // Get parent's children from users collection
        const usersRef = collection(db, 'users');
        const parentQuery = query(usersRef, where('uid', '==', currentUser.uid));
        const parentSnapshot = await getDocs(parentQuery);
        
        if (parentSnapshot.empty) {
          setChildren([]);
          return;
        }

        const parentData = parentSnapshot.docs[0].data();
        const childrenIds = parentData.children || [];

        if (childrenIds.length === 0) {
          setChildren([]);
          return;
        }

        // Get children data from students collection
        const studentsRef = collection(db, 'students');
        const childrenQuery = query(studentsRef, where('id', 'in', childrenIds));
        const childrenSnapshot = await getDocs(childrenQuery);
        
        const childrenData: ParentChild[] = childrenSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || 'Unknown',
          grade: doc.data().grade || 'Unknown',
          readingLevel: doc.data().readingLevel || 'A',
          performance: doc.data().performance || 'Good',
          lastAssessment: doc.data().lastAssessment || '',
          status: doc.data().status || 'active',
          teacherId: doc.data().teacherId || ''
        }));

        setChildren(childrenData);
        
        // Set first child as selected by default
        if (childrenData.length > 0) {
          setSelectedChild(childrenData[0].id);
        }
      } catch (error) {
        console.error('Error fetching children:', error);
        setChildren([]);
      } finally {
        setLoading(false);
      }
    };

    fetchChildren();
  }, [currentUser]);

  // Fetch reading results for selected child
  useEffect(() => {
    if (!selectedChild) return;

    const resultsRef = collection(db, 'readingResults');
    const resultsQuery = query(resultsRef, where('studentId', '==', selectedChild));
    
    const unsubscribe = onSnapshot(resultsQuery, (snapshot) => {
      const results: ReadingResult[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ReadingResult[];
      
      setReadingResults(results);
    }, (error) => {
      console.error('Error fetching reading results:', error);
      setReadingResults([]);
    });

    return () => unsubscribe();
  }, [selectedChild]);

  // Calculate metrics from reading results
  const calculateMetrics = () => {
    if (readingResults.length === 0) {
      return {
        averageScore: 0,
        readingSpeed: 0,
        accuracy: 0,
        sessions: 0
      };
    }

    const validScores = readingResults.filter(r => r.oralReadingScore !== undefined);
    const averageScore = validScores.length > 0 
      ? Math.round(validScores.reduce((sum, r) => sum + (r.oralReadingScore || 0), 0) / validScores.length)
      : 0;

    const comprehensionScores = readingResults.filter(r => r.comprehension !== undefined);
    const accuracy = comprehensionScores.length > 0
      ? Math.round(comprehensionScores.reduce((sum, r) => sum + (r.comprehension || 0), 0) / comprehensionScores.length)
      : 0;

    return {
      averageScore,
      readingSpeed: 0, // WPM not available in current data structure
      accuracy,
      sessions: readingResults.length
    };
  };

  const metrics = calculateMetrics();
  const selectedChildData = children.find(c => c.id === selectedChild);

  // Create chart data from reading results
  const createChartData = () => {
    if (readingResults.length === 0) {
      return {
        assessmentPeriods: ['No Data'],
        oralReadingScores: [0],
        comprehensionScores: [0],
        readingLevels: ['No Data']
      };
    }

    // Sort by date and take last 6 results
    const sortedResults = readingResults
      .sort((a, b) => new Date(a.createdAt?.toDate?.() || a.createdAt).getTime() - new Date(b.createdAt?.toDate?.() || b.createdAt).getTime())
      .slice(-6);

    const periods = sortedResults.map((_, index) => `Session ${index + 1}`);
    const oralScores = sortedResults.map(r => r.oralReadingScore || 0);
    const compScores = sortedResults.map(r => r.comprehension || 0);
    const levels = sortedResults.map(r => r.readingLevel || 'Unknown');

    return {
      assessmentPeriods: periods,
      oralReadingScores: oralScores,
      comprehensionScores: compScores,
      readingLevels: levels
    };
  };

  const chartData = createChartData();

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Loader label="Loading your child's progress..." />
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="p-6 space-y-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-gray-100">
          <div className="px-6 py-6 sm:px-8 sm:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-blue-900">Progress</h2>
              <p className="text-sm text-blue-700 mt-1">Track your child's reading progress and achievements.</p>
            </div>
          </div>
        </div>

        {/* No Children Connected */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <UserGroupIcon className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Children Connected</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              You don't have any children linked to your account yet. Contact your child's teacher to get them connected to your parent account.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button 
                onClick={() => window.location.href = '/parent/children'}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <UserGroupIcon className="w-4 h-4" />
                Manage Children
              </button>
              <button 
                onClick={() => window.location.href = '/parent/dashboard'}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <BookOpenIcon className="w-4 h-4" />
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-gray-100">
        <div className="px-6 py-6 sm:px-8 sm:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-blue-900">Progress</h2>
            <p className="text-sm text-blue-700 mt-1">Track your child's reading progress and achievements.</p>
          </div>
          <div className="flex gap-2">
            <select 
              value={selectedChild} 
              onChange={(e) => setSelectedChild(e.target.value)}
              className="border border-blue-200 rounded-xl px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {children.map(child => (
                <option key={child.id} value={child.id}>{child.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <ChartBarIcon className="w-4 h-4 text-blue-600" />
            <div className="text-xs text-gray-500">Average Score</div>
          </div>
          <div className="text-2xl font-extrabold text-blue-700">{metrics.averageScore}%</div>
        </div>
        <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <BookOpenIcon className="w-4 h-4 text-green-600" />
            <div className="text-xs text-gray-500">Accuracy</div>
          </div>
          <div className="text-2xl font-extrabold text-green-700">{metrics.accuracy}%</div>
        </div>
        <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <ClockIcon className="w-4 h-4 text-purple-600" />
            <div className="text-xs text-gray-500">Sessions</div>
          </div>
          <div className="text-2xl font-extrabold text-purple-700">{metrics.sessions}</div>
        </div>
        <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <UserGroupIcon className="w-4 h-4 text-yellow-600" />
            <div className="text-xs text-gray-500">Reading Level</div>
          </div>
          <div className="text-2xl font-extrabold text-yellow-700">{selectedChildData?.readingLevel || 'A'}</div>
        </div>
      </div>

      {/* Performance Chart */}
      <div className="grid grid-cols-1 gap-6">
        {readingResults.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center mb-4">
                <ChartBarIcon className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Progress Data Yet</h3>
              <p className="text-gray-600 mb-4">
                {selectedChildData?.name} hasn't completed any reading sessions yet. 
                Once they start practicing, you'll see their progress here.
              </p>
              <button 
                onClick={() => window.location.href = '/parent/reading-practice'}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <BookOpenIcon className="w-4 h-4" />
                Start Reading Practice
              </button>
            </div>
          </div>
        ) : (
          <PerformanceChart 
            data={chartData} 
            grades={[]} 
            students={[selectedChildData!]} 
            title={selectedChildData?.name} 
            targetLine={85} 
          />
        )}
      </div>

      {/* Recent Sessions */}
      {readingResults.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Reading Sessions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {readingResults.slice(-6).reverse().map((result, index) => (
              <div key={result.id} className="rounded-xl border border-gray-100 p-4">
                <div className="text-sm font-semibold text-gray-800">Session #{readingResults.length - index}</div>
                <div className="text-xs text-gray-500 mb-2">
                  {result.createdAt?.toDate?.() ? 
                    formatDateHuman(result.createdAt.toDate()) : 
                    'Date not available'
                  }
                </div>
                <div className="mt-2 flex justify-between text-xs">
                  <span className="text-blue-700 font-semibold">
                    Score: {result.oralReadingScore || 0}%
                  </span>
                  <span className="text-green-700 font-semibold">
                    Level: {result.readingLevel || 'Unknown'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressPage; 