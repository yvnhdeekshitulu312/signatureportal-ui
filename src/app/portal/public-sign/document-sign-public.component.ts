import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EsignService } from 'src/app/services/esign.service';
import { DocumentDetailResponse, FieldSummaryDto } from 'src/app/models/esign.models';
import { ToastService } from 'src/app/toast.service';

// Reached ONLY via an emailed "Start Signing" link --
// /pendingdocuments/sign/:token, registered as a top-level route with NO
// AuthguardGuard (see public-sign-routing.module.ts and
// app-routing.module.ts). Note this is a separate, unrelated top-level route
// from the guarded 'dashboard/pendingdocuments/sign/:id' route -- same
// words, different route tree; this one has no 'dashboard' prefix and takes
// a token, not a numeric document id. The token is the
// recipient's own EsignRecipient.AccessToken, generated when the document was
// sent (EsignService.cs SendDocumentAsync) and never exposed anywhere except
// this link, so knowing it is what stands in for being logged in.
// GetDocumentForSignerAsync/SignAsync on the server additionally scope every
// response to just this recipient and enforce the document's own expiry
// (doc.SentOn + doc.DaysToComplete -- see IsSigningLinkExpired in
// EsignService.cs), so this route can't be used to browse or sign anything
// beyond what this one link was actually issued for.
//
// This is a deliberate near-duplicate of DocumentSignComponent
// (portal/document/document-sign.component.ts), not a shared/refactored
// component: that one authenticates by documentId + logged-in email
// (GetForLoggedInSigner/SignAsUser, gated by AuthguardGuard on the parent
// 'dashboard' route) and lives inside the lazy PortalModule alongside the
// rest of the internal dashboard shell. This one authenticates by
// accessToken alone and must stay reachable with NO login and NO dependency
// on anything under 'dashboard' -- pulling it into PortalModule (or vice
// versa) would either drag the guarded shell into an unguarded route or
// require restructuring PortalModule's routing, both riskier than a focused
// duplicate for this one purpose. Keep the two in sync by hand if the
// signing UI itself changes.
//
// "Import" here is a TOKEN-based counterpart to DocumentSignComponent's
// profile-based import (GetUserSignature by userId) -- there's no logged-in
// userId on this page, so loadMySignatures() below calls
// GetUserSignatureToken(accessToken) instead: the server resolves the
// recipient's own email from the token (see EsignService.
// GetUserSignatureForTokenAsync) and returns whatever signature/initial/
// stamp is on file for that email, same shape as GetUserSignature's
// response (SignatureBase64/InitialBase64/StampBase64). On top of that,
// whatever the signer draws fresh on THIS document is also offered back via
// Import for any other signature field, so a signer with nothing saved yet
// still doesn't have to redraw an identical signature by hand every time --
// see applySignature()/signatureStorageKey below for that local-only part.
@Component({ selector: 'app-document-sign-public', templateUrl: './document-sign-public.component.html' })
export class DocumentSignPublicComponent implements OnInit, OnDestroy {
  doc!: DocumentDetailResponse;
  currentPage = 1;
  fieldValues: { [fieldId: number]: string } = {};
  activeSignatureFieldId: number | null = null;
  isSubmitting = false;
  loading = false;
  private ctx!: CanvasRenderingContext2D;
  private drawing = false;

  private token = '';

  // Set on an unrecoverable load failure (missing/invalid/expired link, or a
  // network error) -- shown instead of the consent gate/document. Unlike
  // DocumentSignComponent's error handling, this never redirects anywhere:
  // there's no logged-in dashboard for an anonymous token-based signer to be
  // sent back to.
  loadError: string | null = null;
  // Set once submit() succeeds -- shown instead of the document, for the same
  // reason: nowhere authenticated to navigate this signer to afterwards.
  signedSuccessfully = false;

  // Set from GetForSigner's response when THIS recipient's own "SignedOn" is
  // already populated (non-null) -- i.e. they used this link once before and
  // already completed signing. Shown instead of the signing form/fields, same
  // reasoning as signedSuccessfully above (nowhere authenticated to send them).
  alreadySigned = false;
  alreadySignedOn: string | null = null;

