import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { EsignService } from '../../services/esign.service';

@Component({
  selector: 'app-send-for-signature',
  templateUrl: './send-for-signature.component.html',
  styleUrls: ['./send-for-signature.component.scss']   // ← added (was template-only)
})
export class SendForSignatureComponent implements OnInit {
  form!: FormGroup;
  pageImages: string[] = []; // base64 JPEGs, one per page -- rendered server-side by Aspose
  uploadedDocumentId: number | null = null;
  isUploading = false;
  isSending = false;

  constructor(
    private fb: FormBuilder,
    private esignService: EsignService,
    private router: Router
  ) {}

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

  buildRecipientGroup(order: number): FormGroup {
    return this.fb.group({
      clientId: [`r${order}_${Date.now()}`],
      order: [order],
      email: ['', [Validators.required, Validators.email]],
      name: ['', Validators.required],
      role: ['Sign', Validators.required],
      deliveryMethod: ['Email', Validators.required]
    });
  }

  addRecipient(): void {
    const nextOrder = this.recipients.length + 1;
    this.recipients.push(this.buildRecipientGroup(nextOrder));
  }

  removeRecipient(index: number): void {
    if (this.recipients.length > 1) {
      this.recipients.removeAt(index);
    }
  }

  uploadFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    this.handleFile(input.files[0]);
    input.value = '';
  }

  onFileDropped(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.handleFile(file);
  }

  private handleFile(file: File): void {
    if (this.isUploading) return; // guard against any residual double-fire

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF document.');
      return;
    }

    if (!this.form.get('documentName')?.value) {
      this.form.patchValue({ documentName: file.name.replace(/\.pdf$/i, '') });
    }

    this.isUploading = true;
    this.esignService.uploadDocument(file).subscribe({
      next: (res) => {
        this.isUploading = false; // reset first, so a bad response shape can't leave the UI stuck
        this.uploadedDocumentId = res.DocumentId;
        this.pageImages = (res.PageImages || []).map((b64) => 'data:image/jpeg;base64,' + b64);
      },
      error: () => {
        this.isUploading = false;
        alert('Upload failed. Please try again.');
      }
    });
  }

  gotoDocument(): void {
    if (this.form.invalid || !this.uploadedDocumentId) {
      this.form.markAllAsTouched();
      return;
    }

    const draft = {
      documentId: this.uploadedDocumentId,
      documentName: this.form.value.documentName,
      isOrdered: this.form.value.sendInOrder,
      daysToComplete: this.form.value.daysToComplete,
      reminderDays: this.form.value.reminderDays,
      note: this.form.value.note,
      pageImages: this.pageImages, // handed to the editor screen so it doesn't re-fetch
      recipients: this.recipients.value.map((r: any) => ({
        clientId: r.clientId,
        email: r.email,
        name: r.name,
        role: r.role,
        signingOrder: this.form.value.sendInOrder ? r.order : null,
        deliveryMethod: r.deliveryMethod
      }))
    };
    sessionStorage.setItem('esign_draft', JSON.stringify(draft));

    this.router.navigate(['/dashboard/document'], {
      queryParams: { documentId: this.uploadedDocumentId }
    });
  }
}
