import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { EsignService } from 'src/app/services/esign.service';
import { ToastService } from 'src/app/toast.service';
import { FormsModule } from '@angular/forms'; // <-- Import FormsModule
import { CommonModule } from '@angular/common';

type CaptureTab = 'type' | 'draw' | 'upload';
type CaptureTarget = 'signatureSet' | 'stamp';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  standalone: true,
  imports: [CommonModule,FormsModule]
})
export class ProfileComponent implements OnInit {
  @ViewChild('sigPad') sigPad?: ElementRef<HTMLCanvasElement>;
  @ViewChild('initPad') initPad?: ElementRef<HTMLCanvasElement>;

  section: 'profile' | 'delegate' = 'profile';
  loading = false;
  saving = false;

  // ── profile fields ──
  firstName = '';
  lastName = '';
  email = '';
  company = 'Al Hammadi Holding';
  jobTitle = '';
  dateFormat = 'dd MMM yyyy';
  timeZone = 'Asia/Riyadh';
  dateFormats = ['dd MMM yyyy', 'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'];

  // ── saved images (base64 data URLs) ──
  signatureImg: string | null = null;
  initialImg: string | null = null;
  stampImg: string | null = null;
  photoUrl: string | null = null;

  // ── capture modal state ──
  showCapture = false;
  captureTarget: CaptureTarget = 'signatureSet';
  captureTab: CaptureTab = 'draw';
  typeSignatureText = '';
  typeInitialText :string='';
  tempSignature: string | null = null;
  tempInitial: string | null = null;
  tempStamp: string | null = null;

  private drawing: 'sig' | 'init' | null = null;
  private sigCtx: CanvasRenderingContext2D | null = null;
  private initCtx: CanvasRenderingContext2D | null = null;

  constructor(private esignService: EsignService, private toast: ToastService) {}

  /** doctorDetails may be stored as the array itself, as a { SmartDataList: [...] }
   *  wrapper, or as a plain object — resolve the user record from any of them. */
  private getUser(): any {
    try {
      const raw = JSON.parse(localStorage.getItem('doctorDetails') || '{}');
      if (Array.isArray(raw)) { return raw[0] || {}; }
      if (raw && Array.isArray(raw.SmartDataList)) { return raw.SmartDataList[0] || {}; }
      return raw || {};
    } catch { return {}; }
  }

  get userId(): number {
    const u = this.getUser();
    return Number(u.UserId ?? u.userId ?? u.EmpId ?? 0) || 0;
  }

  get fullName(): string {
    return [this.firstName, this.lastName].filter(Boolean).join(' ').trim() || '—';
  }
  get avatarInitials(): string {
    const s = (this.firstName?.[0] || '') + (this.lastName?.[0] || '');
    return (s || 'U').toUpperCase();
  }

  ngOnInit(): void {
    // Prime name/email/title from the locally cached user, then load saved images.
    const u = this.getUser();
    const name = (u.EmployeeName || u.LoginUsername || u.Name || '').replace(/\s+/g, ' ').trim();
    const parts = name.split(' ').filter(Boolean);
    this.firstName = u.FirstName || parts[0] || '';
    this.lastName = u.LastName || parts.slice(1).join(' ') || '';
    this.email = u.EmpEmail || u.Email || '';
    this.jobTitle = u.EmpDesignation || u.Designation || '';
    if (u.EmpDepartment) { this.company = String(u.EmpDepartment).trim(); }
    this.photoUrl = u.EmpPhotoPath || null;
    this.loadProfile();
  }

