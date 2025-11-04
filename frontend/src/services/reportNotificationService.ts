import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface ReportNotification {
  id: string;
  type: 'report_approved' | 'report_rejected' | 'revision_requested' | 'quality_alert' | 'processing_reminder' | 'workflow_triggered' | 'bulk_processing_complete' | 'system_performance_alert';
  title: string;
  message: string;
  recipientId: string;
  recipientRole: 'admin' | 'teacher' | 'parent';
  senderId?: string;
  senderName?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'report_processing' | 'quality_assurance' | 'workflow_automation' | 'system_alert';
  isRead: boolean;
  isArchived: boolean;
  createdAt: Date;
  data?: {
    reportId?: string;
    teacherId?: string;
    teacherName?: string;
    className?: string;
    qualityScore?: number;
    processingTime?: number;
    workflowId?: string;
    actionRequired?: boolean;
    dueDate?: Date;
  };
}

export interface NotificationTemplate {
  type: string;
  title: string;
  messageTemplate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  variables: string[];
}

class ReportNotificationService {
  
  // Predefined notification templates
  private templates: Record<string, NotificationTemplate> = {
    report_approved: {
      type: 'report_approved',
      title: 'Report Approved',
      messageTemplate: 'Your ISR report for {className} has been approved by {adminName}. {comments}',
      priority: 'medium',
      category: 'report_processing',
      variables: ['className', 'adminName', 'comments']
    },
    report_rejected: {
      type: 'report_rejected',
      title: 'Report Rejected',
      messageTemplate: 'Your ISR report for {className} has been rejected. Reason: {reason}. Please revise and resubmit.',
      priority: 'high',
      category: 'report_processing',
      variables: ['className', 'reason']
    },
    revision_requested: {
      type: 'revision_requested',
      title: 'Revision Required',
      messageTemplate: 'Please revise your ISR report for {className}. {comments}',
      priority: 'high',
      category: 'report_processing',
      variables: ['className', 'comments']
    },
    quality_alert: {
      type: 'quality_alert',
      title: 'Quality Alert',
      messageTemplate: 'Report from {teacherName} has a quality score of {qualityScore}% and requires review.',
      priority: 'high',
      category: 'quality_assurance',
      variables: ['teacherName', 'qualityScore']
    },
    processing_reminder: {
      type: 'processing_reminder',
      title: 'Processing Reminder',
      messageTemplate: 'Report from {teacherName} for {className} has been pending for {days} days and requires attention.',
      priority: 'medium',
      category: 'report_processing',
      variables: ['teacherName', 'className', 'days']
    },
    workflow_triggered: {
      type: 'workflow_triggered',
      title: 'Workflow Activated',
      messageTemplate: 'Automated workflow "{workflowName}" has been triggered for report from {teacherName}.',
      priority: 'low',
      category: 'workflow_automation',
      variables: ['workflowName', 'teacherName']
    },
    bulk_processing_complete: {
      type: 'bulk_processing_complete',
      title: 'Bulk Processing Complete',
      messageTemplate: 'Bulk processing of {count} reports has been completed. {approved} approved, {rejected} rejected.',
      priority: 'medium',
      category: 'report_processing',
      variables: ['count', 'approved', 'rejected']
    },
    system_performance_alert: {
      type: 'system_performance_alert',
      title: 'System Performance Alert',
      messageTemplate: 'System performance metrics indicate {issue}. Average processing time: {avgTime} days.',
      priority: 'urgent',
      category: 'system_alert',
      variables: ['issue', 'avgTime']
    }
  };

  // ===== NOTIFICATION CREATION =====

