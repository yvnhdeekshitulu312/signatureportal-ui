import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EsignService } from '../../services/esign.service';
import { DocumentDetailResponse, FieldSummaryDto } from '../../models/esign.models';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ToastService } from 'src/app/toast.service';

@Component({ selector: 'app-document-sign', templateUrl: './document-sign.component.html' })
export class DocumentSignComponent implements OnInit {
  doc!: DocumentDetailResponse;
  currentPage = 1;
  fieldValues: { [fieldId: number]: string } = {};
  activeSignatureFieldId: number | null = null;
  isSubmitting = false;
  // Document preview/loading is now gated behind the disclosure consent
  // below (see hasConsented/agreeAndContinue()) — nothing is fetched until
  // the signer explicitly agrees, so this starts false rather than true.
  loading = false;
  private ctx!: CanvasRenderingContext2D;
  private drawing = false;
  pdfUrl!: SafeResourceUrl;
Email:any;
  private documentId = 0;

  // saved items from the signer's profile (GetUserSignature)
  userId = 0;
  savedSignature: string | null = null;
  savedInitial: string | null = null;
  savedStamp: string | null = null;
  showImport = false;
  loadingSaved = false;
  activeDateTimeFieldId: number | null = null;
  dateTimeValue = '';

  // ── "Electronic Record and Signature Disclosure" consent gate ──
  // The document only loads and previews once the signer ticks the checkbox
  // and clicks "Agree & Continue" — see the consent bar at the top of the
  // template and agreeAndContinue()/loadDocument() below.
  hasConsented = false;
  disclosureChecked = false;
  // TODO: point this at the real hosted disclosure document once available.
  disclosureUrl = 'assets/docs/electronic-signature-disclosure.pdf';

  constructor(private sanitizer: DomSanitizer, private route: ActivatedRoute,
    private router: Router, private esignService: EsignService, private toast: ToastService) {}

  ngOnInit(): void {
    const d = this.getUser();
    this.documentId = Number(this.route.snapshot.paramMap.get('id'));
    this.Email = d?.EmpEmail;
    this.userId = Number(d?.UserId ?? d?.userId ?? d?.EmpId ?? 0) || 0;
    // Safe to preload the signer's saved signature/initial/stamp before
    // consent — it doesn't expose the document itself, just prepares the
    // signing pad's "Import" options for once they do consent.
    this.loadMySignatures();
  }

  /** Ticking the checkbox and clicking "Agree & Continue" is what actually
   *  loads the document for preview/signing (see the consent bar in the
   *  template) — nothing is fetched before this. */
  agreeAndContinue(): void {
    if (!this.disclosureChecked || this.hasConsented) { return; }
    this.hasConsented = true;
    this.loadDocument();
  }

  private loadDocument(): void {
    this.loading = true;
    this.esignService.getForLoggedInSigner(this.documentId, this.Email).subscribe({
      next: (doc) => {
        this.doc = doc;
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(doc.ViewerGcsUrl);
        this.loading = false;
      },
      error: () => { this.loading = false; this.toast.error('Unable to load this document for signing.'); this.router.navigate(['/dashboard/document']); }
    });
  }

  /** Resolve the cached user record (array | SmartDataList wrapper | plain object). */
  private getUser(): any {
    try {
      const raw = JSON.parse(localStorage.getItem('doctorDetails') || '{}');
      if (Array.isArray(raw)) { return raw[0] || {}; }
      if (raw && Array.isArray(raw.SmartDataList)) { return raw.SmartDataList[0] || {}; }
      return raw || {};
    } catch { return {}; }
  }

  /** Pull the signer's saved signature / initial / stamp from their profile. */
  loadMySignatures(): void {
    if (!this.userId) { return; }
    this.loadingSaved = true;
    this.esignService.getUserSignature(this.userId).subscribe({
      next: (res: any) => {
        const r = (res && (res.Data ?? res.data)) ? (res.Data ?? res.data) : (res || {});
        this.savedSignature = r.SignatureBase64 ?? r.signatureBase64 ?? null;
        this.savedInitial = r.InitialBase64 ?? r.initialBase64 ?? null;
        this.savedStamp = r.StampBase64 ?? r.stampBase64 ?? null;
        this.loadingSaved = false;
      },
      error: () => { this.loadingSaved = false; }
    });
  }

  toggleImport(): void { this.showImport = !this.showImport; }

  /** Apply a saved profile image (signature or initial) to the active field. */
  useSaved(img: string | null): void {
    if (!img || this.activeSignatureFieldId === null) { return; }
    this.fieldValues[this.activeSignatureFieldId] = img;
    this.activeSignatureFieldId = null;
    this.showImport = false;
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
    if (f.FieldType === 'DateTime') { this.openDateTimePicker(f.Id); return; }
  }

  stampOptions = [
    'assets/stamps/hospital.png'
  ];

  activeStampFieldId: number | null = null;

  openDateTimePicker(fieldId: number): void {
  this.activeDateTimeFieldId = fieldId;
  const existing = this.fieldValues[fieldId];
  this.dateTimeValue = existing || this.toLocalDateTimeInputValue(new Date());
}

private toLocalDateTimeInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

applyDateTime(): void {
  if (this.activeDateTimeFieldId === null || !this.dateTimeValue) return;
  const d = new Date(this.dateTimeValue);
  this.fieldValues[this.activeDateTimeFieldId] = d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }); 
  this.activeDateTimeFieldId = null;
}

cancelDateTime(): void { this.activeDateTimeFieldId = null; }

  openStampSelector(fieldId: number): void {
    this.activeStampFieldId = fieldId;
  }

  applyStamp(stampImage: string): void {
    if (this.activeStampFieldId === null) return;

    if (stampImage.startsWith('data:')) {
      this.fieldValues[this.activeStampFieldId] = stampImage;
      this.activeStampFieldId = null;
      return;
    }

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
    this.showImport = false;
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
    if (!this.allRequiredFilled()) { this.toast.error('Please fill all required fields before submitting.'); return; }
    const fieldValues = Object.keys(this.fieldValues).map(id => ({ fieldId: Number(id), value: this.fieldValues[Number(id)] }));
    this.isSubmitting = true;
    this.esignService.signAsUser(this.doc.Id,this.Email, fieldValues).subscribe({
      next: () => { this.isSubmitting = false; this.toast.success(
        'Document signed successfully.',
        { title: 'Success' }
      ); this.router.navigate(['/dashboard/document']); },
      error: () => { this.isSubmitting = false;  this.toast.error(
        'Failed to sign document. Please try again.',
        { title: 'Error' }
      ); }
    });
  }
}