# TRACE GUARD: AI-Powered Personal Data Footprint Auditor

> **Official Tagline:** YOUR DIGITAL LIFE. YOUR CONTROL.

TRACE GUARD is a premium cybersecurity SaaS monitoring platform engineered to help individuals understand, monitor, and reduce their digital exposure surface. Built with a high-contrast dark cybersecurity visual aesthetic, TRACE GUARD unifies personal data exposure tracking, zero-knowledge password verification, application hardware scope auditing, breach monitoring, and contextual AI recommendations.

---

## 🗺️ Application Routing Structure

| Route | View | Description |
| :--- | :--- | :--- |
| `/` | **Public Landing Page** | Public SaaS presentation with hero, live preview card, 6 feature cards, 3-step workflow, and trust pillars. |
| `/dashboard` | **Executive Cybersecurity Dashboard** | Real-time monitoring workspace with 4 stat cards, risk gauge, telemetry charts, breach register, and scope auditors. |
| `/data-exposure` | **Personal Data Exposure** | PII masking and public identifier visibility tracking. |
| `/breach-monitoring` | **Breach Monitoring** | Global incident register with severity and status filters. |
| `/password-security` | **Password Security** | K-anonymity encrypted hash verification. |
| `/app-permissions` | **App Permission Auditor** | Hardware telemetry scope review. |
| `/risk-score` | **Privacy Risk Assessment** | Weighted 0–100 privacy scoring topology. |
| `/reports` | **Security Reports** | Audit report generator and compliance history. |
| `/settings` | **Security Settings** | Identity, authentication preferences, and notification rules. |
| `/support` | **Support & Security Desk** | Technical documentation and incident response contacts. |
| `/login` | **Sign In** | Argon2id email/password and Google OAuth entry. |
| `/register` | **Account Registration** | Secure vault initialization with terms agreement. |

---

## 🎨 Global Design System & Brand Identity

### Brand Colors
- **Main Background:** `#0B0D0F`
- **Sidebar Background:** `#101214`
- **Primary Cards:** `#151719`
- **Secondary Cards:** `#1B1E22`
- **Borders & Dividers:** `#292D32`
- **Electric Blue (Primary Accent):** `#078BFF`
- **Cyan (Telemetry & Highlighting):** `#00CFFF`
- **Purple (Secondary Accent):** `#8B5CF6`
- **Green (Verified / Low Risk):** `#22C55E`
- **Orange (Warning / High Risk):** `#F59E0B`
- **Red (Critical Risk):** `#EF4444`
- **Primary Text:** `#FFFFFF`
- **Secondary Text:** `#9CA3AF`

---

## 🚀 How to Run Locally

### 1. Frontend Development Server
```powershell
cd E:\AntiGravity\frontend
npm install
npm run dev
```
- Open **[http://localhost:5173](http://localhost:5173)** to explore the public landing page.
- Navigate to **[http://localhost:5173/dashboard](http://localhost:5173/dashboard)** to interact with the executive cybersecurity dashboard.

### 2. Backend API Server
```powershell
cd E:\AntiGravity\backend
.\venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```
- Interactive OpenAPI Docs: **[http://localhost:8000/docs](http://localhost:8000/docs)**
- Health Check: **[http://localhost:8000/api/health](http://localhost:8000/api/health)**

### 3. Automated Tests
```powershell
cd E:\AntiGravity\backend
.\venv\Scripts\pytest.exe -v
```
