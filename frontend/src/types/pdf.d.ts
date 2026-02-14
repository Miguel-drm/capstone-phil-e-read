declare module 'pdfjs-dist/build/pdf.worker.entry';

declare module 'pdfjs-dist/build/pdf' {
  export interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
  }

  export interface PDFPageProxy {
    getTextContent(): Promise<PDFTextContent>;
  }

  export interface PDFTextContent {
    items: Array<{ str: string }>;
  }

  export interface PDFDocumentLoadingTask {
    promise: Promise<PDFDocumentProxy>;
  }

  export const GlobalWorkerOptions: {
    workerSrc: string;
  };

  export function getDocument(url: string): PDFDocumentLoadingTask;
  
  export const version: string;
}

declare module 'pdfjs-dist/lib/pdf.js' {
  export * from 'pdfjs-dist';
}
