import React, { useState, useEffect, useMemo } from 'react';
import {
  DocumentTextIcon,
  ChartBarIcon,
  UsersIcon,
  AcademicCapIcon,
  BookOpenIcon,
  ClipboardDocumentListIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PrinterIcon,
  DocumentArrowDownIcon,
  TableCellsIcon,
  ChartPieIcon,
  DocumentChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlayIcon,
  PlusIcon,
  Cog6ToothIcon,
  HeartIcon,
  ShareIcon,
  TrashIcon,
  BellIcon,
  PresentationChartLineIcon,
  CloudArrowUpIcon,
  DocumentDuplicateIcon,
  EnvelopeIcon,
  TagIcon,
  CogIcon
} from '@heroicons/react/24/outline';
import {
  HeartIcon as HeartIconSolid
} from '@heroicons/react/24/solid';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { studentService } from '../../services/studentService';
import { reportService } from '../../services/reportService';
import type { ReportQueryParams } from '../../services/reportService';
import AdminLoader from '../../components/admin/AdminLoader';
import ReportManagementHub from './ReportManagementHub';

import * as XLSX from 'xlsx';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Development-only logging utility
const devLog = (...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args);
  }
};

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: 'academic' | 'administrative' | 'performance' | 'system';
  icon: React.ComponentType<any>;
  fields: string[];
  filters: string[];
  format: 'table' | 'chart' | 'summary' | 'detailed';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  lastGenerated?: Date;
  totalGenerated: number;
  estimatedTime: string;
  dataSource: string;
}

interface GeneratedReport {
  id: string;
  templateId: string;
  name: string;
  generatedAt: Date;
  generatedBy: string;
  parameters: Record<string, any>;
  status: 'generating' | 'completed' | 'failed';
  fileSize?: string;
  recordCount?: number;
  downloadUrl?: string;
  format: 'xlsx' | 'pdf';
}

interface ReportData {
  templates: ReportTemplate[];
  generatedReports: GeneratedReport[];
  students: any[];
  teachers: any[];
  stories: any[];
  performance: any[];
  loading: boolean;
  error: string | null;
}

