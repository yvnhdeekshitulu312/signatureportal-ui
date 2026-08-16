import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  UploadDocumentResponse,
  SendDocumentRequest,
  DocumentDetailResponse
} from '../models/esign.models';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class EsignService {
  // Matches EsignController's [Route("API/Esign/...")] attributes exactly --
  // update the host/port to wherever ALHMobileAppAPI is actually running.
  // private baseUrl = 'http://localhost:54166/API/Esign';
  private baseUrl = environment.esignApiUrl;

  constructor(private http: HttpClient) { }

  uploadDocument(file: File): Observable<UploadDocumentResponse> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<UploadDocumentResponse>(`${this.baseUrl}/UploadDocument`, formData);
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

  getMyPending(): Observable<DocumentDetailResponse[]> {
    return this.http.get<DocumentDetailResponse[]>(`${this.baseUrl}/MyPending`);
  }

  getMyDocuments(): Observable<DocumentDetailResponse[]> {
    return this.http.get<DocumentDetailResponse[]>(`${this.baseUrl}/MyDocuments`);
  }

  getForLoggedInSigner(documentId: number): Observable<DocumentDetailResponse> {
    return this.http.get<DocumentDetailResponse>(`${this.baseUrl}/GetForLoggedInSigner/${documentId}`);
  }

  signAsUser(documentId: number, fieldValues: { fieldId: number; value: string }[]): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/SignAsUser`, { documentId, fieldValues });
  }

  getDownloadUrl(documentId: number): Observable<DocumentDetailResponse> {
    return this.http.get<DocumentDetailResponse>(`${this.baseUrl}/GetDocument/${documentId}`);
  }

  deleteDocument(documentId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/DeleteDocument/${documentId}`);
  }

  downloadFile(path: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/GetFile`, { params: { path }, responseType: 'blob' });
  }
  
}
