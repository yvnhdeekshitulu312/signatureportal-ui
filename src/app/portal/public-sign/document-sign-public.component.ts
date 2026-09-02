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

  // Same idea as alreadySigned above, but for this recipient's own Status
  // (from GetForSigner's Recipients array) already being 'Rejected' -- i.e.
  // they declined via this same link before. Shown instead of the
  // fields/signing UI below, same reasoning as alreadySigned. Before this,
  // there was no client-side check for this at all: a signer who had
  // already rejected could reopen their link and still see (and use) the
  // full signing form, including Submit.
  alreadyRejected = false;

  // ── Reject flow ──
  // Set once reject() succeeds -- shown instead of the document, same
  // reasoning as signedSuccessfully above (nowhere authenticated to send them).
  showRejectModal = false;
  rejectReason = '';
  isRejecting = false;
  rejectedSuccessfully = false;

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
        this.loading = false;

        // DEFENSE IN DEPTH: EsignController.GetForSigner catches ANY exception
        // thrown by GetDocumentForSignerAsync (bad token, expired link, a DB
        // failure while recording the first-view 'Viewed' status, anything)
        // and STILL returns HTTP 200 OK -- just with the error envelope
        // ({Code, Status, Message}, see objBase/SetErrorObject) instead of a
        // real DocumentDetailResponse (see the `catch` blocks in
        // EsignController.cs, every one of which ends in
        // `return OkOrNotFound(objBase);`). Angular's HttpClient sees "200 OK"
        // and calls THIS `next` callback, not `error` below -- so a
        // server-side failure here never used to reach the `error` handler at
        // all, it arrived right here disguised as success.
        //
        // A real DocumentDetailResponse always has a Fields array (empty at
        // worst); the error envelope never does -- that's what distinguishes
        // them. Without this check, `this.doc` got set to the error envelope,
        // which is truthy, so every `*ngIf="... && doc && ..."` guard in the
        // template was satisfied and it tried to render the signing UI --
        // then `fieldsOnPage()`'s `this.doc.Fields.filter(...)` below threw on
        // the missing Fields and silently broke the rest of the render. THAT
        // was the actual mechanism behind "nothing loads at all, reject
        // button included" whenever the server-side call failed -- most
        // often on a brand-new/never-before-opened link, since that's the one
        // case where GetDocumentForSignerAsync does an extra one-time DB
        // write (the Sent -> Viewed transition) that could throw.
        if (!doc || !Array.isArray((doc as any)?.Fields)) {
          this.loadError = (doc as any)?.Message
            || 'This signing link is invalid or has expired. Please ask the sender for a new one.';
          return;
        }

        this.doc = doc;

        // BUG FIX: GetForSigner's Fields array IS scoped to just this token's
        // recipient (server-side restrictToRecipientId), but its Recipients
        // array is NOT -- it lists every recipient on the whole document.
        // Picking "the first recipient with a SignedOn" out of that list, as
        // this used to do, meant that on any multi-recipient document where
        // SOME OTHER recipient had already signed, a genuinely new/unsigned
        // request would get flagged alreadySigned=true here too -- hiding the
        // entire signing/reject UI (including the Reject button) even though
        // THIS recipient hadn't done anything yet.
        //
        // Fix: resolve MY OWN recipientId from my own (correctly-scoped)
        // fields first, then look only that recipient up. If this recipient
        // has zero fields (e.g. a copy-only "View" role, or a Sign recipient
        // with no field placed yet), this deliberately falls back to NOT
        // flagging alreadySigned -- worst case they see the signing UI again,
        // which the server's own duplicate-sign guard (SignInternalAsync)
        // already rejects safely, rather than silently locking them out.
        const recipients: any[] = (doc as any)?.Recipients || [];
        const myRecipientId = (doc as any)?.Fields?.[0]?.RecipientId;
        const mine = myRecipientId != null
          ? recipients.find((r: any) => r?.Id === myRecipientId)
          : undefined;
        if (mine?.SignedOn) {
          this.alreadySigned = true;
          this.alreadySignedOn = mine.SignedOn;
        }

        // Same recipient-scoping reasoning as alreadySigned above (`mine`,
        // not "any recipient on the document") -- this recipient's own
        // Status coming back as 'Rejected' means THEY already declined via
        // this link, regardless of what any other recipient on the document
        // has done.
        if (mine?.Status === 'Rejected') {
          this.alreadyRejected = true;
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
      next: (res: any) => {
        this.isSubmitting = false;

        // SAME TRAP as loadDocument()'s doc-load fix above: EsignController.Sign
        // catches an InvalidOperationException (e.g. the server's own
        // duplicate-sign guard -- "already signed", and now also "this
        // document was already rejected and can't be signed") and still
        // returns HTTP 200 OK with the error envelope ({Code, Status,
        // Message}), not a non-2xx status. Without checking the body here,
        // THIS `next` callback ran unconditionally and always set
        // signedSuccessfully = true -- so a signer who, say, revisited a
        // link after already rejecting it would see "Document signed"
        // regardless of what the server actually did.
        if (res && (res.Code === 'Fail' || res.Status === 'Fail')) {
          this.toast.error(res?.Message || 'Failed to sign document. Please try again.', { title: 'Error' });
          return;
        }

        this.signedSuccessfully = true;
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.toast.error(err?.error?.Message || 'Failed to sign document. Please try again.', { title: 'Error' });
      }
    });
  }

  // ── Reject flow ──
  // Opens the "enter remarks" modal. The doc itself stays as-is behind it;
  // nothing is submitted until submitReject() below.
  openRejectModal(): void {
    if (this.isSubmitting) { return; }
    this.rejectReason = '';
    this.showRejectModal = true;
  }

  closeRejectModal(): void {
    if (this.isRejecting) { return; } // don't let a stray click cancel mid-submit
    this.showRejectModal = false;
  }

  /** POSTs to API/Esign/Reject (EsignController.Reject -> EsignService.RejectAsync),
   *  same accessToken this whole page runs on. The server records the remarks
   *  (EsignRecipient.RejectReason + a permanent row in EsignRejections -- see
   *  PR_EsignAddRejection), marks the recipient Rejected, and marks the whole
   *  document Rejected. */
  submitReject(): void {
    if (this.isRejecting) { return; }
    const reason = (this.rejectReason || '').trim();
    if (!reason) { this.toast.warning('Please enter a reason for rejecting this document.'); return; }

    this.isRejecting = true;
    this.esignService.reject(this.token, reason).subscribe({
      next: (res: any) => {
        this.isRejecting = false;

        // Same 200-OK-with-error-envelope trap as submit() above -- check
        // before declaring success.
        if (res && (res.Code === 'Fail' || res.Status === 'Fail')) {
          this.toast.error(res?.Message || 'Failed to reject document. Please try again.', { title: 'Error' });
          return;
        }

        this.showRejectModal = false;
        this.rejectedSuccessfully = true;
      },
      error: (err: any) => {
        this.isRejecting = false;
        this.toast.error(err?.error?.Message || 'Failed to reject document. Please try again.', { title: 'Error' });
      }
    });
  }
}
