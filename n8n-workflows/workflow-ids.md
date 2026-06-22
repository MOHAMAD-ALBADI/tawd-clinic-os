# TAWD n8n Workflow IDs

## Main Workflows

| n8n ID | الاسم | الملف |
|--------|-------|-------|
| `CputKQi9Eu4NDcuI` | WF-00 WhatsApp Webhook Verify | wf00-webhook-verify.json |
| `arZRfHPPTytcMSR5` | WF-05 Sura Core Engine (WhatsApp) | wf05-sura-core-engine.json |
| `pxPgMdVxdZmuVlYQ` | WF-06 Smart Booking Engine | wf06-smart-booking-engine.json |
| `S237WFJ4ZB3sh2q2` | WF-07 Reminder Engine (24h+2h) | wf07-reminder-engine.json |
| `nMzV4wxrURtNOtfZ` | WF-08 Queue Manager | wf08-queue-manager.json |
| `r8pWM464TFDJ5nUs` | WF-09 No-Show Handler | wf09-noshow-handler.json |
| `Znp4oWRosfaBPatu` | WF-10 Patient Profile Sync | wf10-patient-profile-sync.json |
| `1vkJuEKKHQCDSRGY` | WF-11 Consent & PDPL Manager | wf11-consent-manager.json |
| `MEW9s9F5IUd5gXn6` | WF-15 Invoice Generator + VAT | wf15-invoice-generator.json |
| `J5Xo1PwbIWIi5oX2` | WF-16 Thawani Payment Processor | wf16-thawani-payment.json |
| `MWuHI0l11A46keAp` | WF-17 Payment Link Generator | wf17-payment-link-generator.json |
| `6K0O4YNt2nMt6PtS` | WF-18 Doctor Commission Calculator | wf18-doctor-commission.json |
| `lzNvi3fCIBjrfCk5` | WF-13 Service Catalog Sync | wf13-service-catalog-sync.json |
| `LVizXPb2HP2o1eVW` | WF-14 Insurance Pre-check Stub | wf14-insurance-precheck.json |
| `yuvFcZgDnBXZMwxB` | WF-19 Re-engagement Campaign Engine | wf19-reengagement-campaign.json |
| `V0GrBmakIru6s5Qk` | WF-20 Reviews Router | wf20-reviews-router.json |
| `WJE1JkLPkwCctd8D` | WF-21 Audit Logger | wf21-audit-logger.json |
| `d3a7Esig0glU7A9B` | WF-22 MFA Enforcer (Stub) | wf22-mfa-enforcer.json |
| `BCL1vP4d3khMinjJ` | WF-23 Workflow Health Monitor | wf23-health-monitor.json |
| `D8S7xfDVpLaNWDES` | WF-02 Channel Receiver Instagram | wf02-channel-instagram.json |
| `mDBPZb9EU5xKfI5u` | WF-03 Channel Receiver Web Chat | wf03-channel-webchat.json |

## Sub-workflows (S1–S7) — كلها inactive بالتصميم

| n8n ID | الاسم | الملف |
|--------|-------|-------|
| `kHOzzOVWCtyvB1I1` | [SUB] S2 Log Error | s2-log-error.json |
| `0Aq11NOwPChsSzZ8` | [SUB] S1 Send WhatsApp | s1-send-whatsapp.json |
| `44lmYECx1xkG0Cir` | [SUB] S3 Get or Create Patient | s3-get-or-create-patient.json |
| `MSsHC3t4qbzqWzlk` | [SUB] S4 Get Clinic Context | s4-get-clinic-context.json |
| `LhLhOblkCwLWWQlt` | [SUB] S5 Get or Create Chat Session | s5-get-chat-session.json |
| `F3YMSuQuGiknwoEH` | [SUB] S6 Save Message | s6-save-message.json |
| `dK1T85wRcr8XPZSO` | [SUB] S7 Push to HITL | s7-push-to-hitl.json |

## الـ Credentials المطلوبة في n8n
- `TAWD Supabase` (id: vvSpPqfrBDkrqjjc) — مربوط بكل sub-workflows ✓
- `TAWD WhatsApp API` — Header Auth → يُنشأ يدوياً قبل اختبار S1

## ملاحظة S7
- يستدعي S1 عبر Execute Workflow node
- `staff_phone` يجب يُمرَّر من الـ parent workflow
- `$vars.S1_WORKFLOW_ID` = `0Aq11NOwPChsSzZ8` — سيُضبط في n8n Variables