  activeDateTimeFieldId: number | null = null;
  dateTimeValue = '';

  activeStampFieldId: number | null = null;
  stampOptions = ['assets/stamps/hospital.png'];

  // ── "Import" -- see the header-comment explanation above ──
  showImport = false;
  loadingSaved = false;
  savedSignature: string | null = null;
  savedInitial: string | null = null;
  savedStamp: string | null = null;
  private get signatureStorageKey(): string { return 'esignPublicSavedSig_' + this.token; }

  // ── "Electronic Record and Signature Disclosure" consent gate ──
  // The document only loads once the signer ticks the checkbox and clicks
  // "Agree & Continue" -- same pattern as DocumentSignComponent.
  hasConsented = false;
  disclosureChecked = false;
  disclosureUrl = 'assets/docs/electronic-signature-disclosure.pdf';

  // ── header clock ──
  // Purely cosmetic (matches the "Tue, Aug 25, 2026  09:04:54 PM" strip in
  // PortalComponent's header, see portal.component.ts's identical
  // updateTime()/timerId pattern) -- no data dependency, so it's safe to
  // duplicate here without pulling in anything from the guarded portal shell.
  currentDate = '';
  currentTime = '';
  private timerId: any;

  constructor(private route: ActivatedRoute, private esignService: EsignService, private toast: ToastService) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    if (!this.token) {
      this.loadError = 'This signing link is missing or malformed.';
    } else {
      // Local fallback shows up immediately; loadMySignatures() below will
      // override savedSignature with the server-saved one, if there is one,
      // once it responds.
      try { this.savedSignature = localStorage.getItem(this.signatureStorageKey); } catch { this.savedSignature = null; }
      // Safe to preload before consent -- it doesn't expose the document
      // itself, just prepares the signing pad's "Import" option for once
      // they do consent (same reasoning as DocumentSignComponent's
      // loadMySignatures(), just keyed by accessToken instead of userId).
      this.loadMySignatures();
    }
    this.updateTime();
    this.timerId = setInterval(() => this.updateTime(), 1000);
  }

  ngOnDestroy(): void {
    if (this.timerId) { clearInterval(this.timerId); }
  }

  private updateTime(): void {
    const now = new Date();
    this.currentDate = now.toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
    this.currentTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  agreeAndContinue(): void {
    if (!this.disclosureChecked || this.hasConsented || this.loadError) { return; }
    this.hasConsented = true;
    this.loadDocument();
  }

  /** Pull the signer's saved signature/initial/stamp using the accessToken
   *  from the URL -- the server resolves accessToken -> recipient's email ->
   *  saved signature (see EsignService.GetUserSignatureForTokenAsync /
   *  EsignController.GetUserSignatureToken). Same response-field parsing as
   *  DocumentSignComponent.loadMySignatures(), just token- instead of
   *  userId-keyed. Doesn't overwrite a signature the signer already drew on
   *  THIS document in this session (see the `?? this.savedSignature`
   *  fallback) -- a fresh, ready-to-use signature from their profile only
   *  replaces the locally-drawn one, never the other way around here. */
  loadMySignatures(): void {
    if (!this.token) { return; }
    this.loadingSaved = true;
    this.esignService.getUserSignatureToken(this.token).subscribe({
      next: (res: any) => {
        const r = (res && (res.Data ?? res.data)) ? (res.Data ?? res.data) : (res || {});
        this.savedSignature = r.SignatureBase64 ?? r.signatureBase64 ?? this.savedSignature;
        this.savedInitial = r.InitialBase64 ?? r.initialBase64 ?? null;
        this.savedStamp = r.StampBase64 ?? r.stampBase64 ?? null;
        this.loadingSaved = false;
      },
      // No saved signature on file (or the lookup failed) is not an error
      // state for this page -- the signer just draws one instead, same as
      // before this endpoint existed.
      error: () => { this.loadingSaved = false; }
    });
  }

  private loadDocument(): void {
    this.loading = true;
    this.esignService.getDocumentForSigner(this.token).subscribe({
      next: (doc) => {
        this.doc = doc;
        this.loading = false;

        // GetForSigner scopes Recipients to just this token's recipient (see
        // the header comment above) -- a non-null SignedOn there means they
        // already completed signing via this same link previously.
        const recipients: any[] = (doc as any)?.Recipients || [];
        const mine = recipients.find((r: any) => !!r?.SignedOn) || recipients[0];
        if (mine?.SignedOn) {
          this.alreadySigned = true;
          this.alreadySignedOn = mine.SignedOn;
        }
      },
      error: (err: any) => {
        this.loading = false;
        this.loadError = err?.error?.Message || 'This signing link is invalid or has expired. Please ask the sender for a new one.';
      }
    });
  }

  /** "8/29/2026 1:36:37 PM" (the server's raw SignedOn string) formatted the
   *  same way applyDateTime() already renders a DateTime field's value. */
  get alreadySignedOnFormatted(): string {
    if (!this.alreadySignedOn) { return ''; }
    const d = new Date(this.alreadySignedOn);
    if (isNaN(d.getTime())) { return this.alreadySignedOn; }
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  get pageImages(): string[] {
    return ((this.doc as any)?.PageImages || []).map((b64: string) =>
      b64.startsWith('data:') ? b64 : 'data:image/jpeg;base64,' + b64
    );
  }

  fieldsOnPage(page: number): FieldSummaryDto[] { return this.doc.Fields.filter(f => f.PageNumber === page); }
  isFilled(fieldId: number): boolean { return !!this.fieldValues[fieldId]; }

  boxStyle(f: FieldSummaryDto) {
    return { left: f.XPct + '%', top: f.YPct + '%', width: f.WidthPct + '%', height: f.HeightPct + '%' };
  }

  onFieldClick(f: FieldSummaryDto): void {
    if (f.FieldType === 'Signature') { this.openSignaturePad(f.Id); return; }
    else if (f.FieldType === 'Stamp') { this.openStampSelector(f.Id); return; }
    else if (f.FieldType === 'Checkbox') { this.fieldValues[f.Id] = this.fieldValues[f.Id] === 'true' ? 'false' : 'true'; }
    if (f.FieldType === 'DateTime') { this.openDateTimePicker(f.Id); return; }
  }

  openDateTimePicker(fieldId: number): void {
    this.activeDateTimeFieldId = fieldId;
    const existing = this.fieldValues[fieldId];
    this.dateTimeValue = existing || this.toLocalDateTimeInputValue(new Date());
  }

  private toLocalDateTimeInputValue(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

  openStampSelector(fieldId: number): void { this.activeStampFieldId = fieldId; }

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
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  openSignaturePad(fieldId: number): void {
    this.activeSignatureFieldId = fieldId;
    this.showImport = false;
    setTimeout(() => this.initCanvas(), 0);
  }

  toggleImport(): void { this.showImport = !this.showImport; }

  /** Apply a saved signature/initial (from the profile lookup, or drawn
   *  earlier in this session) to the active field. */
  useSaved(img: string | null): void {
    if (!img || this.activeSignatureFieldId === null) { return; }
    this.fieldValues[this.activeSignatureFieldId] = img;
    this.activeSignatureFieldId = null;
    this.showImport = false;
  }

  private initCanvas(): void {
    const canvas = document.getElementById('sigCanvasPublic') as HTMLCanvasElement;
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
    const canvas = document.getElementById('sigCanvasPublic') as HTMLCanvasElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  applySignature(): void {
    const canvas = document.getElementById('sigCanvasPublic') as HTMLCanvasElement;
    const dataUrl = canvas.toDataURL('image/png');
    this.fieldValues[this.activeSignatureFieldId!] = dataUrl;
    this.activeSignatureFieldId = null;

    // Offer this same drawing back via "Import" for any other signature
    // field on this document (see signatureStorageKey comment above).
    this.savedSignature = dataUrl;
    try { localStorage.setItem(this.signatureStorageKey, dataUrl); } catch { /* storage unavailable -- import just won't persist across a reload */ }
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
    this.esignService.sign(this.token, fieldValues).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.signedSuccessfully = true;
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.toast.error(err?.error?.Message || 'Failed to sign document. Please try again.', { title: 'Error' });
      }
    });
  }
}
