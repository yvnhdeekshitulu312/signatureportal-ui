import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CdkDragDrop, CdkDragEnd } from '@angular/cdk/drag-drop';
import { forkJoin } from 'rxjs';
import { EsignService } from '../../services/esign.service';
import { FieldType, PlacedField, RecipientDto, SendDocumentRequest } from '../../models/esign.models';
import { ToastService } from '../../services/toast.service';

interface FieldPaletteItem {
  type: FieldType;
  label: string;
  defaultWidthPx: number;
  defaultHeightPx: number;
}

// A field also remembers which document it belongs to (multi-document support).
type EditorField = PlacedField & { documentId: number };

interface EditorDoc {
  documentId: number;
  name: string;
  pages: string[]; // base64 data URLs for this document only
}

@Component({
  selector: 'app-document-editor',
  templateUrl: './document-editor.component.html',
  styleUrls: ['./document-editor.component.scss']
})
export class DocumentEditorComponent implements OnInit {
  @ViewChild('pageOverlay', { static: false }) pageOverlay!: ElementRef<HTMLDivElement>;

  documentId!: number;          // first document (kept for compatibility)
  documentName = '';

  // ── multiple documents ──
  documents: EditorDoc[] = [];
  currentDocIndex = 0;
  currentPage = 1; // 1-indexed WITHIN the current document

  recipients: RecipientDto[] = [];
  activeRecipientClientId: string | null = null;

  placedFields: EditorField[] = [];
  fieldCounter = 0;

  fieldPalette: FieldPaletteItem[] = [
    { type: 'Signature', label: 'Signature', defaultWidthPx: 160, defaultHeightPx: 50 },
    { type: 'Stamp', label: 'Stamp', defaultWidthPx: 120, defaultHeightPx: 120 },
    { type: 'Text', label: 'Text', defaultWidthPx: 160, defaultHeightPx: 30 },
    { type: 'DateTime', label: 'Date', defaultWidthPx: 160, defaultHeightPx: 34 },
  ];

