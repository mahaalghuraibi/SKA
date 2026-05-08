# SKA - Smart Kitchen Analytics

منصة لإدارة عمليات المطبخ ومتابعة جودة وسلامة التشغيل، مع لوحة تحكم حسب الصلاحيات (موظف، مشرف، مدير)، وسجل أطباق، وتنبيهات مراقبة.

## الفكرة بسرعة

SKA يجمع بين:
- توثيق الأطباق ومتابعة حالتها
- مراجعات المشرف واعتماد/رفض السجلات
- تنبيهات مراقبة السلامة
- واجهة إدارة حديثة وسهلة

## هيكل المشروع

```text
ska-system/
├── backend/    # FastAPI + SQLAlchemy + business logic
├── frontend/   # React + Vite + Tailwind
└── ai-service/ # خدمات AI إضافية (عند الحاجة)
```

## المتطلبات

- Python 3.11+ (أو بيئة متوافقة مع متطلبات `backend`)
- Node.js 18+ و npm
- Git

## التشغيل المحلي

### 1) تشغيل الـ Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 2) تشغيل الـ Frontend

```bash
cd frontend
npm install
npm run dev
```

## المتغيرات البيئية

- انسخ الإعدادات من `backend/.env.example` إلى `backend/.env`
- حدّث مفاتيح الخدمات حسب بيئتك
- لا ترفع مفاتيح API الحقيقية إلى GitHub

## أوامر التحقق السريعة

### Frontend

```bash
cd frontend
npm run lint
npm run build
```

### Backend

```bash
cd backend
source .venv/bin/activate
python -m py_compile app/main.py app/core/config.py
```

## ملاحظات مهمة

- المشروع في تطوير مستمر؛ قد تتغير بعض الشاشات والميزات.
- يفضّل تنفيذ أي تحديث كبير على فرع مستقل قبل الدمج إلى `main`.

## المساهمة

إذا أردت إضافة ميزة أو تعديل كبير:
1. افتح فرع جديد
2. نفّذ التغيير مع اختبار سريع
3. افتح Pull Request واضح بالسبب والنتيجة
