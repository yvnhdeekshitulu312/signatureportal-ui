// ── Add / replace in esign.service.ts ────────────────────────────
// The editor's send() now posts a SignatureModel-shaped object, so
// sendDocument must accept `any` and hit SaveSignatureRequests.
// (Emails fire server-side inside that endpoint — no extra call needed.)

import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

// inside EsignService (ensure HttpClient is injected in the constructor):
//   constructor(private http: HttpClient) {}

sendDocument(model: any): Observable<any> {
  // `model` matches the C# SignatureModel (recipients in ReciepientsXML, etc.)
  return this.http.post(`${environment.apiBaseUrl}/API/SaveSignatureRequests`, model);
}
