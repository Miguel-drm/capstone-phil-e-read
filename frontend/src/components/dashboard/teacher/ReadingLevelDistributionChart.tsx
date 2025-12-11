import React, { useEffect, useMemo, useRef, useState } from 'react';
import PillSelect, { type PillOption } from '../../ui/PillSelect';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../config/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import * as echarts from 'echarts';

interface Props {
  classes?: { id?: string; name: string }[];
}

const ReadingLevelDistributionChart: React.FC<Props> = ({ classes = [] }) => {
  const pieChartRef = useRef<HTMLDivElement>(null);
  const pieChartInstance = useRef<echarts.ECharts | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const { currentUser } = useAuth();
  const [counts, setCounts] = useState<{ independent: number; instructional: number; frustration: number }>({ independent: 0, instructional: 0, frustration: 0 });

  // Derived chart data from realtime counts
  const readingLevelData = useMemo(() => {
    return [
      { value: counts.instructional, name: 'Instructional', itemStyle: { color: '#22c55e' } }, // green
      { value: counts.independent, name: 'Independent', itemStyle: { color: '#3b82f6' } }, // blue
      { value: counts.frustration, name: 'Frustration', itemStyle: { color: '#facc15' } } // yellow
    ];
  }, [counts]);

  useEffect(() => {
    if (pieChartRef.current) {
      pieChartInstance.current = echarts.init(pieChartRef.current);

      const option = {
        backgroundColor: 'transparent',
        title: {
          text: 'Reading Level Distribution',
          left: 'center',
          top: 10,
          textStyle: {
            fontSize: 16,
            fontWeight: '600',
          }
        },
        tooltip: {
          show: false
        },
        legend: {
          orient: 'horizontal',
          bottom: 10,
          left: 'center',
          data: readingLevelData.map(d => d.name),
          textStyle: {
            fontSize: 12,
            fontWeight: '600',
            color: '#374151',
          },
          itemGap: 20,
          icon: 'circle',
        },
        series: [
          {
            name: 'Reading Level',
            type: 'pie',
            radius: ['50%', '70%'],
            center: ['50%', '50%'],
            itemStyle: {
              borderColor: '#fff',
              borderWidth: 5,
              borderRadius: 8,
              shadowBlur: 10,
              shadowColor: 'rgba(0,0,0,0.08)'
            },
            label: {
              show: false, 
              position: 'center'
            },
            emphasis: {
              label: {
                show: true,
                fontSize: '24',
                fontWeight: 'bold',
                formatter: `{d}%`
              }
            },
            labelLine: {
              show: false
            },
            data: readingLevelData,
          }
        ]
      };
      pieChartInstance.current.setOption(option);
      const resizeHandler = () => pieChartInstance.current?.resize();
      window.addEventListener('resize', resizeHandler);
      let observer: ResizeObserver | null = null;
      if (typeof ResizeObserver !== 'undefined' && pieChartRef.current?.parentElement) {
        observer = new ResizeObserver(() => resizeHandler());
        observer.observe(pieChartRef.current.parentElement);
      }
      return () => {
        window.removeEventListener('resize', resizeHandler);
        if (observer) observer.disconnect();
        pieChartInstance.current?.dispose();
      };
    }
  }, []);

  // Update chart when data changes
  useEffect(() => {
    if (!pieChartInstance.current) return;
    pieChartInstance.current.setOption({ series: [{ data: readingLevelData }] });
  }, [readingLevelData]);

  // Subscribe to data for pie chart (prefer ISR results API; fallback to Firestore readingResults)
  useEffect(() => {
    if (!currentUser?.uid) return;

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    // Helper to bucket a result
    const bucketize = (levelName?: string, accuracy?: number): 'independent' | 'instructional' | 'frustration' => {
      if (typeof levelName === 'string') {
        const name = levelName.toLowerCase();
        if (name.startsWith('independent')) return 'independent';
        if (name.startsWith('instruction')) return 'instructional';
        return 'frustration';
      }
      if (typeof accuracy === 'number') {
        if (accuracy >= 97) return 'independent';
        if (accuracy >= 90) return 'instructional';
        return 'frustration';
      }
      return 'frustration';
    };

    const applyCounts = (items: any[]) => {
      if (cancelled) return;
      let independent = 0;
      let instructional = 0;
      let frustration = 0;

      const selectedName = classes.find(c => c.id === selectedClassId)?.name?.toLowerCase?.() || '';

      items.forEach((item) => {
        const gradeId = (item as any).gradeId || (item as any).gradeSection || '';
        const gradeName = String(gradeId || '').toLowerCase();
        if (selectedClassId) {
          if (gradeId === selectedClassId) {
            // pass
          } else if (selectedName && gradeName.includes(selectedName.toLowerCase())) {
            // pass
          } else {
            return;
          }
        }
        const levelName: string | undefined =
          (item as any).readingLevel ||
          (item as any).level ||
          (item as any).readingLevelName ||
          (item as any).partB?.wordReadingLevel ||
          (item as any).partB?.accuracyLevel;
        const accuracy: number | undefined =
          (item as any).oralReadingScore ??
          (item as any).accuracy ??
          (item as any).score ??
          (item as any).partB?.wordReadingScore;

        const bucket = bucketize(levelName, accuracy);
        if (bucket === 'independent') independent += 1;
        if (bucket === 'instructional') instructional += 1;
        if (bucket === 'frustration') frustration += 1;
      });

      setCounts({ independent, instructional, frustration });
    };

    // First try ISR results API (MongoDB)
    (async () => {
      try {
        const { isrResultService } = await import('../../../services/ISRresultService');
        const results = await isrResultService.getISRResultsByTeacher(currentUser.uid);
        applyCounts(results);
      } catch (apiError) {
        console.warn('ReadingLevelDistribution: ISR API unavailable, falling back to Firestore', apiError);

        try {
          const col = collection(db, 'readingResults');
          const q = query(col, where('teacherId', '==', currentUser.uid));

          unsubscribe = onSnapshot(
            q,
            (snap) => {
              const docs: any[] = [];
              snap.forEach((docSnap) => docs.push({ id: docSnap.id, ...docSnap.data() }));
              applyCounts(docs);
            },
            () => applyCounts([])
          );
        } catch (err) {
          console.warn('ReadingLevelDistribution: Firestore fallback failed', err);
          applyCounts([]);
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        if (unsubscribe) unsubscribe();
      } catch (error) {
        console.error('🔥 READING CHART: Error during cleanup:', error);
      }
    };
  }, [currentUser?.uid, selectedClassId, classes]);

  return (
    <div className="bg-white rounded-2xl p-4 transition-all duration-300 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-[#2C3E50] text-sm sm:text-base">Reading Level Distribution</div>
        <PillSelect
          ariaLabel="Select Class"
          options={(classes.length === 0 ? [{ label: 'All Classes', value: '' }] : classes.map(c => ({ label: c.name, value: c.id || '' })) as PillOption[])}
          value={selectedClassId}
          onChange={setSelectedClassId}
          placeholder="All Classes"
        />
      </div>
      <div className="flex-1 flex flex-col justify-center">
        <div ref={pieChartRef} className="w-full h-64 sm:h-72"></div>
      </div>
    </div>
  );
};

export default ReadingLevelDistributionChart;
