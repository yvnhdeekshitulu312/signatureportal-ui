import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { locationData } from 'src/assets/config-constants';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { BYPASS_LOG } from './headers.interceptor';
import { environment } from 'src/environments/environment';


@Injectable({
  providedIn: 'any'
})
export class ConfigService {
  //public devApiUrl = "http://172.18.17.219/DoctorPortalAPI/API/";
  
  //public devApiUrl = "http://localhost:54166/API/";
  public devApiUrl = environment.esignApiUrl;
  private hisUrl = environment.clinicalApiUrl;
 // public devApiUrl = "http://172.18.17.219/ZOHOAPI/API/";
  public hijApiUrl = "http://172.18.17.219/DEVAPI/API/";
  baseApiUrl = "https://file.io";//
  public devPatientApiUrl = "http://172.18.17.219/SSRCE/API/"
  public prodApiUrl = "";
  patientDetails: any;
  patientInfo: any;
  hospitalId = locationData.locationId;
  public httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      Authorization: 'Basic ' + btoa('admin' + ':' + '123456'),
    }),
  };
  langData: any;
  langCode: any;
  code: any = "en";
  // public defaultLangCode = new BehaviorSubject("en");

  constructor(private https: HttpClient, private router: Router) {
    this.patientInfo = JSON.parse(localStorage.getItem("patientInfo") || '{}');
    this.patientDetails = JSON.parse(localStorage.getItem("PatientDetails") || '{}');
    this.langCode = localStorage.getItem('lang');
  }
 
  getLangData() {
    this.langData = JSON.parse(localStorage.getItem("langData") || '{}');
    return this.langData;
  }
  getLangCode() {
    this.langData = localStorage.getItem('lang');
    return this.langData;
  }
  getSelectedLang(lang: any) {
    return this.https.get(`assets/lang/${lang}.json`)
  }

  onLogout() {
    let isLoggedIn = "isLoggedIn";

    localStorage.removeItem(isLoggedIn);
    localStorage.removeItem("doctorDetails");
    localStorage.clear()
    this.router.navigate(['/login'])
  }
  
   fetchFetchHospitalLocations() {
    return this.https.get<any>(this.hisUrl + '/FetchHospitalLocations?type=0&filter=blocked=0&UserId=0&WorkstationId=0', this.httpOptions);
  }

  validateDoctorLogin(username: string, password: string, location: string) {
    return this.https.get<any>(this.devApiUrl + '/ValidateLoginCredentials?username='+ username +'&password='+ password +'&location='+ location +'', this.httpOptions);
  }

  fetchDoctorAppointments(doctorID: string, hospitalId: string, fromDate: any, toDate: any) {
    return this.https.get<any>(this.devApiUrl + '/FetchDoctorAppointments?DoctorID='+ doctorID +'&HospitalID='+ hospitalId +'&FromDate='+ fromDate +'&ToDate='+ toDate+'', this.httpOptions);
  }

  fetchPatients(doctorID: string, hospitalId: string, fromDate: any, toDate: any) {
    return this.https.get<any>(this.devApiUrl + '/FetchPatientDetails?FromDate='+ fromDate +'&ToDate='+ toDate +'&DoctorID='+ doctorID +'&HospitalID='+ hospitalId +'', this.httpOptions);
  }
  fetchPatientAllergies(PatientID: string, RegCode: string, hospitalId: any) {
    return this.https.get<any>(this.devApiUrl + '/FetchPatientAllergies?PatientID='+ PatientID +'&RegCode='+ RegCode +'&HospitalID='+ hospitalId +'', this.httpOptions);
  }
  CancelAppointment(payload: any) {
    return this.https.post<any>(this.devApiUrl + 'CancelAppointment', payload);
  }
  fetchVitalParamsValues(PatientID: any, FromDate: any, ToDate: any, HospitalID: any) {
    return this.https.get<any>(this.devApiUrl + 'FetchPatientvitalsDataDocPat?PatientID='+PatientID+ '&FromDate='+FromDate+ '&ToDate='+ToDate+'&HospitalID='+HospitalID,this.httpOptions);
  }
  fetchPatientVisits(Patientid: any, HospitalID: any) {
    return this.https.get<any>(this.devApiUrl + 'FetchPatientVisits?Patientid='+ Patientid +'&HospitalID='+ HospitalID  +'', this.httpOptions);
  }
  fetchPatientFileData(EpisodeID: any, Admissionid: any, HospitalID: any) {
    return this.https.get<any>(this.devApiUrl + '/FetchPatientFileData?EpisodeID='+ EpisodeID +'&Admissionid='+ Admissionid +'&HospitalID='+ HospitalID  +'', this.httpOptions);
  }
  fetchPatientMedication(IPID: any, PatientID: any, HospitalID: any) {
    return this.https.get<any>(this.devApiUrl + '/FetchPatientOrderedOrPrescribedDrugs?IPID='+ IPID +'&PatientID='+ PatientID +'&HospitalID='+ HospitalID  +'', this.httpOptions);
  }

  fetchPatientIDByHospId(regcode: any, hospId: any) {
    return this.https.get<any>(this.devPatientApiUrl + '/FetchPatientIDLocation?RegCode='+ regcode +'&HospitalID='+hospId, this.httpOptions);
  }

  fetchOutPatientData(PatientID: any, FromDate: any, ToDate: any, HospitalID: any) {
    return this.https.get<any>(this.devApiUrl + '/FetchPatientVitalsByPatientId?PatientID='+ PatientID +'&TBL=1&FromDate='+ FromDate +'&ToDate='+ ToDate +'&HospitalID='+ HospitalID  +'', this.httpOptions);
  }

  fetchInPatientData(PatientID: any, FromDate: any, ToDate: any, HospitalID: any) {
    return this.https.get<any>(this.devApiUrl + '/FetchPatientVitalsByIPID?PatientID='+ PatientID +'&TBL=1&FromDate='+ FromDate +'&ToDate='+ ToDate +'&HospitalID='+ HospitalID  +'', this.httpOptions);
  }

  getLabTestOrders(reqPayload: any) {
    return this.https.post<any>(this.devPatientApiUrl + 'TestOrders', reqPayload);
  }

  getOutsideLabTestOrders(PatientID: any, IsRadiology: any) {
    return this.https.get<any>(this.devPatientApiUrl + 'FetchPatientOutsideMedicalReport?PatientID='+PatientID+ '&IsRadiology='+IsRadiology,this.httpOptions);
  }

  getLabReportResults() {
    let reqPayload = {
      "RegCode": this.patientDetails.RegCode,
      "HospitalId": this.hospitalId,
      "TestOrderItemId": "2690582",
      "TestOrderId": "841123"
    }
    return this.https.post<any>(this.devPatientApiUrl + 'LabReport', reqPayload);
  }

  getLabReportPdf(reqPayload: any) {
    return this.https.post<any>(this.devPatientApiUrl + 'LabReportGroupPDF', reqPayload);
  }

  fetchPatientLabTestOrders(PatientID: any, Min: any, Max: any, IsResult: any, location: any) {
    return this.https.get<any>(this.devPatientApiUrl + 'FetchPatientLabOrders?PatientID='+PatientID+ '&Min='+Min+ '&Max='+Max+ '&IsResult='+IsResult+'&HospitalID='+location,this.httpOptions);
  }

  getTestOrderDetails(reqPayload: any) {
    //this.patientDetails.RegCode,
    return this.https.post<any>(this.devPatientApiUrl + 'TestOrderDetails', reqPayload);
  }
  getPatientDetails(payload: any) {
    //"ALHH.0000343014"
    return this.https.post<any>(this.devPatientApiUrl + 'PatientSelection', payload);
  }
  fetchMedicationDemographics(demographic: any, UserId: any, HospitalID: any) {
    return this.https.get<any>(this.devApiUrl + 'FetchMedicationDemographics?demographic='+ demographic + '&UserId=' + UserId + '&HospitalID='+ HospitalID,this.httpOptions);
  }
  fetchDrugFrequencies(UserId: any, WorkStationID: any, HospitalID: any) {
    return this.https.get<any>(this.devApiUrl + 'FetchDrugFrequencies?Tbl=2&LanguageID=0&UserId=' + UserId + '&WorkStationID=' + WorkStationID + '&HospitalID='+ HospitalID,this.httpOptions);
  }
  fetchMedicationInstructions(UserId: any, Filter:any, WorkStationID: any, HospitalID: any) {
    return this.https.get<any>(this.devApiUrl + 'FetchAdminMasters?Type=813&Filter=' + Filter + '&USERID=' + UserId + '&WORKSTATIONID=' + WorkStationID + '&HospitalID='+ HospitalID,this.httpOptions);
  }
  fetchItemDetails(min:any, max: any, Type:any, Filter:any, UserId: any, WorkStationID: any, HospitalID: any) {
    return this.https.get<any>(this.devApiUrl + 'FetchItemDetails?min='+ min +'&max='+ max +'&Type='+ Type +'&Filter=' + Filter + '&UserId=' + UserId + '&WorkStationID=' + WorkStationID + '&HospitalID='+ HospitalID,this.httpOptions);
  }
  fetchItemForPrescriptions(ItemId:any, TBL:any, UserId: any, WorkStationId: any, HospitalID: any) {
    return this.https.get<any>(this.devApiUrl + 'FetchItemForPrescriptions?ItemID='+ ItemId +'&TBL=' + TBL + '&UserId=' + UserId + '&WorkStationId=' + WorkStationId + '&HospitalID='+ HospitalID,this.httpOptions);
  }
  displayScheduleAndQuantity(UserId: any, WorkStationID: any, FreqVal: any, CurrentIndx: any, DosageUnit: any, DurationUnit: any, DurationVal: any, Type: any, IssueTypeUOM: any, ItemId: any, DefaultUOMID: any, PrescStartDate: any) {
    return this.https.get<any>(this.devApiUrl + 'DisplayScheduleAndQuantity?intUserId='+ UserId +'&intWorkStationId=' + WorkStationID + '&FeqId=' + FreqVal + '&Index=' + CurrentIndx + '&DosageUnit=' + DosageUnit + '&DurationUnit=' + DurationUnit + '&DurationVal=' + DurationVal  + '&Type=' + Type  + '&IssueType=' + IssueTypeUOM  + '&ItemId=' + ItemId  + '&DefaultUnitID=' + DefaultUOMID + '&StartDate='+ PrescStartDate,this.httpOptions);
  }
  getInvestigationProcedureDetails(Name: any, Param1: any) { 
    //"ALHH.0000343014"  this.devApiUrl + '    
    return this.https.get<any>('https://localhost:44350/API/FetchInvestigationProcedureDetails?Name='+ Name +'&Param1='+ Param1);
  }
  SavePrescription(payload: any) {
    return this.https.post<any>(this.devApiUrl + 'SavePrescriptions', payload);
  }

  PdfToImage(formData: FormData) {
    return this.https.post<any>(this.devApiUrl + 'PdfToImage', formData);
  }
  
  ValidateUser(payload: any) {
    return this.https.post<any>(this.hisUrl + '/ValidateLoginUserHIS', payload);
  }
}
