import { AuthguardGuard } from './authguard.guard';
import { AuthguardService } from './authguard.service';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HeadersInterceptor } from './services/headers.interceptor';
import { LoaderComponent } from './loader/loader.component';
import { LoaderInterceptor } from './services/loader.interceptor';
import { LoginComponent } from './login/login.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PortalComponent } from './portal/portal.component';
import { SidebarComponent } from './sidebar/sidebar.component';
import { SafePipe } from './safe.pipe';
import { BnNgIdleService } from 'bn-ng-idle';
import { ToastContainerComponent } from './toast/toast-container.component';

@NgModule({
  declarations: [
    AppComponent,
    LoaderComponent,
    LoginComponent,
    SidebarComponent,
    PortalComponent,
    ToastContainerComponent
    // SafePipe
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    BrowserAnimationsModule,
    ReactiveFormsModule
  ],
  providers: [
    BnNgIdleService,
    AuthguardService,
    AuthguardGuard,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: HeadersInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: LoaderInterceptor,
      multi: true,
    },],
  bootstrap: [AppComponent]
})
export class AppModule { }
