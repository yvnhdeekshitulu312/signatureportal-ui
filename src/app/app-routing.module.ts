import { AuthguardGuard } from './authguard.guard';
import { LoginComponent } from './login/login.component';
import { HomepageComponent } from './portal/homepage/homepage.component';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  // { path: 'login', component: LoginComponent },
  { path: 'login', loadChildren: () => import('./login/login.module').then(m => m.LoginModule) },
  { path: 'dashboard', loadChildren: () => import('./portal/portal.module').then(m => m.PortalModule), canActivate: [AuthguardGuard] },
  // Deliberately NO canActivate/AuthguardGuard here -- this is the emailed
  // "Start Signing" magic-link route (/esign/sign/:token). It authenticates
  // via the recipient's own EsignRecipient.AccessToken instead of a login
  // session; see the header comment in
  // public-sign/document-sign-public.component.ts for the full reasoning,
  // and EsignService.cs's BuildSignUrl for where this URL gets generated
  // (only ever in the signature-request email -- nothing in the app itself
  // links here).
  //{ path: 'esign/sign', loadChildren: () => import('./portal/public-sign/public-sign.module').then(m => m.PublicSignModule) },
  { path: 'pendingdocuments/sign', loadChildren: () => import('./portal/public-sign/public-sign.module').then(m => m.PublicSignModule) },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  // { path: '**', component: PageNotFoundComponent },  // Wildcard route for a 404 page
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
