import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ActiveTool,
  PDFAnnotation,
  PDFPageInfo,
  RibbonTab,
  StampType,
} from '@/types/pdf';

interface PDFContextType {
  // Document state
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  setPdfDoc: (doc: pdfjsLib.PDFDocumentProxy | null) => void;
  pdfBytes: Uint8Array | null;
  setPdfBytes: (bytes: Uint8Array | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // View & Page state
  pageCount: number;
  currentPageIndex: number;
  setCurrentPageIndex: (index: number | ((prev: number) => number)) => void;
  zoomScale: number;
  setZoomScale: (scale: number | ((prev: number) => number)) => void;
  pagesInfo: PDFPageInfo[];
  setPagesInfo: React.Dispatch<React.SetStateAction<PDFPageInfo[]>>;
  pageOrder: number[];
  setPageOrder: React.Dispatch<React.SetStateAction<number[]>>;

  // Tools & Ribbon
  activeTab: RibbonTab;
  setActiveTab: (tab: RibbonTab) => void;
  activeTool: ActiveTool;
  setActiveTool: (tool: ActiveTool) => void;
  userRole: 'admin' | 'b2b_agent';
  setUserRole: (role: 'admin' | 'b2b_agent') => void;

  // Annotations & Selection
  annotations: PDFAnnotation[];
  setAnnotations: React.Dispatch<React.SetStateAction<PDFAnnotation[]>>;
  selectedAnnotationId: string | null;
  setSelectedAnnotationId: (id: string | null) => void;
  addAnnotation: (ann: Omit<PDFAnnotation, 'id' | 'createdAt'>) => void;
  updateAnnotation: (id: string, patch: Partial<PDFAnnotation>) => void;
  deleteAnnotation: (id: string) => void;

  // Undo / Redo
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  // UI state
  isDarkMode: boolean;
  setIsDarkMode: (dark: boolean | ((prev: boolean) => boolean)) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  sidebarTab: 'thumbnails' | 'annotations' | 'search';
  setSidebarTab: (tab: 'thumbnails' | 'annotations' | 'search') => void;
  propertyPanelOpen: boolean;
  setPropertyPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;

  // Modals & Tool Settings
  isSignatureModalOpen: boolean;
  setIsSignatureModalOpen: (open: boolean) => void;
  activeStampType: StampType;
  setActiveStampType: (stamp: StampType) => void;
  customStampText: string;
  setCustomStampText: (text: string) => void;
  activeColor: string;
  setActiveColor: (color: string) => void;
  strokeWidth: number;
  setStrokeWidth: (w: number) => void;
  fontSize: number;
  setFontSize: (s: number) => void;

  // Page Operations
  rotatePage: (pageIndex: number, direction: 'cw' | 'ccw') => void;
  deletePage: (pageIndex: number) => void;
  reorderPages: (newOrder: number[]) => void;
}

const PDFContext = createContext<PDFContextType | undefined>(undefined);

export const PDFProvider: React.FC<{ children: React.ReactNode; initialRole?: 'admin' | 'b2b_agent' }> = ({
  children,
  initialRole = 'admin',
}) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [zoomScale, setZoomScale] = useState<number>(1.2);
  const [pagesInfo, setPagesInfo] = useState<PDFPageInfo[]>([]);
  const [pageOrder, setPageOrder] = useState<number[]>([]);

  const [activeTab, setActiveTab] = useState<RibbonTab>('home');
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [userRole, setUserRole] = useState<'admin' | 'b2b_agent'>(initialRole);

  const [annotations, setAnnotations] = useState<PDFAnnotation[]>([]);
  const [undoStack, setUndoStack] = useState<PDFAnnotation[][]>([]);
  const [redoStack, setRedoStack] = useState<PDFAnnotation[][]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [sidebarTab, setSidebarTab] = useState<'thumbnails' | 'annotations' | 'search'>('thumbnails');
  const [propertyPanelOpen, setPropertyPanelOpen] = useState<boolean>(true);

  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState<boolean>(false);
  const [activeStampType, setActiveStampType] = useState<StampType>('APPROVED');
  const [customStampText, setCustomStampText] = useState<string>('AGENCY STAMP');
  const [activeColor, setActiveColor] = useState<string>('#DE7356');
  const [strokeWidth, setStrokeWidth] = useState<number>(2);
  const [fontSize, setFontSize] = useState<number>(14);