  async sendReportApprovedNotification(
    teacherId: string,
    reportData: {
      reportId: string;
      className: string;
      adminName: string;
      comments?: string;
    }
  ): Promise<boolean> {
    try {
      const template = this.templates.report_approved;
      const message = this.fillTemplate(template.messageTemplate, {
        className: reportData.className,
        adminName: reportData.adminName,
        comments: reportData.comments || 'No additional comments.'
      });

      await this.createNotification({
        type: 'report_approved',
        title: template.title,
        message,
        recipientId: teacherId,
        recipientRole: 'teacher',
        senderName: reportData.adminName,
        priority: template.priority as any,
        category: template.category as any,
        data: {
          reportId: reportData.reportId,
          className: reportData.className,
          actionRequired: false
        }
      });

      return true;
    } catch (error) {
      console.error('Error sending report approved notification:', error);
      return false;
    }
  }

  async sendReportRejectedNotification(
    teacherId: string,
    reportData: {
      reportId: string;
      className: string;
      reason: string;
      adminName: string;
    }
  ): Promise<boolean> {
    try {
      const template = this.templates.report_rejected;
      const message = this.fillTemplate(template.messageTemplate, {
        className: reportData.className,
        reason: reportData.reason
      });

      await this.createNotification({
        type: 'report_rejected',
        title: template.title,
        message,
        recipientId: teacherId,
        recipientRole: 'teacher',
        senderName: reportData.adminName,
        priority: template.priority as any,
        category: template.category as any,
        data: {
          reportId: reportData.reportId,
          className: reportData.className,
          actionRequired: true,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
        }
      });

      return true;
    } catch (error) {
      console.error('Error sending report rejected notification:', error);
      return false;
    }
  }

  async sendRevisionRequestNotification(
    teacherId: string,
    reportData: {
      reportId: string;
      className: string;
      comments: string;
      adminName: string;
    }
  ): Promise<boolean> {
    try {
      const template = this.templates.revision_requested;
      const message = this.fillTemplate(template.messageTemplate, {
        className: reportData.className,
        comments: reportData.comments
      });

      await this.createNotification({
        type: 'revision_requested',
        title: template.title,
        message,
        recipientId: teacherId,
        recipientRole: 'teacher',
        senderName: reportData.adminName,
        priority: template.priority as any,
        category: template.category as any,
        data: {
          reportId: reportData.reportId,
          className: reportData.className,
          actionRequired: true,
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
        }
      });

      return true;
    } catch (error) {
      console.error('Error sending revision request notification:', error);
      return false;
    }
  }

  async sendQualityAlertNotification(
    adminId: string,
    reportData: {
      reportId: string;
      teacherId: string;
      teacherName: string;
      className: string;
      qualityScore: number;
    }
  ): Promise<boolean> {
    try {
      const template = this.templates.quality_alert;
      const message = this.fillTemplate(template.messageTemplate, {
        teacherName: reportData.teacherName,
        qualityScore: reportData.qualityScore.toString()
      });

      await this.createNotification({
        type: 'quality_alert',
        title: template.title,
        message,
        recipientId: adminId,
        recipientRole: 'admin',
        priority: template.priority as any,
        category: template.category as any,
        data: {
          reportId: reportData.reportId,
          teacherId: reportData.teacherId,
          teacherName: reportData.teacherName,
          className: reportData.className,
          qualityScore: reportData.qualityScore,
          actionRequired: true
        }
      });

      return true;
    } catch (error) {
      console.error('Error sending quality alert notification:', error);
      return false;
    }
  }

  async sendProcessingReminderNotification(
    adminId: string,
    reportData: {
      reportId: string;
      teacherId: string;
      teacherName: string;
      className: string;
      daysPending: number;
    }
  ): Promise<boolean> {
    try {
      const template = this.templates.processing_reminder;
      const message = this.fillTemplate(template.messageTemplate, {
        teacherName: reportData.teacherName,
        className: reportData.className,
        days: reportData.daysPending.toString()
      });

      await this.createNotification({
        type: 'processing_reminder',
        title: template.title,
        message,
        recipientId: adminId,
        recipientRole: 'admin',
        priority: reportData.daysPending > 5 ? 'high' : 'medium',
        category: template.category as any,
        data: {
          reportId: reportData.reportId,
          teacherId: reportData.teacherId,
          teacherName: reportData.teacherName,
          className: reportData.className,
          processingTime: reportData.daysPending,
          actionRequired: true
        }
      });

      return true;
    } catch (error) {
      console.error('Error sending processing reminder notification:', error);
      return false;
    }
  }

