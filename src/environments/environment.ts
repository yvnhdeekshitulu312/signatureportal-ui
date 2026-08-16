// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

// environment.ts
export const environment = {
  production: false,
  //esignApiUrl: 'http://localhost:54166/API/Esign'
  // esignApiUrl: 'https://his.alhammadi.med.sa/ZOHOAPI/API/Esign',
  // clinicalApiUrl: 'https://his.alhammadi.med.sa/ClinicalsAPiT/API'
  esignApiUrl: 'http://localhost:54166/API/Esign', //local
  clinicalApiUrl: 'https://his.alhammadi.med.sa/ClinicalsAPiT/API' //local
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
