import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-confirm-delete-modal',
  template: `
    <div class="modal-header">
      <h4 class="modal-title">Delete document?</h4>
      <button type="button" class="btn-close" aria-label="Close" (click)="activeModal.dismiss()"></button>
    </div>
    <div class="modal-body">
      <p>Are you sure you want to delete <strong>{{ docName }}</strong>? This can't be undone.</p>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" (click)="activeModal.dismiss()">Cancel</button>
      <button type="button" class="btn btn-danger" (click)="activeModal.close(true)">Yes, delete</button>
    </div>
  `
})
export class ConfirmDeleteModalComponent {
  @Input() docName = '';
  constructor(public activeModal: NgbActiveModal) {}
}