  async sendWorkflowTriggeredNotification(
    adminId: string,
    workflowData: {
      workflowId: string;
      workflowName: string;
      reportId: string;
      teacherId: string;
      teacherName: string;
      action: string;
    }
  ): Promise<boolean> {
    try {
      const template = this.templates.workflow_triggered;
      const message = this.fillTemplate(template.messageTemplate, {
        workflowName: workflowData.workflowName,
        teacherName: workflowData.teacherName
      });

      await this.createNotification({
        type: 'workflow_triggered',
        title: template.title,
        message,
        recipientId: adminId,
        recipientRole: 'admin',
        priority: template.priority as any,
        category: template.category as any,
        data: {
          workflowId: workflowData.workflowId,
          reportId: workflowData.reportId,
          teacherId: workflowData.teacherId,
          teacherName: workflowData.teacherName,
          actionRequired: false
        }
      });

      return true;
    } catch (error) {
      console.error('Error sending workflow triggered notification:', error);
      return false;
    }
  }

  async sendBulkProcessingCompleteNotification(
    adminId: string,
    processingData: {
      totalCount: number;
      approvedCount: number;
      rejectedCount: number;
      adminName: string;
    }
  ): Promise<boolean> {
    try {
      const template = this.templates.bulk_processing_complete;
      const message = this.fillTemplate(template.messageTemplate, {
        count: processingData.totalCount.toString(),
        approved: processingData.approvedCount.toString(),
        rejected: processingData.rejectedCount.toString()
      });

      await this.createNotification({
        type: 'bulk_processing_complete',
        title: template.title,
        message,
        recipientId: adminId,
        recipientRole: 'admin',
        senderName: processingData.adminName,
        priority: template.priority as any,
        category: template.category as any,
        data: {
          actionRequired: false
        }
      });

      return true;
    } catch (error) {
      console.error('Error sending bulk processing complete notification:', error);
      return false;
    }
  }

  async sendSystemPerformanceAlert(
    adminId: string,
    performanceData: {
      issue: string;
      averageProcessingTime: number;
      severity: 'low' | 'medium' | 'high' | 'urgent';
    }
  ): Promise<boolean> {
    try {
      const template = this.templates.system_performance_alert;
      const message = this.fillTemplate(template.messageTemplate, {
        issue: performanceData.issue,
        avgTime: performanceData.averageProcessingTime.toFixed(1)
      });

      await this.createNotification({
        type: 'system_performance_alert',
        title: template.title,
        message,
        recipientId: adminId,
        recipientRole: 'admin',
        priority: performanceData.severity,
        category: template.category as any,
        data: {
          processingTime: performanceData.averageProcessingTime,
          actionRequired: true
        }
      });

      return true;
    } catch (error) {
      console.error('Error sending system performance alert:', error);
      return false;
    }
  }

  // ===== BULK NOTIFICATIONS =====

  async sendBulkNotifications(notifications: Omit<ReportNotification, 'id' | 'createdAt'>[]): Promise<boolean> {
    try {
      const batch = writeBatch(db);
      
      notifications.forEach(notification => {
        const docRef = doc(collection(db, this.getCollectionName(notification.recipientRole)));
        batch.set(docRef, {
          ...notification,
          createdAt: serverTimestamp(),
          isRead: false,
          isArchived: false
        });
      });

      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error sending bulk notifications:', error);
      return false;
    }
  }

  // ===== NOTIFICATION MANAGEMENT =====