  selectedFieldId: string | null = null;
  isSending = false;
owner = 'You';
  Email:any; EmpID:any;
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private esignService: EsignService,
    private toast: ToastService
  ) {
     const d = JSON.parse(localStorage.getItem('doctorDetails') || '{}');
      this.owner = d?.Name || d?.FullName || d?.EmployeeName || d?.DoctorName || d?.UserName || 'You';
       this.Email=d?.EmpEmail;
       this.EmpID=d?.EmpId;
  }

  ngOnInit(): void {
    this.documentId = Number(this.route.snapshot.queryParamMap.get('documentId'));

    const draftRaw = sessionStorage.getItem('esign_draft');
    if (!draftRaw) {
      this.router.navigate(['/dashboard/sendforsignature']);
      return;
    }
    const draft = JSON.parse(draftRaw);
    this.documentName = draft.documentName;
    this.recipients = draft.recipients || [];
    this.activeRecipientClientId = this.recipients[0]?.clientId ?? null;

    // Rebuild per-document pages from the combined pageImages + documents[] metadata.
    const allPages: string[] = draft.pageImages || [];
    const meta = (draft.documents && draft.documents.length)
      ? draft.documents
      : [{ documentId: draft.documentId, name: draft.documentName, pageCount: allPages.length }];

    let offset = 0;
    this.documents = meta.map((m: any) => {
      const count = m.pageCount || 0;
      const pages = allPages.slice(offset, offset + count);
      offset += count;
      return { documentId: m.documentId, name: m.name, pages } as EditorDoc;
    });
    // Fallback: if metadata had no page counts, put everything in the first document.
    if (this.documents.length === 1 && !this.documents[0].pages.length && allPages.length) {
      this.documents[0].pages = allPages;
    }

    this.documentId = this.documents[0]?.documentId ?? draft.documentId;
    this.currentDocIndex = 0;
    this.currentPage = 1;
  }

  // ── document / page helpers ──
  get currentDoc(): EditorDoc | undefined { return this.documents[this.currentDocIndex]; }
  get currentPages(): string[] { return this.currentDoc?.pages || []; }

  selectDocument(index: number): void {
    this.currentDocIndex = index;
    this.currentPage = 1;
    this.selectedFieldId = null;
  }

  fieldCountFor(doc: EditorDoc): number {
    return this.placedFields.filter(f => f.documentId === doc.documentId).length;
  }

  /** Fields to render on the currently visible page of the current document. */
  isFieldOnCurrentPage(field: EditorField): boolean {
    return field.documentId === this.currentDoc?.documentId && field.pageNumber === this.currentPage;
  }

  selectRecipient(clientId: string): void {
    this.activeRecipientClientId = clientId;
  }

  onFieldDropped(event: CdkDragDrop<any>, pageNumber: number): void {
    if (!this.activeRecipientClientId) { this.toast.warning('Select a recipient first'); return; }
    const paletteItem: FieldPaletteItem = event.item.data;
    const overlayRect = this.pageOverlay.nativeElement.getBoundingClientRect();
    const dropX = event.dropPoint.x - overlayRect.left;
    const dropY = event.dropPoint.y - overlayRect.top;
    this.addFieldAt(paletteItem, dropX - paletteItem.defaultWidthPx / 2, dropY - paletteItem.defaultHeightPx / 2);
  }

  addFieldByClick(item: FieldPaletteItem): void {
    if (!this.activeRecipientClientId) { this.toast.warning('Select a recipient first'); return; }
    const overlayRect = this.pageOverlay?.nativeElement.getBoundingClientRect();
    const baseX = overlayRect ? overlayRect.width / 2 - item.defaultWidthPx / 2 : 40;
    const baseY = overlayRect ? overlayRect.height / 2 - item.defaultHeightPx / 2 : 40;
    const existingOnPage = this.placedFields.filter(
      (f) => f.documentId === this.currentDoc?.documentId && f.pageNumber === this.currentPage
    ).length;
    const stagger = (existingOnPage % 8) * 24;
    this.addFieldAt(item, baseX + stagger, baseY + stagger);
  }

  private addFieldAt(item: FieldPaletteItem, xPx: number, yPx: number): void {
    if (!this.currentDoc) { return; }
    this.fieldCounter++;
    const tempId = `f${this.fieldCounter}`;
    this.placedFields.push({
      tempId,
      recipientClientId: this.activeRecipientClientId!,
      fieldType: item.type,
      documentId: this.currentDoc.documentId,   // remember which document
      pageNumber: this.currentPage,              // page WITHIN that document
      xPx: Math.max(0, xPx),
      yPx: Math.max(0, yPx),
      widthPx: item.defaultWidthPx,
      heightPx: item.defaultHeightPx,
      isRequired: true
    });
    this.selectedFieldId = tempId;
  }

  onFieldMoved(event: CdkDragEnd, field: EditorField): void {
    // CDK free-drag moves the element with a CSS transform that it does NOT clear on
    // its own. Persist the net drag distance onto the stored px position, then reset the
    // transform so the element rests exactly at its [style.left/top]. Without the reset,
    // the leftover transform stacks on top of left/top and the field jumps every drag.
    const rect = this.pageOverlay.nativeElement.getBoundingClientRect();
    const maxX = Math.max(0, rect.width - field.widthPx);
    const maxY = Math.max(0, rect.height - field.heightPx);
    field.xPx = Math.min(Math.max(0, field.xPx + event.distance.x), maxX);
    field.yPx = Math.min(Math.max(0, field.yPx + event.distance.y), maxY);
    event.source.reset();
  }

  selectField(fieldId: string): void { this.selectedFieldId = fieldId; }

  deleteField(fieldId: string): void {
    this.placedFields = this.placedFields.filter((f) => f.tempId !== fieldId);
    if (this.selectedFieldId === fieldId) this.selectedFieldId = null;
  }

  deleteSelectedField(): void {
    if (this.selectedFieldId) this.deleteField(this.selectedFieldId);
  }

  recipientColor(clientId: string): string {
    const idx = this.recipients.findIndex((r) => r.clientId === clientId);
    const palette = ['#1855A4', '#3B7DC4', '#4FCED2', '#7499C8'];
    return palette[idx % palette.length];
  }

  goBack(): void { this.router.navigate(['/dashboard/sendforsignature']); }

  reject(): void {
    if (confirm('Discard this document?')) {
      sessionStorage.removeItem('esign_draft');
      this.toast.info('Document discarded');
      this.router.navigate(['/dashboard']);
    }
  }

  sendOld(): void {
    if (this.isSending) { return; }
    if (this.placedFields.length === 0) { this.toast.warning('Place at least one field before sending'); return; }

    const draft = JSON.parse(sessionStorage.getItem('esign_draft') || '{}');
    const user = JSON.parse(localStorage.getItem('doctorDetails') || '{}');
    const overlayRect = this.pageOverlay.nativeElement.getBoundingClientRect();

    // field placement → percentages (top-left origin; backend converts to PDF points)
    const toField = (f: EditorField) => ({
      FieldType: f.fieldType,
      PageNumber: f.pageNumber,
      RecipientClientId: f.recipientClientId,
      XPct: (f.xPx / overlayRect.width) * 100,
      YPct: (f.yPx / overlayRect.height) * 100,
      WidthPct: (f.widthPx / overlayRect.width) * 100,
      HeightPct: (f.heightPx / overlayRect.height) * 100,
      IsRequired: f.isRequired
    });

    // recipients → ReciepientsXML (property names match the C# recipient model;
    // adjust here if yours differ). SigningOrder follows row position when ordered.
    const buildRecipients = () => this.recipients.map((r: any, idx: number) => ({
      //Email: r.email,
      //ReciepientName: r.name,
      EMAIL: r.email,
      NAME: r.name,
      Role: r.role,
      SigningOrder: draft.isOrdered ? idx + 1 : (r.signingOrder ?? null),
      // ReciepientUserID: r.userId ?? r.reciepientUserID ?? null,
      RUSERID: r.userId ?? r.reciepientUserID ?? null,
      DeliveryMethod: r.deliveryMethod
    }));

    // one signable document per uploaded PDF that has fields
    const docsToSend = this.documents.filter(d => this.placedFields.some(f => f.documentId === d.documentId));
    if (!docsToSend.length) { this.toast.warning('Place at least one field before sending'); return; }

    // Build a SignatureModel-shaped payload → POST /API/SaveSignatureRequests (via sendDocument)
    const requests = docsToSend.map(doc => this.esignService.sendDocumentMail({
      DocumentId: doc.documentId,
      Patientid: draft.patientId ?? user.Patientid ?? 0,
      RequestDocumentName: doc.name || this.documentName,
      SendInOrder: !!draft.isOrdered,
      DaysToComplete: draft.daysToComplete ?? 0,
      Remainder: draft.reminderDays ?? 0,
      Notes: draft.note ?? '',
      HTMLDocumentName: doc.name || this.documentName,
      HTMLStringForSignature: '',       
      SenderEmail: user.EmpEmail ?? user.EmpEmail ?? 0,          // fill if you serialize placements as HTML
      UserId: user.UserId ?? user.userId ?? 0,
      WorkStationID: user.WorkStationID ?? user.workStationID ?? 0,
      HospitalId: user.HospitalId ?? user.hospitalId ?? 0,
      ReciepientsXML: buildRecipients(),
      Fields: this.placedFields.filter(f => f.documentId === doc.documentId).map(toField)
    } as any));

    this.isSending = true;
    forkJoin(requests).subscribe({
      next: () => {
        sessionStorage.removeItem('esign_draft');
        this.isSending = false;
        const count = docsToSend.length;
        this.toast.success(
          count > 1
            ? `${count} documents sent for signature`
            : 'Document sent for signature',
          { title: 'Sent' }
        );
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.isSending = false;
        this.toast.error('Failed to send document(s). Please try again', { title: 'Send failed' });
      }
    });
  }
  send(): void {
    if (this.isSending) { return; }
    if (this.placedFields.length === 0) { this.toast.warning('Place at least one field before sending'); return; }

    // Every field must belong to a recipient, or the server can't bind it
    // (and rightly refuses for multi-recipient documents).
    if (this.placedFields.some(f => !f.recipientClientId)) {
      this.toast.warning('Every field must be assigned to a recipient');
      return;
    }

    const draft = JSON.parse(sessionStorage.getItem('esign_draft') || '{}');
    const overlayRect = this.pageOverlay.nativeElement.getBoundingClientRect();

    // field placement -> percentages (top-left origin; backend converts to PDF points).
    // recipientClientId is REQUIRED so the server can bind each field to its signer.
    const toPct = (f: EditorField) => ({
      recipientClientId: f.recipientClientId,
      fieldType: f.fieldType,
      pageNumber: f.pageNumber,
      xPct: (f.xPx / overlayRect.width) * 100,
      yPct: (f.yPx / overlayRect.height) * 100,
      widthPct: (f.widthPx / overlayRect.width) * 100,
      heightPct: (f.heightPx / overlayRect.height) * 100,
      isRequired: f.isRequired
    });

    // Send one request per document that has fields (each PDF is its own signable document).
    const docsToSend = this.documents.filter(d => this.placedFields.some(f => f.documentId === d.documentId));
    if (!docsToSend.length) { this.toast.warning('Place at least one field before sending'); return; }

    const requests = docsToSend.map(doc => this.esignService.sendDocument({
      documentId: doc.documentId,
      documentName: doc.name,
      email: this.Email,
      EmpID: this.EmpID,
      isOrdered: draft.isOrdered,
      daysToComplete: draft.daysToComplete,
      reminderDays: draft.reminderDays,
      note: draft.note,
      recipients: this.recipients,
      fields: this.placedFields.filter(f => f.documentId === doc.documentId).map(toPct)
    } as SendDocumentRequest));

    this.isSending = true;
    forkJoin(requests).subscribe({
      next: () => {
        sessionStorage.removeItem('esign_draft');
        this.isSending = false;
        const count = docsToSend.length;
        this.toast.success(
          count > 1
            ? `${count} documents sent for signature`
            : 'Document sent for signature',
          { title: 'Sent' }
        );
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.isSending = false;
        this.toast.error('Failed to send document(s). Please try again', { title: 'Send failed' });
      }
    });
  }
}
