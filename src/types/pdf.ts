export type RibbonTab = 'home' | 'edit' | 'comment' | 'organize' | 'protect' | 'view' | 'form';

export type ActiveTool =
  | 'select'
  | 'hand'
  | 'text'
  | 'whiteout'
  | 'redact'
  | 'highlight'
  | 'underline'
  | 'strikethrough'
  | 'pen'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'stamp'
  | 'signature'
  | 'sticky'
  | 'form_text'
  | 'form_checkbox';

export type StampType =
  | 'APPROVED'
  | 'CONFIDENTIAL'
  | 'DRAFT'
  | 'SIGN_HERE'
  | 'COMPLETED'
  | 'ISSUED'
  | 'CUSTOM';

export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BaseAnnotation {
  id: string;
  pageIndex: number;
  type: ActiveTool;
  color?: string;
  opacity?: number;
  rotation?: number; // degrees, 0-360
  createdAt: number;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text' | 'form_text';
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight?: string;
  fontStyle?: string;
  textColor: string;
  backgroundColor?: string;
  x: number; // percentage (0 to 100)
  y: number; // percentage (0 to 100)
  width: number; // percentage
  height: number; // percentage
}

export interface WhiteoutAnnotation extends BaseAnnotation {
  type: 'whiteout';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RedactionAnnotation extends BaseAnnotation {
  type: 'redact';
  x: number;
  y: number;
  width: number;
  height: number;
  reason?: string;
}

export interface HighlightAnnotation extends BaseAnnotation {
  type: 'highlight' | 'underline' | 'strikethrough';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface DrawingAnnotation extends BaseAnnotation {
  type: 'pen';
  points: Point[]; // normalized 0..1
  strokeWidth: number;
  color: string;
}

export interface ShapeAnnotation extends BaseAnnotation {
  type: 'rectangle' | 'circle' | 'line' | 'arrow';
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  strokeWidth: number;
  fillColor?: string;
}

export interface StampAnnotation extends BaseAnnotation {
  type: 'stamp';
  stampType: StampType;
  customText?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SignatureAnnotation extends BaseAnnotation {
  type: 'signature';
  imageDataUrl: string; // base64 data URL png
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StickyNoteAnnotation extends BaseAnnotation {
  type: 'sticky';
  text: string;
  x: number;
  y: number;
  color: string;
}

export type PDFAnnotation =
  | TextAnnotation
  | WhiteoutAnnotation
  | RedactionAnnotation
  | HighlightAnnotation
  | DrawingAnnotation
  | ShapeAnnotation
  | StampAnnotation
  | SignatureAnnotation
  | StickyNoteAnnotation;

export interface PDFPageInfo {
  pageIndex: number;
  originalIndex: number;
  rotation: number; // 0, 90, 180, 270
  width: number;
  height: number;
}

export interface TicketPDFEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl?: string;
  pdfBytes?: Uint8Array;
  ticketId?: string;
  bookingRef?: string;
  userRole?: 'admin' | 'b2b_agent';
  onSaveAndPrint?: (editedPdfBytes: Uint8Array) => void;
  onSaveToBooking?: (editedPdfBytes: Uint8Array) => Promise<void>;
}
