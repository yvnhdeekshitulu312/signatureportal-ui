import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize, shareReplay } from 'rxjs/operators';
import {
  UploadDocumentResponse,
  SendDocumentRequest,
  DocumentDetailResponse
} from '../models/esign.models';
import { config } from 'src/environments/environment';
import { HttpParams } from '@angular/common/http';


@Injectable({ providedIn: 'root' })
export class EsignService {

  // private baseUrl = 'http://localhost:54166/API/Esign';
  private baseUrl = config.esignApiUrl;

  constructor(private http: HttpClient) { }


  uploadDocument(file: File, uploadedBy: string,EmpID:string): Observable<UploadDocumentResponse> {
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('uploadedBy', uploadedBy);
  formData.append('EmpID', EmpID);
  return this.http.post<UploadDocumentResponse>(
    `${this.baseUrl}/UploadDocument`,
    formData
  );
}

  sendDocument(request: SendDocumentRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/SendDocument`, request);
  }



  sendDocumentMail(model: any): Observable<any> {
    // `model` is the SignatureModel-shaped object the editor builds
    // (ReciepientsXML, RequestDocumentName, SendInOrder, Remainder, Notes, ...)
    return this.http.post(`${this.baseUrl}/SaveSignatureRequests`, model);
  }

  getDocument(documentId: number): Observable<DocumentDetailResponse> {
    return this.http.get<DocumentDetailResponse>(`${this.baseUrl}/GetDocument/${documentId}`);
  }

  getDocumentForSigner(accessToken: string): Observable<DocumentDetailResponse> {
    return this.http.get<DocumentDetailResponse>(`${this.baseUrl}/GetForSigner/${accessToken}`);
  }

  sign(accessToken: string, fieldValues: { fieldId: number; value: string }[]): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/Sign`, { accessToken, fieldValues });
  }

  reject(accessToken: string, reason: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/Reject`, { accessToken, reason });
  }

  // getMyPending(email: string): Observable<DocumentDetailResponse[]> {
  //   return this.http.get<DocumentDetailResponse[]>(`${this.baseUrl}/MyPending/${email} `);
  // }

  // De-dupes concurrent calls: PortalComponent (notification bell, on init AND on
  // every NavigationEnd) and DashboardComponent (its own "Pending" stat/table, on
  // init) both call getMyPending() independently -- legitimately, they serve two
  // different UI pieces -- but when they land in the same tick (e.g. dashboard's
  // first load) that used to fire two identical "MyPending?email=...&EmpID=..."
  // requests. While a request for a given email+EmpID is already in flight, any
  // second caller now gets the SAME Observable (shareReplay(1)) instead of
  // triggering a new HTTP call; once it resolves the cache entry is cleared
  // (finalize), so the next genuinely-new call (e.g. Portal's post-navigation
  // refresh) still hits the server for fresh data.
  private myPendingInFlight = new Map<string, Observable<DocumentDetailResponse[]>>();

  getMyPending(email: string,EmpID:string): Observable<DocumentDetailResponse[]> {
    const key = `${email}|${EmpID}`;
    const cached = this.myPendingInFlight.get(key);
    if (cached) { return cached; }

    const params = new HttpParams()
      .set('email', email)
      .set('EmpID', EmpID);

    const request$ = this.http.get<DocumentDetailResponse[]>(
      `${this.baseUrl}/MyPending`,
      { params }
    ).pipe(
      shareReplay(1),
      finalize(() => this.myPendingInFlight.delete(key))
    );

    this.myPendingInFlight.set(key, request$);
    return request$;
  }

 getForLoggedInSigner(documentId: number, email: string): Observable<DocumentDetailResponse> {
  const params = new HttpParams()
    .set('documentId', documentId.toString())
    .set('email', email);

  return this.http.get<DocumentDetailResponse>(
    `${this.baseUrl}/GetForLoggedInSigner`,
    { params }
  );
}

getMyDocuments(email: string,EmpID:string,FromDate:string,ToDate:string): Observable<DocumentDetailResponse[]> {
  const params = new HttpParams()
  .set('email', email)
  .set('EmpID', EmpID)
  .set('FromDate', FromDate)
  .set('ToDate', ToDate);

  return this.http.get<DocumentDetailResponse[]>(
    `${this.baseUrl}/MyDocuments`,
    { params }
  );
}

  // getMyDocuments(): Observable<DocumentDetailResponse[]> {
  //   return this.http.get<DocumentDetailResponse[]>(`${this.baseUrl}/MyDocuments`);
  // }



  signAsUser(documentId: number,email:any, fieldValues: { fieldId: number; value: string }[]): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/SignAsUser`, { documentId,email, fieldValues });
  }

  getDownloadUrl(documentId: number): Observable<DocumentDetailResponse> {
    return this.http.get<DocumentDetailResponse>(`${this.baseUrl}/GetDocument/${documentId}`);
  }

  // deleteDocument(documentId: number): Observable<void> {
  //   return this.http.delete<void>(`${this.baseUrl}/DeleteDocument/${documentId}`);
  // }

  deleteDocument(id: number, email: string) {
    return this.http.delete(`${this.baseUrl}/DeleteDocument/${id}`, {
      params: { email }
    });
  }

  draftDeleteDocument(id: number, email: string) {
    return this.http.delete(`${this.baseUrl}/DraftdeleteDocument/${id}`, {
      params: { requestedBy: email }
    });
  }

  downloadFile(path: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/GetFile`, { params: { path }, responseType: 'blob' });
  }
   getUserSignature(userId: number) {
    return this.http.get(`${this.baseUrl}/GetUserSignature`, { params: { userId } });
  }
  saveUserSignature(payload: any) {
    return this.http.post(`${this.baseUrl}/SaveUserSignature`, payload);
  }

DraftdeleteDocument(documentId: number, requestedBy: string): Observable<void> {
  const params = requestedBy ? `?requestedBy=${encodeURIComponent(requestedBy)}` : '';
  return this.http.delete<void>(`${this.baseUrl}/DraftdeleteDocument/${documentId}${params}`);
}
}