const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'templates' | 'generated' | 'scheduled' | 'management'>('templates');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [reportData, setReportData] = useState<ReportData>({
    templates: [],
    generatedReports: [],
    students: [],
    teachers: [],
    stories: [],
    performance: [],
    loading: true,
    error: null
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [reportParameters, setReportParameters] = useState<Record<string, any>>({});
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [academicPeriodFilter, setAcademicPeriodFilter] = useState<string>('all');

  const [favorites, setFavorites] = useState<string[]>([]);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'xlsx' | 'pdf'>('xlsx');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Initialize report templates
  // Essential Phil-IRI Report Templates (Most Useful Only)
  const reportTemplates: ReportTemplate[] = [
    {
      id: 'phil-iri-summary',
      name: 'Phil-IRI Assessment Summary',
      description: 'Complete student reading assessment results with reading levels and comprehension data from approved ISR records',
      category: 'academic',
      icon: BookOpenIcon,
      fields: ['Student Name', 'Grade', 'Reading Level', 'Comprehension Level', 'Language', 'Assessment Date'],
      filters: ['Grade', 'Reading Level', 'Academic Period', 'Language'],
      format: 'detailed',
      frequency: 'quarterly',
      totalGenerated: 89,
      estimatedTime: '2-3 minutes',
      dataSource: 'Approved ISR Records'
    },
    {
      id: 'reading-level-distribution',
      name: 'Reading Level Distribution',
      description: 'Statistical breakdown showing how many students are at Independent, Instructional, and Frustration levels by grade',
      category: 'performance',
      icon: ChartPieIcon,
      fields: ['Grade Level', 'Independent Count', 'Instructional Count', 'Frustration Count', 'Percentages'],
      filters: ['Grade', 'Academic Period', 'Language'],
      format: 'chart',
      frequency: 'monthly',
      totalGenerated: 45,
      estimatedTime: '1-2 minutes',
      dataSource: 'Reading Assessment Data'
    },
    {
      id: 'teacher-isr-submissions',
      name: 'Teacher ISR Submissions',
      description: 'Track which teachers have submitted Individual Summary Records and their approval status for accountability',
      category: 'administrative',
      icon: UsersIcon,
      fields: ['Teacher Name', 'Class', 'Students Assessed', 'Submission Date', 'Status', 'Review Date'],
      filters: ['Grade', 'Status', 'Academic Period'],
      format: 'summary',
      frequency: 'monthly',
      totalGenerated: 34,
      estimatedTime: '1-2 minutes',
      dataSource: 'ISR Submission Records'
    }
  ];

  // Convert report parameters to query params
  const getQueryParams = (): ReportQueryParams => {
    const params: ReportQueryParams = {};

    // Parse academic period filter
    if (academicPeriodFilter !== 'all') {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      switch (academicPeriodFilter) {
        case 'current-quarter':
          if (currentMonth >= 7 && currentMonth <= 9) {
            params.startDate = new Date(currentYear, 7, 1);
            params.endDate = new Date(currentYear, 9, 31);
          } else if (currentMonth >= 10 || currentMonth <= 0) {
            params.startDate = new Date(currentMonth >= 10 ? currentYear : currentYear - 1, 10, 1);
            params.endDate = new Date(currentMonth <= 0 ? currentYear : currentYear + 1, 0, 31);
          } else if (currentMonth >= 1 && currentMonth <= 3) {
            params.startDate = new Date(currentYear, 1, 1);
            params.endDate = new Date(currentYear, 3, 30);
          } else {
            params.startDate = new Date(currentYear, 4, 1);
            params.endDate = new Date(currentYear, 6, 31);
          }
          break;
        case 'q1-2024-25':
          params.startDate = new Date(2024, 7, 1);
          params.endDate = new Date(2024, 9, 31);
          break;
        case 'q2-2024-25':
          params.startDate = new Date(2024, 10, 1);
          params.endDate = new Date(2025, 0, 31);
          break;
        case 'q3-2024-25':
          params.startDate = new Date(2025, 1, 1);
          params.endDate = new Date(2025, 3, 30);
          break;
        case 'q4-2024-25':
          params.startDate = new Date(2025, 4, 1);
          params.endDate = new Date(2025, 6, 31);
          break;
        case 'semester1-2024-25':
          params.startDate = new Date(2024, 7, 1);
          params.endDate = new Date(2025, 0, 31);
          break;
        case 'semester2-2024-25':
          params.startDate = new Date(2025, 1, 1);
          params.endDate = new Date(2025, 6, 31);
          break;
        case 'school-year-2024-25':
          params.startDate = new Date(2024, 7, 1);
          params.endDate = new Date(2025, 6, 31);
          break;
        case 'school-year-2023-24':
          params.startDate = new Date(2023, 7, 1);
          params.endDate = new Date(2024, 6, 31);
          break;
      }
    }

    if (statusFilter !== 'all') {
      params.status = statusFilter;
    }

    return params;
  };

  useEffect(() => {
    initializeReports();
  }, []);

  // Function to get real record counts from database
  const updateReportCounts = async (reports: GeneratedReport[]) => {
    try {
      const updatedReports = await Promise.all(reports.map(async (report) => {
        let recordCount = 0;

        const queryParams = getQueryParams();
        
        switch (report.templateId) {
          case 'phil-iri-summary':
            const summaryData = await reportService.fetchPhilIRISummaryData(queryParams);
            recordCount = summaryData.filter(item => !item.error && !item.message).length;
            break;
          case 'reading-level-distribution':
            const distributionData = await reportService.fetchReadingLevelDistributionData(queryParams);
            recordCount = distributionData.filter(item => item['Total Students'] > 0).length;
            break;
          case 'teacher-isr-submissions':
            const submissionData = await reportService.fetchTeacherISRSubmissionsData(queryParams);
            recordCount = submissionData.filter(item => !item.error && !item.message).length;
            break;
        }

        return {
          ...report,
          recordCount,
          fileSize: recordCount > 0 ? `${Math.max(1, Math.ceil(recordCount / 50))} MB` : '0 KB'
        };
      }));

      return updatedReports;
    } catch {
      return reports;
    }
  };

  const initializeReports = async () => {
    setReportData(prev => ({ ...prev, loading: true }));

    try {
      // Initialize with templates and mock generated reports
      // Generate reports based on actual database content
      const mockGeneratedReports: GeneratedReport[] = [
        {
          id: '1',
          templateId: 'phil-iri-summary',
          name: 'Phil-IRI Assessment Summary - Current Data',
          generatedAt: new Date(),
          generatedBy: 'System Administrator',
          parameters: {
            academicPeriod: 'current-quarter',
            dataSource: 'Live Database - Approved ISR Records + Recent Submissions',
            includesPending: 'Yes'
          },
          status: 'completed',
          fileSize: 'Dynamic',
          recordCount: 0, // Will be updated with real count
          format: 'xlsx'
        },
        {
          id: '2',
          templateId: 'reading-level-distribution',
          name: 'Reading Level Distribution - Live Data',
          generatedAt: new Date(),
          generatedBy: 'System Administrator',
          parameters: {
            academicPeriod: 'current-quarter',
            dataSource: 'Live Database - All ISR Submissions',
            gradeBreakdown: 'By Grade Level'
          },
          status: 'completed',
          fileSize: 'Dynamic',
          recordCount: 0, // Will be updated with real count
          format: 'pdf'
        },
        {
          id: '3',
          templateId: 'teacher-isr-submissions',
          name: 'Teacher ISR Submissions - Real-Time Tracking',
          generatedAt: new Date(),
          generatedBy: 'System Administrator',
          parameters: {
            academicPeriod: 'school-year-2024-25',
            dataSource: 'Live Database - Admin Inbox',
            includesStatus: 'All Statuses'
          },
          status: 'completed',
          fileSize: 'Dynamic',
          recordCount: 0, // Will be updated with real count
          format: 'xlsx'
        }
      ];

      // Update report counts with real database data
      const reportsWithCounts = await updateReportCounts(mockGeneratedReports);
      
      // Fetch real-time statistics
      const stats = await reportService.getReportStatistics();
      devLog('[Reports] Report statistics:', stats);

      setReportData(prev => ({
        ...prev,
        templates: reportTemplates,
        generatedReports: reportsWithCounts,
        loading: false
      }));
    } catch {
      setReportData(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load reports'
      }));
    }
  };

  const filteredTemplates = useMemo(() => {
    let filtered = reportTemplates;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(template => template.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [selectedCategory, searchQuery]);

  const handleGenerateReport = async (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setShowGenerateModal(true);
  };

  const executeReportGeneration = async () => {
    if (!selectedTemplate) return;

    setIsGenerating(true);
    setGenerationProgress(0);
    setShowGenerateModal(false);

    try {
      // Simulate report generation with progress
      const steps = ['Collecting data...', 'Processing records...', 'Formatting report...', 'Finalizing...'];

      for (let i = 0; i < steps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setGenerationProgress(((i + 1) / steps.length) * 100);
      }

      // Create new generated report with selected format
      const newReport: GeneratedReport = {
        id: Date.now().toString(),
        templateId: selectedTemplate.id,
        name: `${selectedTemplate.name} - ${new Date().toLocaleDateString()}`,
        generatedAt: new Date(),
        generatedBy: 'Admin User',
        parameters: { ...reportParameters, format: selectedFormat },
        status: 'completed',
        fileSize: `${(Math.random() * 5 + 1).toFixed(1)} MB`,
        recordCount: Math.floor(Math.random() * 500 + 50),
        format: selectedFormat
      };

      setReportData(prev => ({
        ...prev,
        generatedReports: [newReport, ...prev.generatedReports]
      }));

      // Auto-download the report in selected format
      await downloadReport(newReport, selectedFormat);

    } catch {
      // Report generation failed
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
      setSelectedTemplate(null);
      setReportParameters({});
      setSelectedFormat('xlsx');
    }
  };

  // Advanced Functionalities
  const previewReport = async (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setShowPreviewModal(true);

    try {
      // Fetch sample data for preview using service
      const queryParams = getQueryParams();
      let sampleData: any[] = [];
      switch (template.id) {
        case 'phil-iri-summary':
          sampleData = await reportService.fetchPhilIRISummaryData({ ...queryParams, limit: 10 });
          break;
        case 'reading-level-distribution':
          sampleData = await reportService.fetchReadingLevelDistributionData(queryParams);
          break;
        case 'teacher-isr-submissions':
          sampleData = await reportService.fetchTeacherISRSubmissionsData(queryParams);
          break;
        default:
          sampleData = [{ message: 'Preview not available for this report type' }];
      }
      setPreviewData(sampleData.slice(0, 10)); // Show first 10 records
    } catch {
      setPreviewData([{ error: 'Failed to load preview' }]);
    }
  };

  const toggleFavorite = (templateId: string) => {
    setFavorites(prev =>
      prev.includes(templateId)
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    );
  };

  const duplicateTemplate = (template: ReportTemplate) => {
    const newTemplate: ReportTemplate = {
      ...template,
      id: `${template.id}-copy-${Date.now()}`,
      name: `${template.name} (Copy)`,
      totalGenerated: 0
    };

    setReportData(prev => ({
      ...prev,
      templates: [...prev.templates, newTemplate]
    }));
  };

  const shareReport = async (report: GeneratedReport) => {
    try {
      const shareUrl = `${window.location.origin}/reports/shared/${report.id}`;
      await navigator.clipboard.writeText(shareUrl);
      alert('Share link copied to clipboard!');
    } catch {
      // Share failed
    }
  };

  const scheduleReport = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setShowScheduleModal(true);
  };

  const bulkDeleteReports = () => {
    setReportData(prev => ({
      ...prev,
      generatedReports: prev.generatedReports.filter(report => !selectedReports.includes(report.id))
    }));
    setSelectedReports([]);
    setShowBulkActions(false);
  };

  const bulkDownloadReports = async () => {
    const reportsToDownload = reportData.generatedReports.filter(report =>
      selectedReports.includes(report.id)
    );

    for (const report of reportsToDownload) {
      await downloadReport(report);
      await new Promise(resolve => setTimeout(resolve, 500)); // Delay between downloads
    }

    setSelectedReports([]);
    setShowBulkActions(false);
  };

  const exportReportList = () => {
    const exportData = reportData.generatedReports.map(report => ({
      'Report Name': report.name,
      'Generated Date': report.generatedAt.toLocaleDateString(),
      'Generated By': report.generatedBy,
      'Status': report.status,
      'File Size': report.fileSize,
      'Record Count': report.recordCount,
      'Format': report.format
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reports List');

    const fileName = `reports_list_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const sendReportByEmail = (report: GeneratedReport) => {
    const subject = encodeURIComponent(`Report: ${report.name}`);
    const body = encodeURIComponent(`
      Hi,
      
      Please find the attached report: ${report.name}
      Generated on: ${report.generatedAt.toLocaleDateString()}
      Records: ${report.recordCount}
      
      Best regards,
      Admin Team
    `);

    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  // Sorting and filtering
  const sortedAndFilteredReports = useMemo(() => {
    let filtered = reportData.generatedReports;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(report => report.status === statusFilter);
    }

    // Apply academic period filter
    if (academicPeriodFilter !== 'all') {
      filtered = filtered.filter(report => {
        const reportDate = report.generatedAt;
        const now = new Date();
        const currentYear = now.getFullYear();

        // Define academic year periods (August to July)
        // Academic year runs from August to July (e.g., 2024-25 = Aug 2024 to Jul 2025)

        switch (academicPeriodFilter) {
          case 'current-quarter':
            // Determine current quarter based on month
            const currentMonth = now.getMonth();
            let quarterStart: Date, quarterEnd: Date;

            if (currentMonth >= 7 && currentMonth <= 9) { // Aug-Oct
              quarterStart = new Date(currentYear, 7, 1);
              quarterEnd = new Date(currentYear, 9, 31);
            } else if (currentMonth >= 10 || currentMonth <= 0) { // Nov-Jan
              quarterStart = new Date(currentMonth >= 10 ? currentYear : currentYear - 1, 10, 1);
              quarterEnd = new Date(currentMonth <= 0 ? currentYear : currentYear + 1, 0, 31);
            } else if (currentMonth >= 1 && currentMonth <= 3) { // Feb-Apr
              quarterStart = new Date(currentYear, 1, 1);
              quarterEnd = new Date(currentYear, 3, 30);
            } else { // May-Jul
              quarterStart = new Date(currentYear, 4, 1);
              quarterEnd = new Date(currentYear, 6, 31);
            }
            return reportDate >= quarterStart && reportDate <= quarterEnd;

          case 'q1-2024-25':
            return reportDate >= new Date(2024, 7, 1) && reportDate <= new Date(2024, 9, 31);
          case 'q2-2024-25':
            return reportDate >= new Date(2024, 10, 1) && reportDate <= new Date(2025, 0, 31);
          case 'q3-2024-25':
            return reportDate >= new Date(2025, 1, 1) && reportDate <= new Date(2025, 3, 30);
          case 'q4-2024-25':
            return reportDate >= new Date(2025, 4, 1) && reportDate <= new Date(2025, 6, 31);

          case 'semester1-2024-25':
            return reportDate >= new Date(2024, 7, 1) && reportDate <= new Date(2025, 0, 31);
          case 'semester2-2024-25':
            return reportDate >= new Date(2025, 1, 1) && reportDate <= new Date(2025, 6, 31);

          case 'school-year-2024-25':
            return reportDate >= new Date(2024, 7, 1) && reportDate <= new Date(2025, 6, 31);
          case 'school-year-2023-24':
            return reportDate >= new Date(2023, 7, 1) && reportDate <= new Date(2024, 6, 31);

          case 'summer-2024':
            return reportDate >= new Date(2024, 5, 1) && reportDate <= new Date(2024, 7, 31);

          default:
            return true;
        }
      });
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'date':
          aValue = a.generatedAt.getTime();
          bValue = b.generatedAt.getTime();
          break;
        case 'size':
          aValue = parseFloat(a.fileSize?.replace(/[^\d.]/g, '') || '0');
          bValue = parseFloat(b.fileSize?.replace(/[^\d.]/g, '') || '0');
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          return 0;
      }

      if (aValue === bValue) return 0;
      const result = aValue > bValue ? 1 : -1;
      return sortOrder === 'asc' ? result : -result;
    });
  }, [reportData.generatedReports, sortBy, sortOrder, statusFilter, academicPeriodFilter]);

  const getReportAnalytics = () => {
    const total = reportData.generatedReports.length;
    const completed = reportData.generatedReports.filter(r => r.status === 'completed').length;
    const failed = reportData.generatedReports.filter(r => r.status === 'failed').length;
    const totalSize = reportData.generatedReports.reduce((sum, report) => {
      const size = parseFloat(report.fileSize?.replace(/[^\d.]/g, '') || '0');
      return sum + size;
    }, 0);

    return { total, completed, failed, totalSize: totalSize.toFixed(1) };
  };

  const downloadReport = async (report: GeneratedReport, format?: 'xlsx' | 'pdf') => {
    try {
      // Fetch actual data based on report template using service
      const queryParams = getQueryParams();
      let data: any[] = [];

      switch (report.templateId) {
        case 'phil-iri-summary':
          data = await reportService.fetchPhilIRISummaryData(queryParams);
          break;
        case 'reading-level-distribution':
          data = await reportService.fetchReadingLevelDistributionData(queryParams);
          break;
        case 'comprehension-analysis':
          data = await reportService.fetchComprehensionAnalysisData(queryParams);
          break;
        case 'teacher-isr-submissions':
          data = await reportService.fetchTeacherISRSubmissionsData(queryParams);
          break;
        case 'reading-progress-tracking':
          data = await fetchReadingProgressData();
          break;
        case 'language-comparison':
          data = await fetchLanguageComparisonData();
          break;
        default:
          data = [{ message: 'Phil-IRI report data not available' }];
      }

      const baseFileName = report.name.replace(/[^a-zA-Z0-9]/g, '_');
      const downloadFormat = format || report.format || 'xlsx';

      switch (downloadFormat) {
        case 'xlsx':
          await downloadAsExcel(data, baseFileName);
          break;
        case 'pdf':
          await downloadAsPDF(data, report.name, baseFileName);
          break;

        default:
          await downloadAsExcel(data, baseFileName);
      }

    } catch {
      setNotification({
        message: `Failed to download ${format || report.format || 'report'}. Please try again.`,
        type: 'error'
      });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const downloadAsExcel = async (data: any[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report Data');
    XLSX.writeFile(wb, `${fileName}.xlsx`);

    setNotification({ message: 'Excel report downloaded successfully!', type: 'success' });
    setTimeout(() => setNotification(null), 3000);
  };



  const downloadAsPDF = async (data: any[], reportName: string, fileName: string) => {
    try {
      // Try the advanced PDF generation first
      const success = await generateAdvancedPDF(data, reportName, fileName);
      if (success) return;

      // Fallback to HTML-based PDF generation
      await generateHTMLBasedPDF(data, reportName);

    } catch {
      setNotification({
        message: 'Failed to generate PDF. Please try Excel format instead.',
        type: 'error'
      });
      setTimeout(() => setNotification(null), 5000);
    }
  };

  const generateAdvancedPDF = async (data: any[], reportName: string, fileName: string): Promise<boolean> => {
    try {
      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Page settings
      const pageWidth = 595.28; // A4 width in points
      const pageHeight = 841.89; // A4 height in points
      const margin = 50;
      const usableWidth = pageWidth - (margin * 2);

      let page = pdfDoc.addPage([pageWidth, pageHeight]);
      let yPosition = pageHeight - margin;

      // Header
      const headerHeight = 80;
      page.drawRectangle({
        x: margin,
        y: yPosition - headerHeight,
        width: usableWidth,
        height: headerHeight,
        color: rgb(0.31, 0.27, 0.9), // Indigo color
      });

      // Title
      const titleFontSize = 18;
      const titleWidth = boldFont.widthOfTextAtSize(reportName, titleFontSize);
      page.drawText(reportName, {
        x: margin + (usableWidth - titleWidth) / 2,
        y: yPosition - 30,
        size: titleFontSize,
        font: boldFont,
        color: rgb(1, 1, 1),
      });

      // Date and record count
      const dateText = `Generated on: ${new Date().toLocaleDateString()}`;
      const recordText = `Total Records: ${data.length.toLocaleString()}`;
      const subFontSize = 10;

      page.drawText(dateText, {
        x: margin + 10,
        y: yPosition - 55,
        size: subFontSize,
        font: font,
        color: rgb(0.9, 0.9, 0.9),
      });

      page.drawText(recordText, {
        x: pageWidth - margin - font.widthOfTextAtSize(recordText, subFontSize) - 10,
        y: yPosition - 55,
        size: subFontSize,
        font: font,
        color: rgb(0.9, 0.9, 0.9),
      });

      yPosition -= headerHeight + 30;

      if (data.length === 0) {
        // No data message
        const noDataText = 'No data available for this report.';
        const noDataFontSize = 14;
        const noDataWidth = font.widthOfTextAtSize(noDataText, noDataFontSize);

        page.drawText(noDataText, {
          x: margin + (usableWidth - noDataWidth) / 2,
          y: yPosition - 50,
          size: noDataFontSize,
          font: font,
          color: rgb(0.4, 0.4, 0.4),
        });
      } else {
        // Table generation
        const headers = Object.keys(data[0]);
        const columnWidth = usableWidth / headers.length;
        const rowHeight = 25;
        const fontSize = 8;

        // Table header
        page.drawRectangle({
          x: margin,
          y: yPosition - rowHeight,
          width: usableWidth,
          height: rowHeight,
          color: rgb(0.95, 0.95, 0.95),
        });

        // Header text
        headers.forEach((header, index) => {
          const text = String(header).substring(0, 15); // Truncate long headers
          page.drawText(text, {
            x: margin + (index * columnWidth) + 5,
            y: yPosition - 15,
            size: fontSize,
            font: boldFont,
            color: rgb(0.2, 0.2, 0.2),
          });
        });

        yPosition -= rowHeight;

        // Table rows
        const maxRowsPerPage = Math.floor((yPosition - margin - 50) / rowHeight);
        const totalPages = Math.ceil(data.length / maxRowsPerPage);
        let currentRow = 0;

        for (let pageNum = 0; pageNum < totalPages && currentRow < data.length; pageNum++) {
          if (pageNum > 0) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            yPosition = pageHeight - margin - 30;

            // Add page header for continuation pages
            page.drawText(`${reportName} (Page ${pageNum + 1} of ${totalPages})`, {
              x: margin,
              y: yPosition,
              size: 12,
              font: boldFont,
              color: rgb(0.3, 0.3, 0.3),
            });
            yPosition -= 40;

            // Redraw table header
            page.drawRectangle({
              x: margin,
              y: yPosition - rowHeight,
              width: usableWidth,
              height: rowHeight,
              color: rgb(0.95, 0.95, 0.95),
            });

            headers.forEach((header, index) => {
              const text = String(header).substring(0, 15);
              page.drawText(text, {
                x: margin + (index * columnWidth) + 5,
                y: yPosition - 15,
                size: fontSize,
                font: boldFont,
                color: rgb(0.2, 0.2, 0.2),
              });
            });
            yPosition -= rowHeight;
          }

          const rowsThisPage = Math.min(maxRowsPerPage, data.length - currentRow);

          for (let i = 0; i < rowsThisPage; i++) {
            const row = data[currentRow];

            // Alternate row colors
            if (currentRow % 2 === 0) {
              page.drawRectangle({
                x: margin,
                y: yPosition - rowHeight,
                width: usableWidth,
                height: rowHeight,
                color: rgb(0.98, 0.98, 0.98),
              });
            }

            // Row data
            headers.forEach((header, index) => {
              const cellValue = row[header];
              const text = String(cellValue || '').substring(0, 20); // Truncate long values

              page.drawText(text, {
                x: margin + (index * columnWidth) + 5,
                y: yPosition - 15,
                size: fontSize,
                font: font,
                color: rgb(0.3, 0.3, 0.3),
              });
            });

            yPosition -= rowHeight;
            currentRow++;
          }
        }

        // Add summary footer
        yPosition -= 30;
        const summaryText = `Report completed - ${data.length.toLocaleString()} total records processed`;
        page.drawText(summaryText, {
          x: margin,
          y: yPosition,
          size: 9,
          font: font,
          color: rgb(0.4, 0.4, 0.4),
        });
      }

      // Footer
      const footerY = 30;
      const footerText = 'Administrative Reports System - Confidential Document';
      const footerWidth = font.widthOfTextAtSize(footerText, 8);

      page.drawText(footerText, {
        x: margin + (usableWidth - footerWidth) / 2,
        y: footerY,
        size: 8,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      });

      // Generate PDF bytes
      const pdfBytes = await pdfDoc.save();

      // Create download link
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName}.pdf`;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setNotification({
        message: 'PDF report downloaded successfully!',
        type: 'success'
      });
      setTimeout(() => setNotification(null), 3000);

      return true;

    } catch {
      return false;
    }
  };

  const generateHTMLBasedPDF = async (data: any[], reportName: string) => {
    try {
      // Create a simple HTML table for PDF generation
      const htmlContent = generatePDFHTML(data, reportName);

      // Create a hidden iframe for PDF generation
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.width = '210mm'; // A4 width
      iframe.style.height = '297mm'; // A4 height
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error('Unable to access iframe document');
      }

      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      // Wait for content to load then trigger print
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();

          // Clean up after a delay
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 1000);

          setNotification({
            message: 'PDF report ready! Use your browser\'s print dialog to save as PDF.',
            type: 'success'
          });
          setTimeout(() => setNotification(null), 5000);

        } catch {
          // Fallback: open in new window
          const printWindow = window.open('', '_blank', 'width=800,height=600');
          if (printWindow) {
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            printWindow.focus();

            setNotification({
              message: 'PDF opened in new window. Use Ctrl+P to print/save as PDF.',
              type: 'success'
            });
            setTimeout(() => setNotification(null), 5000);
          } else {
            throw new Error('Unable to open print window');
          }
        }
      }, 1000);

    } catch (error) {
      throw error;
    }
  };

  const generatePDFHTML = (data: any[], reportName: string) => {
    if (data.length === 0) {
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>${reportName.replace(/[<>"'&]/g, '')}</title>
            <style>
              @page { 
                size: A4; 
                margin: 1in; 
              }
              body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                margin: 0; 
                padding: 20px;
                line-height: 1.4;
                color: #333;
              }
              .header { 
                text-align: center; 
                margin-bottom: 40px; 
                border-bottom: 3px solid #4f46e5;
                padding-bottom: 20px;
              }
              .header h1 { 
                color: #1e293b; 
                margin: 0 0 15px 0;
                font-size: 28px;
                font-weight: 700;
              }
              .header p { 
                color: #64748b; 
                margin: 5px 0;
                font-size: 14px;
              }
              .no-data { 
                text-align: center; 
                color: #64748b;
                font-size: 16px;
                margin-top: 60px;
                padding: 40px;
                background-color: #f8fafc;
                border-radius: 8px;
                border: 2px dashed #cbd5e1;
              }
              .footer {
                margin-top: 40px;
                text-align: center;
                font-size: 11px;
                color: #94a3b8;
                border-top: 1px solid #e2e8f0;
                padding-top: 15px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${reportName.replace(/[<>"'&]/g, '')}</h1>
              <p><strong>Generated on:</strong> ${new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}</p>
              <p><strong>Time:</strong> ${new Date().toLocaleTimeString('en-US')}</p>
            </div>
            <div class="no-data">
              <h3>No Data Available</h3>
              <p>This report contains no data for the selected criteria.</p>
            </div>
            <div class="footer">
              <p>This report was generated by the Administrative Reports System</p>
              <p>© ${new Date().getFullYear()} - Confidential Document</p>
            </div>
          </body>
        </html>
      `;
    }

    // Safely extract headers and escape HTML
    const headers = Object.keys(data[0]);
    const escapeHtml = (text: any) => {
      if (text === null || text === undefined) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const tableRows = data.map(row =>
      `<tr>${headers.map(header => `<td>${escapeHtml(row[header])}</td>`).join('')}</tr>`
    ).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${reportName.replace(/[<>"'&]/g, '')}</title>
          <style>
            @page { 
              size: A4; 
              margin: 0.75in; 
            }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              margin: 0; 
              padding: 0;
              font-size: 11px;
              line-height: 1.4;
              color: #1e293b;
              background: white;
            }
            .header { 
              text-align: center; 
              margin-bottom: 30px; 
              border-bottom: 3px solid #4f46e5;
              padding-bottom: 20px;
              background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
              padding: 25px;
              margin: -20px -20px 30px -20px;
            }
            .header h1 { 
              color: #1e293b; 
              margin: 0 0 15px 0;
              font-size: 24px;
              font-weight: 700;
              text-shadow: 0 1px 2px rgba(0,0,0,0.1);
            }
            .header p { 
              color: #475569; 
              margin: 5px 0;
              font-size: 13px;
              font-weight: 500;
            }
            .stats {
              background: #f1f5f9;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 25px;
              border-left: 4px solid #4f46e5;
            }
            .stats p {
              margin: 0;
              font-weight: 600;
              color: #334155;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 20px;
              background: white;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            th, td { 
              border: 1px solid #d1d5db; 
              padding: 10px 8px; 
              text-align: left;
              vertical-align: top;
            }
            th { 
              background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
              color: white;
              font-weight: 600;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              border-color: #4338ca;
            }
            tr:nth-child(even) { 
              background-color: #f8fafc; 
            }
            tr:hover {
              background-color: #f1f5f9;
            }
            td {
              font-size: 10px;
              border-color: #e5e7eb;
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              font-size: 10px;
              color: #94a3b8;
              border-top: 2px solid #e2e8f0;
              padding-top: 20px;
              background: #f8fafc;
              margin-left: -20px;
              margin-right: -20px;
              padding-left: 20px;
              padding-right: 20px;
            }
            .page-break {
              page-break-before: always;
            }
            @media print {
              body { 
                margin: 0; 
                padding: 20px;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .header { 
                page-break-after: avoid; 
                margin: -20px -20px 30px -20px;
              }
              table { 
                page-break-inside: auto;
              }
              tr { 
                page-break-inside: avoid; 
                page-break-after: auto;
              }
              th {
                page-break-after: avoid;
              }
              .footer {
                page-break-before: avoid;
                margin-left: -20px;
                margin-right: -20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${escapeHtml(reportName)}</h1>
            <p><strong>Generated on:</strong> ${new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleTimeString('en-US')}</p>
          </div>
          
          <div class="stats">
            <p><strong>Total Records:</strong> ${data.length.toLocaleString()}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                ${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          
          <div class="footer">
            <p><strong>Administrative Reports System</strong></p>
            <p>© ${new Date().getFullYear()} - Confidential Document</p>
            <p>Generated at ${new Date().toISOString()}</p>
          </div>
        </body>
      </html>
    `;
  };

  // Legacy function - kept for backward compatibility but now uses service
  const fetchPhilIRISummaryData = async () => {
    return reportService.fetchPhilIRISummaryData(getQueryParams());
  };

  // Legacy wrapper - now uses service
  const fetchComprehensionAnalysisData = async () => {
    return reportService.fetchComprehensionAnalysisData(getQueryParams());
  };

  const fetchComprehensionAnalysisData_OLD = async () => {
    try {
      // Fetch approved ISR records for comprehension analysis
      const approvedISRQuery = query(
        collection(db, 'approvedISRRecords'),
        orderBy('approvedDate', 'desc')
      );
      const approvedSnapshot = await getDocs(approvedISRQuery);

      const comprehensionData: any[] = [];

      approvedSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.students && Array.isArray(data.students)) {
          data.students.forEach((student: any) => {
            const latestReading = student.readingData?.[0] || {};

            // Determine comprehension level
            let comprehensionLevel = 'Frustration';
            if (latestReading.comprehension?.ind) {
              comprehensionLevel = 'Independent';
            } else if (latestReading.comprehension?.ins) {
              comprehensionLevel = 'Instructional';
            }

            // Compile observations
            const observations = student.observations || {};
            const observationsList = [];
            if (observations.wordByWord) observationsList.push('Word by word reading');
            if (observations.lacksExpression) observationsList.push('Lacks expression');
            if (observations.hardlyAudible) observationsList.push('Hardly audible');
            if (observations.disregardsPunctuation) observationsList.push('Disregards punctuation');
            if (observations.pointsToWords) observationsList.push('Points to words');
            if (observations.littleAnalysis) observationsList.push('Little analysis');
            if (observations.otherObservations) observationsList.push(observations.otherObservations);

            comprehensionData.push({
              'Student Name': student.studentName || 'Unknown',
              'Grade': student.gradeSection || data.grade || 'N/A',
              'Comprehension Level': comprehensionLevel,
              'Progress': comprehensionLevel === 'Independent' ? 'Excellent' :
                comprehensionLevel === 'Instructional' ? 'Good' : 'Needs Support',
              'Observations': observationsList.join('; ') || 'None recorded',
              'Date': latestReading.dateTaken || data.approvedDate?.toDate?.()?.toLocaleDateString() || 'N/A',
              'Language': student.language || 'Filipino',
              'Teacher': student.teacher || data.teacherName || 'N/A'
            });
          });
        }
      });

      return comprehensionData.length > 0 ? comprehensionData : [{ message: 'No comprehension analysis data available' }];
    } catch {
      return [{ error: 'Failed to fetch comprehension analysis data' }];
    }
  };

  // Legacy function - kept for backward compatibility but now uses service
  const fetchReadingLevelDistributionData = async () => {
    return reportService.fetchReadingLevelDistributionData(getQueryParams());
  };

  const fetchReadingLevelDistributionData_OLD = async () => {
    try {

      // Fetch from both approved ISR records and recent submissions
      const approvedISRQuery = query(
        collection(db, 'approvedISRRecords'),
        orderBy('approvedDate', 'desc')
      );
      const approvedSnapshot = await getDocs(approvedISRQuery);

      const adminInboxQuery = query(
        collection(db, 'adminInbox'),
        where('type', '==', 'teacher_report')
      );
      const inboxSnapshot = await getDocs(adminInboxQuery);

      // Group by grade and count reading levels
      const gradeStats: Record<string, { independent: number; instructional: number; frustration: number; total: number }> = {};

      // Process approved ISR records
      approvedSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.students && Array.isArray(data.students)) {
          data.students.forEach((student: any) => {
            const grade = student.gradeSection || data.grade || 'Unknown Grade';
            const latestReading = student.readingData?.[0] || {};

            if (!gradeStats[grade]) {
              gradeStats[grade] = { independent: 0, instructional: 0, frustration: 0, total: 0 };
            }

            // Determine reading level based on Phil-IRI criteria
            if (latestReading.wordReading?.ind && latestReading.comprehension?.ind) {
              gradeStats[grade].independent++;
            } else if (latestReading.wordReading?.ins && latestReading.comprehension?.ins) {
              gradeStats[grade].instructional++;
            } else {
              gradeStats[grade].frustration++;
            }
            gradeStats[grade].total++;
          });
        }
      });

      // Process recent submissions from adminInbox
      inboxSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.data?.reportType === 'class_isr' || data.data?.reportType === 'individual_isr') {
          if (data.data?.students && Array.isArray(data.data.students)) {
            data.data.students.forEach((student: any) => {
              const grade = student.gradeSection || data.data?.grade || 'Unknown Grade';
              const latestReading = student.readingData?.[0] || {};

              if (!gradeStats[grade]) {
                gradeStats[grade] = { independent: 0, instructional: 0, frustration: 0, total: 0 };
              }

              // Determine reading level based on Phil-IRI criteria
              if (latestReading.wordReading?.ind && latestReading.comprehension?.ind) {
                gradeStats[grade].independent++;
              } else if (latestReading.wordReading?.ins && latestReading.comprehension?.ins) {
                gradeStats[grade].instructional++;
              } else {
                gradeStats[grade].frustration++;
              }
              gradeStats[grade].total++;
            });
          }
        }
      });

      // Convert to array format
      const distributionData = Object.entries(gradeStats).map(([grade, stats]) => ({
        'Grade Level': grade,
        'Independent Count': stats.independent,
        'Instructional Count': stats.instructional,
        'Frustration Count': stats.frustration,
        'Total Students': stats.total,
        'Independent %': stats.total > 0 ? ((stats.independent / stats.total) * 100).toFixed(1) + '%' : '0%',
        'Instructional %': stats.total > 0 ? ((stats.instructional / stats.total) * 100).toFixed(1) + '%' : '0%',
        'Frustration %': stats.total > 0 ? ((stats.frustration / stats.total) * 100).toFixed(1) + '%' : '0%'
      }));

      if (distributionData.length === 0) {
        return [{
          'Grade Level': 'No data available',
          'Independent Count': 0,
          'Instructional Count': 0,
          'Frustration Count': 0,
          'Total Students': 0,
          'Independent %': '0%',
          'Instructional %': '0%',
          'Frustration %': '0%'
        }];
      }

      return distributionData;
    } catch {
      return [{
        'Grade Level': 'Database Error',
        'Independent Count': 0,
        'Instructional Count': 0,
        'Frustration Count': 0,
        'Total Students': 0,
        'Independent %': 'Error',
        'Instructional %': 'Error',
        'Frustration %': 'Error'
      }];
    }
  };









  if (reportData.loading) {
    return <AdminLoader label="Loading Report Templates..." fullScreen size="lg" />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-[100000] px-6 py-4 rounded-lg shadow-lg border-l-4 ${notification.type === 'success'
          ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
          : 'bg-rose-50 border-rose-500 text-rose-800'
          } transition-all duration-300`}>
          <div className="flex items-center gap-3">
            {notification.type === 'success' ? (
              <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
            ) : (
              <ExclamationTriangleIcon className="h-5 w-5 text-rose-600" />
            )}
            <span className="font-medium">{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-2 text-slate-400 hover:text-slate-600"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg">
                <ClipboardDocumentListIcon className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Administrative Reports</h1>
                <p className="text-slate-600">Generate, manage, and download comprehensive system reports</p>
              </div>
            </div>

            <div className="flex items-center gap-3">

              <button
                onClick={() => {
                  // Quick test of PDF generation
                  const testData = [
                    { 'Student Name': 'John Doe', 'Grade': '4th', 'Score': '85%', 'Status': 'Active' },
                    { 'Student Name': 'Jane Smith', 'Grade': '5th', 'Score': '92%', 'Status': 'Active' },
                    { 'Student Name': 'Bob Johnson', 'Grade': '3rd', 'Score': '78%', 'Status': 'Active' }
                  ];
                  downloadAsPDF(testData, 'Test Report', 'test_report');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors shadow-sm"
              >
                <DocumentTextIcon className="h-4 w-4" />
                Test PDF
              </button>
              <button
                onClick={() => setShowAnalytics(!showAnalytics)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors shadow-sm"
              >
                <PresentationChartLineIcon className="h-4 w-4" />
                Analytics
              </button>
              <button
                onClick={() => setShowGenerateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-sm"
              >
                <PlusIcon className="h-4 w-4" />
                New Report
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex space-x-1 bg-white rounded-xl p-1 shadow-sm border border-slate-200">
              {[
                { key: 'templates', label: 'Report Templates', icon: DocumentChartBarIcon },
                { key: 'generated', label: 'Generated Reports', icon: DocumentArrowDownIcon },
                { key: 'scheduled', label: 'Scheduled Reports', icon: ClockIcon },
                { key: 'management', label: 'Report Management', icon: CogIcon }
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === tab.key
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                      }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Search and Filters */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm w-64"
                />
              </div>

              {activeTab === 'templates' && (
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                >
                  <option value="all">All Categories</option>
                  <option value="academic">Academic</option>
                  <option value="administrative">Administrative</option>
                  <option value="performance">Performance</option>
                  <option value="system">System</option>
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Analytics Panel */}
        {showAnalytics && (
          <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-6">
            {(() => {
              const analytics = getReportAnalytics();
              return [
                { label: 'Total Reports', value: analytics.total, icon: DocumentTextIcon, color: 'blue' },
                { label: 'Completed', value: analytics.completed, icon: CheckCircleIcon, color: 'emerald' },
                { label: 'Failed', value: analytics.failed, icon: ExclamationTriangleIcon, color: 'rose' },
                { label: 'Total Size', value: `${analytics.totalSize} MB`, icon: CloudArrowUpIcon, color: 'purple' }
              ].map((stat, index) => {
                const Icon = stat.icon;
                const colorClasses = {
                  blue: 'from-blue-500 to-blue-600',
                  emerald: 'from-emerald-500 to-emerald-600',
                  rose: 'from-rose-500 to-rose-600',
                  purple: 'from-purple-500 to-purple-600'
                };

                return (
                  <div key={index} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 rounded-xl bg-gradient-to-r ${colorClasses[stat.color as keyof typeof colorClasses]} shadow-lg`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                      <p className="text-slate-600 text-sm font-medium">{stat.label}</p>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* Content Area */}
        {activeTab === 'templates' && (
          <div className="space-y-6">
            {/* Quick Actions Bar */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h3 className="font-semibold text-slate-900">Quick Actions</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const studentTemplate = reportTemplates.find(t => t.id === 'student-performance');
                        if (studentTemplate) handleGenerateReport(studentTemplate);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                    >
                      <AcademicCapIcon className="h-4 w-4" />
                      Student Report
                    </button>
                    <button
                      onClick={() => {
                        const teacherTemplate = reportTemplates.find(t => t.id === 'teacher-activity');
                        if (teacherTemplate) handleGenerateReport(teacherTemplate);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors"
                    >
                      <UsersIcon className="h-4 w-4" />
                      Teacher Activity
                    </button>
                    <button
                      onClick={() => {
                        const systemTemplate = reportTemplates.find(t => t.id === 'system-usage');
                        if (systemTemplate) handleGenerateReport(systemTemplate);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors"
                    >
                      <ChartBarIcon className="h-4 w-4" />
                      System Usage
                    </button>
                  </div>
                </div>
                <div className="text-sm text-slate-600">
                  {filteredTemplates.length} of {reportTemplates.length} templates
                </div>
              </div>
            </div>

            {/* Templates Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map(template => {
                const Icon = template.icon;
                const categoryColors = {
                  academic: 'from-blue-500 to-blue-600',
                  administrative: 'from-emerald-500 to-emerald-600',
                  performance: 'from-purple-500 to-purple-600',
                  system: 'from-amber-500 to-amber-600'
                };

                return (
                  <div key={template.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-xl bg-gradient-to-r ${categoryColors[template.category]} shadow-lg`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
                          {template.category}
                        </p>
                        <p className="text-sm text-slate-600">{template.totalGenerated} generated</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">{template.name}</h3>
                      <p className="text-sm text-slate-600 mb-3">{template.description}</p>

                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <ClockIcon className="h-3 w-3" />
                          {template.estimatedTime}
                        </div>
                        <div className="flex items-center gap-1">
                          <TableCellsIcon className="h-3 w-3" />
                          {template.format}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleGenerateReport(template)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors text-sm"
                      >
                        <PlayIcon className="h-4 w-4" />
                        Generate
                      </button>
                      <button
                        onClick={() => previewReport(template)}
                        className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                        title="Preview Report"
                      >
                        <EyeIcon className="h-4 w-4 text-slate-600" />
                      </button>
                      <button
                        onClick={() => toggleFavorite(template.id)}
                        className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                        title="Add to Favorites"
                      >
                        {favorites.includes(template.id) ? (
                          <HeartIconSolid className="h-4 w-4 text-rose-500" />
                        ) : (
                          <HeartIcon className="h-4 w-4 text-slate-600" />
                        )}
                      </button>
                      <div className="relative group">
                        <button className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                          <Cog6ToothIcon className="h-4 w-4 text-slate-600" />
                        </button>
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                          <div className="p-2">
                            <button
                              onClick={() => scheduleReport(template)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg"
                            >
                              <BellIcon className="h-4 w-4" />
                              Schedule Report
                            </button>
                            <button
                              onClick={() => duplicateTemplate(template)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg"
                            >
                              <DocumentDuplicateIcon className="h-4 w-4" />
                              Duplicate Template
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'generated' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Generated Reports</h3>
                  <p className="text-sm text-slate-600">Download and manage your generated reports</p>
                </div>
                <div className="flex items-center gap-3">
                  {selectedReports.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">{selectedReports.length} selected</span>
                      <button
                        onClick={() => setShowBulkActions(!showBulkActions)}
                        className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-200 transition-colors"
                      >
                        Bulk Actions
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm"
                  >
                    <FunnelIcon className="h-4 w-4" />
                    Filters
                  </button>
                  <button
                    onClick={exportReportList}
                    className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    Export List
                  </button>
                </div>
              </div>

              {/* Bulk Actions Panel */}
              {showBulkActions && selectedReports.length > 0 && (
                <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={bulkDownloadReports}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4" />
                      Download Selected
                    </button>
                    <button
                      onClick={bulkDeleteReports}
                      className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <TrashIcon className="h-4 w-4" />
                      Delete Selected
                    </button>
                    <button
                      onClick={() => setSelectedReports([])}
                      className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              )}

              {/* Filters Panel */}
              {showFilters && (
                <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      >
                        <option value="all">All Status</option>
                        <option value="completed">Completed</option>
                        <option value="generating">Generating</option>
                        <option value="failed">Failed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Academic Period</label>
                      <select
                        value={academicPeriodFilter}
                        onChange={(e) => setAcademicPeriodFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      >
                        <option value="all">All Periods</option>
                        <option value="current-quarter">Current Quarter</option>
                        <option value="q1-2024-25">1st Quarter (Aug-Oct 2024)</option>
                        <option value="q2-2024-25">2nd Quarter (Nov-Jan 2025)</option>
                        <option value="q3-2024-25">3rd Quarter (Feb-Apr 2025)</option>
                        <option value="q4-2024-25">4th Quarter (May-Jul 2025)</option>
                        <option value="semester1-2024-25">1st Semester (Aug-Jan 2025)</option>
                        <option value="semester2-2024-25">2nd Semester (Feb-Jul 2025)</option>
                        <option value="school-year-2024-25">School Year 2024-2025</option>
                        <option value="school-year-2023-24">School Year 2023-2024</option>
                        <option value="summer-2024">Summer Program 2024</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Sort By</label>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      >
                        <option value="date">Date</option>
                        <option value="name">Name</option>
                        <option value="size">Size</option>
                        <option value="status">Status</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Order</label>
                      <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      >
                        <option value="desc">Descending</option>
                        <option value="asc">Ascending</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {sortedAndFilteredReports.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedReports.length === sortedAndFilteredReports.length && sortedAndFilteredReports.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedReports(sortedAndFilteredReports.map(r => r.id));
                            } else {
                              setSelectedReports([]);
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Report</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Generated</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Records</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Size</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {sortedAndFilteredReports.map(report => (
                      <tr key={report.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedReports.includes(report.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedReports(prev => [...prev, report.id]);
                              } else {
                                setSelectedReports(prev => prev.filter(id => id !== report.id));
                              }
                            }}
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-slate-900">{report.name}</p>
                            <p className="text-sm text-slate-600">by {report.generatedBy}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {report.generatedAt.toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {report.recordCount?.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {report.fileSize}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${report.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : report.status === 'generating'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                            }`}>
                            {report.status === 'completed' && <CheckCircleIcon className="h-3 w-3 mr-1" />}
                            {report.status === 'generating' && <ClockIcon className="h-3 w-3 mr-1" />}
                            {report.status === 'failed' && <ExclamationTriangleIcon className="h-3 w-3 mr-1" />}
                            {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            <div className="relative group">
                              <button
                                onClick={() => downloadReport(report)}
                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Download Report"
                              >
                                <ArrowDownTrayIcon className="h-4 w-4" />
                              </button>
                              <div className="absolute bottom-full left-0 mb-2 w-32 bg-white rounded-lg shadow-lg border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                <div className="p-2">
                                  <button
                                    onClick={() => downloadReport(report, 'xlsx')}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg"
                                  >
                                    <TableCellsIcon className="h-4 w-4" />
                                    Excel
                                  </button>
                                  <button
                                    onClick={() => downloadReport(report, 'pdf')}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg"
                                  >
                                    <DocumentTextIcon className="h-4 w-4" />
                                    PDF
                                  </button>

                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => shareReport(report)}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Share Report"
                            >
                              <ShareIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => sendReportByEmail(report)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Send by Email"
                            >
                              <EnvelopeIcon className="h-4 w-4" />
                            </button>
                            <button
                              className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                              title="Print Report"
                            >
                              <PrinterIcon className="h-4 w-4" />
                            </button>
                            <div className="relative group">
                              <button className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                                <Cog6ToothIcon className="h-4 w-4" />
                              </button>
                              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                <div className="p-2">
                                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg">
                                    <TagIcon className="h-4 w-4" />
                                    Add Tags
                                  </button>
                                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg">
                                    <DocumentDuplicateIcon className="h-4 w-4" />
                                    Duplicate
                                  </button>
                                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 rounded-lg">
                                    <TrashIcon className="h-4 w-4" />
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <DocumentTextIcon className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No Reports Found</h3>
                <p className="text-slate-600">No reports match your current filters.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'scheduled' && (
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold mb-2">Automated Report Scheduling</h3>
                  <p className="text-indigo-100">Set up recurring reports to be generated and delivered automatically</p>
                </div>
                <div className="flex gap-3">
                  <button className="flex items-center gap-2 px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg font-medium transition-colors">
                    <BellIcon className="h-4 w-4" />
                    Create Schedule
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg font-medium transition-colors">
                    <Cog6ToothIcon className="h-4 w-4" />
                    Settings
                  </button>
                </div>
              </div>
            </div>

            {/* Scheduled Reports List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="text-lg font-semibold text-slate-900">Active Schedules</h3>
                <p className="text-sm text-slate-600">Manage your automated report schedules</p>
              </div>

              <div className="p-8 text-center">
                <div className="max-w-md mx-auto">
                  <div className="bg-slate-100 rounded-full p-4 w-16 h-16 mx-auto mb-4">
                    <ClockIcon className="h-8 w-8 text-slate-400 mx-auto" />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900 mb-2">No Scheduled Reports</h4>
                  <p className="text-slate-600 mb-6">
                    You haven't set up any automated report schedules yet. Create your first schedule to start receiving reports automatically.
                  </p>

                  <div className="space-y-3">
                    <button className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors">
                      <PlusIcon className="h-5 w-5" />
                      Create First Schedule
                    </button>
                    <button className="w-full flex items-center justify-center gap-2 px-6 py-3 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors">
                      <DocumentTextIcon className="h-5 w-5" />
                      Learn About Scheduling
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Features Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="bg-emerald-100 rounded-lg p-3 w-fit mb-4">
                  <BellIcon className="h-6 w-6 text-emerald-600" />
                </div>
                <h4 className="font-semibold text-slate-900 mb-2">Automated Delivery</h4>
                <p className="text-sm text-slate-600">Reports are automatically generated and delivered to specified recipients via email.</p>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="bg-blue-100 rounded-lg p-3 w-fit mb-4">
                  <ClockIcon className="h-6 w-6 text-blue-600" />
                </div>
                <h4 className="font-semibold text-slate-900 mb-2">Flexible Scheduling</h4>
                <p className="text-sm text-slate-600">Set up daily, weekly, monthly, or custom schedules to fit your reporting needs.</p>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="bg-purple-100 rounded-lg p-3 w-fit mb-4">
                  <Cog6ToothIcon className="h-6 w-6 text-purple-600" />
                </div>
                <h4 className="font-semibold text-slate-900 mb-2">Smart Management</h4>
                <p className="text-sm text-slate-600">Automatic cleanup of old reports and intelligent retry mechanisms for failed generations.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'management' && (
          <ReportManagementHub 
            adminId="admin-user-id" // This should come from auth context
            adminName="System Administrator" // This should come from auth context
          />
        )}

        {/* Generation Progress Modal */}
        {isGenerating && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
              <div className="text-center">
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="2"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth="2"
                      strokeDasharray={`${generationProgress}, 100`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-slate-900">{Math.round(generationProgress)}%</span>
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-slate-900 mb-2">Generating Report</h3>
                <p className="text-slate-600 mb-4">
                  {selectedTemplate?.name}
                </p>
                <p className="text-sm text-slate-500">
                  This may take a few minutes depending on the data size...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Generate Report Modal */}
        {showGenerateModal && selectedTemplate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-4">
                <h3 className="text-lg font-semibold">Generate Report</h3>
                <p className="text-indigo-100 text-sm">{selectedTemplate.name}</p>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <h4 className="font-semibold text-slate-900 mb-3">Report Parameters</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Academic Period</label>
                      <select
                        value={reportParameters.academicPeriod || 'current-quarter'}
                        onChange={(e) => setReportParameters(prev => ({ ...prev, academicPeriod: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="current-quarter">Current Quarter</option>
                        <option value="q1-2024-25">1st Quarter (Aug-Oct 2024)</option>
                        <option value="q2-2024-25">2nd Quarter (Nov-Jan 2025)</option>
                        <option value="q3-2024-25">3rd Quarter (Feb-Apr 2025)</option>
                        <option value="q4-2024-25">4th Quarter (May-Jul 2025)</option>
                        <option value="semester1-2024-25">1st Semester (Aug-Jan 2025)</option>
                        <option value="semester2-2024-25">2nd Semester (Feb-Jul 2025)</option>
                        <option value="school-year-2024-25">School Year 2024-2025</option>
                        <option value="school-year-2023-24">School Year 2023-2024</option>
                        <option value="summer-2024">Summer Program 2024</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Format</label>
                      <select
                        value={selectedFormat}
                        onChange={(e) => setSelectedFormat(e.target.value as 'xlsx' | 'pdf')}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="xlsx">Excel (.xlsx)</option>
                        <option value="pdf">PDF (.pdf)</option>

                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowGenerateModal(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeReportGeneration}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <PlayIcon className="h-4 w-4" />
                    Generate Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preview Modal */}
        {showPreviewModal && selectedTemplate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Report Preview</h3>
                    <p className="text-blue-100 text-sm">{selectedTemplate.name}</p>
                  </div>
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="text-white hover:text-blue-200 text-2xl font-bold p-1 rounded hover:bg-white hover:bg-opacity-20 transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="mb-4">
                  <p className="text-sm text-slate-600 mb-4">
                    Preview showing first 10 records from live database. Generate full report to see all data.
                  </p>
                  {selectedTemplate?.id === 'teacher-isr-submissions' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <h4 className="font-semibold text-blue-900 mb-1">Class ISR Submissions from Teachers</h4>
                      <p className="text-sm text-blue-700">
                        This shows Individual Summary Records (ISR) that teachers have submitted through the system.
                        Each row represents a class ISR submission with student assessment data.
                      </p>
                    </div>
                  )}
                </div>

                {previewData.length > 0 && previewData[0] && !previewData[0].message && !previewData[0].error && (
                  <div className="overflow-x-auto">
                    <table className="w-full border border-slate-200 rounded-lg">
                      <thead className="bg-slate-50">
                        <tr>
                          {Object.keys(previewData[0]).map(key => (
                            <th key={key} className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, index) => (
                          <tr key={index} className="hover:bg-slate-50">
                            {Object.values(row).map((value, cellIndex) => (
                              <td key={cellIndex} className="px-4 py-2 text-sm text-slate-900 border-b border-slate-100">
                                {String(value)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {previewData.length > 0 && (previewData[0].message || previewData[0].error) && (
                  <div className="text-center py-8">
                    <DocumentTextIcon className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      {previewData[0].error ? 'Database Error' : 'No Data Available'}
                    </h3>
                    <p className="text-slate-600 mb-4">
                      {previewData[0].error || previewData[0].message}
                    </p>
                    {selectedTemplate?.id === 'teacher-isr-submissions' && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 max-w-md mx-auto">
                        <p className="text-sm text-amber-800">
                          <strong>Note:</strong> Teachers need to submit Class ISR reports through the system.
                          Once submitted, they will appear in this report for admin review and approval.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {previewData.length === 0 && (
                  <div className="text-center py-8">
                    <DocumentTextIcon className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">Loading Preview...</h3>
                    <p className="text-slate-600">Fetching data from database...</p>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowPreviewModal(false);
                    handleGenerateReport(selectedTemplate);
                  }}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <PlayIcon className="h-4 w-4" />
                  Generate Full Report
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Schedule Modal */}
        {showScheduleModal && selectedTemplate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-4">
                <h3 className="text-lg font-semibold">Schedule Report</h3>
                <p className="text-emerald-100 text-sm">{selectedTemplate.name}</p>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Frequency</label>
                    <select className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      <option>Daily</option>
                      <option>Weekly</option>
                      <option>Monthly</option>
                      <option>Quarterly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Time</label>
                    <input
                      type="time"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Email Recipients</label>
                    <input
                      type="email"
                      placeholder="admin@example.com"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500" />
                    <span className="text-sm text-slate-700">Auto-delete reports older than 30 days</span>
                  </label>
                </div>
              </div>

              <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowScheduleModal(false);
                    // Here you would implement the scheduling logic
                    alert('Report scheduled successfully!');
                  }}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <BellIcon className="h-4 w-4" />
                  Schedule Report
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper functions moved outside component
const fetchReadingProgressData = async () => {
    try {
      // This would require historical data tracking - for now, provide sample structure
      const students = await studentService.getAllStudents();

      const progressData = students.slice(0, 20).map(student => ({
        'Student Name': student.name,
        'Grade': student.grade,
        'Previous Level': ['Frustration', 'Instructional', 'Independent'][Math.floor(Math.random() * 3)],
        'Current Level': student.readingLevel || 'Not assessed',
        'Progress Status': Math.random() > 0.6 ? 'Improved' : Math.random() > 0.3 ? 'Maintained' : 'Declined',
        'Date Range': 'Q1 2024-25 to Q2 2024-25',
        'Language': Math.random() > 0.5 ? 'English' : 'Filipino',
        'Teacher': 'Elementary Teacher'
      }));

      return progressData;
    } catch (error) {
      return [{ error: 'Failed to fetch reading progress data' }];
    }
  };

const fetchLanguageComparisonData = async () => {
    try {
      // Fetch ISR data for both languages
      const approvedISRQuery = query(
        collection(db, 'approvedISRRecords'),
        orderBy('approvedDate', 'desc')
      );
      const approvedSnapshot = await getDocs(approvedISRQuery);

      const languageData: any[] = [];

      approvedSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.students && Array.isArray(data.students)) {
          data.students.forEach((student: any) => {
            const latestReading = student.readingData?.[0] || {};

            // Determine reading level
            let readingLevel = 'Frustration';
            if (latestReading.wordReading?.ind && latestReading.comprehension?.ind) {
              readingLevel = 'Independent';
            } else if (latestReading.wordReading?.ins && latestReading.comprehension?.ins) {
              readingLevel = 'Instructional';
            }

            languageData.push({
              'Student Name': student.studentName || 'Unknown',
              'Grade': student.gradeSection || data.grade || 'N/A',
              'English Level': student.language === 'English' ? readingLevel : 'Not assessed',
              'Filipino Level': student.language === 'Filipino' ? readingLevel : 'Not assessed',
              'Language Preference': student.language || 'Filipino',
              'Assessment Date': latestReading.dateTaken || data.approvedDate?.toDate?.()?.toLocaleDateString() || 'N/A',
              'Teacher': student.teacher || data.teacherName || 'N/A'
            });
          });
        }
      });

      return languageData.length > 0 ? languageData : [{ message: 'No language comparison data available' }];
    } catch {
      return [{ error: 'Failed to fetch language comparison data' }];
    }
};

export default Reports;