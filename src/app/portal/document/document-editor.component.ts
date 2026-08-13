import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CdkDragDrop, CdkDragEnd } from '@angular/cdk/drag-drop';
import { EsignService } from '../../services/esign.service';
import { FieldType, PlacedField, RecipientDto, SendDocumentRequest } from '../../models/esign.models';

interface FieldPaletteItem {
  type: FieldType;
  label: string;
  defaultWidthPx: number;
  defaultHeightPx: number;
}

@Component({
  selector: 'app-document-editor',
  templateUrl: './document-editor.component.html'
})
export class DocumentEditorComponent implements OnInit {
  @ViewChild('pageOverlay', { static: false }) pageOverlay!: ElementRef<HTMLDivElement>;

  documentId!: number;
  documentName = '';
  pageImages: string[] = [];
  currentPage = 1; // 1-indexed, matches EsignField.pageNumber

  recipients: RecipientDto[] = [];
  activeRecipientClientId: string | null = null;

  placedFields: PlacedField[] = [];
  fieldCounter = 0;

  // Palette shown in the right-hand "Fields" panel -- matches your existing markup
  fieldPalette: FieldPaletteItem[] = [
    { type: 'Signature', label: 'Signature', defaultWidthPx: 160, defaultHeightPx: 50 },
    { type: 'Stamp', label: 'Stamp', defaultWidthPx: 120, defaultHeightPx: 120 },
    { type: 'Text', label: 'Text', defaultWidthPx: 160, defaultHeightPx: 30 },
  ];

  selectedFieldId: string | null = null; // drives the "edit recipient/field" side panel
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
    this.recipients = draft.recipients;
    this.pageImages = draft.pageImages || [];
    this.activeRecipientClientId = this.recipients[0]?.clientId ?? null;
  }

  selectRecipient(clientId: string): void {
    this.activeRecipientClientId = clientId;
  }

  // Drag from the Fields palette onto the document overlay
  onFieldDropped(event: CdkDragDrop<any>, pageNumber: number): void {
    if (!this.activeRecipientClientId) {
      alert('Select a recipient first.');
      return;
    }

    const paletteItem: FieldPaletteItem = event.item.data;
    const overlayRect = this.pageOverlay.nativeElement.getBoundingClientRect();

    const dropX = event.dropPoint.x - overlayRect.left;
    const dropY = event.dropPoint.y - overlayRect.top;

    this.addFieldAt(paletteItem, dropX - paletteItem.defaultWidthPx / 2, dropY - paletteItem.defaultHeightPx / 2);
  }

  // Click a field type in the palette -- drops it on the currently visible page
  // for whichever recipient is selected. Each click adds a NEW, independent field
  // instance (not a toggle) -- clicking "Signature" three times gives you three
  // separate signature boxes, each individually draggable/deletable. Position is
  // staggered per click so repeated clicks don't stack exactly on top of each
  // other and look like nothing happened.
  addFieldByClick(item: FieldPaletteItem): void {
    if (!this.activeRecipientClientId) {
      alert('Select a recipient first.');
      return;
    }

    const overlayRect = this.pageOverlay?.nativeElement.getBoundingClientRect();
    const baseX = overlayRect ? overlayRect.width / 2 - item.defaultWidthPx / 2 : 40;
    const baseY = overlayRect ? overlayRect.height / 2 - item.defaultHeightPx / 2 : 40;

    const existingOnPage = this.placedFields.filter((f) => f.pageNumber === this.currentPage).length;
    const stagger = (existingOnPage % 8) * 24; // wraps after 8 so it doesn't cascade off-page

    this.addFieldAt(item, baseX + stagger, baseY + stagger);
  }

  private addFieldAt(item: FieldPaletteItem, xPx: number, yPx: number): void {
    this.fieldCounter++;
    const tempId = `f${this.fieldCounter}`;
    this.placedFields.push({
      tempId,
      recipientClientId: this.activeRecipientClientId!,
      fieldType: item.type,
      pageNumber: this.currentPage,
      xPx: Math.max(0, xPx),
      yPx: Math.max(0, yPx),
      widthPx: item.defaultWidthPx,
      heightPx: item.defaultHeightPx,
      isRequired: true
    });
    this.selectedFieldId = tempId; // opens the field-settings panel immediately
  }

  // Repositioning a field already placed on the page
  onFieldMoved(event: CdkDragEnd, field: PlacedField): void {
    const overlayRect = this.pageOverlay.nativeElement.getBoundingClientRect();
    const finalPoint = event.dropPoint;
    field.xPx = Math.max(0, finalPoint.x - overlayRect.left - field.widthPx / 2);
    field.yPx = Math.max(0, finalPoint.y - overlayRect.top - field.heightPx / 2);
  }

  selectField(fieldId: string): void {
    this.selectedFieldId = fieldId;
  }

  deleteField(fieldId: string): void {
    this.placedFields = this.placedFields.filter((f) => f.tempId !== fieldId);
    if (this.selectedFieldId === fieldId) this.selectedFieldId = null;
  }

  // Wrapper for the template button, where selectedFieldId is known non-null
  // (the button only renders inside *ngIf="selectedFieldId") but TypeScript
  // can't infer that narrowing across the template.
  deleteSelectedField(): void {
    if (this.selectedFieldId) this.deleteField(this.selectedFieldId);
  }

  recipientColor(clientId: string): string {
    const idx = this.recipients.findIndex((r) => r.clientId === clientId);
    const palette = ['#43A9BC', '#E29B3E', '#8B5CF6', '#EF4444'];
    return palette[idx % palette.length];
  }

  goBack(): void {
    this.router.navigate(['/dashboard/sendforsignature']);
  }

  reject(): void {
    if (confirm('Discard this document?')) {
      sessionStorage.removeItem('esign_draft');
      this.router.navigate(['/dashboard']);
    }
  }

  send(): void {
    if (this.isSending) return; 
    if (this.placedFields.length === 0) {
      alert('Place at least one field before sending.');
      return;
    }

    const draft = JSON.parse(sessionStorage.getItem('esign_draft') || '{}');
    const overlayRect = this.pageOverlay.nativeElement.getBoundingClientRect();

    const request: SendDocumentRequest = {
      documentId: this.documentId,
      documentName: this.documentName,
      isOrdered: draft.isOrdered,
      daysToComplete: draft.daysToComplete,
      reminderDays: draft.reminderDays,
      note: draft.note,
      recipients: this.recipients,
      fields: this.placedFields.map((f) => ({
        recipientClientId: f.recipientClientId,
        fieldType: f.fieldType,
        pageNumber: f.pageNumber,
        xPct: (f.xPx / overlayRect.width) * 100,
        yPct: (f.yPx / overlayRect.height) * 100,
        widthPct: (f.widthPx / overlayRect.width) * 100,
        heightPct: (f.heightPx / overlayRect.height) * 100,
        isRequired: f.isRequired
      }))
    };

    this.isSending = true;
    this.esignService.sendDocument(request).subscribe({
      next: () => {
        sessionStorage.removeItem('esign_draft');
        this.isSending = false;
        // trigger your existing #saveMessage modal here (jQuery/Bootstrap modal show)
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.isSending = false;
        alert('Failed to send document. Please try again.');
      }
    });
  }
}