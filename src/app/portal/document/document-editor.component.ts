import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CdkDragDrop, CdkDragEnd } from '@angular/cdk/drag-drop';
import { forkJoin } from 'rxjs';
import { EsignService } from '../../services/esign.service';
import { FieldType, PlacedField, RecipientDto, SendDocumentRequest } from '../../models/esign.models';

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
  ];

  selectedFieldId: string | null = null;
  isSending = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private esignService: EsignService
  ) {}

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
    if (!this.activeRecipientClientId) { alert('Select a recipient first.'); return; }
    const paletteItem: FieldPaletteItem = event.item.data;
    const overlayRect = this.pageOverlay.nativeElement.getBoundingClientRect();
    const dropX = event.dropPoint.x - overlayRect.left;
    const dropY = event.dropPoint.y - overlayRect.top;
    this.addFieldAt(paletteItem, dropX - paletteItem.defaultWidthPx / 2, dropY - paletteItem.defaultHeightPx / 2);
  }

  addFieldByClick(item: FieldPaletteItem): void {
    if (!this.activeRecipientClientId) { alert('Select a recipient first.'); return; }
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
    const overlayRect = this.pageOverlay.nativeElement.getBoundingClientRect();
    const finalPoint = event.dropPoint;
    field.xPx = Math.max(0, finalPoint.x - overlayRect.left - field.widthPx / 2);
    field.yPx = Math.max(0, finalPoint.y - overlayRect.top - field.heightPx / 2);
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
      this.router.navigate(['/dashboard']);
    }
  }

  send(): void {
    if (this.isSending) { return; }
    if (this.placedFields.length === 0) { alert('Place at least one field before sending.'); return; }

    const draft = JSON.parse(sessionStorage.getItem('esign_draft') || '{}');
    const overlayRect = this.pageOverlay.nativeElement.getBoundingClientRect();

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
    if (!docsToSend.length) { alert('Place at least one field before sending.'); return; }

    const requests = docsToSend.map(doc => this.esignService.sendDocument({
      documentId: doc.documentId,
      documentName: doc.name,
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
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.isSending = false;
        alert('Failed to send document(s). Please try again.');
      }
    });
  }
}
