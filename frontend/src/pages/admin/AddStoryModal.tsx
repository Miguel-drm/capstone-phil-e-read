import React, { useState, useEffect } from 'react';
import type { Story } from '../../types/Story';
import Swal from 'sweetalert2'; // Import Swal for validation messages

interface AddStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (storyData: Pick<Story, 'title' | 'description' | 'language'>, file: File) => Promise<void>;
  targetGradeSet?: { grade: '3' | '4' | '5' | '6', set: 'A' | 'B' | 'C' | 'D' } | null;
  defaultLanguage?: 'english' | 'tagalog';
}

type InputMode = 'selection' | 'pdf' | 'manual';

const AddStoryModal: React.FC<AddStoryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  targetGradeSet,
  defaultLanguage = 'english',
}) => {
  const [inputMode, setInputMode] = useState<InputMode>('selection');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<'english' | 'tagalog'>(defaultLanguage);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [manualContent, setManualContent] = useState('');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right' | 'justify'>('left');
  const [fontSize, setFontSize] = useState<number>(14);

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setInputMode('selection');
      setTitle('');
      setDescription('');
      setSelectedFile(null);
      setLanguage(defaultLanguage);
      setIsSaving(false);
      setIsDragOver(false);
      setManualContent('');
      setTextAlign('left');
      setFontSize(14);
    } else {
      // Set language when modal opens
      setLanguage(defaultLanguage);
      setInputMode('selection');
    }
  }, [isOpen, defaultLanguage]);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
      } else {
        Swal.fire('Error', 'Please drop a valid PDF file.', 'error');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
      } else {
        Swal.fire('Error', 'Please select a valid PDF file.', 'error');
        e.target.value = '';
      }
    }
  };

  // Handle Tab key press in textarea to insert spaces (like Word)
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault(); // Prevent default tab behavior (focus change)
      
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const tabSpaces = '    '; // 4 spaces for tab indent
      
      // Insert tab spaces at cursor position
      const newValue = manualContent.substring(0, start) + tabSpaces + manualContent.substring(end);
      setManualContent(newValue);
      
      // Set cursor position after the inserted spaces
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + tabSpaces.length;
      }, 0);
    }
  };

  const handleSubmit = async () => {
    if (!title || !language) {
      Swal.fire('Error', 'Please fill in the title and select a language.', 'error');
      return;
    }

    if (inputMode === 'pdf') {
      if (!selectedFile) {
        Swal.fire('Error', 'Please upload a PDF file.', 'error');
        return;
      }
      if (selectedFile.type !== 'application/pdf') {
        Swal.fire('Error', 'Please upload a valid PDF file.', 'error');
        setSelectedFile(null);
        return;
      }
    } else if (inputMode === 'manual') {
      if (!manualContent.trim()) {
        Swal.fire('Error', 'Please enter the story content.', 'error');
        return;
      }
      // Create a text file from manual content and convert to PDF-like blob
      const blob = new Blob([manualContent], { type: 'text/plain' });
      const file = new File([blob], `${title}.txt`, { type: 'text/plain' });
      setSelectedFile(file);
    }

    setIsSaving(true);
    try {
      const fileToUpload = inputMode === 'manual' 
        ? new File([new Blob([manualContent], { type: 'text/plain' })], `${title}.txt`, { type: 'text/plain' })
        : selectedFile!;
        
      await onSave(
        {
          title,
          description: description.trim() || `A ${language} story for reading assessment.`,
          language,
        },
        fileToUpload
      );
      onClose();
    } catch (error) {
      console.error("Error saving story from modal:", error);
      Swal.fire('Error', 'Failed to add story. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  // Selection Mode - Choose between PDF or Manual Input
  if (inputMode === 'selection') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      >
        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-2 text-center">
            Add New Story
          </h2>
          <p className="text-gray-600 text-center mb-8">
            Choose how you want to add your story
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* PDF Import Card */}
            <button
              onClick={() => setInputMode('pdf')}
              className="group relative bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border-2 border-blue-200 hover:border-blue-400 rounded-xl p-8 transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Import PDF</h3>
                  <p className="text-sm text-gray-600">
                    Upload an existing PDF file with your story content
                  </p>
                </div>
                <div className="flex items-center gap-2 text-blue-600 font-medium">
                  <span>Choose PDF</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>

            {/* Manual Input Card */}
            <button
              onClick={() => setInputMode('manual')}
              className="group relative bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 border-2 border-green-200 hover:border-green-400 rounded-xl p-8 transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center group-hover:bg-green-600 transition-colors">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Manual Input</h3>
                  <p className="text-sm text-gray-600">
                    Type or paste your story content directly
                  </p>
                </div>
                <div className="flex items-center gap-2 text-green-600 font-medium">
                  <span>Write Story</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </button>
          </div>

          <div className="mt-8 flex justify-center">
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // PDF or Manual Input Mode - Landscape layout
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setInputMode('selection')}
            className="text-gray-600 hover:text-gray-800 flex items-center gap-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">Back</span>
          </button>
          <h2 className="text-xl font-semibold text-gray-800">
            {inputMode === 'pdf' ? 'Import PDF Story' : 'Manual Story Input'}
          </h2>
          <div className="w-16"></div>
        </div>

        {/* Top row - Title and Language */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Story Title</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., The Ant and the Grasshopper"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Language
            </label>
            <div className="w-full px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700">
              {language === 'english' ? 'English' : 'Tagalog'}
            </div>
          </div>
        </div>

        {/* Content area */}
        <div>

            {inputMode === 'pdf' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Story PDF</label>
                <div
                  className={`relative w-full h-[300px] rounded-lg border-2 border-dashed transition-colors ${isDragOver
                    ? 'border-blue-400 bg-blue-50'
                    : selectedFile
                      ? 'border-green-400 bg-green-50'
                      : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                    }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    id="pdfFile"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex items-center justify-center h-full">
                    {selectedFile ? (
                      <div className="space-y-3 text-center">
                        <div className="text-green-600 text-4xl">📄</div>
                        <p className="text-base font-medium text-green-800">{selectedFile.name}</p>
                        <p className="text-sm text-green-600">
                          {(selectedFile.size / 1024).toFixed(0)} KB • PDF Ready for Upload
                        </p>
                        <div className="flex items-center justify-center gap-1 text-sm text-green-600">
                          <span>✓</span>
                          <span>Valid PDF file selected</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                          }}
                          className="text-sm text-red-600 hover:text-red-800 underline"
                        >
                          Remove file
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3 text-center">
                        <div className="text-gray-400 text-4xl">📁</div>
                        <p className="text-base text-gray-600">
                          <span className="font-medium">Drop your PDF here</span> or click to browse
                        </p>
                        <p className="text-sm text-gray-500">PDF files only</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {inputMode === 'manual' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="manualContent" className="block text-sm font-medium text-gray-700">
                    Story Content
                  </label>
                  {/* Formatting Toolbar */}
                  <div className="flex items-center gap-2">
                    {/* Font Size Controls */}
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                      <button
                        type="button"
                        onClick={() => setFontSize(Math.max(10, fontSize - 2))}
                        className="p-2 rounded text-gray-600 hover:text-gray-800 hover:bg-white transition-colors"
                        title="Decrease Font Size"
                        disabled={fontSize <= 10}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      <span className="px-2 text-xs font-medium text-gray-700 min-w-[3rem] text-center">
                        {fontSize}px
                      </span>
                      <button
                        type="button"
                        onClick={() => setFontSize(Math.min(32, fontSize + 2))}
                        className="p-2 rounded text-gray-600 hover:text-gray-800 hover:bg-white transition-colors"
                        title="Increase Font Size"
                        disabled={fontSize >= 32}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Text Alignment Controls */}
                    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                      <button
                        type="button"
                        onClick={() => setTextAlign('left')}
                        className={`p-2 rounded transition-colors ${
                          textAlign === 'left' 
                            ? 'bg-white text-green-600 shadow-sm' 
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                        title="Align Left"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h16" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTextAlign('center')}
                        className={`p-2 rounded transition-colors ${
                          textAlign === 'center' 
                            ? 'bg-white text-green-600 shadow-sm' 
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                        title="Align Center"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M4 18h16" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTextAlign('right')}
                        className={`p-2 rounded transition-colors ${
                          textAlign === 'right' 
                            ? 'bg-white text-green-600 shadow-sm' 
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                        title="Align Right"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M10 12h10M4 18h16" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTextAlign('justify')}
                        className={`p-2 rounded transition-colors ${
                          textAlign === 'justify' 
                            ? 'bg-white text-green-600 shadow-sm' 
                            : 'text-gray-600 hover:text-gray-800'
                        }`}
                        title="Justify"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                <textarea
                  id="manualContent"
                  value={manualContent}
                  onChange={(e) => setManualContent(e.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="Type or paste your story content here..."
                  className="w-full h-[300px] px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                  style={{ 
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    textAlign: textAlign,
                    fontSize: `${fontSize}px`,
                    lineHeight: '1.6'
                  }}
                />
                <p className="text-xs text-gray-500 mt-2">
                  {manualContent.trim().split(/\s+/).filter(w => w).length} words
                </p>
              </div>
            )}
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={() => setInputMode('selection')}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className={`px-6 py-2.5 rounded-md text-white font-medium focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              inputMode === 'pdf' 
                ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-400' 
                : 'bg-green-600 hover:bg-green-700 focus:ring-green-400'
            }`}
          >
            {isSaving ? 'Adding Story...' : 'Add Story'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddStoryModal; 