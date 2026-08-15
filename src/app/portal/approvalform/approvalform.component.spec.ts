import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApprovalformComponent } from './approvalform.component';

describe('ApprovalformComponent', () => {
  let component: ApprovalformComponent;
  let fixture: ComponentFixture<ApprovalformComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ApprovalformComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApprovalformComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
