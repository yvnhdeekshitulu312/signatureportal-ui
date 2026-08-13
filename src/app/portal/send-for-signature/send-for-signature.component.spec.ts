import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SendForSignatureComponent } from './send-for-signature.component';

describe('SendForSignatureComponent', () => {
  let component: SendForSignatureComponent;
  let fixture: ComponentFixture<SendForSignatureComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SendForSignatureComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SendForSignatureComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
