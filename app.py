# ═══════════════════════════════════════════════════════════════════════════
#  AttendAI — Student Academic Attendance Portal
#  Smarter Attendance, Safer Tomorrow
# ═══════════════════════════════════════════════════════════════════════════

import streamlit as st
import requests
import re
import pandas as pd

# ══════════════════════════════════════════════════════
#  CONFIGURATION
# ══════════════════════════════════════════════════════
API_BASE_URL = "http://127.0.0.1:5000/api"   # Node.js backend URL
TOTAL_WORKING_DAYS = 30

# ══════════════════════════════════════════════════════
#  PAGE CONFIGURATION
# ══════════════════════════════════════════════════════
st.set_page_config(
    page_title="AttendAI — Student Academic Portal",
    page_icon="🎓",
    layout="centered",
    initial_sidebar_state="expanded"
)

# ══════════════════════════════════════════════════════
#  ATTENDAI DESIGN SYSTEM & CUSTOM CSS
# ══════════════════════════════════════════════════════
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    
    * {
        font-family: 'Inter', sans-serif !important;
        box-sizing: border-box;
    }

    .stApp {
        background-color: #F8FAFC;
        color: #0F172A;
    }

    .header-container {
        background: linear-gradient(135deg, #111C3A 0%, #312E81 50%, #4F46E5 100%);
        padding: 32px 24px;
        border-radius: 18px;
        color: white;
        text-align: center;
        margin-bottom: 25px;
        box-shadow: 0 10px 25px rgba(79, 70, 229, 0.15);
        border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .header-title {
        font-size: 2.1rem;
        font-weight: 800;
        margin-bottom: 6px;
        letter-spacing: -0.5px;
    }
    .header-subtitle {
        font-size: 0.95rem;
        opacity: 0.85;
        font-weight: 400;
        color: #CBD5E1;
    }

    .info-card {
        background-color: #FFFFFF;
        border: 1px solid #E2E8F0;
        padding: 20px;
        border-radius: 16px;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03);
        margin-bottom: 15px;
        transition: transform 0.25s ease, box-shadow 0.25s ease;
    }
    .info-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(79, 70, 229, 0.08);
    }

    .warning-card {
        background: linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%);
        border-left: 6px solid #EF4444;
        color: #991B1B;
        padding: 18px;
        border-radius: 12px;
        margin-bottom: 20px;
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.1);
    }
    .warning-title {
        font-size: 1.1rem;
        font-weight: 700;
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    /* Sidebar */
    section[data-testid="stSidebar"] {
        background-color: #111C3A !important;
        border-right: 1px solid rgba(255, 255, 255, 0.08);
    }
    section[data-testid="stSidebar"] .stMarkdown, section[data-testid="stSidebar"] label {
        color: #E2E8F0 !important;
    }

    .stButton > button {
        border-radius: 10px !important;
        font-weight: 600 !important;
        padding: 8px 18px !important;
        transition: all 0.2s ease !important;
    }
    .stButton > button[kind="primary"] {
        background: linear-gradient(135deg, #4F46E5 0%, #8B5CF6 100%) !important;
        border: none !important;
        box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25) !important;
    }
</style>
""", unsafe_allow_html=True)


# ══════════════════════════════════════════════════════
#  API HELPERS (UNCHANGED BACKEND PROTOCOL)
# ══════════════════════════════════════════════════════
def api_post(endpoint, payload):
    try:
        url = f"{API_BASE_URL}{endpoint}"
        r = requests.post(url, json=payload, timeout=8)
        return r.status_code in (200, 201), r.json()
    except Exception as e:
        return False, {"message": str(e)}

def api_get(endpoint):
    """GET from the Node.js backend. Returns (success, data)."""
    try:
        r = requests.get(f"{API_BASE_URL}{endpoint}", timeout=8)
        return r.status_code == 200, r.json()
    except requests.exceptions.ConnectionError:
        return False, {"message": "Cannot connect to AttendAI backend. Ensure Node.js server is active on port 5000."}
    except Exception as e:
        return False, {"message": str(e)}


# ══════════════════════════════════════════════════════
#  SESSION STATE
# ══════════════════════════════════════════════════════
if 'logged_in_user' not in st.session_state:
    st.session_state.logged_in_user = None

if 'current_page' not in st.session_state:
    st.session_state.current_page = "Login"

def switch_page(page_name):
    st.session_state.current_page = page_name
    st.rerun()


# ══════════════════════════════════════════════════════
#  SIDEBAR
# ══════════════════════════════════════════════════════
with st.sidebar:
    st.markdown("""
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
        <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #6366F1 0%, #A78BFA 100%);
                    display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: 800; color: white;">⚡</div>
        <div>
            <div style="color: white; font-size: 1.25rem; font-weight: 800; letter-spacing: -0.4px;">AttendAI</div>
            <div style="color: #94A3B8; font-size: 0.7rem; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;">Student Portal</div>
        </div>
    </div>
    <div style="height: 1px; background: rgba(255,255,255,0.08); margin-bottom: 20px;"></div>
    """, unsafe_allow_html=True)

    if st.session_state.logged_in_user is not None:
        user = st.session_state.logged_in_user
        st.write("🟢 **Authenticated As:**")
        st.markdown(f"""
        <div style='background-color:rgba(255,255,255,0.05); padding:14px; border-radius:12px;
                    margin-bottom:15px; border:1px solid rgba(255,255,255,0.1); border-left:4px solid #10B981;'>
            <strong style='color:#F1F5F9; font-size:1rem;'>{user['name']}</strong><br/>
            <span style='color:#94A3B8; font-size:0.85rem;'>PRN: {user['prn']}</span>
        </div>
        """, unsafe_allow_html=True)

        if st.button("🚪 Sign Out", use_container_width=True):
            st.session_state.logged_in_user = None
            st.session_state.current_page = "Login"
            st.toast("Signed out successfully!")
            st.rerun()
    else:
        st.write("Navigation:")
        if st.button("🔐 Student Authentication", use_container_width=True,
                     type="primary" if st.session_state.current_page == "Login" else "secondary"):
            switch_page("Login")
        if st.button("📝 Student Onboarding", use_container_width=True,
                     type="primary" if st.session_state.current_page == "Register" else "secondary"):
            switch_page("Register")

    st.markdown("<br/><br/>", unsafe_allow_html=True)
    st.markdown("""
    <div style='font-size:0.8rem; color:#94A3B8; text-align:center;'>
        <strong>AttendAI Student Portal</strong><br/>
        Smarter Attendance, Safer Tomorrow<br/>
        <span style='color:#10B981;'>● MySQL Biometric Link Active</span>
    </div>
    """, unsafe_allow_html=True)


# ══════════════════════════════════════════════════════
#  PAGE 1: STUDENT REGISTRATION
# ══════════════════════════════════════════════════════
if st.session_state.current_page == "Register" and st.session_state.logged_in_user is None:
    st.markdown("""
    <div class="header-container">
        <div class="header-title">Student Onboarding</div>
        <div class="header-subtitle">Enroll into AttendAI Automated Face Recognition System</div>
    </div>
    """, unsafe_allow_html=True)

    with st.form("registration_form"):
        st.markdown("##### 📝 Academic Profile Details")
        col1, col2 = st.columns(2)

        with col1:
            full_name  = st.text_input("Full Registered Name", placeholder="e.g., Rahul Patil").strip()
            prn_number = st.text_input("PRN / Roll Number", placeholder="e.g., 2026105",
                                       help="Must be alphanumeric").strip()
            email_id   = st.text_input("Institutional Email", placeholder="e.g., rahul@attendai.edu").strip()

        with col2:
            year       = st.selectbox("Academic Year", ["FE", "SE", "TE", "BE"], index=2)
            department = st.selectbox("Department", ["CSE", "IT", "AI&DS", "ECE", "Mechanical", "Civil"])
            division   = st.selectbox("Division / Section", ["A", "B", "C", "D"])

        submit_btn = st.form_submit_button("Complete Registration →", use_container_width=True, type="primary")

    if submit_btn:
        if not full_name or not prn_number or not email_id:
            st.error("All mandatory fields must be filled.")
        elif not prn_number.isalnum():
            st.error("PRN must be alphanumeric without spaces or symbols.")
        elif not re.match(r"[^@]+@[^@]+\.[^@]+", email_id):
            st.error("Please enter a valid email address.")
        else:
            success, data = api_post("/students/register", {
                "name"       : full_name,
                "prn"        : prn_number,
                "year"       : year,
                "department" : department,
                "division"   : division,
                "email"      : email_id,
            })

            if success:
                st.success(f"🎉 Registration Successful! Welcome {full_name}. Redirecting...")
                st.session_state.current_page = "Login"
                st.rerun()
            else:
                st.error(f"❌ {data.get('message', 'Registration failed.')}")

    st.markdown("<br/>", unsafe_allow_html=True)
    if st.button("Already Enrolled? Sign In Here", use_container_width=True):
        switch_page("Login")


# ══════════════════════════════════════════════════════
#  PAGE 2: STUDENT LOGIN
# ══════════════════════════════════════════════════════
elif st.session_state.current_page == "Login" and st.session_state.logged_in_user is None:
    st.markdown("""
    <div class="header-container">
        <div class="header-title">Student Sign In</div>
        <div class="header-subtitle">Secure Access to Your Biometric Attendance Record</div>
    </div>
    """, unsafe_allow_html=True)

    with st.form("login_form"):
        st.markdown("##### 🔑 Enter Identity Verification")
        login_name = st.text_input("Registered Full Name", placeholder="e.g. Prajakta or Rahul Patil").strip()
        login_prn  = st.text_input("PRN / Roll Number", type="password", placeholder="Enter your PRN").strip()
        login_submit = st.form_submit_button("Authenticate Securely →", use_container_width=True, type="primary")

    if login_submit:
        if not login_name or not login_prn:
            st.error("Please enter both Name and PRN.")
        else:
            success, data = api_post("/students/login", {"name": login_name, "prn": login_prn})
            if success and data.get("success"):
                st.session_state.logged_in_user = data["student"]
                st.toast(f"Welcome back, {data['student']['name']}!", icon="👋")
                st.rerun()
            else:
                st.error(f"❌ {data.get('message', 'Authentication failed. Please verify credentials.')}")

    st.markdown("<br/>", unsafe_allow_html=True)
    if st.button("Need to Register? Create Student Account", use_container_width=True):
        switch_page("Register")


# ══════════════════════════════════════════════════════
#  PAGE 3: STUDENT DASHBOARD
# ══════════════════════════════════════════════════════
elif st.session_state.logged_in_user is not None:
    user = st.session_state.logged_in_user

    st.markdown(f"""
    <div class="header-container">
        <div class="header-title">Welcome back, {user['name']}!</div>
        <div class="header-subtitle">PRN: {user['prn']} • {user['department']} (Year: {user['year']} - Div {user['division']})</div>
    </div>
    """, unsafe_allow_html=True)

    success, dash_data = api_get(f"/students/{user['prn']}/dashboard")
    if not success:
        st.error(f"Could not load dashboard: {dash_data.get('message')}")
        st.stop()

    att           = dash_data["attendance"]
    att_pct       = float(att["attendance_percentage"])
    present_days  = att["days_present"]
    status_label  = att["status"]
    logs          = att["logs"]
    is_short      = att_pct < 75.0
    status_color  = "#EF4444" if is_short else "#10B981"

    if is_short:
        st.markdown(f"""
        <div class="warning-card">
            <div class="warning-title">⚠️ Short Attendance Escalation Alert</div>
            Your attendance percentage of <strong>{att_pct}%</strong> is below the university-mandated threshold of <strong>75%</strong>.
            Please attend remaining scheduled lectures to ensure examination clearance.
        </div>
        """, unsafe_allow_html=True)

    # Metric Cards
    c1, c2, c3 = st.columns(3)
    with c1:
        st.markdown(f"""
        <div class="info-card" style="text-align:center;">
            <div style="font-size:0.82rem; color:#64748B; font-weight:700; text-transform:uppercase;">Attendance Rate</div>
            <div style="font-size:2.2rem; font-weight:800; color:{status_color}; margin:6px 0;">{att_pct}%</div>
            <div style="font-size:0.78rem; color:#94A3B8;">Mandatory: 75.0%</div>
        </div>
        """, unsafe_allow_html=True)
    with c2:
        st.markdown(f"""
        <div class="info-card" style="text-align:center;">
            <div style="font-size:0.82rem; color:#64748B; font-weight:700; text-transform:uppercase;">Days Present</div>
            <div style="font-size:2.2rem; font-weight:800; color:#4F46E5; margin:6px 0;">{present_days} <span style="font-size:1.1rem; color:#94A3B8;">/ {TOTAL_WORKING_DAYS}</span></div>
            <div style="font-size:0.78rem; color:#94A3B8;">Total Working Days</div>
        </div>
        """, unsafe_allow_html=True)
    with c3:
        st.markdown(f"""
        <div class="info-card" style="text-align:center;">
            <div style="font-size:0.82rem; color:#64748B; font-weight:700; text-transform:uppercase;">Compliance Status</div>
            <div style="font-size:1.6rem; font-weight:800; color:{status_color}; margin:12px 0;">{status_label}</div>
            <div style="font-size:0.78rem; color:#94A3B8;">University Standard</div>
        </div>
        """, unsafe_allow_html=True)

    st.progress(float(att_pct) / 100.0)

    # Detailed Log
    st.markdown("##### 📅 Biometric Log Journal")
    if logs:
        df_logs = pd.DataFrame(logs)
        df_logs.index = df_logs.index + 1
        st.dataframe(df_logs, use_container_width=True)
    else:
        st.info("No attendance logged yet. Attendance is marked automatically when recognized by the camera.")
else:
    st.session_state.current_page = "Login"
    st.rerun()
