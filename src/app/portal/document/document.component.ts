import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { DocumentDetailResponse } from "src/app/models/esign.models";
import { EsignService } from "src/app/services/esign.service";

@Component({
  selector: 'app-documents',
  templateUrl: './document.component.html',
  styleUrls: ['./document.component.scss']   // ← added (was template-only)
})
export class DocumentComponent implements OnInit {
  activeTab: 'pending' | 'sent' = 'pending';
  pendingDocs: DocumentDetailResponse[] = [];
  sentDocs: DocumentDetailResponse[] = [];
  loading = false;

  constructor(private esignService: EsignService, private router: Router, private route: ActivatedRoute) { }

  ngOnInit(): void {
    // Honour an optional ?tab= deep link (e.g. dashboard "My documents" → ?tab=sent),
    // then load BOTH lists so every document is fetched and both tab counts are correct.
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'sent' || tab === 'pending') { this.activeTab = tab; }
    this.loadPending();
    this.loadSent();
  }

  setTab(tab: 'pending' | 'sent'): void {
    this.activeTab = tab;
    tab === 'pending' ? this.loadPending() : this.loadSent();
  }

  loadPending(): void {
    this.loading = true;
    this.esignService.getMyPending().subscribe({
      next: (docs) => { this.pendingDocs = docs; this.loading = false; },
      error: () => this.loading = false
    });
  }

  loadSent(): void {
    this.loading = true;
    this.esignService.getMyDocuments().subscribe({
      next: (docs) => { this.sentDocs = docs; this.loading = false; },
      error: () => this.loading = false
    });
  }

  // openPending(doc: DocumentDetailResponse): void {
  //   // route to a signer view keyed by document + logged-in user's recipient row,
  //   // NOT the public accessToken link (that's for external/email-based signers)
  //   this.router.navigate(['/dashboard/sign', doc.Id]);
  // }

  // openSent(doc: DocumentDetailResponse): void {
  //   this.router.navigate(['/dashboard/view', doc.Id]);
  // }

  openPending(doc: DocumentDetailResponse): void {
    this.router.navigate(['/dashboard/pendingdocuments/sign', doc.Id]);
  }

  openSent(doc: DocumentDetailResponse): void {
    this.router.navigate(['/dashboard/pendingdocuments/view', doc.Id]);
  }
}
