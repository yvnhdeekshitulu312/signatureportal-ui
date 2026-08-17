export type RecipientRole = 'Sign' | 'Approve' | 'View' | 'CC';
export type DeliveryMethod = 'Email' | 'Teams' | 'Slack';
export type FieldType = 'Signature' | 'Stamp' | 'Text' | 'Initial' | 'Checkbox'| 'DateTime';;
export interface DocumentDetailResponse {
  Id: number;
  Name: string;
  Status: string;
   CreatedBy: string;
  CreatedOn: string;
  ViewerGcsUrl: string;
  IsOrdered: boolean;
  Recipients: RecipientSummaryDto[];
  Fields: FieldSummaryDto[];
  PageImages?: string[];
}
export interface UploadDocumentResponse {
  DocumentId: number;
  Name: string;
  OriginalGcsPath: string;
  PageImages: string[]; // base64 JPEG, one per page, in order (from Aspose rendering)
}

export interface RecipientDto {
  clientId: string;      // temp id, generated client-side, e.g. "r1"
  email: string;
  name: string;
  role: RecipientRole;
  signingOrder?: number | null;
  deliveryMethod: DeliveryMethod;
}

export interface FieldDto {
  recipientClientId: string;
  fieldType: FieldType;
  pageNumber: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  isRequired: boolean;
}

export interface SendDocumentRequest {
  documentId: number;
  documentName: string;
  isOrdered: boolean;
  daysToComplete?: number | null;
  reminderDays?: number | null;
  note?: string;
  recipients: RecipientDto[];
  fields: FieldDto[];
}




export interface RecipientSummaryDto {
  Id: number;
  Name: string;
  Email: string;
  Role: RecipientRole;
  Status: string;
  SigningOrder?: number | null;
}

export interface FieldSummaryDto {
  Id: number;
  RecipientId: number;
  FieldType: FieldType;
  PageNumber: number;
  XPct: number;
  YPct: number;
  WidthPct: number;
  HeightPct: number;
  Value?: string;
  IsRequired: boolean;
}

// Client-side working model for a field being placed on the canvas,
// before it's saved. Keeps pixel position (for rendering) alongside
// the percentage position (for persistence).
export interface PlacedField {
  tempId: string;
  recipientClientId: string;
  fieldType: FieldType;
  pageNumber: number;
  xPx: number;
  yPx: number;
  widthPx: number;
  heightPx: number;
  isRequired: boolean;
}
