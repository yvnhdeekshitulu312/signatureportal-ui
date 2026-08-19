import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { EsignService } from '../../services/esign.service';
import { ConfigService } from '../../services/config.service';
import { ToastService } from 'src/app/toast.service';
interface UploadedDoc {
  documentId: number;
  name: string;
  pages: string[]; // base64 data URLs
}

@Component({
  selector: 'app-send-for-signature',
  templateUrl: './send-for-signature.component.html',
  styleUrls: ['./send-for-signature.component.scss']   // ← added (was template-only)
})
export class SendForSignatureComponent implements OnInit {
  form!: FormGroup;

  // Multiple documents — each PDF uploaded becomes one UploadedDoc.
  uploadedDocs: UploadedDoc[] = [];
  uploadedDocumentId: number | null = null; // first doc (kept for backward-compat routing)
  private pending = 0;

  isUploading = false;
  isSending = false;
  owner = 'You';
  Email: any;
  EmpID: any;
  // ── employee smart-search (per recipient row) ──
  empSuggestions: any[] = [];
  suggestFor: number | null = null;
  searchingEmp = false;
  private searchTimer: any;

  constructor(
    private fb: FormBuilder,
    private esignService: EsignService,
    private ConfigService: ConfigService,
    private router: Router, private toast: ToastService,
  ) {
    const d = JSON.parse(localStorage.getItem('doctorDetails') || '{}');
    this.owner = d?.Name || d?.FullName || d?.EmployeeName || d?.DoctorName || d?.UserName || 'You';
    this.Email = d?.EmpEmail;
    this.EmpID=d?.EmpId;
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      documentName: ['', Validators.required],
      sendInOrder: [false],
      daysToComplete: [null],
      reminderDays: [null],
      note: [''],
      recipients: this.fb.array([this.buildRecipientGroup(1)])
    });
  }

  get recipients(): FormArray {
    return this.form.get('recipients') as FormArray;
  }

  /** Combined pages across all uploaded documents (preview + editor draft). */
  get pageImages(): string[] {
    return this.uploadedDocs.reduce<string[]>((all, d) => all.concat(d.pages), []);
  }

  get sendInOrder(): boolean {
    return !!this.form?.get('sendInOrder')?.value;
  }

  buildRecipientGroup(order: number): FormGroup {
    return this.fb.group({
      clientId: [`r${order}_${Date.now()}`],
      order: [order],
      email: ['', [Validators.required, Validators.email]],
      empID: [''],
      name: ['', Validators.required],
      role: ['Sign', Validators.required],
      deliveryMethod: ['Email', Validators.required]
    });
  }

  addRecipient(): void {
    this.recipients.push(this.buildRecipientGroup(this.recipients.length + 1));
    this.renumber();
  }

  removeRecipient(index: number): void {
    if (this.recipients.length > 1) {
      this.recipients.removeAt(index);
      this.renumber();
    }
  }

  // ── reorder recipients (drives signing order when "Send in order" is on) ──
  moveRecipient(from: number, to: number): void {
    if (to < 0 || to >= this.recipients.length || from === to) { return; }
    const ctrl = this.recipients.at(from);
    this.recipients.removeAt(from);
    this.recipients.insert(to, ctrl);
    this.renumber();
  }
  moveUp(i: number): void { this.moveRecipient(i, i - 1); }
  moveDown(i: number): void { this.moveRecipient(i, i + 1); }

  private renumber(): void {
    this.recipients.controls.forEach((c, idx) => c.get('order')?.setValue(idx + 1));
  }

  // ── file upload (multiple) ──
  uploadFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) { return; }
    this.handleFiles(input.files);
    input.value = '';
  }

  onFileDropped(event: DragEvent): void {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length) { this.handleFiles(files); }
  }

  private handleFiles(files: FileList): void {
    const pdfs = Array.from(files).filter(f => f.type === 'application/pdf');
    if (!pdfs.length) { alert('Please upload PDF documents.'); return; }

    // seed the document name from the first file if the field is empty
    if (!this.form.get('documentName')?.value && pdfs[0]) {
      this.form.patchValue({ documentName: pdfs[0].name.replace(/\.pdf$/i, '') });
    }
    pdfs.forEach(f => this.uploadOne(f));
  }

  // private uploadOne(file: File): void {
  //   this.pending++;
  //   this.isUploading = true;
  //   this.esignService.uploadDocument(file).subscribe({
  //     next: (res) => {
  //       this.uploadedDocs.push({
  //         documentId: res.DocumentId,
  //         name: file.name.replace(/\.pdf$/i, ''),
  //         pages: (res.PageImages || []).map((b64) => 'data:image/jpeg;base64,' + b64)
  //       });
  //       if (this.uploadedDocumentId == null) { this.uploadedDocumentId = res.DocumentId; }
  //       this.settle();
  //     },
  //     error: () => { this.settle(); alert(`Upload failed for "${file.name}". Please try again.`); }
  //   });
  // }
  private uploadOne(file: File): void {
    this.pending++;
    this.isUploading = true;

    // Assuming you have the user's email/username stored in a property like this.userEmail or this.currentUser.email
    const uploadedBy = this.Email; // or pass it as a method argument: uploadOne(file: File, uploadedBy: string)
const EmpID = this.EmpID;
    this.esignService.uploadDocument(file, uploadedBy,EmpID).subscribe({
      next: (res) => {
        this.uploadedDocs.push({
          documentId: res.DocumentId,
          name: file.name.replace(/\.pdf$/i, ''),
          pages: (res.PageImages || []).map((b64) => 'data:image/jpeg;base64,' + b64)
        });
        if (this.uploadedDocumentId == null) { this.uploadedDocumentId = res.DocumentId; }
        this.settle();

        this.toast.success(`"${file.name}" uploaded successfully`);
      },
      error: () => {
        this.settle();
        alert(`Upload failed for "${file.name}". Please try again.`);
      }
    });
  }

  private settle(): void {
    this.pending = Math.max(0, this.pending - 1);
    if (this.pending === 0) { this.isUploading = false; }
  }

  removeDoc(index: number): void {
    const removed = this.uploadedDocs.splice(index, 1)[0];
    if (removed && removed.documentId === this.uploadedDocumentId) {
      this.uploadedDocumentId = this.uploadedDocs[0]?.documentId ?? null;
    }
  }

  /** Remove a single page from a document. If that was its last page, the
   *  whole document block is removed too. */
  removePage(docIndex: number, pageIndex: number): void {
    const doc = this.uploadedDocs[docIndex];
    if (!doc) { return; }
    doc.pages.splice(pageIndex, 1);
    if (!doc.pages.length) {
      this.removeDoc(docIndex);
    }
  }

  triggerFilePicker(el: HTMLInputElement): void { el.click(); }

  // ── employee smart-search ──
  // Type a name in the Email box → look up matching staff → pick one to fill
  // email + name. Uses (mousedown) on options so the pick fires before blur.
  onEmpSearch(i: number, term: string): void {
    const q = (term || '').trim();
    this.suggestFor = i;
    clearTimeout(this.searchTimer);
    if (q.length < 2) { this.empSuggestions = []; this.searchingEmp = false; return; }

    this.searchTimer = setTimeout(() => {
      this.searchingEmp = true;
      this.ConfigService.searchEmployees(q).subscribe({
        next: (list: any) => {
          const loggedInEmail = (localStorage.getItem('authUserName') || '').toLowerCase();
          const results = list.SSEmployeeDetailsZohoDataList || [];

          this.empSuggestions = results.filter(
            (emp: any) => (emp.Email || '').toLowerCase() !== loggedInEmail
          );

          this.searchingEmp = false;
        },
        error: () => { this.empSuggestions = []; this.searchingEmp = false; }
      });
    }, 300);
  }

  selectEmployee(i: number, emp: any): void {
    this.recipients.at(i).patchValue({
      email: (emp.Email || '').trim(),
      name: (emp.EmployeeName || '').replace(/\s+/g, ' ').trim(),
      empID: (emp.Empid || '').trim(),
    });
    this.empSuggestions = [];
    this.suggestFor = null;
  }

  hideSuggestions(): void {
    // small delay so a mousedown on an option registers before we hide
    setTimeout(() => { this.suggestFor = null; this.empSuggestions = []; }, 150);
  }

  // ── continue to the editor ──
  gotoDocument(): void {
    const validRecipients = this.recipients.controls.filter(recipient => {
      const email = recipient.get('email')?.value?.trim();
      const name = recipient.get('name')?.value?.trim();

      return email && name;
    });

    if (validRecipients.length === 0) {
      this.toast.error('Add at least one recipient to continue.');
      return;
    }

    if (this.form.invalid || !this.uploadedDocumentId || !this.uploadedDocs.length) {
      this.form.markAllAsTouched();
      return;
    }

    const draft = {
      documentId: this.uploadedDocumentId,                 // first doc (backward compat)
      documents: this.uploadedDocs.map(d => ({             // full list for multi-doc editors
        documentId: d.documentId, name: d.name, pageCount: d.pages.length
      })),
      documentName: this.form.value.documentName,
      isOrdered: this.form.value.sendInOrder,
      daysToComplete: this.form.value.daysToComplete,
      reminderDays: this.form.value.reminderDays,
      note: this.form.value.note,
      pageImages: this.pageImages,                         // combined pages
      recipients: this.recipients.value.map((r: any, idx: number) => ({
        clientId: r.clientId,
        email: r.email,
        name: r.name,
        role: r.role,
        empID: r.empID,
        signingOrder: this.form.value.sendInOrder ? idx + 1 : null,
        deliveryMethod: r.deliveryMethod
      }))
    };
    sessionStorage.setItem('esign_draft', JSON.stringify(draft));

    this.router.navigate(['/dashboard/document'], {
      queryParams: { documentId: this.uploadedDocumentId }
    });
  }
}
