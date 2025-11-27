import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase.js';

interface ReportDownloadMap {
  pdf?: string;
  csv?: string;
  png?: string;
}

interface ScheduledNotificationPayload {
  templateName: string;
  templateType: string;
  reportId: string;
  downloads: ReportDownloadMap;
  scheduleId?: string;
  warnings?: string[];
}

const teacherInbox = collection(db, 'teacherInbox');

export const notifyTeachersOfScheduledReport = async (
  recipientIds: string[],
  payload: ScheduledNotificationPayload,
) => {
  if (!recipientIds || recipientIds.length === 0) {
    return;
  }

  const baseMessage = {
    type: 'teacher_report',
    title: `Scheduled report ready: ${payload.templateName}`,
    message: `Your scheduled "${payload.templateName}" report finished generating. Download the latest files from Administrative Reports → Generated History.`,
    senderId: 'admin-reports',
    senderRole: 'admin',
    senderName: 'Administrative Reports',
    isRead: false,
    isArchived: false,
    priority: 'medium',
    category: 'teacher_reports',
    createdAt: serverTimestamp(),
    data: {
      reportId: payload.reportId,
      templateName: payload.templateName,
      templateType: payload.templateType,
      scheduleId: payload.scheduleId,
      downloads: payload.downloads,
      warnings: payload.warnings ?? [],
    },
  };

  await Promise.all(
    recipientIds.map(async (recipientId) => {
      try {
        await addDoc(teacherInbox, {
          ...baseMessage,
          recipientId,
        });
      } catch (error) {
        console.error('[AdminReports] Failed to notify teacher about scheduled report', {
          recipientId,
          error,
        });
      }
    }),
  );
};