  const pageCount = useMemo(() => pageOrder.length || pdfDoc?.numPages || 0, [pageOrder, pdfDoc]);

  // Helper for pushing undo history
  const pushHistory = useCallback((newAnns: PDFAnnotation[]) => {
    setUndoStack((prev) => [...prev, annotations]);
    setRedoStack([]);
    setAnnotations(newAnns);
  }, [annotations]);

  const addAnnotation = useCallback((ann: Omit<PDFAnnotation, 'id' | 'createdAt'>) => {
    const id = `ann_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newAnn = { ...ann, id, createdAt: Date.now() } as PDFAnnotation;
    pushHistory([...annotations, newAnn]);
    setSelectedAnnotationId(id);
  }, [annotations, pushHistory]);

  const updateAnnotation = useCallback((id: string, patch: Partial<PDFAnnotation>) => {
    const newAnns = annotations.map((a) => (a.id === id ? ({ ...a, ...patch } as PDFAnnotation) : a));
    pushHistory(newAnns);
  }, [annotations, pushHistory]);

  const deleteAnnotation = useCallback((id: string) => {
    const newAnns = annotations.filter((a) => a.id !== id);
    pushHistory(newAnns);
    if (selectedAnnotationId === id) setSelectedAnnotationId(null);
  }, [annotations, pushHistory, selectedAnnotationId]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, annotations]);
    setAnnotations(previous);
    setUndoStack((prev) => prev.slice(0, -1));
  }, [annotations, undoStack]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, annotations]);
    setAnnotations(next);
    setRedoStack((prev) => prev.slice(0, -1));
  }, [annotations, redoStack]);

  const rotatePage = useCallback((pIndex: number, direction: 'cw' | 'ccw') => {
    setPagesInfo((prev) =>
      prev.map((p) => {
        if (p.pageIndex === pIndex) {
          const delta = direction === 'cw' ? 90 : -90;
          const newRot = (p.rotation + delta + 360) % 360;
          return { ...p, rotation: newRot };
        }
        return p;
      })
    );
  }, []);

  const deletePage = useCallback((pIndex: number) => {
    setPageOrder((prev) => {
      const next = prev.filter((_, idx) => idx !== pIndex);
      return next;
    });
    setAnnotations((prev) => prev.filter((a) => a.pageIndex !== pIndex));
  }, []);

  const reorderPages = useCallback((newOrder: number[]) => {
    setPageOrder(newOrder);
  }, []);

  const value = useMemo(
    () => ({
      pdfDoc, setPdfDoc,
      pdfBytes, setPdfBytes,
      isLoading, setIsLoading,
      pageCount,
      currentPageIndex, setCurrentPageIndex,
      zoomScale, setZoomScale,
      pagesInfo, setPagesInfo,
      pageOrder, setPageOrder,
      activeTab, setActiveTab,
      activeTool, setActiveTool,
      userRole, setUserRole,
      annotations, setAnnotations,
      selectedAnnotationId, setSelectedAnnotationId,
      addAnnotation, updateAnnotation, deleteAnnotation,
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      undo, redo,
      isDarkMode, setIsDarkMode,
      sidebarOpen, setSidebarOpen,
      sidebarTab, setSidebarTab,
      propertyPanelOpen, setPropertyPanelOpen,
      isSignatureModalOpen, setIsSignatureModalOpen,
      activeStampType, setActiveStampType,
      customStampText, setCustomStampText,
      activeColor, setActiveColor,
      strokeWidth, setStrokeWidth,
      fontSize, setFontSize,
      rotatePage, deletePage, reorderPages,
    }),
    [
      pdfDoc, pdfBytes, isLoading, pageCount, currentPageIndex, zoomScale, pagesInfo, pageOrder,
      activeTab, activeTool, userRole, annotations, selectedAnnotationId, addAnnotation, updateAnnotation, deleteAnnotation,
      undoStack, redoStack, undo, redo, isDarkMode, sidebarOpen, sidebarTab, propertyPanelOpen, isSignatureModalOpen, activeStampType,
      customStampText, activeColor, strokeWidth, fontSize, rotatePage, deletePage, reorderPages,
    ]
  );

  return <PDFContext.Provider value={value}>{children}</PDFContext.Provider>;
};

export const usePDF = () => {
  const context = useContext(PDFContext);
  if (!context) throw new Error('usePDF must be used within a PDFProvider');
  return context;
};
