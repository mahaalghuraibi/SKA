# Security & deployment notes — Quality Platform

## Changes applied in this release

| Area | Change |
|------|--------|
| **Upload limits** | `POST /api/v1/monitoring/analyze-frame` rejects bodies larger than `MONITORING_UPLOAD_MAX_BYTES` (default 8 MiB). |
| **CORS** | Optional env `CORS_ALLOW_ORIGINS` (comma-separated). If unset, development defaults (`localhost` Vite ports) apply. Set explicitly in production. |
| **Logging** | Frontend monitoring logs no longer include API error bodies or tokens; reduced PII in `console` paths. |
| **Credentials** | Camera passwords remain masked in UI; stored obfuscated client-side only until backend persistence exists. |

## Recommended before production

1. **Secrets**: Set strong `SECRET_KEY`, rotate `SEED_*` defaults, disable `DEV_AUTH_BYPASS`, review `SEED_DEV_ADMIN` / `SEED_DEV_SUPERVISOR`.
2. **CORS**: Set `CORS_ALLOW_ORIGINS=https://your-production-domain` only.
3. **HTTPS**: Terminate TLS at reverse proxy; enable HSTS.
4. **Rate limiting**: Add reverse-proxy or application rate limits on `/api/v1/auth/login` and `/api/v1/monitoring/analyze-frame`.
5. **Errors**: Keep `ENVIRONMENT=production`; avoid returning raw exception strings from custom handlers (FastAPI defaults may still expose validation details — review `DEBUG` / custom exception middleware if needed).
6. **Database**: Use PostgreSQL or managed DB in production; avoid shared SQLite file.

## Residual risks

- Client-side camera password encoding is not cryptographic storage; migrate to server-side secrets when CRUD exists.
- Global `Exception` handler was not enabled to avoid interfering with FastAPI validation responses; use nginx error pages or a careful handler if generic 500 hiding is required.

---

## Security audit summary (لوحة الإدارة — واجهة المستخدم)

### ما تم تأمينه / تقليل الكشف عنه في الواجهة

| الموضوع | التفاصيل |
|---------|-----------|
| **بيانات الشبكة للكاميرا** | عرض IPv4 المخزَّن بصيغة مموّهة (`maskIpv4Display`) خارج نموذج التحرير؛ روابط RTSP تُعرض بأسلوب `maskRtspUrlForDisplay`. |
| **التنبيهات والجلسة** | استمرار الاعتماد على JWT في الطلبات؛ عدم توسيع تخزين الرموز في أنماط جديدة؛ معالجة أخطاء الحماية عبر المسارات الحالية. |
| **قوائم البيانات الحساسة** | تقليل ازدحام الشاشة عبر «عرض المزيد» لتقليل التصفح السريع للبيانات الحساسة دون تغيير صلاحيات الخادم. |

### ما تم تحسينه في هذا الإصدار (UX أمني)

- توحيد حالات التنبيهات بألوان workflow (مفتوح / يحتاج مراجعة / تمت المعالجة) لتقليل الخطأ البشري عند المتابعة.
- شريط ملخص تحليلات ثابت أثناء التمرير لعرض مؤشرات رئيسية دون فتح أقسام إضافية.

### نقاط مستقبلية قبل الإنتاج الحقيقي

1. **Rate limiting** على `/api/v1/auth/login` ومسارات رفع الصور/الإطارات (`analyze-frame`) على الخادم أو عبر البروكسي.
2. **تخزين أسرار الكاميرا** في الخادم فقط مع تشفير أثناء السكون؛ إزالة الاعتماد على localStorage للإنتاج.
3. **مراجعة CORS و`.env`** وفق نطاق الإنتاج؛ راجع أيضًا `Recommended before production` أعلاه.
4. **اختبار صلاحيات** دورية (موظف / مشرف / أدمن) ضد كل مسار API حساس.
