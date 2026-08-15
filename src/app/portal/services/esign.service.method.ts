// ── This is the ONE method to place INSIDE your EsignService class ──
// File: src/app/services/esign.service.ts
// Do NOT keep this as a separate file, and do NOT "call" it anywhere.
// It replaces your existing sendDocument(...) method.
//
// Requirements already in most services:
//   import { HttpClient } from '@angular/common/http';
//   import { Observable } from 'rxjs';
//   import { environment } from 'src/environments/environment';
//   constructor(private http: HttpClient) { ... }

sendDocument(model: any): Observable<any> {
  // `model` is the SignatureModel-shaped object the editor builds
  // (ReciepientsXML, RequestDocumentName, SendInOrder, Remainder, Notes, ...)
  return this.http.post(`${environment.apiBaseUrl}/API/SaveSignatureRequests`, model);
}
