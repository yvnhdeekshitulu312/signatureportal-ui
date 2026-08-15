import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EsignService } from '../../services/esign.service';
import { DocumentDetailResponse, FieldSummaryDto } from '../../models/esign.models';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({ selector: 'app-document-sign', templateUrl: './document-sign.component.html' })
export class DocumentSignComponent implements OnInit {
  doc!: DocumentDetailResponse;
  currentPage = 1;
  fieldValues: { [fieldId: number]: string } = {};
  activeSignatureFieldId: number | null = null;
  isSubmitting = false;
  loading = true;
  private ctx!: CanvasRenderingContext2D;
  private drawing = false;
  pdfUrl!: SafeResourceUrl;

  constructor(private sanitizer: DomSanitizer, private route: ActivatedRoute, private router: Router, private esignService: EsignService) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.esignService.getForLoggedInSigner(id).subscribe({
      next: (doc) => { this.doc = doc; 
        
         this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
            doc.ViewerGcsUrl
        );
        this.loading = false; },
      error: () => { this.loading = false; alert('Unable to load this document for signing.'); this.router.navigate(['/dashboard/document']); }
    });
  }

  get pageImages(): string[] {
    return ((this.doc as any).PageImages || []).map((b64: string) =>
      b64.startsWith('data:') ? b64 : 'data:image/jpeg;base64,' + b64
    );
  }

  fieldsOnPage(page: number): FieldSummaryDto[] { return this.doc.Fields.filter(f => f.PageNumber === page); }
  isFilled(fieldId: number): boolean { return !!this.fieldValues[fieldId]; }

  boxStyle(f: FieldSummaryDto) {
    return { left: f.XPct + '%', top: f.YPct + '%', width: f.WidthPct + '%', height: f.HeightPct + '%' };
  }

  onFieldClick(f: FieldSummaryDto): void {
    if (f.FieldType === 'Signature') {
        this.openSignaturePad(f.Id);
        return;
    }

    else if (f.FieldType === 'Stamp') {
        this.openStampSelector(f.Id);
        return;
    }
    // if (f.FieldType === 'Signature' || f.FieldType === 'Stamp') this.openSignaturePad(f.Id);
    else if (f.FieldType === 'Checkbox') this.fieldValues[f.Id] = this.fieldValues[f.Id] === 'true' ? 'false' : 'true';
    else if (f.FieldType === 'Date') this.fieldValues[f.Id] = new Date().toLocaleDateString();
  }

  stampOptions = [
    'assets/stamps/hospital.png'
  ];

  activeStampFieldId: number | null = null;

  openStampSelector(fieldId: number): void {
    this.activeStampFieldId = fieldId;
  }

  applyStamp(stampImage: string): void {
    if (this.activeStampFieldId === null) return;

    this.convertImageToBase64(stampImage).then(base64 => {
      this.fieldValues[this.activeStampFieldId!] = base64;
      this.activeStampFieldId = null;
    });
  }

  private async convertImageToBase64(imageUrl: string): Promise<string> {
    const response = await fetch(imageUrl);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onloadend = () => {
        resolve(reader.result as string);
      };

      reader.onerror = reject;

      reader.readAsDataURL(blob);
    });
  }

  // applyStamp(stampImage: string): void {
  //   if (this.activeStampFieldId === null) return;

  //   this.fieldValues[this.activeStampFieldId] = stampImage;
  //   this.activeStampFieldId = null;
  // }

  openSignaturePad(fieldId: number): void {
    this.activeSignatureFieldId = fieldId;
    setTimeout(() => this.initCanvas(), 0);
  }

  private initCanvas(): void {
    const canvas = document.getElementById('sigCanvas') as HTMLCanvasElement;
    if (!canvas) return;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.strokeStyle = '#000'; this.ctx.lineWidth = 2; this.ctx.lineJoin = 'round'; this.ctx.lineCap = 'round';
  }

  startDraw(e: MouseEvent): void {
    this.drawing = true;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    this.ctx.beginPath();
    this.ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }
  draw(e: MouseEvent): void {
    if (!this.drawing) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    this.ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    this.ctx.stroke();
  }
  endDraw(): void { this.drawing = false; }
  clearSignature(): void {
    const canvas = document.getElementById('sigCanvas') as HTMLCanvasElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // "replace the box with the signature" -- store the drawn PNG as the field's value
  applySignature(): void {
    const canvas = document.getElementById('sigCanvas') as HTMLCanvasElement;
    this.fieldValues[this.activeSignatureFieldId!] = canvas.toDataURL('image/png');
    this.activeSignatureFieldId = null;
  }
  cancelSignature(): void { this.activeSignatureFieldId = null; }

  allRequiredFilled(): boolean {
    return this.doc.Fields.every((f: any) => !f.IsRequired || this.isFilled(f.Id));
  }

  submit(): void {
    if (this.isSubmitting) return;
    if (!this.allRequiredFilled()) { alert('Please fill all required fields before submitting.'); return; }
    const fieldValues = Object.keys(this.fieldValues).map(id => ({ fieldId: Number(id), value: this.fieldValues[Number(id)] }));
    this.isSubmitting = true;
    this.esignService.signAsUser(this.doc.Id, fieldValues).subscribe({
      next: () => { this.isSubmitting = false; alert('Document signed successfully.'); this.router.navigate(['/dashboard/document']); },
      error: () => { this.isSubmitting = false; alert('Failed to sign document. Please try again.'); }
    });
  }
}