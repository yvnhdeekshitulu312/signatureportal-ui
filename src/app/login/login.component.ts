import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, Validators, FormGroup, FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { Patterns } from 'global-constants';
import * as moment from 'moment';
import { ConfigService } from '../services/config.service';
import { LoaderService } from '../services/loader.service';
declare var $: any;

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, OnDestroy {

  loginForm: any;
  otpDetails: any;
  selectedLang: any;
  position!: number;
  showLogin: boolean = true;
  apiResponse: any = {};
  isSubmitted: boolean = false;
  locationList: any;
  doctorDetails: any;
  errorMessage: any;

  otp = {
    one: "",
    two: "",
    three: "",
    four: ""
  }
  patientInfo: any;
  listOfLanguages = [
    { Id: 1, value: "English", code: "en" },
    { Id: 2, value: "Arabic", code: "ar" }
  ]
  timeLeft: number = 60;
  interval: any;
  showResendOTP: boolean = false;
  currentdate: any;
  currenttime: any;
  datetime: any;
  loginLangData: any;
  // Live clock shown at the bottom of the login page — ticks every second
  // instead of only rendering the date/time once at page load.
  private clockInterval: any;
  constructor(private fb: FormBuilder, private config: ConfigService, private router: Router, private loader: LoaderService) {
    this.config.onLogout();
    if ("lang" in localStorage) {
      let langCode = localStorage.getItem('lang');
      if (langCode === "en") {
        this.selectedLang = { Id: 1, value: "English", code: "en" };
      } else if (langCode === "ar") {
        this.selectedLang = { Id: 2, value: "Arabic", code: "ar" };
      }
      this.loader.setDefaultLangCode(langCode);
      console.log("Already lang code existed");
      this.getSelectedLangData(langCode);
      this.getDate(langCode);
    } else {
      this.selectedLang = { Id: 1, value: "English", code: "en" };
      localStorage.setItem("lang", `${this.selectedLang.code}`);
      this.loader.setDefaultLangCode(this.selectedLang.code);
      this.getSelectedLangData(this.selectedLang.code);
      this.getDate(this.selectedLang.code);
    }
    this.position = 1;
  }

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      UserName: ['', Validators.required],
      Password: ['', Validators.required],
      Location: ['', Validators.required]
    });
    this.FetchFetchHospitalLocations();
  }

  FetchFetchHospitalLocations() {
    this.config.fetchFetchHospitalLocations().subscribe((response) => {
      if (response.Status === "Success") {
        this.locationList = response.HospitalLocationsDataList;
        if (response.HospitalLocationsDataList.length == 1) {
          this.loginForm.get('Location')?.setValue(response.HospitalLocationsDataList[0].HospitalID);
        }
      } else {
      }
    },
      (err) => {

      })
  }

  // onSubmit(): void {
  //   this.errorMessage = '';
  //   this.isSubmitted = true;
  //   if (this.loginForm.invalid) return;

  //   const username = this.loginForm.get('UserName')?.value;
  //   const password = this.loginForm.get('Password')?.value;

  //   // TEMPORARY dev auth -- any email works, password is fixed at "12345".
  //   // Real credential check happens nowhere yet; swap this out before go-live.
  //   if (password !== '12345') {
  //     this.errorMessage = 'Invalid User Name / Password';
  //     return;
  //   }

  //   localStorage.setItem('authUserName', username);
  //   localStorage.setItem('authPassword', password);
  //   localStorage.setItem('isLoggedIn', 'true');
  //   this.router.navigate(['/dashboard']);
  // }

  // onSubmit(): void {
  //   localStorage.setItem("isLoggedIn", 'true');
  //   this.router.navigate(['/dashboard'])
  //   // if (this.loginForm.valid) {
  //   //   this.isSubmitted = false;
  //   //   this.validateDoctorLogin();
     
  //   // } else {
  //   //   this.showLogin = true;
  //   //   this.isSubmitted = true;
  //   // }

  //   //  localStorage.setItem("loginDetails", JSON.stringify(this.loginForm.value))
  // }

  onSubmit(): void {
    this.errorMessage = '';
    this.isSubmitted = true;
    if (this.loginForm.invalid) return;

    const username = this.loginForm.get('UserName')?.value;
    const password = this.loginForm.get('Password')?.value;
    const location = this.loginForm.get('Location')?.value;

    var payload = {
      username: this.loginForm.get('UserName').value,
      password: this.loginForm.get('Password').value,
      HostName: '127.0.0.1',
      _intTrialCount: 0,
      location: this.loginForm.get('Location').value,
      Checklogin: 0,
    }

    this.config.ValidateUser(payload).subscribe({
      next: (response) => {
        if (!response || response.Code != 200) {
          this.errorMessage = 'Invalid User Name / Password';
          return;
        }
        const user = response.SmartDataList[0];
        localStorage.setItem('authUserName', user.EmpEmail);  
        localStorage.setItem('authPassword', password);
        localStorage.setItem('loginUserName', user.UserName + ' - ' + user.LoginUsername);
        localStorage.setItem('empDesignation', user.EmpDesignation || '');
         localStorage.setItem("doctorDetails", JSON.stringify(user))
          localStorage.setItem("hospitalId", this.loginForm.get('Location').value)

        localStorage.setItem('isLoggedIn', 'true');
        this.router.navigate(['/dashboard']);
      },
      error: () => { this.errorMessage = 'Invalid User Name / Password'; }
    });
  }

  validateDoctorLogin() {
    this.errorMessage ="";
    if (this.loginForm.valid) {
      this.config.validateDoctorLogin(this.loginForm.get('UserName').value,this.loginForm.get('Password').value,this.loginForm.get('Location').value).subscribe((response) => {
        if (response.length === 0) {
          this.errorMessage = "Invalid UserName / Password"
        } else if (response[0].CredentialsMessage) {
          this.errorMessage = "Invalid UserName / Password"
        }
        else {
          localStorage.setItem("doctorDetails", JSON.stringify(response))
          localStorage.setItem("hospitalId", this.loginForm.get('Location').value)
          localStorage.setItem("isLoggedIn", 'true');
          this.router.navigate(['/home/patients'])
        }
      },
        (err) => {

        })
    }
  }
 
  backToLogin() {
    this.showLogin = true;
  }
  
  selectedLanguage(lang: any) {
    this.selectedLang = lang;
    localStorage.setItem("lang", `${this.selectedLang.code}`);
    this.loader.setDefaultLangCode(this.selectedLang.code);
    this.getSelectedLangData(this.selectedLang.code);
    this.getDate(this.selectedLang.code);
  }
  startTimer() {
    this.interval = setInterval(() => {
      if (this.timeLeft > 0) {
        this.timeLeft--;
      } else {
        this.timeLeft = 60;
      }
      if (this.timeLeft == 0) {
        this.pauseTimer();
      }
    }, 1000)
  }

  pauseTimer() {
    clearInterval(this.interval);
    this.showResendOTP = true;
  }
  showToastrModal() {
    $("#otpMessage").modal('show');
  }
  closeToastr() {
    $("#otpMessage").modal('hide');
  }
  // showOtpFailModal() {
  //   $("#otpFail").modal('show');
  // }
  // closeOtpFailModal() {
  //   $("#otpFail").modal('hide');
  // }
  getSelectedLangData(lang: any) {
    this.config.getSelectedLang(lang).subscribe((response: any) => {
      this.loginLangData = response;
      localStorage.setItem("langData", JSON.stringify(this.loginLangData))
    });
  }
  /** Start (or restart, on language change) a live-updating clock for the
   *  login page footer — sets currentdate immediately, then re-formats it
   *  every second so it behaves as a real running clock rather than a
   *  timestamp frozen at page load. */
  getDate(langCode: any) {
    clearInterval(this.clockInterval);
    const tick = () => {
      this.currentdate = moment(new Date()).format('DD-MMM-YYYY, hh:mm:ss A');
    };
    tick();
    this.clockInterval = setInterval(tick, 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.clockInterval);
  }
}