  loadProfile(): void {
    if (!this.userId) { return; }
    this.loading = true;
    this.esignService.getUserSignature(this.userId).subscribe({
      next: (res: any) => {
        // API wraps the record in an envelope: { Code, Status, Message, Data: {...} }.
        const r = (res && (res.Data ?? res.data)) ? (res.Data ?? res.data) : (res || {});
        this.signatureImg = r.SignatureBase64 ?? r.signatureBase64 ?? this.signatureImg;
        this.initialImg = r.InitialBase64 ?? r.initialBase64 ?? this.initialImg;
        this.stampImg = r.StampBase64 ?? r.stampBase64 ?? this.stampImg;
        this.dateFormat = r.DateFormat ?? r.dateFormat ?? this.dateFormat;
        this.timeZone = r.TimeZone ?? r.timeZone ?? this.timeZone;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  // ── open / close capture ──
  openSignature(): void {
    this.captureTarget = 'signatureSet';
    this.captureTab = 'draw';
    this.tempSignature = this.signatureImg;
    this.tempInitial = this.initialImg;
    this.typeSignatureText = '';
    this.typeInitialText = '';
    this.showCapture = true;
    setTimeout(() => this.setupCanvases(), 0);
  }
  openStamp(): void {
    this.captureTarget = 'stamp';
    this.captureTab = 'upload';
    this.tempStamp = this.stampImg;
    this.showCapture = true;
  }
  closeCapture(): void { this.showCapture = false; this.drawing = null; }

  setTab(tab: CaptureTab): void {
    this.captureTab = tab;
    if (tab === 'draw') { setTimeout(() => this.setupCanvases(), 0); }
  }

  // ── DRAW pads ──
  private setupCanvases(): void {
    this.sigCtx = this.prepPad(this.sigPad?.nativeElement);
    this.initCtx = this.prepPad(this.initPad?.nativeElement);
  }
  private prepPad(c?: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
    if (!c) { return null; }
    const rect = c.getBoundingClientRect();
    c.width = Math.max(1, Math.round(rect.width));
    c.height = Math.max(1, Math.round(rect.height));
    const ctx = c.getContext('2d');
    if (ctx) { ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#002654'; }
    return ctx;
  }
  private point(c: HTMLCanvasElement, e: PointerEvent) {
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  padDown(which: 'sig' | 'init', e: PointerEvent): void {
    const c = which === 'sig' ? this.sigPad?.nativeElement : this.initPad?.nativeElement;
    const ctx = which === 'sig' ? this.sigCtx : this.initCtx;
    if (!c || !ctx) { return; }
    this.drawing = which;
    const p = this.point(c, e);
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  padMove(which: 'sig' | 'init', e: PointerEvent): void {
    if (this.drawing !== which) { return; }
    const c = which === 'sig' ? this.sigPad?.nativeElement : this.initPad?.nativeElement;
    const ctx = which === 'sig' ? this.sigCtx : this.initCtx;
    if (!c || !ctx) { return; }
    const p = this.point(c, e);
    ctx.lineTo(p.x, p.y); ctx.stroke();
  }
  padUp(): void { this.drawing = null; }
  clearPad(which: 'sig' | 'init'): void {
    const c = which === 'sig' ? this.sigPad?.nativeElement : this.initPad?.nativeElement;
    const ctx = which === 'sig' ? this.sigCtx : this.initCtx;
    if (c && ctx) { ctx.clearRect(0, 0, c.width, c.height); }
  }

  // ── UPLOAD ──
  onFile(ev: Event, which: 'sig' | 'init' | 'stamp'): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) { return; }
    if (!file.type.startsWith('image/')) { this.toast.warning('Please choose an image file'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      if (which === 'sig') { this.tempSignature = url; }
      else if (which === 'init') { this.tempInitial = url; }
      else { this.tempStamp = url; }
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  // ── TYPE → render text to a transparent PNG in the brand font ──
  private renderTyped(text: string): string | null {
    if (!text || !text.trim()) { return null; }
    const c = document.createElement('canvas');
    c.width = 440; c.height = 130;
    const g = c.getContext('2d');
    if (!g) { return null; }
    g.fillStyle = '#002654';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = "44px 'Noto Kufi Arabic', sans-serif";
    g.fillText(text.trim(), c.width / 2, c.height / 2);
    return c.toDataURL('image/png');
  }

  private isBlank(c?: HTMLCanvasElement | null): boolean {
    if (!c) { return true; }
    const ctx = c.getContext('2d');
    if (!ctx) { return true; }
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < data.length; i += 4) { if (data[i] !== 0) { return false; } }
    return true;
  }

  // ── OK ──
  applyCapture(): void {
    if (this.captureTarget === 'stamp') {
      if (this.tempStamp) { this.stampImg = this.tempStamp; }
      this.showCapture = false;
      return;
    }

    if (this.captureTab === 'draw') {
      const sig = this.sigPad?.nativeElement;
      const ini = this.initPad?.nativeElement;
      if (sig && !this.isBlank(sig)) { this.tempSignature = sig.toDataURL('image/png'); }
      if (ini && !this.isBlank(ini)) { this.tempInitial = ini.toDataURL('image/png'); }
    } else if (this.captureTab === 'type') {
      this.tempSignature = this.renderTyped(this.typeSignatureText) ?? this.tempSignature;
      this.tempInitial = this.renderTyped(this.typeInitialText) ?? this.tempInitial;
    }
    // (upload tab already set temp* via onFile)

    this.signatureImg = this.tempSignature ?? this.signatureImg;
    this.initialImg = this.tempInitial ?? this.initialImg;
    this.showCapture = false;
  }

  // ── SAVE ──
  update(): void {
    if (!this.userId) { this.toast.error('Could not resolve your user id', { title: 'Not signed in' }); return; }
    if (this.saving) { return; }
    this.saving = true;
    this.esignService.saveUserSignature({
      userId: this.userId,
      signatureBase64: this.signatureImg,
      initialBase64: this.initialImg,
      stampBase64: this.stampImg,
      dateFormat: this.dateFormat,
      timeZone: this.timeZone
    }).subscribe({
      next: () => { this.saving = false; this.toast.success('Profile updated', { title: 'Saved' }); },
      error: () => { this.saving = false; this.toast.error('Failed to save. Please try again', { title: 'Save failed' }); }
    });
  }
}