  async getNotifications(
    userId: string, 
    userRole: 'admin' | 'teacher' | 'parent',
    filters?: {
      category?: string;
      priority?: string;
      isRead?: boolean;
      limit?: number;
    }
  ): Promise<ReportNotification[]> {
    try {
      const collectionName = this.getCollectionName(userRole);
      let q = query(
        collection(db, collectionName),
        where('recipientId', '==', userId)
      );

      if (filters?.category) {
        q = query(q, where('category', '==', filters.category));
      }

      if (filters?.priority) {
        q = query(q, where('priority', '==', filters.priority));
      }

      if (filters?.isRead !== undefined) {
        q = query(q, where('isRead', '==', filters.isRead));
      }

      const snapshot = await getDocs(q);
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as ReportNotification[];

      // Sort by creation date (newest first) and apply limit
      const sorted = notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      return filters?.limit ? sorted.slice(0, filters.limit) : sorted;
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }

  async markAsRead(notificationId: string, userRole: 'admin' | 'teacher' | 'parent'): Promise<boolean> {
    try {
      const collectionName = this.getCollectionName(userRole);
      const docRef = doc(db, collectionName, notificationId);
      
      await updateDoc(docRef, {
        isRead: true,
        readAt: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  async markAllAsRead(userId: string, userRole: 'admin' | 'teacher' | 'parent'): Promise<boolean> {
    try {
      const notifications = await this.getNotifications(userId, userRole, { isRead: false });
      const batch = writeBatch(db);
      const collectionName = this.getCollectionName(userRole);

      notifications.forEach(notification => {
        const docRef = doc(db, collectionName, notification.id);
        batch.update(docRef, {
          isRead: true,
          readAt: serverTimestamp()
        });
      });

      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  }

  async archiveNotification(notificationId: string, userRole: 'admin' | 'teacher' | 'parent'): Promise<boolean> {
    try {
      const collectionName = this.getCollectionName(userRole);
      const docRef = doc(db, collectionName, notificationId);
      
      await updateDoc(docRef, {
        isArchived: true,
        archivedAt: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error('Error archiving notification:', error);
      return false;
    }
  }

  async getUnreadCount(userId: string, userRole: 'admin' | 'teacher' | 'parent'): Promise<number> {
    try {
      const notifications = await this.getNotifications(userId, userRole, { isRead: false });
      return notifications.length;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // ===== HELPER METHODS =====

  private async createNotification(notification: Omit<ReportNotification, 'id' | 'createdAt' | 'isRead' | 'isArchived'>): Promise<string> {
    const collectionName = this.getCollectionName(notification.recipientRole);
    
    const docRef = await addDoc(collection(db, collectionName), {
      ...notification,
      createdAt: serverTimestamp(),
      isRead: false,
      isArchived: false
    });

    return docRef.id;
  }

  private getCollectionName(userRole: 'admin' | 'teacher' | 'parent'): string {
    switch (userRole) {
      case 'admin':
        return 'adminInbox';
      case 'teacher':
        return 'teacherInbox';
      case 'parent':
        return 'parentInbox';
      default:
        return 'notifications';
    }
  }

  private fillTemplate(template: string, variables: Record<string, string>): string {
    let result = template;
    
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      result = result.replace(new RegExp(placeholder, 'g'), value);
    });

    return result;
  }

  // ===== AUTOMATED NOTIFICATION TRIGGERS =====

  async setupAutomatedReminders(): Promise<void> {
    // This would typically be called by a scheduled function or cron job
    try {
      // Get all pending reports older than 3 days
      const pendingReports = await this.getPendingReportsForReminders();
      
      for (const report of pendingReports) {
        const daysPending = Math.floor((new Date().getTime() - report.submissionDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysPending >= 3) {
          await this.sendProcessingReminderNotification('admin-id', {
            reportId: report.id,
            teacherId: report.teacherId,
            teacherName: report.teacherName,
            className: report.className,
            daysPending
          });
        }
      }
    } catch (error) {
      console.error('Error setting up automated reminders:', error);
    }
  }

  private async getPendingReportsForReminders(): Promise<any[]> {
    // This would fetch pending reports from the database
    // For now, return empty array as this is a mock implementation
    return [];
  }
}

export const reportNotificationService = new ReportNotificationService();